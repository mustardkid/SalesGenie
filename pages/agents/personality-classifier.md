# 🧠 PersonalityClassifierAgent — Deep Dive

> Single responsibility: Classify a vehicle buyer into one of four DISC-variant personality archetypes.

---

## Architecture

```
           ┌──────────────────────────────────────────────┐
           │      PersonalityClassifierAgent               │
           │                                               │
  Q&A ────▶│  validate() → classify() → assess() ────────▶│──── PersonalityProfile
  Cues ───▶│      │           │            │               │
           │      ▼           ▼            ▼               │
           │  3+ answers?  Gemini AI    Confidence          │
           │               inference    check               │
           │                   │                            │
           │              confidence < 60%?                 │
           │                   │                            │
           │              YES: ask follow-up                │
           │              re-classify with                  │
           │              additional data                   │
           └──────────────────────────────────────────────┘
```

## Parallel Execution

This agent runs **in parallel** with VinDecoderAgent because they have zero dependencies:

```typescript
// In OrchestratorAgent:
const [vehicleData, personalityProfile] = await Promise.all([
  vinDecoderAgent.run({ vin }),
  personalityClassifierAgent.run({ answers, observedCues }),
]);
```

## Confidence Thresholds

| Confidence Range | Action |
|-----------------|--------|
| 80–100% | High confidence — return immediately |
| 60–79% | Moderate — return with note |
| 40–59% | Low — generate follow-up question, re-classify |
| 0–39% | Very low — default to "Friendly" with warning |

## Follow-Up Strategy

When classification is ambiguous, the agent generates a targeted question to disambiguate:

```
Ambiguous: Driver vs Analytical
→ "If you could only pick one — raw performance or proven reliability — which wins?"

Ambiguous: Friendly vs Expressive  
→ "Is it more important that your family loves it, or that you love looking at it?"
```

The answer to this single follow-up question typically pushes confidence above 70%.

## Gemini Usage

- **Model**: `gemini-2.5-flash` (do not change)
- **No responseMimeType** — not supported
- **Always strip markdown fences** before parsing JSON
- **Token budget**: ~500 output tokens (profiles are structured and concise)
