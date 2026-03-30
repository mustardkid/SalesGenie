# 📝 Skill Deep Dive: `buildListingSkill`

> Generate a marketplace-ready vehicle listing optimized for the target platform.

---

## Platform Formatting Rules

| Platform | Max Title Length | Tone | Special Rules |
|----------|-----------------|------|---------------|
| AutoTrader | 80 chars | Professional | Structured tags, specific categories |
| CarGurus | 100 chars | Professional | VIN must be included |
| Facebook Marketplace | 100 chars | Casual, friendly | Emoji-friendly, conversational |
| Craigslist | No strict limit | Direct | Plain text, no HTML |
| eBay Motors | 80 chars | Professional | Item specifics required |

---

## Title Templates

```typescript
const titleTemplates: Record<string, (v: VehicleData) => string> = {
  autotrader: (v) => `${v.year} ${v.make} ${v.model} ${v.trim} ${v.driveType} - ${v.engineDisplacement}L`,
  facebook: (v) => `🔥 ${v.year} ${v.make} ${v.model} ${v.trim} — ${v.driveType}!`,
  craigslist: (v) => `${v.year} ${v.make} ${v.model} ${v.trim} ${v.driveType} ${v.engineDisplacement}L ${v.bodyClass}`,
  cargurus: (v) => `${v.year} ${v.make} ${v.model} ${v.trim}`,
};
```

---

## Bullet Point Generation

The skill generates 5-8 bullets that highlight the vehicle's best features, in priority order:

1. **Engine & Performance** — "6.4L HEMI V8, 410 HP, 429 lb-ft torque"
2. **Capability** — "31,210 lb max towing, Class 3 GVWR"
3. **Drivetrain** — "4WD with selectable modes"
4. **Interior** — "Longhorn leather, heated/ventilated seats"
5. **Technology** — "12-inch Uconnect, wireless CarPlay/Android Auto"
6. **Safety** — "Forward collision warning, blind-spot monitoring"
7. **Condition/History** — "One-owner, clean CARFAX, no accidents"
8. **Value Prop** — "Below market average for this trim/mileage combo"

---

## Photo Coverage Assessment

The skill checks which photos are present and suggests missing shots:

```typescript
const REQUIRED_PHOTOS = [
  { name: 'Exterior Front 3/4', importance: 'critical' },
  { name: 'Exterior Rear 3/4', importance: 'critical' },
  { name: 'Driver Side Profile', importance: 'important' },
  { name: 'Passenger Side Profile', importance: 'important' },
  { name: 'Interior Dashboard', importance: 'critical' },
  { name: 'Interior Rear Seats', importance: 'important' },
  { name: 'Engine Bay', importance: 'important' },
  { name: 'Cargo Area / Truck Bed', importance: 'important' },
  { name: 'Odometer Reading', importance: 'nice_to_have' },
  { name: 'Wheel Detail', importance: 'nice_to_have' },
];
```

---

## Example Output

```json
{
  "title": "2024 RAM 3500 Laramie Longhorn 4WD - 6.4L HEMI V8",
  "bullets": [
    "🔧 6.4L HEMI V8 producing 410 HP and 429 lb-ft of torque",
    "🏋️ Class-leading 31,210 lb max towing capacity",
    "⚙️ 4WD with BorgWarner transfer case and selectable modes",
    "🪑 Longhorn premium leather interior with heated/ventilated front seats",
    "📱 12-inch Uconnect 5 touchscreen with wireless CarPlay & Android Auto",
    "🛡️ Full safety suite: collision warning, blind-spot, trailer backup camera",
    "🏭 Manufactured in USA, one-owner vehicle",
    "💰 Competitively priced — 4% below market average for this trim/mileage"
  ],
  "description": "This 2024 RAM 3500 Laramie Longhorn is the pinnacle of heavy-duty capability meets luxury refinement. Under the hood sits the proven 6.4L HEMI V8, delivering 410 horsepower and 429 lb-ft of torque through a smooth 8-speed automatic transmission...",
  "missingPhotoSuggestions": [
    "Need engine bay photo — buyers want to verify condition",
    "Add an interior rear seat shot showing legroom"
  ],
  "seoTags": ["ram 3500", "laramie longhorn", "heavy duty truck", "4wd", "hemi v8", "towing"],
  "pricePositioning": "Priced 4% below KBB Fair Market Value for this trim, mileage, and region"
}
```
