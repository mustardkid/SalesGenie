# 🤝 Skill Deep Dive: `matchSalespersonSkill`

> Match a profiled buyer to the ideal salesperson using a weighted scoring algorithm.

---

## Algorithm Overview

The matching algorithm scores each available salesperson against the buyer's profile:

```
Score = (personalityFit × 0.45) + (specialtyMatch × 0.25) + (closeRate × 0.20) - (loadPenalty × 0.10)
```

---

## Scoring Breakdown

### Personality Fit (45% weight)

The strongest predictor. Measures how well the rep's strengths align with the buyer's type.

```typescript
function personalityFit(buyer: PersonalityProfile, rep: Salesperson): number {
  let score = 0;
  
  // Primary match — full points
  if (rep.strengths.includes(buyer.primaryType)) score += 0.7;
  
  // Secondary match — partial points  
  if (buyer.secondaryType && rep.strengths.includes(buyer.secondaryType)) score += 0.3;
  
  // Bonus: rep's first strength matches buyer's primary (their best match)
  if (rep.strengths[0] === buyer.primaryType) score += 0.15;
  
  return Math.min(score, 1.0); // cap at 1.0
}
```

### Specialty Match (25% weight)

Does this rep know this type of vehicle?

```typescript
function specialtyMatch(vehicle: VehicleData, rep: Salesperson): number {
  const vehicleCategory = categorize(vehicle); // "trucks", "luxury", "economy", etc.
  
  if (rep.specialties.includes(vehicleCategory)) return 1.0;
  
  // Partial credit for related categories
  const related: Record<string, string[]> = {
    trucks: ['fleet', 'commercial'],
    luxury: ['premium', 'sports'],
    economy: ['compact', 'hybrid'],
    suv: ['trucks', 'family'],
  };
  
  if (related[vehicleCategory]?.some(r => rep.specialties.includes(r))) return 0.5;
  
  return 0;
}
```

### Close Rate (20% weight)

Historical performance matters:

```typescript
function closeRateScore(rep: Salesperson): number {
  return rep.closeRate / 100; // normalize to 0-1
}
```

### Load Penalty (10% weight)

Don't overload busy reps:

```typescript
function loadPenalty(rep: Salesperson): number {
  if (rep.currentLoad === 0) return 0;
  if (rep.currentLoad <= 2) return 0.2;
  if (rep.currentLoad <= 4) return 0.5;
  return 1.0; // 5+ active deals = max penalty
}
```

---

## Handoff Script Generation

Once the best rep is selected, the skill generates a natural handoff script:

```typescript
function generateHandoffScript(
  rep: Salesperson,
  buyer: PersonalityProfile,
  vehicle: VehicleData
): string {
  const templates: Record<string, string> = {
    Driver: `${rep.name}, this customer knows what they want — they're looking at the ${vehicle.year} ${vehicle.make} ${vehicle.model}. They value straight talk and efficiency. Lead with performance specs and keep it tight.`,
    
    Analytical: `${rep.name}, this buyer is doing their homework on the ${vehicle.year} ${vehicle.make} ${vehicle.model}. They'll appreciate detailed specs, competitor comparisons, and hard data. Give them time to process.`,
    
    Friendly: `${rep.name}, you'll connect well with this customer — they're exploring the ${vehicle.year} ${vehicle.make} ${vehicle.model} for ${buyer.buyingMotivators[0] || 'their family'}. Build rapport first, then walk through comfort and safety features.`,
    
    Expressive: `${rep.name}, this customer has great energy — they're excited about the ${vehicle.year} ${vehicle.make} ${vehicle.model}. Show them the head-turning features first, then get to the details. Match their enthusiasm!`,
  };
  
  return templates[buyer.primaryType];
}
```

---

## Example Roster

```typescript
const sampleRoster: Salesperson[] = [
  {
    id: 'rep-001',
    name: 'Sarah Chen',
    strengths: ['Analytical', 'Driver'],
    specialties: ['trucks', 'fleet', 'commercial'],
    currentLoad: 2,
    closeRate: 68,
    available: true,
  },
  {
    id: 'rep-002',
    name: 'Mike Johnson',
    strengths: ['Friendly', 'Expressive'],
    specialties: ['family', 'suv', 'minivan'],
    currentLoad: 1,
    closeRate: 55,
    available: true,
  },
  {
    id: 'rep-003',
    name: 'Jessica Torres',
    strengths: ['Expressive', 'Driver'],
    specialties: ['luxury', 'sports', 'premium'],
    currentLoad: 3,
    closeRate: 72,
    available: true,
  },
  {
    id: 'rep-004',
    name: 'David Park',
    strengths: ['Analytical', 'Friendly'],
    specialties: ['economy', 'hybrid', 'electric'],
    currentLoad: 0,
    closeRate: 61,
    available: false, // day off
  },
];
```
