# 🤖 AGENTS.md — Agent Definitions

> An **agent** is an autonomous unit with a single responsibility. Each agent owns one or more skills, manages its own retry logic, and reports results back to the Orchestrator. Agents can run in parallel when their inputs are independent.

---

## Agent Index

| # | Agent | Role | Skills Used | Runs When |
|---|-------|------|-------------|-----------|
| 1 | **VinDecoderAgent** | Decode any VIN into structured vehicle data | `decodeVinSkill` | Always (first) |
| 2 | **PersonalityClassifierAgent** | Profile the buyer's personality archetype | `classifyPersonalitySkill` | Always (parallel w/ #1) |
| 3 | **SalesMatchmakerAgent** | Match buyer to the ideal salesperson | `matchSalespersonSkill` | After #2 completes |
| 4 | **SalesPitchAgent** | Write a tailored sales pitch | `generateSalesPitchSkill` | After #1 and #2 complete |
| 5 | **ListingAgent** | Generate a vehicle marketplace listing | `buildListingSkill` | On demand |
| 6 | **OrchestratorAgent** | Route directives, spawn agents, aggregate results | *all (indirectly)* | Always (entry point) |

---

## 1. VinDecoderAgent

**Goal**: Turn a raw VIN string into a rich `VehicleData` object.

**Skills**: `decodeVinSkill`

**Behavior**:
```
RECEIVE vin string
  → VALIDATE format (17 chars, check digit)
  → CALL decodeVinSkill(vin)
  → IF confidence < 50%
      → FLAG for manual review
      → RETURN partial data with warning
  → ELSE
      → RETURN VehicleData
  → ON ERROR
      → RETRY 3× with backoff
      → IF still failing → RETURN error artifact
```

**Input**: `{ vin: string, modelYear?: number }`

**Output**: `VehicleData` (see [SKILLS.md](SKILLS.md#1-decodevinskill))

**SLA**: < 2 seconds (NHTSA API is fast; ~200ms typical)

📖 **Deep dive**: [pages/agents/vin-decoder-agent.md](pages/agents/vin-decoder-agent.md)

---

## 2. PersonalityClassifierAgent

**Goal**: Determine the buyer's personality type from conversational input.

**Skills**: `classifyPersonalitySkill`

**Behavior**:
```
RECEIVE buyer answers (3-5 questions) + optional observed cues
  → VALIDATE at least 3 answers provided
  → CALL classifyPersonalitySkill(answers, cues)
  → IF confidence < 60%
      → ASK one follow-up question to disambiguate
      → RE-CLASSIFY with additional data
  → RETURN PersonalityProfile
```

**Input**: `{ answers: QuestionAnswer[], observedCues?: string[] }`

**Output**: `PersonalityProfile`

**SLA**: < 3 seconds (Gemini inference)

**Important Notes**:
- This agent runs **in parallel** with VinDecoderAgent — they don't depend on each other
- If buyer answers are too vague, the agent generates a targeted follow-up question
- The agent never guesses — if confidence stays below 40% after follow-up, it returns type `"Friendly"` as the safe default (most versatile pitch style)

📖 **Deep dive**: [pages/agents/personality-classifier.md](pages/agents/personality-classifier.md)

---

## 3. SalesMatchmakerAgent

**Goal**: Select the best salesperson for this specific buyer.

**Skills**: `matchSalespersonSkill`

**Behavior**:
```
RECEIVE buyerProfile + salesperson roster
  → FILTER roster to available reps only
  → IF no reps available
      → RETURN "all hands busy" with ETA
  → CALL matchSalespersonSkill(profile, filteredRoster)
  → GENERATE handoff script
  → RETURN SalespersonMatch
```

**Input**: `{ buyerProfile: PersonalityProfile, roster: Salesperson[] }`

**Output**: `SalespersonMatch`

**SLA**: < 500ms (local computation, no external API)

**Dependencies**: Must wait for PersonalityClassifierAgent to complete.

📖 **Deep dive**: [pages/agents/sales-matchmaker.md](pages/agents/sales-matchmaker.md)

---

## 4. SalesPitchAgent

**Goal**: Generate a complete, personality-aware sales pitch with talking points and objection handlers.

**Skills**: `generateSalesPitchSkill`

**Behavior**:
```
RECEIVE vehicleData + personalityProfile + optional dealerContext
  → VALIDATE both inputs are present and complete
  → CONSTRUCT prompt with vehicle specs + personality rules
  → CALL generateSalesPitchSkill(vehicle, personality, context)
  → VALIDATE output has all required fields
  → IF pitch is too generic (heuristic check)
      → REGENERATE with stronger personality emphasis
  → RETURN SalesPitch
```

**Input**: `{ vehicle: VehicleData, personality: PersonalityProfile, dealerContext?: DealerContext }`

**Output**: `SalesPitch`

**SLA**: < 5 seconds (Gemini inference with structured output)

**Dependencies**: Must wait for **both** VinDecoderAgent and PersonalityClassifierAgent.

**Quality Gates**:
- Pitch must reference at least 2 specific vehicle specs
- Pitch must use language matching the buyer's archetype
- At least 3 talking points must be generated
- At least 2 objection handlers must be included

📖 **Deep dive**: [pages/agents/sales-pitch-agent.md](pages/agents/sales-pitch-agent.md)

---

## 5. ListingAgent

**Goal**: Generate a marketplace-ready vehicle listing.

**Skills**: `buildListingSkill`

**Behavior**:
```
RECEIVE vehicleData + optional photos + optional sellerNotes
  → CALL buildListingSkill(vehicle, photos, notes)
  → IF missing critical photos
      → GENERATE missingPhotoSuggestions
  → FORMAT for target platform
  → RETURN VehicleListing
```

**Input**: `{ vehicle: VehicleData, photos?: string[], sellerNotes?: string, platform?: string }`

**Output**: `VehicleListing`

**SLA**: < 4 seconds

**Dependencies**: VinDecoderAgent only — no personality data needed.

**Trigger**: Only runs when the directive explicitly requests a listing (e.g., "Build a listing for this vehicle").

📖 **Deep dive**: [pages/agents/listing-agent.md](pages/agents/listing-agent.md)

---

## 6. OrchestratorAgent (Master)

**Goal**: Parse user directives, spawn the right agents in the right order, handle failures, and aggregate the final deliverable.

**Skills**: *None directly* — it coordinates other agents.

**Behavior**:
```
RECEIVE directive from user
  → PARSE directive to determine required agents
  → PLAN execution graph:
      Phase 1 (parallel): VinDecoderAgent + PersonalityClassifierAgent
      Phase 2 (sequential): SalesMatchmakerAgent (needs Phase 1.2)
      Phase 3 (sequential): SalesPitchAgent (needs Phase 1.1 + 1.2)
      Phase 4 (conditional): ListingAgent (only if requested)
  → EXECUTE phases
  → FOR each agent result:
      IF success → collect artifact
      IF failure → apply fallback (see DOE/Execute.md)
  → AGGREGATE all artifacts into final SalesBrief
  → RETURN SalesBrief to user
```

### Execution Timeline

```
Time  0s ──────── 2s ──────── 3s ──────── 5s ──────── 8s
      │           │           │           │           │
      ├─ VinDecoder ──────┤   │           │           │
      │   (NHTSA call)     │   │           │           │
      │                    │   │           │           │
      ├─ PersonalityClass ─────┤           │           │
      │   (Gemini call)        │           │           │
      │                        │           │           │
      │                        ├─ Matchmaker ┤         │
      │                        │  (local)     │         │
      │                        │              │         │
      │                        ├── PitchAgent ──────────┤
      │                        │   (Gemini call)        │
      │                                                 │
      │                        Total: ~5-8 seconds      │
```

### Final Output: `SalesBrief`

```typescript
interface SalesBrief {
  directive: string;            // original user request
  vehicle: VehicleData;         // from VinDecoderAgent
  buyerProfile: PersonalityProfile; // from PersonalityClassifierAgent
  salespersonMatch: SalespersonMatch; // from SalesMatchmakerAgent
  pitch: SalesPitch;            // from SalesPitchAgent
  listing?: VehicleListing;     // from ListingAgent (if requested)
  metadata: {
    totalTimeMs: number;
    agentsRun: string[];
    errors: string[];
    timestamp: string;
  };
}
```

📖 **Deep dive**: [pages/agents/orchestrator-agent.md](pages/agents/orchestrator-agent.md)

---

## Agent Communication Pattern

Agents don't talk to each other directly. All communication flows through the Orchestrator:

```
User Directive
      │
      ▼
┌─────────────────┐
│ OrchestratorAgent│
│                  │
│  ┌──────────┐   │      ┌───────────────┐
│  │ Phase 1   │───┼─────▶│VinDecoderAgent│──── VehicleData
│  │ (parallel)│   │      └───────────────┘          │
│  │           │───┼─────▶┌────────────────────┐     │
│  └──────────┘   │      │PersonalityClassifier│     │
│                  │      └────────────────────┘     │
│  ┌──────────┐   │               │                  │
│  │ Phase 2   │◀──┼───────────────┘                  │
│  │           │───┼─────▶┌──────────────────┐        │
│  └──────────┘   │      │SalesMatchmaker   │        │
│                  │      └──────────────────┘        │
│  ┌──────────┐   │               │                   │
│  │ Phase 3   │◀──┼───────────────┤───────────────────┘
│  │           │───┼─────▶┌───────────────┐
│  └──────────┘   │      │SalesPitchAgent│──── SalesPitch
│                  │      └───────────────┘
│  ┌──────────┐   │
│  │ Aggregate │   │──── SalesBrief ──▶ User
│  └──────────┘   │
└─────────────────┘
```
