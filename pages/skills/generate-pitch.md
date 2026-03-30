# ✍️ Skill Deep Dive: `generateSalesPitchSkill`

> Generate a personality-aware, spec-rich sales pitch from vehicle data and buyer profile.

---

## Output Structure

Every pitch includes these components:

| Component | Purpose | Example |
|-----------|---------|---------|
| **Headline** | Attention-grabbing summary | "The RAM 3500 Laramie: Where Luxury Meets 410 lb-ft" |
| **Pitch** | 5-sentence tailored pitch | (see examples below) |
| **Talking Points** | 3-5 spec-based selling points | Towing, interior, tech, safety |
| **Objection Handlers** | 2-3 pre-loaded responses | Price, reliability, competitor |
| **Closing Strategy** | Personality-matched close | Assumptive, logical, relational |
| **Urgency Hook** | FOMO trigger | "Only 2 in this trim on the lot" |

---

## Pitch Examples by Personality

### 🔴 Driver Pitch — 2024 RAM 3500 Laramie Longhorn

> **Headline**: "410 Horses. 31,210 lbs of Towing. Best-in-Class, Period."
>
> **Pitch**: "The 2024 RAM 3500 Laramie Longhorn is the most powerful production pickup in its class — 410 horsepower, 429 lb-ft of torque from the 6.4L HEMI V8. You're looking at 31,210 pounds of max towing and the highest GVWR in the segment. The Longhorn trim isn't just capability — it's a statement that you don't settle for second best. This truck outworks and outclasses everything else on the market. There's one at this price point. Once it's gone, it's gone."

---

### 🔵 Analytical Pitch — 2024 RAM 3500 Laramie Longhorn

> **Headline**: "31,210 lb Tow Capacity, 62% Residual Value at 60mo — The Data Speaks"
>
> **Pitch**: "The 2024 RAM 3500 Laramie Longhorn delivers measurably superior specifications in every metric that matters. Its 6.4L HEMI V8 produces 410 HP at 5,600 RPM with 429 lb-ft of torque — that's 15% more payload capacity than the comparable Ford F-350 Lariat. Independent reliability studies show RAM's Cummins-era engineering improvements, and the Longhorn specifically holds 62% residual value at 60 months versus 57% for in-class competitors. The total cost of ownership over 5 years, factoring fuel, maintenance, and depreciation, positions this as the strongest value proposition in the heavy-duty segment. I can pull up the full comparison data if you'd like."

---

### 🟢 Friendly Pitch — 2024 RAM 3500 Laramie Longhorn

> **Headline**: "Built for the Whole Family — Comfort, Safety, and Capability"
>
> **Pitch**: "This is the kind of truck that your whole family is going to love riding in — the Laramie Longhorn interior is like a luxury SUV with real leather seats that are heated and ventilated. Your passengers get three-zone climate control, and the safety package includes forward collision warning, blind-spot monitoring, and six airbags. It's got the towing power for your boat, your camper, whatever your family needs — 31,000 pounds. And with the five-year powertrain warranty, you've got peace of mind knowing you're covered. This is honestly one of my favorite trucks on the lot, and I think your family is going to feel right at home."

---

### 🟡 Expressive Pitch — 2024 RAM 3500 Laramie Longhorn

> **Headline**: "Turn Heads, Tow Anything — The Truck That Makes a Statement"
>
> **Pitch**: "Imagine pulling up to the job site — or the tailgate — in this Laramie Longhorn. That two-tone paint with the chrome package? People notice. The interior is pure luxury — hand-stitched leather, real wood accents, a 12-inch touchscreen that makes every drive feel premium. But here's the thing — it's not just gorgeous, it's a beast underneath. 410 horsepower, class-leading towing, and the kind of presence that says you've made it. This exact color and trim combo is rare — we had two, and one sold last Saturday. You should test drive this before someone else does."

---

## Gemini Prompt Structure

```
SYSTEM:
You are an elite automotive sales copywriter with 15 years of experience 
at premium dealerships. You write pitches that close deals.

VEHICLE DATA:
Year: {{vehicle.year}}
Make: {{vehicle.make}}
Model: {{vehicle.model}}
Trim: {{vehicle.trim}}
Engine: {{vehicle.engineDisplacement}}L {{vehicle.engineCylinders}}-cylinder ({{vehicle.fuelType}})
Drive: {{vehicle.driveType}}
Body: {{vehicle.bodyClass}}
Transmission: {{vehicle.transmissionStyle}}
GVWR: {{vehicle.gvwr}}

BUYER PROFILE:
Type: {{personality.primaryType}} ({{personality.confidence}}% confidence)
Motivators: {{personality.buyingMotivators.join(', ')}}
Communication tips: {{personality.communicationTips.join('; ')}}
Avoid: {{personality.avoidTopics.join(', ')}}

{{#if dealerContext}}
DEALER CONTEXT:
Current promos: {{dealerContext.currentPromos.join(', ')}}
Days on lot: {{dealerContext.inventoryDays}}
{{/if}}

{{PERSONALITY_RULES[personality.primaryType]}}

OUTPUT FORMAT (valid JSON, no markdown fences):
{
  "headline": "attention-grabbing single line",
  "pitch": "exactly 5 sentences tailored to buyer personality",
  "talkingPoints": [
    { "topic": "...", "point": "...", "whyItMatters": "..." }
  ],
  "objectionHandlers": [
    { "objection": "...", "response": "...", "technique": "..." }
  ],
  "closingStrategy": "personality-matched closing technique",
  "urgencyHook": "time/scarcity-based motivator"
}
```

---

## Quality Validation

Every generated pitch is checked against these quality gates:

```typescript
function validatePitch(pitch: SalesPitch, personality: string): ValidationResult {
  const issues: string[] = [];
  
  // Must have enough talking points
  if (pitch.talkingPoints.length < 3) {
    issues.push('Need at least 3 talking points');
  }
  
  // Must have objection handlers
  if (pitch.objectionHandlers.length < 2) {
    issues.push('Need at least 2 objection handlers');
  }
  
  // Pitch must be approximately 5 sentences
  const sentenceCount = pitch.pitch.split(/[.!?]+/).filter(s => s.trim()).length;
  if (sentenceCount < 4 || sentenceCount > 7) {
    issues.push(`Pitch has ${sentenceCount} sentences, target is 5`);
  }
  
  // Personality language check
  const personalitySignals: Record<string, RegExp> = {
    Driver: /best|power|dominate|fastest|unmatched|elite/i,
    Analytical: /data|percent|compared|ratio|cost|value|rated/i,
    Friendly: /family|safe|comfort|peace of mind|enjoy|love/i,
    Expressive: /imagine|stunning|head-turn|exclusive|rare|adventure/i,
  };
  
  if (!personalitySignals[personality]?.test(pitch.pitch)) {
    issues.push(`Pitch doesn't use ${personality}-specific language`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    shouldRegenerate: issues.length > 1,
  };
}
```
