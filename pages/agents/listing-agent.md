# 📝 ListingAgent — Deep Dive

> Single responsibility: Generate marketplace-ready vehicle listings.

---

## Architecture

```
           ┌──────────────────────────────────────────────────┐
           │                ListingAgent                       │
           │                                                   │
  Vehicle ─▶│  photos() → prompt() → generate() → format() ──▶│── VehicleListing
  Photos ──▶│     │          │           │           │         │
  Notes ───▶│     ▼          ▼           ▼           ▼         │
           │  Assess      Build       Gemini AI   Platform    │
           │  coverage    prompt      inference   formatting  │
           └──────────────────────────────────────────────────┘
```

## Trigger Conditions

Unlike other agents, the ListingAgent only runs when explicitly requested:

- Directive contains "listing", "post", "marketplace", "autotrader", "craigslist", "facebook"
- User selects "Build Listing" action in UI
- Part of the D-005 or D-006 directive

## Dependencies

- `VehicleData` from VinDecoderAgent (required)
- Photos, seller notes, platform (all optional)

Does NOT need personality data — listings are optimized for search, not for a specific buyer.

## Platform Optimization

Each platform has different best practices:

### AutoTrader
- Professional tone, no emojis
- Include full VIN in listing
- Structured bullet format
- Max 700 chars for mobile snippet

### Facebook Marketplace
- Casual, friendly tone
- Emojis are effective for engagement
- Lead with price and key specs
- Mobile-first formatting

### Craigslist
- No HTML or rich formatting
- Very direct, no fluff
- Include contact method
- Region-specific pricing

### CarGurus
- Data-rich format
- Include all available specs
- VIN required
- Competitive pricing context
