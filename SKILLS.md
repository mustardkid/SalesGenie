# 🔧 SKILLS.md — Skill Catalog

> A **skill** is a single, testable capability. Skills are pure functions — they take inputs, produce outputs, and have no side effects beyond their defined purpose. Agents compose skills to accomplish goals.

---

## Skill Index

| # | Skill | One-Liner | Status |
|---|-------|-----------|--------|
| 1 | `decodeVinSkill` | Decode a VIN via NHTSA API → full vehicle specs | ✅ Active |
| 2 | `classifyPersonalitySkill` | Profile a buyer into one of four archetypes | ✅ Active |
| 3 | `matchSalespersonSkill` | Match buyer personality to the ideal sales rep | ✅ Active |
| 4 | `generateSalesPitchSkill` | Generate a tailored 5-sentence pitch | ✅ Active |
| 5 | `buildListingSkill` | Create a vehicle listing with title + bullets | 🟡 Optional |

---

## 1. `decodeVinSkill`

**Purpose**: Call NHTSA's `DecodeVinValuesExtended` endpoint and return structured vehicle data.

**API Endpoint**:
```
GET https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/{VIN}?format=json
```

### Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vin` | `string` | ✅ | 17-character Vehicle Identification Number |
| `modelYear` | `number` | ❌ | Optional year hint for better accuracy |

### Outputs

```typescript
interface VehicleData {
  vin: string;
  year: number;
  make: string;              // e.g., "RAM"
  model: string;             // e.g., "3500"
  trim: string;              // e.g., "Laramie Longhorn"
  bodyClass: string;         // e.g., "Pickup"
  driveType: string;         // e.g., "4WD/4-Wheel Drive/4x4"
  engineCylinders: number;   // e.g., 8
  engineDisplacement: string;// e.g., "6.4L"
  fuelType: string;          // e.g., "Gasoline"
  transmissionStyle: string; // e.g., "Automatic"
  gvwr: string;              // Gross Vehicle Weight Rating
  wheelbase: string;         // e.g., "169.3"
  msrp: number | null;       // if available from NHTSA
  plantCountry: string;      // e.g., "UNITED STATES"
  doors: number;
  seatRows: number;
  steeringLocation: string;
  abs: boolean;
  tpms: boolean;
  esc: boolean;
  airBagCount: number;
  confidence: number;        // 0-100 decode confidence
  rawNhtsa: Record<string, string>; // full NHTSA response for extensibility
}
```

### Key Use Case
> A customer walks in with a trade-in. The rep scans the VIN barcode → SalesGenie instantly pulls the full spec sheet without typing a single field.

### Error Handling
- Invalid VIN (wrong length, bad check digit) → return `{ error: 'INVALID_VIN', message: '...' }`
- NHTSA API down → retry 3× with exponential backoff, then return cached data if available
- Low confidence decode (< 50%) → flag for manual review

📖 **Deep dive**: [pages/skills/decode-vin.md](pages/skills/decode-vin.md)

---

## 2. `classifyPersonalitySkill`

**Purpose**: Ask 3–5 rapid-fire questions and classify the buyer into one of four personality archetypes based on the DISC model variant.

### The Four Archetypes

| Archetype | Traits | Buying Style | Trigger Words |
|-----------|--------|-------------|---------------|
| 🔴 **Driver** | Decisive, results-oriented, competitive | Wants the bottom line fast — no fluff | "power", "best", "fastest", "dominate" |
| 🔵 **Analytical** | Data-driven, cautious, detail-oriented | Needs specs, comparisons, and proof | "reliability", "data", "efficiency", "resale" |
| 🟢 **Friendly** | Warm, relationship-focused, loyal | Trusts people over specs | "family", "comfort", "safety", "community" |
| 🟡 **Expressive** | Enthusiastic, image-conscious, spontaneous | Buys the sizzle, not the steak | "style", "unique", "head-turner", "adventure" |

### Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `answers` | `QuestionAnswer[]` | ✅ | Array of question-answer pairs from the buyer |
| `observedCues` | `string[]` | ❌ | Optional: salesperson's notes ("seemed impatient", "asked about towing") |

```typescript
interface QuestionAnswer {
  questionId: string;
  question: string;    // e.g., "What matters most to you in a vehicle?"
  answer: string;      // e.g., "I need something my family feels safe in"
}
```

### Outputs

```typescript
interface PersonalityProfile {
  primaryType: 'Driver' | 'Analytical' | 'Friendly' | 'Expressive';
  secondaryType: 'Driver' | 'Analytical' | 'Friendly' | 'Expressive' | null;
  confidence: number;         // 0–100
  reasoning: string;          // AI explanation of classification
  communicationTips: string[]; // e.g., ["Lead with data", "Don't rush"]
  avoidTopics: string[];       // e.g., ["Don't emphasize emotion over logic"]
  buyingMotivators: string[];  // e.g., ["Resale value", "Fuel economy"]
}
```

### Key Use Case
> While the VIN is being decoded, the salesperson chats with the buyer for 60 seconds. Their answers are fed into this skill, and by the time the vehicle data comes back, SalesGenie already knows *how* to sell to this person.

### Classification Questions (default set)

1. "What's the most important thing you're looking for in your next vehicle?"
2. "How do you usually make big purchase decisions?"
3. "What do you love about your current vehicle — or hate about it?"
4. "Who else is involved in this decision?"
5. "What would make you drive off the lot today?"

📖 **Deep dive**: [pages/skills/classify-personality.md](pages/skills/classify-personality.md)

---

## 3. `matchSalespersonSkill`

**Purpose**: Given a buyer personality profile and a salesperson roster, select the best rep for the deal.

### Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `buyerProfile` | `PersonalityProfile` | ✅ | Output from `classifyPersonalitySkill` |
| `roster` | `Salesperson[]` | ✅ | Available reps with their strengths |

```typescript
interface Salesperson {
  id: string;
  name: string;
  strengths: ('Driver' | 'Analytical' | 'Friendly' | 'Expressive')[];
  specialties: string[];    // e.g., ["trucks", "luxury", "fleet"]
  currentLoad: number;      // active deals — used for load balancing
  closeRate: number;        // historical close rate 0–100
  available: boolean;
}
```

### Outputs

```typescript
interface SalespersonMatch {
  recommended: Salesperson;
  matchScore: number;          // 0–100
  reason: string;              // e.g., "Sarah excels with Analytical buyers and specializes in trucks"
  alternates: Salesperson[];   // fallback options if primary is busy
  handoffScript: string;       // suggested intro: "Sarah, this is [buyer], they're interested in..."
}
```

### Matching Algorithm

```
Score = (personalityFit × 0.45) + (specialtyMatch × 0.25) + (closeRate × 0.20) - (loadPenalty × 0.10)
```

| Factor | Weight | Logic |
|--------|--------|-------|
| Personality Fit | 45% | Rep's strengths overlap with buyer's primary/secondary type |
| Specialty Match | 25% | Rep specializes in this vehicle category |
| Close Rate | 20% | Historical performance |
| Load Penalty | 10% | Penalty for reps with 3+ active deals |

### Key Use Case
> An Analytical buyer walks in asking about a RAM 3500. The system picks Sarah (data-driven closer, truck specialist, 68% close rate). The system generates a handoff script so the intro feels natural.

📖 **Deep dive**: [pages/skills/match-salesperson.md](pages/skills/match-salesperson.md)

---

## 4. `generateSalesPitchSkill`

**Purpose**: Given vehicle specs + buyer personality, generate a tailored 5-sentence sales pitch plus supporting talking points.

### Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vehicle` | `VehicleData` | ✅ | Output from `decodeVinSkill` |
| `personality` | `PersonalityProfile` | ✅ | Output from `classifyPersonalitySkill` |
| `dealerContext` | `DealerContext` | ❌ | Optional: current promos, inventory pressure, trade-in value |

```typescript
interface DealerContext {
  currentPromos: string[];       // e.g., ["0% APR for 72 months"]
  inventoryDays: number;         // days this vehicle has been on the lot
  competitorPricing: string[];   // if known
  tradeInEstimate: number | null;
}
```

### Outputs

```typescript
interface SalesPitch {
  headline: string;              // e.g., "The RAM 3500 Laramie: Where Luxury Meets 410 lb-ft of Torque"
  pitch: string;                 // 5-sentence tailored pitch
  talkingPoints: TalkingPoint[];
  objectionHandlers: ObjectionHandler[];
  closingStrategy: string;       // recommended close technique for this personality
  urgencyHook: string;           // e.g., "Only 2 at this trim on the lot"
}

interface TalkingPoint {
  topic: string;       // e.g., "Towing Capacity"
  point: string;       // e.g., "31,210 lbs max tow — that's best-in-class by 2,000 lbs"
  whyItMatters: string;// e.g., "Analytical buyers want proof points, so lead with the numbers"
}

interface ObjectionHandler {
  objection: string;   // e.g., "That's too expensive"
  response: string;    // e.g., "Let's look at the cost-per-mile over 5 years compared to..."
  technique: string;   // e.g., "Reframe as investment"
}
```

### Pitch Generation Rules by Personality

| Buyer Type | Pitch Style | Lead With | Avoid |
|------------|-------------|-----------|-------|
| 🔴 Driver | Direct, concise, competitive | Power stats, exclusivity, "best in class" | Long stories, too many options |
| 🔵 Analytical | Data-rich, comparative | Specs, TCO, reliability ratings | Emotional appeals, pressure tactics |
| 🟢 Friendly | Warm, story-driven | Safety, family, comfort, community | Aggressive closing, tech overload |
| 🟡 Expressive | Exciting, visual, aspirational | Style, uniqueness, adventure stories | Spreadsheets, boring spec sheets |

### Key Use Case
> VIN decoded as 2024 RAM 3500 Laramie Longhorn. Buyer classified as Analytical. Pitch auto-generated: *"The 2024 RAM 3500 Laramie Longhorn delivers 410 lb-ft of torque from its 6.4L HEMI V8, paired with class-leading 31,210 lb towing capacity. Independent studies rank its interior material quality above competitive offerings from Ford and Chevy. With an estimated 15-year mechanical lifespan and 62% residual value at 60 months, this is one of the strongest long-term investments in the heavy-duty segment…"*

📖 **Deep dive**: [pages/skills/generate-pitch.md](pages/skills/generate-pitch.md)

---

## 5. `buildListingSkill` *(Optional)*

**Purpose**: Generate a marketplace listing (title, bullet points, description) optimized for online sales platforms.

### Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vehicle` | `VehicleData` | ✅ | Output from `decodeVinSkill` |
| `photos` | `string[]` | ❌ | URLs of vehicle photos |
| `sellerNotes` | `string` | ❌ | Free-text notes from dealer |
| `platform` | `string` | ❌ | Target platform: "autotrader", "cargurus", "facebook", "craigslist" |

### Outputs

```typescript
interface VehicleListing {
  title: string;                // SEO-optimized listing title
  bullets: string[];            // 5–8 key selling points
  description: string;          // 150–300 word rich description
  missingPhotoSuggestions: string[]; // e.g., ["Need engine bay photo", "Add interior rear seat shot"]
  seoTags: string[];            // platform-appropriate tags
  pricePositioning: string;     // e.g., "Priced 4% below market avg for this trim/mileage"
}
```

### Key Use Case
> After scanning a trade-in, the dealer wants to flip it fast. This skill generates a ready-to-post listing for AutoTrader or Facebook Marketplace.

📖 **Deep dive**: [pages/skills/build-listing.md](pages/skills/build-listing.md)

---

## Skill Dependency Graph

```
                    ┌──────────────┐
        VIN ───────▶│decodeVinSkill│──────────────────┐
                    └──────────────┘                   │
                                                       ▼
                    ┌─────────────────────┐    ┌────────────────────┐
      Buyer Q&A ──▶│classifyPersonality   │──▶│generateSalesPitch  │──▶ PITCH
                    │Skill                │    │Skill               │
                    └─────────────────────┘    └────────────────────┘
                              │                        ▲
                              ▼                        │
                    ┌─────────────────────┐            │
                    │matchSalesperson     │────────────┘
                    │Skill               │
                    └─────────────────────┘
                    
                    ┌─────────────────────┐
      (Optional) ──▶│buildListingSkill    │──▶ LISTING
                    └─────────────────────┘
```

Skills 1 and 2 run **in parallel**. Skills 3 and 4 depend on skill 2. Skill 4 depends on both 1 and 2.
