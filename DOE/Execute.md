# ⚡ Execute — The "Do"

> Execute is where the rubber meets the road. Each agent runs its skill, handles edge cases, and returns a structured result. This document defines the **exact sequence of agent handoffs** from directive intake to final delivery.

---

## Execution Philosophy

1. **Fail fast, fall back gracefully** — If an agent can't do its job, don't block the pipeline. Return what you can and let the Orchestrator decide.
2. **Validate inputs before calling APIs** — Don't waste API calls on bad data.
3. **Gate on confidence** — If confidence < 80% on VIN decode, generate a `HUMAN_REVIEW` artifact before proceeding.
4. **Always return structured output** — Even on failure, return a typed object with an error field.
5. **Log everything** — Every agent execution is logged for debugging and analytics.

---

## End-to-End Execution Sequence

### Full Sales Brief (D-001) — The Flagship Flow

```
TIME    STEP    AGENT                       ACTION
─────   ─────   ──────────────────────────  ─────────────────────────────────────
 0ms    0.1     Orchestrator                RECEIVE directive string
 0ms    0.2     Orchestrator                PARSE → extract VIN, personality, intent
 1ms    0.3     Orchestrator                VALIDATE VIN format (17 chars, no I/O/Q)
                                             IF invalid → HALT with INVALID_VIN error
 2ms    0.4     Orchestrator                BUILD execution graph (Phase 1–4)

───── PHASE 1: PARALLEL DATA GATHERING ──────────────────────────────────────────

 5ms    1.1a    VinDecoderAgent             START (parallel)
 5ms    1.1b    PersonalityClassifierAgent  START (parallel)

        1.1a    VinDecoderAgent             CALL NHTSA DecodeVinValuesExtended
                                             GET https://vpic.nhtsa.dot.gov/api
                                               /vehicles/DecodeVinValuesExtended
                                               /{VIN}?format=json
                                             ON timeout → retry 3× (0ms, 500ms, 1500ms)
                                             ON success → MAP NHTSA fields to VehicleData
                                             CALCULATE confidence score:
                                               - Missing Make/Model/Year: -25 each
                                               - Missing Trim/Body/Drive/Engine: -10 each
                                               - Missing MSRP/HP/Wheelbase: -3 each
                                               - ErrorCode ≠ "0": -20
                                             
                                             CONFIDENCE GATE:
                                               IF confidence < 50%:
                                                 → GENERATE artifact: HUMAN_REVIEW
                                                 → RETURN partial data with WARNING flag
                                               IF confidence 50-79%:
                                                 → RETURN data with LOW_CONFIDENCE flag
                                               IF confidence ≥ 80%:
                                                 → RETURN VehicleData (clean)

        1.1b    PersonalityClassifierAgent  VALIDATE: answers.length ≥ 3
                                             IF preset personality provided:
                                               → SKIP Gemini call
                                               → BUILD profile from preset templates
                                               → RETURN with confidence: 90
                                             ELSE:
                                               → BUILD Gemini prompt with DISC rules
                                               → CALL Gemini (gemini-2.5-flash)
                                               → STRIP markdown fences from response
                                               → JSON.parse() → PersonalityProfile
                                             
                                             CONFIDENCE GATE:
                                               IF confidence < 40%:
                                                 → DEFAULT to "Friendly" with WARNING
                                               IF confidence 40-59%:
                                                 → GENERATE targeted follow-up question
                                                 → RE-CLASSIFY with additional data
                                                 → IF still < 40% → default "Friendly"
                                               IF confidence ≥ 60%:
                                                 → RETURN PersonalityProfile (clean)

~2.5s   1.2     Orchestrator                AWAIT Promise.all([VinDecoder, PersonalityClassifier])
                                             COLLECT: VehicleData + PersonalityProfile
                                             LOG phase 1 timing + confidence scores

───── PHASE 2: SALESPERSON MATCHING ─────────────────────────────────────────────

~2.5s   2.1     Orchestrator                CHECK: wantsMatch? AND personalityProfile exists?
                                             IF NO → SKIP to Phase 3

~2.5s   2.2     SalesMatchmakerAgent        RECEIVE buyerProfile + roster[]
                                             FILTER roster → available reps only
                                             IF no reps available:
                                               → RETURN { allBusy: true, eta: "15 min" }
                                             
                                             FOR EACH available rep:
                                               personalityFit = overlap(buyer.primary,
                                                 rep.strengths) × 0.45
                                               specialtyMatch = categoryMatch(vehicle,
                                                 rep.specialties) × 0.25
                                               closeRate = rep.closeRate/100 × 0.20
                                               loadPenalty = loadScore(rep) × 0.10
                                               totalScore = pFit + sFit + cRate - lPen
                                             
                                             RANK by totalScore DESC
                                             SELECT best match
                                             GENERATE handoff script (personality-matched)
                                             RETURN SalespersonMatch

~2.6s   2.3     Orchestrator                COLLECT: SalespersonMatch
                                             LOG phase 2 timing + match score

───── PHASE 3: PITCH GENERATION ─────────────────────────────────────────────────

~2.6s   3.1     Orchestrator                CHECK: wantsPitch? AND vehicleData? AND personalityProfile?
                                             IF NO → SKIP to Phase 4

~2.6s   3.2     SalesPitchAgent             RECEIVE vehicleData + personalityProfile + dealerContext
                                             VALIDATE: both required inputs present
                                             
                                             BUILD Gemini prompt:
                                               → Inject vehicle specs (year, make, model, etc.)
                                               → Inject personality rules (PERSONALITY_RULES[type])
                                               → Inject dealer context (promos, days on lot)
                                               → Inject output schema (headline, pitch, etc.)
                                             
                                             CALL Gemini (gemini-2.5-flash)
                                             STRIP markdown fences
                                             JSON.parse() → SalesPitch
                                             
                                             QUALITY GATES:
                                               ☐ talkingPoints.length ≥ 3
                                               ☐ objectionHandlers.length ≥ 2
                                               ☐ pitch sentences ≈ 5
                                               ☐ personality-specific language present
                                               ☐ ≥ 2 vehicle specs referenced
                                             
                                             IF gates fail AND attempts < 3:
                                               → LOG issues
                                               → REGENERATE with stronger personality emphasis
                                             IF gates fail AND attempts = 3:
                                               → RETURN best attempt with quality_warning
                                             IF gates pass:
                                               → RETURN SalesPitch

~6.5s   3.3     Orchestrator                COLLECT: SalesPitch
                                             LOG phase 3 timing + quality gate results

───── PHASE 4: LISTING (CONDITIONAL) ────────────────────────────────────────────

~6.5s   4.1     Orchestrator                CHECK: wantsListing? AND vehicleData?
                                             IF NO → SKIP to Aggregate

~6.5s   4.2     ListingAgent                RECEIVE vehicleData + photos? + sellerNotes? + platform?
                                             ASSESS photo coverage → missingPhotoSuggestions
                                             BUILD Gemini prompt for target platform
                                             CALL Gemini → VehicleListing
                                             FORMAT output for platform (AutoTrader, FB, etc.)
                                             RETURN VehicleListing

~8.5s   4.3     Orchestrator                COLLECT: VehicleListing
                                             LOG phase 4 timing

───── AGGREGATE + DELIVER ───────────────────────────────────────────────────────

~8.5s   5.1     Orchestrator                AGGREGATE all results into SalesBrief:
                                               directive: original input
                                               vehicle: VehicleData
                                               buyerProfile: PersonalityProfile
                                               salespersonMatch: SalespersonMatch
                                               pitch: SalesPitch
                                               listing?: VehicleListing
                                               metadata: { totalTimeMs, agentsRun, errors }

~8.5s   5.2     Orchestrator                DELIVER SalesBrief to user
                                             LOG: total time, agents run, error count
                                             DONE ✅
```

---

## Agent Handoff Map

```
User Directive
      │
      ▼
┌─────────────────┐
│ ORCHESTRATOR     │
│                  │
│  ┌──────────┐   │     ┌────────────────────┐
│  │ Phase 1   │───┼────▶│ VinDecoderAgent    │───→ VehicleData
│  │ PARALLEL  │   │     │ (NHTSA API)        │       │
│  │           │   │     └────────────────────┘       │
│  │           │   │                                   │
│  │           │───┼────▶┌────────────────────┐       │
│  └──────────┘   │     │ PersonalityClassif  │───→ PersonalityProfile
│                  │     │ (Gemini AI)         │       │
│                  │     └────────────────────┘       │
│                  │                │                   │
│  ┌──────────┐   │                │                   │
│  │ CONFID.  │   │     IF vin_conf < 80% → HUMAN_REVIEW artifact
│  │ GATES    │   │     IF pers_conf < 60% → follow-up question
│  └──────────┘   │                │                   │
│                  │                ▼                   │
│  ┌──────────┐   │     ┌────────────────────┐       │
│  │ Phase 2   │───┼────▶│ SalesMatchmaker    │───→ SalespersonMatch
│  │ MATCH     │   │     │ (local algorithm)  │       │
│  └──────────┘   │     └────────────────────┘       │
│                  │                │                   │
│  ┌──────────┐   │                ▼                   ▼
│  │ Phase 3   │───┼────▶┌────────────────────┐
│  │ PITCH     │   │     │ SalesPitchAgent    │───→ SalesPitch
│  │           │   │     │ (Gemini AI)        │
│  └──────────┘   │     └────────────────────┘
│                  │                │
│  ┌──────────┐   │                ▼ (conditional)
│  │ Phase 4   │───┼────▶┌────────────────────┐
│  │ LISTING   │   │     │ ListingAgent       │───→ VehicleListing
│  │ (if req.) │   │     │ (Gemini AI)        │
│  └──────────┘   │     └────────────────────┘
│                  │
│  ┌──────────┐   │
│  │ AGGREGATE │───┼───→ SalesBrief ───▶ User
│  └──────────┘   │
└─────────────────┘
```

---

## HUMAN_REVIEW Artifact

When VIN decode confidence falls below 80%, the system generates a structured review artifact:

```typescript
interface HumanReviewArtifact {
  type: 'HUMAN_REVIEW';
  trigger: 'LOW_VIN_CONFIDENCE' | 'PARTIAL_DECODE';
  vin: string;
  confidence: number;
  decodedFields: {
    present: string[];    // fields successfully decoded
    missing: string[];    // fields that were empty or "Not Applicable"
    uncertain: string[];  // fields with ErrorCode ≠ "0"
  };
  suggestedAction: string;  // "Verify make/model manually" or "Check VIN for typos"
  rawNhtsaErrors: string[]; // ErrorCode + ErrorText from NHTSA
  timestamp: string;
}
```

**Example**:
```json
{
  "type": "HUMAN_REVIEW",
  "trigger": "LOW_VIN_CONFIDENCE",
  "vin": "3C6UR5FL1KG50XXXX",
  "confidence": 42,
  "decodedFields": {
    "present": ["Make", "Model"],
    "missing": ["Trim", "BodyClass", "DriveType", "EngineCylinders"],
    "uncertain": ["ModelYear"]
  },
  "suggestedAction": "VIN may have a typo in positions 14-17. Verify the full VIN and re-scan.",
  "rawNhtsaErrors": ["1 - Check Digit (9th position) is incorrect"],
  "timestamp": "2026-03-30T10:15:00Z"
}
```

---

## Fallback Chains

When an agent fails, the Orchestrator applies these fallback chains:

```
VinDecoderAgent FAILS
  → Retry 3× (0ms, 500ms, 1500ms backoff)
  → IF all retries fail:
      → Prompt user for manual vehicle entry
      → Continue with manual data (confidence: 20)
      → Flag as MANUAL_ENTRY in metadata

PersonalityClassifierAgent FAILS
  → Retry 1×
  → IF retry fails:
      → Default to "Friendly" archetype (safest default)
      → Set confidence: 30
      → Flag as PERSONALITY_DEFAULT in metadata
      → Continue — pitch will be warm/generic but not wrong

SalesMatchmakerAgent FAILS
  → No retry (local computation — should never fail)
  → IF somehow fails:
      → Skip matching entirely
      → Return pitch without rep match
      → Flag as MATCH_SKIPPED in metadata

SalesPitchAgent FAILS
  → Retry 2× with regeneration
  → IF all retries fail:
      → Return generic pitch template filled with vehicle specs
      → Flag as GENERIC_PITCH in metadata

ListingAgent FAILS
  → Retry 1×
  → IF retry fails:
      → Return partial listing (title + basic vehicle specs)
      → Flag as PARTIAL_LISTING in metadata
```

---

## Execution Timing Breakdown

| Phase | Agent(s) | Typical Duration | Bottleneck |
|-------|----------|-----------------|------------|
| Phase 0: Parse | Orchestrator | < 5ms | Regex matching |
| Phase 1a: VIN Decode | VinDecoderAgent | 100–500ms | NHTSA API latency |
| Phase 1b: Personality | PersonalityClassifierAgent | 1–3s | Gemini inference |
| Phase 2: Match | SalesMatchmakerAgent | < 50ms | Local computation |
| Phase 3: Pitch | SalesPitchAgent | 3–5s | Gemini inference |
| Phase 4: Listing | ListingAgent | 2–4s | Gemini inference |
| Phase 5: Aggregate | Orchestrator | < 5ms | Object assembly |
| **Total (no listing)** | | **~5–8s** | |
| **Total (with listing)** | | **~8–12s** | |

---

## Validation Report: Partial VIN vs Full VIN

### Full VIN (17-character, valid)

**Input**: `3C6UR5FL1KG501234`

```
Step 1: VALIDATE → PASS (17 chars, no I/O/Q, valid charset)
Step 2: CALL NHTSA → HTTP 200
Step 3: MAP fields → All critical fields present
Step 4: CONFIDENCE → 91% (missing only BasePrice)
Step 5: GATE → PASS (≥ 80%) → proceed normally
Step 6: RETURN VehicleData → 2019 RAM 3500 Laramie Longhorn
```

### Partial VIN (< 17 characters)

**Input**: `3C6UR5FL1KG`

```
Step 1: VALIDATE → FAIL
  Error: "VIN must be 17 characters (got 11)"
  Code: INVALID_VIN
Step 2: HALT — do not call NHTSA
Step 3: RETURN { error: 'INVALID_VIN', message: 'VIN must be 17 characters (got 11)' }
  → Orchestrator returns error to user immediately
  → No agents run, no API calls wasted
```

### Full VIN with Bad Check Digit

**Input**: `3C6UR5FL0KG501234` (position 9 is 0 instead of 1)

```
Step 1: VALIDATE → PASS (format valid — check digit not verified client-side)
Step 2: CALL NHTSA → HTTP 200
Step 3: MAP fields → Some fields present but ErrorCode: "1"
Step 4: CONFIDENCE → 58% (ErrorCode penalty + missing fields)
Step 5: GATE → WARNING (50-79% range)
  → Generate LOW_CONFIDENCE flag
  → Continue with partial data
Step 6: RETURN VehicleData with warning
  → Orchestrator proceeds but flags output for user verification
```
