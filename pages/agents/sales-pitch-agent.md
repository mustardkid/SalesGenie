# ✍️ SalesPitchAgent — Deep Dive

> Single responsibility: Generate a tailored, personality-aware sales pitch from vehicle specs and buyer profile.

---

## Architecture

```
           ┌──────────────────────────────────────────────────┐
           │              SalesPitchAgent                      │
           │                                                   │
  Vehicle ─▶│  validate() → prompt() → generate() → check() ─▶│── SalesPitch
  Profile ─▶│      │          │           │           │        │
  Context ─▶│      ▼          ▼           ▼           ▼        │
           │  Both present? Build      Gemini AI   Quality     │
           │               prompt      inference   gates       │
           │                              │                    │
           │                         Pass gates?               │
           │                         NO: regenerate            │
           │                         (max 2 retries)           │
           └──────────────────────────────────────────────────┘
```

## Dependencies

This agent has the **most dependencies** of any non-orchestrator agent:

1. `VehicleData` from VinDecoderAgent (required)
2. `PersonalityProfile` from PersonalityClassifierAgent (required)
3. `DealerContext` from user input (optional)

It runs in Phase 3 — after both Phase 1 agents complete.

## Quality Gates

Every generated pitch must pass these checks before delivery:

| Gate | Check | On Fail |
|------|-------|---------|
| Talking point count | ≥ 3 points | Regenerate |
| Objection handler count | ≥ 2 handlers | Regenerate |
| Sentence count | 4-7 sentences | Regenerate |
| Personality language | Contains archetype-specific keywords | Regenerate |
| Vehicle spec references | ≥ 2 specific specs mentioned | Regenerate |
| Maximum regeneration | 2 retries max | Return best attempt + warning |

## Token Budget

| Component | Estimated Tokens |
|-----------|-----------------|
| System prompt | ~300 |
| Vehicle data injection | ~200 |
| Personality rules injection | ~150 |
| Dealer context (optional) | ~100 |
| Output format specification | ~100 |
| **Total input** | **~850** |
| **Expected output** | **~500-800** |

## Personality-Specific Language Validation

```typescript
const PERSONALITY_KEYWORDS: Record<string, string[]> = {
  Driver: ['best', 'power', 'dominate', 'fastest', 'unmatched', 'elite', 'class-leading', 'win'],
  Analytical: ['data', 'percent', 'compared', 'ratio', 'cost', 'value', 'rated', 'TCO', 'efficiency'],
  Friendly: ['family', 'safe', 'comfort', 'peace of mind', 'enjoy', 'love', 'warm', 'community'],
  Expressive: ['imagine', 'stunning', 'head-turn', 'exclusive', 'rare', 'adventure', 'style', 'unique'],
};
```

## Common Objection Templates

The agent generates these, but also has fallback templates:

| Objection | Technique | Example Response |
|-----------|-----------|-----------------|
| "Too expensive" | Reframe as value | "Let's look at cost-per-mile over 5 years..." |
| "I need to think about it" | Scarcity | "I understand. FYI, we only have 2 at this price..." |
| "Competitor X is cheaper" | Feature comparison | "The price difference buys you [specific feature advantage]..." |
| "Bad timing" | Future cost | "With rates trending up, locking in now could save..." |
| "My spouse needs to see it" | Next step | "Let's schedule a time when you can both come in..." |
