# 📋 Directives — The "What"

> A **directive** is a high-level goal expressed in natural language. The user says *what* they want; the Orchestrator figures out *how*.

---

## Mission Statement

> **Extract VIN data, categorize the buyer as Driver / Analytical / Friendly / Expressive, and generate a 5-sentence high-impact pitch — all in under 10 seconds.**

Every directive ultimately serves this loop:

```
VIN → Vehicle Specs → Buyer Profile → Matched Rep → Tailored Pitch → CLOSE THE DEAL
```

---

## What Is a Directive?

A directive is the entry point for every interaction with SalesGenie. It's a plain-English instruction that triggers one or more agents. Think of it as the "prompt" that starts the machine.

```
"Decode VIN 3C6UR5FL1KG501234 and generate a pitch for an analytical buyer."
```

The Orchestrator parses this, identifies the required agents, and executes accordingly.

---

## End-User Goals

Each directive maps directly to a **user goal** — not a technical function:

| # | User Goal | Directive |
|---|-----------|-----------|
| 1 | "I have a customer on the lot — tell me everything about this vehicle and how to sell it to them" | **Full Sales Brief** (D-001) |
| 2 | "What vehicle is this VIN?" | **VIN Decode Only** (D-002) |
| 3 | "Help me understand this buyer before they pick a vehicle" | **Personality Profile Only** (D-003) |
| 4 | "I already know the buyer — just write me a pitch for this car" | **Generate Pitch** (D-004) |
| 5 | "I need to post this vehicle online — write the listing" | **Build Listing** (D-005) |
| 6 | "Full sales workup AND an online listing ready to go" | **Full Brief + Listing** (D-006) |

---

## Directive Catalog

### D-001: Full Sales Brief ⭐ (Flagship)

**The directive 90% of users will run.**

**User Goal**: "Customer just walked in. I scanned the VIN and chatted for 60 seconds. Tell me everything — the vehicle, the buyer type, who should sell to them, and exactly what to say."

**Natural Language Examples**:
```
"Scan VIN 3C6UR5FL1KG501234 and generate a pitch"
"New customer on the lot — VIN is WBAJB0C51JB084901, profile them and pitch"
"Full sales brief for 1FTEW1E53NFC12345"
```

**Required Inputs**:
| Input | Source | Required |
|-------|--------|----------|
| VIN | Barcode scan, manual entry, or photo OCR | ✅ |
| Buyer answers | Salesperson Q&A (3–5 questions) or preset personality | ✅ (or preset) |
| Observed cues | Salesperson notes ("seemed impatient", "asked about towing") | ❌ |
| Dealer context | Current promos, inventory pressure, trade-in value | ❌ |
| Salesperson roster | Available reps with strengths | ❌ (uses sample) |

**Agents Triggered**: VinDecoder → PersonalityClassifier → SalesMatchmaker → SalesPitch

**Output**: Complete `SalesBrief` — vehicle specs, personality profile, rep match, tailored pitch

**SLA**: ~5–8 seconds end-to-end

**Success Criteria**:
- Vehicle decoded with ≥80% confidence
- Buyer classified with ≥60% confidence
- Pitch contains personality-matched language
- At least 3 talking points and 2 objection handlers generated

---

### D-002: VIN Decode Only

**User Goal**: Quick vehicle lookup — no sales layer needed.

**Natural Language Examples**:
```
"Decode VIN 3C6UR5FL1KG501234"
"What vehicle is this? WP0AB2A71DL020815"
"Look up this VIN"
```

**Required Inputs**: VIN only

**Agents Triggered**: VinDecoderAgent

**Output**: `VehicleData`

**SLA**: < 2 seconds

**Confidence Gate**: If decode confidence < 80%, the output includes a `⚠️ LOW_CONFIDENCE` flag and suggests manual verification.

---

### D-003: Personality Profile Only

**User Goal**: Profile a buyer without a specific vehicle in mind (walk-in browsing).

**Natural Language Examples**:
```
"Profile this buyer — they asked about safety, mentioned their kids, seemed warm"
"Classify: answers are [family, comfort, loyal, partner decides]"
```

**Required Inputs**: 3–5 buyer Q&A answers

**Agents Triggered**: PersonalityClassifierAgent

**Output**: `PersonalityProfile`

**SLA**: < 3 seconds

**Confidence Gate**: If classification confidence < 60%, the agent generates a follow-up question to disambiguate. If still < 40% after follow-up, defaults to "Friendly" with warning.

---

### D-004: Generate Pitch (No Matchmaker)

**User Goal**: The salesperson is already assigned — they just need the pitch.

**Natural Language Examples**:
```
"I'm already talking to an Analytical buyer about a 2024 RAM — give me a pitch"
"Pitch for VIN 3C6UR5FL1KG501234, buyer type is Expressive"
```

**Required Inputs**: VIN + buyer personality (Q&A or preset)

**Agents Triggered**: VinDecoderAgent + PersonalityClassifierAgent + SalesPitchAgent

**Output**: `SalesPitch`

**SLA**: ~5 seconds

---

### D-005: Build Listing

**User Goal**: Post this vehicle online — fast.

**Natural Language Examples**:
```
"Build a Craigslist listing for VIN 3C6UR5FL1KG501234"
"Generate an AutoTrader listing with these photos: [urls]"
```

**Required Inputs**: VIN + optional photos + optional platform

**Agents Triggered**: VinDecoderAgent + ListingAgent

**Output**: `VehicleListing`

**SLA**: ~4 seconds

---

### D-006: Full Brief + Listing

**User Goal**: Everything — sales brief plus a marketplace listing.

**Agents Triggered**: All six agents

**Output**: `SalesBrief` + `VehicleListing`

**SLA**: ~8–10 seconds

---

## Directive Parsing Rules

The Orchestrator uses these signals to determine which agents to trigger:

| Signal | Detection Method | Agents Triggered |
|--------|-----------------|------------------|
| 17-char alphanumeric VIN | Regex `/[A-HJ-NPR-Z0-9]{17}/i` | VinDecoderAgent |
| Personality keywords or buyer answers | Keywords: "personality", "buyer", "profile", "classify" | PersonalityClassifierAgent |
| Preset personality type | Keywords: "driver", "analytical", "friendly", "expressive" | Bypass classifier → use preset |
| "pitch", "sell", "brief", "sales" | Keyword match | SalesPitchAgent |
| "match", "who should", "best rep" | Keyword match | SalesMatchmakerAgent |
| "listing", "post", "marketplace" | Keyword match | ListingAgent |
| No specific signals detected | Default behavior | D-001 (Full Sales Brief) |

---

## Confidence Thresholds (System-Wide)

These thresholds govern decision-making across all directives:

| Domain | Threshold | Action |
|--------|-----------|--------|
| **VIN Decode** | ≥ 80% | ✅ Proceed normally |
| **VIN Decode** | 50–79% | ⚠️ Warn: "Low confidence decode — verify vehicle details" |
| **VIN Decode** | < 50% | 🔴 Generate `HUMAN_REVIEW` artifact — flag for manual verification |
| **Personality** | ≥ 80% | ✅ High confidence — proceed |
| **Personality** | 60–79% | ✅ Moderate — proceed with note |
| **Personality** | 40–59% | ⚠️ Ask follow-up question, re-classify |
| **Personality** | < 40% | 🟡 Default to "Friendly" (safest archetype) with warning |

---

## Custom Directives

Users can compose custom directives by combining keywords:

```
"Decode VIN [X], skip personality — I already know they're a Driver — just pitch"
→ Triggers: VinDecoderAgent + SalesPitchAgent (with preset personality)

"Profile this buyer and match to a rep — no vehicle yet"
→ Triggers: PersonalityClassifierAgent + SalesMatchmakerAgent

"Update the listing for VIN [X] with new photos"
→ Triggers: VinDecoderAgent + ListingAgent (update mode)
```

---

## Directive Lifecycle

```
┌──────────────┐
│   USER INPUT  │  "Scan VIN 3C6UR5FL1KG501234 and pitch for an Analytical buyer"
│ (natural lang)│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    PARSE      │  Extract: VIN = 3C6UR5FL1KG501234, personality = Analytical
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   VALIDATE    │  VIN format OK ✅  |  Personality preset OK ✅
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  CONFIDENCE   │  VIN confidence ≥ 80%? → Proceed
│   GATE        │  Personality confidence ≥ 60%? → Proceed
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   ROUTE       │  D-001: VinDecoder ∥ PersonalityClassifier → Matchmaker → Pitch
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   EXECUTE     │  Run agents per Orchestrator.md → Execute.md flows
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   DELIVER     │  Return aggregated SalesBrief to user
└──────────────┘
```
