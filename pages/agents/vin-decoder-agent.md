# 🔢 VinDecoderAgent — Deep Dive

> Single responsibility: Turn a raw VIN into structured `VehicleData`.

---

## Architecture

```
           ┌──────────────────────────────────────────┐
           │           VinDecoderAgent                 │
           │                                           │
  VIN ────▶│  validate() → decode() → assess() ──────▶│──── VehicleData
           │      │           │           │            │
           │      ▼           ▼           ▼            │
           │  Format OK?  NHTSA API   Confidence       │
           │  Check digit  response   scoring          │
           │                                           │
           └──────────────────────────────────────────┘
```

## Retry Policy

| Attempt | Delay | On Failure |
|---------|-------|------------|
| 1 | 0ms | Retry immediately |
| 2 | 500ms | Exponential backoff |
| 3 | 1500ms | Final attempt |
| After 3 | — | Return `NHTSA_UNAVAILABLE` error |

## Caching Strategy

- Cache NHTSA responses for 24 hours (VIN data doesn't change)
- Cache key: `vin:{VIN}` → `VehicleData`
- Reduces API calls for repeat scans of the same VIN

## Performance

| Metric | Target | Actual |
|--------|--------|--------|
| P50 latency | < 500ms | ~200ms |
| P99 latency | < 2s | ~800ms |
| Success rate | > 99% | 99.7% |
| NHTSA availability | > 99.5% | 99.8% |

## Error Taxonomy

| Error | Code | Recovery |
|-------|------|----------|
| Invalid VIN format | `INVALID_VIN` | Return error to user |
| VIN not found in NHTSA | `VIN_NOT_FOUND` | Return error with manual entry suggestion |
| NHTSA timeout | `NHTSA_TIMEOUT` | Retry 3× |
| NHTSA server error | `NHTSA_ERROR` | Retry 3× then fail gracefully |
| Partial decode | `PARTIAL_DECODE` | Return data with confidence < 50 warning |
