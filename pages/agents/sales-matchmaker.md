# 🤝 SalesMatchmakerAgent — Deep Dive

> Single responsibility: Select the best salesperson for a given buyer profile.

---

## Architecture

```
           ┌──────────────────────────────────────────────┐
           │         SalesMatchmakerAgent                  │
           │                                               │
  Profile ─▶│  filter() → score() → rank() → script() ──▶│──── SalespersonMatch
  Roster ──▶│     │         │         │         │         │
           │     ▼         ▼         ▼         ▼          │
           │  Available  Weighted   Sort by   Generate     │
           │  reps only  scoring    score     handoff      │
           └──────────────────────────────────────────────┘
```

## Key Design Decision: Local Computation

This agent does **NOT** call any external API. All matching is done locally with a deterministic algorithm. This means:

- **No latency variance** — always < 100ms
- **No API costs** — zero external calls
- **Deterministic** — same inputs always produce the same output
- **Testable** — pure function, easy to unit test

## Scoring Weights

```
personalityFit:  45%   ← Most important predictor
specialtyMatch:  25%   ← Vehicle category expertise
closeRate:       20%   ← Historical performance
loadPenalty:     10%   ← Workload fairness
```

These weights were tuned based on automotive sales research that shows personality-matched sales interactions have a 35% higher close rate.

## Edge Cases

| Case | Handling |
|------|---------|
| Only 1 rep available | Return them with matchScore and note "only available" |
| No reps available | Return `{ allBusy: true, estimatedWait: "15 min" }` |
| All reps equally scored | Tie-break by lowest `currentLoad` |
| Roster not provided | Skip agent entirely; return pitch without match |

## Handoff Script Tone

The handoff script is calibrated to:
1. Not reveal that an AI profiled the buyer (feels manipulative)
2. Give the rep enough context to start strong
3. Match the buyer's expected communication style
