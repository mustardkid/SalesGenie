# 🎯 OrchestratorAgent — Deep Dive

> The master agent. Parses directives, spawns agents, manages execution, handles failures, and delivers results.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OrchestratorAgent                             │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  PARSE    │→│   PLAN    │→│  EXECUTE  │→│ AGGREGATE │→ SalesBrief│
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│       │              │             │              │                  │
│       ▼              ▼             ▼              ▼                  │
│  Extract VIN    Build DAG     Run phases     Combine all            │
│  Extract Q&A    of agents     in order       agent outputs          │
│  Detect intent  Plan parallel Handle errors  Add metadata           │
│                  execution    Apply fallbacks                        │
└─────────────────────────────────────────────────────────────────────┘
```

## The Orchestrator Never Calls Skills Directly

This is a critical architectural principle. The Orchestrator:

- ✅ Spawns agents
- ✅ Passes data between agents
- ✅ Handles errors and retries
- ✅ Aggregates results
- ❌ Never calls NHTSA API directly
- ❌ Never calls Gemini directly
- ❌ Never does matching logic directly

This separation means agents are independently testable and replaceable.

## Execution Phases

```
Phase 0: PARSE
  ↓ Extract VIN, buyer data, intent from natural language directive

Phase 1: GATHER (parallel)
  ├─ VinDecoderAgent      ─── runs independently ──→ VehicleData
  └─ PersonalityClassifier ─── runs independently ──→ PersonalityProfile
  ↓ Wait for both to complete (Promise.all)

Phase 2: MATCH (sequential)
  └─ SalesMatchmakerAgent ─── needs PersonalityProfile ──→ SalespersonMatch
  ↓

Phase 3: GENERATE (sequential)
  └─ SalesPitchAgent ─── needs VehicleData + PersonalityProfile ──→ SalesPitch
  ↓

Phase 4: OPTIONAL (conditional)
  └─ ListingAgent ─── needs VehicleData only ──→ VehicleListing
  ↓

Phase 5: AGGREGATE
  └─ Combine all results into SalesBrief
```

## Graceful Degradation

If any agent fails, the Orchestrator doesn't abort — it degrades gracefully:

| Agent Failure | Impact on Output |
|---------------|-----------------|
| VinDecoderAgent fails | No vehicle data → prompt user for manual entry |
| PersonalityClassifier fails | Default to "Friendly" → pitch will be warm/safe |
| SalesMatchmaker fails | No rep match → "Any available rep" |
| SalesPitchAgent fails | Generic pitch template with vehicle specs |
| ListingAgent fails | Partial listing (title + basic specs) |

**Minimum viable output**: Even if VIN decode + personality both fail, the Orchestrator returns a generic sales template rather than nothing.

## State Object

The Orchestrator maintains state throughout the session:

```typescript
interface OrchestratorState {
  sessionId: string;           // unique per directive
  directive: string;           // original user input
  parsed: ParsedDirective;     // extracted intent + data
  phases: ExecutionPhase[];    // planned execution graph
  results: Partial<{
    vehicleData: VehicleData;
    personalityProfile: PersonalityProfile;
    salespersonMatch: SalespersonMatch;
    salesPitch: SalesPitch;
    vehicleListing: VehicleListing;
  }>;
  errors: AgentError[];        // collected errors
  startTime: number;           // for total timing
  status: 'parsing' | 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'aggregating' | 'complete' | 'failed';
}
```

## Logging & Observability

Every Orchestrator run produces a structured log:

```json
{
  "sessionId": "sess_abc123",
  "directive": "Full sales brief for VIN 3C6UR5FL1KG501234",
  "phases": [
    { "phase": 1, "agents": ["VinDecoder", "PersonalityClassifier"], "parallel": true, "durationMs": 2100 },
    { "phase": 2, "agents": ["SalesMatchmaker"], "parallel": false, "durationMs": 45 },
    { "phase": 3, "agents": ["SalesPitch"], "parallel": false, "durationMs": 3500 }
  ],
  "totalDurationMs": 5645,
  "agentsRun": 4,
  "agentsFailed": 0,
  "status": "complete"
}
```
