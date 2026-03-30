// ─── matchSalespersonSkill ───────────────────────────────────────────
// Deterministic salesperson matching — no external API calls

import { PersonalityProfile, Salesperson, SalespersonMatch, VehicleData, PersonalityType } from '../types';

/**
 * Categorize a vehicle into a sales specialty area.
 */
function categorizeVehicle(vehicle: VehicleData): string {
  const bodyLower = vehicle.bodyClass.toLowerCase();
  const makeLower = vehicle.make.toLowerCase();

  if (/pickup|truck/i.test(bodyLower)) return 'trucks';
  if (/suv|sport utility/i.test(bodyLower)) return 'suv';
  if (/van|minivan/i.test(bodyLower)) return 'family';
  if (/sedan|coupe|convertible/i.test(bodyLower)) {
    if (/bmw|mercedes|audi|lexus|porsche|jaguar|maserati|bentley|rolls/i.test(makeLower)) return 'luxury';
    return 'sedans';
  }
  if (/motorcycle|motorbike/i.test(bodyLower)) return 'powersports';

  return 'general';
}

/**
 * Calculate personality fit score (0-1).
 */
function personalityFitScore(buyer: PersonalityProfile, rep: Salesperson): number {
  let score = 0;

  // Primary match
  if (rep.strengths.includes(buyer.primaryType)) score += 0.7;

  // Secondary match
  if (buyer.secondaryType && rep.strengths.includes(buyer.secondaryType)) score += 0.3;

  // Bonus: rep's top strength matches buyer's primary
  if (rep.strengths[0] === buyer.primaryType) score += 0.15;

  return Math.min(score, 1.0);
}

/**
 * Calculate specialty match score (0-1).
 */
function specialtyMatchScore(vehicleCategory: string, rep: Salesperson): number {
  if (rep.specialties.includes(vehicleCategory)) return 1.0;

  const related: Record<string, string[]> = {
    trucks: ['fleet', 'commercial'],
    luxury: ['premium', 'sports'],
    sedans: ['compact', 'hybrid'],
    suv: ['trucks', 'family'],
    family: ['suv', 'sedans'],
    powersports: ['trucks'],
  };

  if (related[vehicleCategory]?.some(r => rep.specialties.includes(r))) return 0.5;

  return 0;
}

/**
 * Calculate load penalty score (0-1, higher = worse).
 */
function loadPenaltyScore(rep: Salesperson): number {
  if (rep.currentLoad === 0) return 0;
  if (rep.currentLoad <= 2) return 0.2;
  if (rep.currentLoad <= 4) return 0.5;
  return 1.0;
}

/**
 * Generate a handoff script for the matched salesperson.
 */
function generateHandoffScript(
  rep: Salesperson,
  buyer: PersonalityProfile,
  vehicle: VehicleData
): string {
  const vehicleDesc = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim();
  const motivator = buyer.buyingMotivators[0] || 'this vehicle';

  const templates: Record<PersonalityType, string> = {
    Driver: `${rep.name}, this customer knows what they want — they're looking at the ${vehicleDesc}. They value straight talk and efficiency. Lead with performance specs and keep it tight.`,
    Analytical: `${rep.name}, this buyer is doing their homework on the ${vehicleDesc}. They'll appreciate detailed specs, competitor comparisons, and hard data. Give them time to process — don't rush.`,
    Friendly: `${rep.name}, you'll connect well with this customer — they're exploring the ${vehicleDesc} with ${motivator} in mind. Build rapport first, then walk through comfort and safety features.`,
    Expressive: `${rep.name}, this customer has great energy — they're excited about the ${vehicleDesc}. Show them the head-turning features first, match their enthusiasm, then get to the details.`,
  };

  return templates[buyer.primaryType];
}

/**
 * Match a buyer to the best available salesperson.
 *
 * @param buyerProfile - The buyer's personality profile
 * @param roster - Full salesperson roster
 * @param vehicle - Optional vehicle data for specialty matching
 * @returns Best match with score, reason, alternates, and handoff script
 */
export function matchSalesperson(
  buyerProfile: PersonalityProfile,
  roster: Salesperson[],
  vehicle?: VehicleData
): SalespersonMatch {
  // Filter to available reps only
  const available = roster.filter(r => r.available);

  if (available.length === 0) {
    throw new Error('ALL_BUSY: No salespersons currently available');
  }

  const vehicleCategory = vehicle ? categorizeVehicle(vehicle) : 'general';

  // Score each rep
  const scored = available.map(rep => {
    const pFit = personalityFitScore(buyerProfile, rep) * 0.45;
    const sFit = specialtyMatchScore(vehicleCategory, rep) * 0.25;
    const cRate = (rep.closeRate / 100) * 0.20;
    const lPen = loadPenaltyScore(rep) * 0.10;

    const total = pFit + sFit + cRate - lPen;

    return { rep, score: total, breakdown: { pFit, sFit, cRate, lPen } };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  const dummyVehicle: VehicleData = vehicle || {
    vin: '', year: 0, make: 'Unknown', model: 'Unknown', trim: '',
    bodyClass: '', driveType: '', engineCylinders: 0, engineDisplacement: '',
    fuelType: '', transmissionStyle: '', gvwr: '', wheelbase: '',
    msrp: null, plantCountry: '', doors: 0, seatRows: 0,
    steeringLocation: '', abs: false, tpms: false, esc: false,
    airBagCount: 0, confidence: 0, rawNhtsa: {},
  };

  // Build reason string
  const strengthMatch = best.rep.strengths.includes(buyerProfile.primaryType) ? 'personality-matched' : 'best available';
  const specialtyNote = best.breakdown.sFit > 0 ? ` and specializes in ${vehicleCategory}` : '';
  const reason = `${best.rep.name} is ${strengthMatch}${specialtyNote} with a ${best.rep.closeRate}% close rate`;

  return {
    recommended: best.rep,
    matchScore: Math.round(best.score * 100),
    reason,
    alternates: scored.slice(1, 3).map(s => s.rep),
    handoffScript: generateHandoffScript(best.rep, buyerProfile, dummyVehicle),
  };
}
