# 🔍 Skill Deep Dive: `decodeVinSkill`

> Decode any 17-character VIN into structured vehicle data using the NHTSA vPIC API.

---

## API Reference

**Endpoint**: `GET https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/{VIN}?format=json`

**Rate Limits**: No authentication required. No official rate limit, but be respectful (~5 req/sec max).

**Response Time**: ~100-300ms typical.

---

## VIN Structure

A VIN (Vehicle Identification Number) is a 17-character string with a specific format:

```
Position:  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17
           │  │  │  │  │  │  │  │  │   │  │  │  │  │  │  │  │
           │  │  │  │  │  │  │  │  │   │  │  └──┴──┴──┴──┴──┘
           │  │  │  │  │  │  │  │  │   │  │     Sequential Number
           │  │  │  │  │  │  │  │  │   │  └─── Plant Code
           │  │  │  │  │  │  │  │  │   └────── Model Year
           │  │  │  │  │  │  │  │  └────────── Check Digit
           │  │  │  └──┴──┴──┴──┘
           │  │  │     Vehicle Descriptor (model, body, engine)
           └──┴──┘
           World Manufacturer ID
```

### Validation Rules
- **Length**: Exactly 17 characters
- **Forbidden characters**: `I`, `O`, `Q` (to avoid confusion with 1, 0)
- **Position 9**: Check digit (computed from a weighted algorithm)

---

## NHTSA Response Fields

The NHTSA API returns ~140+ fields. Here are the critical ones we extract:

| NHTSA Field | Our Field | Type | Notes |
|-------------|-----------|------|-------|
| `Make` | `make` | string | Manufacturer brand name |
| `Manufacturer` | (enrichment) | string | Parent company name |
| `Model` | `model` | string | Vehicle model name |
| `ModelYear` | `year` | number | Model year |
| `Trim` | `trim` | string | Trim level (may be empty) |
| `Series` | (combined with trim) | string | Series designation |
| `BodyClass` | `bodyClass` | string | "Pickup", "SUV", "Sedan" etc. |
| `DriveType` | `driveType` | string | "4WD", "AWD", "RWD", "FWD" |
| `EngineCylinders` | `engineCylinders` | number | Cylinder count |
| `DisplacementL` | `engineDisplacement` | string | Engine size in liters |
| `EngineHP` | (enrichment) | number | Horsepower if available |
| `FuelTypePrimary` | `fuelType` | string | "Gasoline", "Diesel", "Electric" |
| `TransmissionStyle` | `transmissionStyle` | string | "Automatic", "Manual" |
| `GVWR` | `gvwr` | string | Weight class |
| `WheelBaseShort` | `wheelbase` | string | Wheelbase in inches |
| `BasePrice` | `msrp` | number | Base MSRP (often empty for used) |
| `PlantCountry` | `plantCountry` | string | Country of manufacture |
| `Doors` | `doors` | number | Door count |
| `SeatRows` | `seatRows` | number | Number of seat rows |
| `SteeringLocation` | `steeringLocation` | string | "Left" for US vehicles |
| `ABS` | `abs` | boolean | Anti-lock brakes |
| `TPMS` | `tpms` | boolean | Tire pressure monitoring |
| `ESC` | `esc` | boolean | Electronic stability control |
| `AirBagLocFront` + others | `airBagCount` | number | Total airbag locations |
| `ErrorCode` | (error handling) | string | "0" = success |
| `ErrorText` | (error handling) | string | Description of any issues |

---

## Confidence Scoring

```typescript
function calculateConfidence(data: NhtsaResponse): number {
  let score = 100;
  
  const criticalFields = ['Make', 'Model', 'ModelYear'];
  const importantFields = ['Trim', 'BodyClass', 'DriveType', 'EngineCylinders'];
  const niceToHave = ['BasePrice', 'EngineHP', 'WheelBaseShort'];
  
  for (const field of criticalFields) {
    if (!data[field] || data[field] === 'Not Applicable') score -= 25;
  }
  
  for (const field of importantFields) {
    if (!data[field] || data[field] === 'Not Applicable') score -= 10;
  }
  
  for (const field of niceToHave) {
    if (!data[field] || data[field] === 'Not Applicable') score -= 3;
  }
  
  if (data.ErrorCode !== '0') score -= 20;
  
  return Math.max(0, score);
}
```

---

## Example API Call

**Request**:
```bash
curl "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/3C6UR5FL1KG501234?format=json"
```

**Response** (key fields):
```json
{
  "Results": [{
    "Make": "RAM",
    "Model": "3500",
    "ModelYear": "2019",
    "Trim": "Laramie Longhorn",
    "BodyClass": "Pickup",
    "DriveType": "4WD/4-Wheel Drive/4x4",
    "EngineCylinders": "8",
    "DisplacementL": "6.3916",
    "FuelTypePrimary": "Gasoline",
    "TransmissionStyle": "Automatic",
    "GVWR": "Class 3: 10,001 - 14,000 lb (4,536 - 6,350 kg)",
    "PlantCountry": "MEXICO",
    "Doors": "4",
    "ErrorCode": "0",
    "ErrorText": "0 - VIN decoded clean..."
  }]
}
```

---

## Edge Cases

| Case | Handling |
|------|---------|
| VIN decodes but `ErrorCode: "1"` | Some fields may be empty — proceed with warning |
| VIN for unreleased model year | Returns partial data — flag `confidence < 50` |
| VIN for imported vehicle | May have limited data — supplement with manufacturer API |
| Government/fleet VIN | Often missing trim — return as "Base/Unknown Trim" |
| Rebuilt/salvage title | NHTSA doesn't indicate title status — add as limitation note |
