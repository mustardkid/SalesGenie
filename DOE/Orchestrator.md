# 🧠 Orchestrator — The "How"

> The Orchestrator is the brain of SalesGenie. It reads directives, decides which agents to run, manages dependencies, handles failures, and assembles the final output.

---

## Core Rule Engine

The Orchestrator operates on a simple **conditional rule engine**:

```
IF VIN is valid AND Personality is identified (or preset)
  THEN invoke SalesPitchAgent with VehicleData + PersonalityProfile

IF VIN is valid AND Personality is identified AND match requested
  THEN invoke SalesMatchmakerAgent before SalesPitchAgent

IF VIN is valid AND listing requested
  THEN invoke ListingAgent (can run parallel with Pitch if personality is not needed)

IF VIN is invalid (< 17 chars, bad check digit)
  THEN HALT → return INVALID_VIN error immediately

IF VIN decode confidence < 80%
  THEN generate HUMAN_REVIEW artifact → continue with warning

IF Personality confidence < 40%
  THEN default to "Friendly" → continue with WARNING flag
```

---

## Orchestrator Responsibilities

1. **Parse** — Extract intent and inputs from the directive
2. **Validate** — Check VIN format, buyer data completeness
3. **Gate** — Apply confidence thresholds before proceeding
4. **Plan** — Build a directed acyclic graph (DAG) of agents
5. **Route** — Dispatch agents in the correct order (parallel where possible)
6. **Monitor** — Track agent progress, enforce timeouts
7. **Retry** — Apply fallback logic on failures
8. **Aggregate** — Combine all agent outputs into a single deliverable
9. **Deliver** — Return the result to the user

---

## Decision Engine — Step by Step

### Step 1: Parse the Directive

Extract structured intent from natural language:

```typescript
function parseDirective(input: string): ParsedDirective {
  return {
    hasVin: /[A-HJ-NPR-Z0-9]{17}/i.test(input),
    hasBuyerData: /personality|buyer|profile|answers|cues|classify/i.test(input) ||
                  extractPresetPersonality(input) !== null,
    wantsPitch: /pitch|sell|brief|sales|generate/i.test(input) ||
                !(/listing only|decode only|profile only/i.test(input)),
    wantsMatch: /match|rep|salesperson|who should/i.test(input),
    wantsListing: /listing|post|marketplace|autotrader|craigslist|facebook/i.test(input),
    presetPersonality: extractPresetPersonality(input),
    vin: extractVin(input),
    buyerAnswers: [],
  };
}
```

### Step 2: Validate Inputs

```
IF parsed.hasVin:
  validation = validateVin(parsed.vin)
  IF NOT validation.valid:
    RETURN { error: 'INVALID_VIN', message: validation.error }

IF parsed.hasBuyerData AND NOT parsed.presetPersonality:
  IF buyerAnswers.length < 3:
    RETURN { error: 'INSUFFICIENT_DATA', message: 'Need at least 3 buyer answers' }

IF NOT parsed.hasVin AND NOT parsed.hasBuyerData:
  RETURN { error: 'NO_INPUT', message: 'I need a VIN or buyer info to work with' }
```

### Step 3: Apply Confidence Gates

These gates run **after** Phase 1 agents complete:

```
AFTER VinDecoderAgent completes:
  IF vehicleData.confidence < 50:
    GENERATE artifact: HUMAN_REVIEW
    FLAG: "VIN decode confidence is ${confidence}% — manual review recommended"
    CONTINUE with partial data (do not halt)
  
  IF vehicleData.confidence >= 50 AND < 80:
    FLAG: "Low confidence decode — verify vehicle details"
    CONTINUE normally

AFTER PersonalityClassifierAgent completes:
  IF profile.confidence < 40:
    OVERRIDE profile = default("Friendly")
    FLAG: "Personality confidence too low — defaulting to Friendly"
  
  IF profile.confidence >= 40 AND < 60:
    GENERATE follow-up question
    RE-RUN classifier with additional answer
    IF still < 40: default to "Friendly"
```

### Step 4: Build the Execution Graph

```typescript
function buildExecutionGraph(parsed: ParsedDirective): ExecutionPhase[] {
  const phases: ExecutionPhase[] = [];

  // Phase 1: Parallel data gathering (VIN + Personality are independent)
  const phase1: AgentTask[] = [];
  if (parsed.hasVin) {
    phase1.push({ agent: 'VinDecoderAgent', input: { vin: parsed.vin } });
  }
  if (parsed.hasBuyerData && !parsed.presetPersonality) {
    phase1.push({ agent: 'PersonalityClassifierAgent', input: { answers: parsed.buyerAnswers } });
  }
  if (phase1.length > 0) phases.push({ parallel: true, tasks: phase1 });

  // Phase 2: Matchmaker (depends on PersonalityProfile)
  if (parsed.wantsMatch) {
    phases.push({
      parallel: false,
      tasks: [{ agent: 'SalesMatchmakerAgent', input: 'FROM_PERSONALITY_CLASSIFIER' }],
    });
  }

  // Phase 3: Pitch (depends on VehicleData + PersonalityProfile)
  if (parsed.wantsPitch) {
    phases.push({
      parallel: false,
      tasks: [{ agent: 'SalesPitchAgent', input: 'FROM_VIN_DECODER + FROM_PERSONALITY_CLASSIFIER' }],
    });
  }

  // Phase 4: Listing (depends on VehicleData only — conditional)
  if (parsed.wantsListing) {
    phases.push({
      parallel: false,
      tasks: [{ agent: 'ListingAgent', input: 'FROM_VIN_DECODER' }],
    });
  }

  return phases;
}
```

### Step 5: Execute Phases

```
Phase 1 ─── Parallel ──────────────────────────────────────┐
│                                                           │
├─ VinDecoderAgent        → VehicleData                    │
│  (NHTSA API — ~200ms)   [IF confidence < 80% → WARN]    │
│                                                           │
├─ PersonalityClassifier  → PersonalityProfile             │
│  (Gemini AI — ~2s)      [IF confidence < 60% → FOLLOWUP]│
│                                                           │
└───────────────────────────────────────────────────────────┘
           │
           ▼
Phase 2 ─── Sequential ─── IF (wantsMatch AND personalityProfile exists):
│                           SalesMatchmakerAgent → SalespersonMatch
│                           (local computation — ~50ms)
│
           ▼
Phase 3 ─── Sequential ─── IF (wantsPitch AND vehicleData AND personalityProfile):
│                           SalesPitchAgent → SalesPitch
│                           (Gemini AI — ~3-5s)
│                           [Quality gates: ≥3 talking points, ≥2 objection handlers]
│
           ▼
Phase 4 ─── Conditional ── IF (wantsListing AND vehicleData):
│                           ListingAgent → VehicleListing
│                           (Gemini AI — ~3s)
│
           ▼
       AGGREGATE → SalesBrief
```

---

## Conditional Routing Rules

| # | Condition | Action |
|---|-----------|--------|
| R1 | VIN provided | Run VinDecoderAgent |
| R2 | VIN provided + no buyer data | VIN decode only → return VehicleData |
| R3 | VIN + buyer data (Q&A) | Run VIN + Personality **in parallel** |
| R4 | VIN + preset personality (e.g., "they're Analytical") | Run VIN only; **skip** PersonalityClassifier; use preset |
| R5 | "match" keyword detected | Include SalesMatchmakerAgent (after personality) |
| R6 | "pitch" keyword OR default intent | Include SalesPitchAgent (after VIN + personality) |
| R7 | "listing" keyword detected | Include ListingAgent (after VIN) |
| R8 | No VIN + no buyer data | Return error: "I need a VIN or buyer info to work with" |
| R9 | VIN decode confidence < 80% | Generate `HUMAN_REVIEW` artifact; continue with warning |
| R10 | Personality confidence < 40% | Default to "Friendly"; continue with warning |

---

## Timeout Management

| Agent | Timeout | On Timeout | Retry |
|-------|---------|------------|-------|
| VinDecoderAgent | 5s | Retry with exponential backoff | 3× (0ms, 500ms, 1500ms) |
| PersonalityClassifierAgent | 8s | Retry once, then default to "Friendly" | 1× |
| SalesMatchmakerAgent | 2s | Skip matching; return "any available rep" | 0 (local) |
| SalesPitchAgent | 10s | Retry once; return generic pitch template on failure | 1× |
| ListingAgent | 8s | Retry once; return partial listing (title + specs) | 1× |

---

## Error Handling Matrix

```
┌────────────────────┬──────────────────────────┬──────────────────────────────┐
│ Error Type          │ First Response            │ Fallback                      │
├────────────────────┼──────────────────────────┼──────────────────────────────┤
│ INVALID_VIN        │ Return error immediately  │ Ask user to re-enter VIN      │
│ NHTSA API down     │ Retry 3× w/ backoff       │ Prompt for manual vehicle data│
│ VIN confidence <50 │ Generate HUMAN_REVIEW     │ Continue w/ partial data      │
│ VIN confidence <80 │ Show LOW_CONFIDENCE warn  │ Continue normally             │
│ Gemini overloaded  │ Retry 2× w/ backoff       │ Queue for async delivery      │
│ Personality < 40%  │ Default to "Friendly"     │ Use safest archetype + flag   │
│ Personality < 60%  │ Ask follow-up question    │ Re-classify with addl. answer │
│ No roster provided │ Skip matchmaker           │ Return pitch without rep match│
│ Pitch fails quality│ Regenerate up to 2×       │ Return best attempt + warning │
│ All agents fail    │ Log full error chain       │ Graceful degradation message  │
└────────────────────┴──────────────────────────┴──────────────────────────────┘
```

---

## Parallel Execution Strategy

```typescript
async function executePhase(phase: ExecutionPhase): Promise<AgentResult[]> {
  if (phase.parallel) {
    // Run all tasks simultaneously — VIN + Personality are independent
    return Promise.allSettled(
      phase.tasks.map(task => runAgent(task.agent, task.input))
    );
  } else {
    // Run sequentially — each task uses previous results
    const results: AgentResult[] = [];
    for (const task of phase.tasks) {
      results.push(await runAgent(task.agent, task.input));
    }
    return results;
  }
}
```

### Why Parallel Matters

```
Without parallelism: 2s (VIN) + 3s (personality) + 0.5s (match) + 5s (pitch) = 10.5s
With parallelism:   3s (VIN ∥ personality) + 0.5s (match) + 5s (pitch) = 8.5s

→ 20% speed improvement from running Phase 1 in parallel
```

---

## Orchestrator Decision Tree

```
                         START
                           │
                    Has VIN? ───── No ───── Has buyer data?
                      │                        │
                     Yes                      Yes → Run Personality only
                      │                       No → ERROR: Nothing to do
                      │
               Has buyer data?
                  │         │
                 Yes        No
                  │          │
         ┌────────┴───┐    Run VIN only
         │ PARALLEL   │    return VehicleData
         │ Phase 1    │
         │ VIN + Pers │
         └────────┬───┘
                  │
           ┌──────┴──────┐
           │ CONFIDENCE  │
           │ GATES       │
           │ VIN ≥ 80%?  │──No──→ Generate HUMAN_REVIEW artifact
           │ Pers ≥ 60%? │──No──→ Ask follow-up / default Friendly
           └──────┬──────┘
                  │
           Wants match?
             │       │
            Yes      No
             │       │
        Run Matchmaker │
             │       │
             └───┬───┘
                 │
          Run PitchAgent
                 │
          Wants listing?
             │       │
            Yes      No
             │       │
        Run ListingAgent │
             │       │
             └───┬───┘
                 │
           AGGREGATE
                 │
            DELIVER
```

---

## State Management

The Orchestrator maintains a session state object throughout the execution:

```typescript
interface OrchestratorState {
  sessionId: string;           // unique per directive
  directive: string;           // original user input
  parsed: ParsedDirective;     // extracted intent + data
  phases: ExecutionPhase[];    // planned execution graph
  results: {
    vehicleData?: VehicleData;
    personalityProfile?: PersonalityProfile;
    salespersonMatch?: SalespersonMatch;
    salesPitch?: SalesPitch;
    vehicleListing?: VehicleListing;
  };
  confidenceGates: {
    vinConfidence: number;
    personalityConfidence: number;
    humanReviewTriggered: boolean;
    followUpAsked: boolean;
  };
  errors: AgentError[];
  startTime: number;
  status: 'parsing' | 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'aggregating' | 'complete' | 'failed';
}
```

---

## Aggregation Logic

Once all phases complete, the Orchestrator assembles the final output:

```typescript
function aggregate(state: OrchestratorState): SalesBrief {
  return {
    directive: state.directive,
    vehicle: state.results.vehicleData!,
    buyerProfile: state.results.personalityProfile!,
    salespersonMatch: state.results.salespersonMatch!,
    pitch: state.results.salesPitch!,
    listing: state.results.vehicleListing,
    metadata: {
      totalTimeMs: Date.now() - state.startTime,
      agentsRun: state.phases.flatMap(p => p.tasks.map(t => t.agent)),
      errors: state.errors.map(e => e.error),
      timestamp: new Date().toISOString(),
    },
  };
}
```
