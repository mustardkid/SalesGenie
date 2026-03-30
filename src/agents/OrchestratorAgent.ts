// ─── OrchestratorAgent ──────────────────────────────────────────────
// Master agent: parses directives, spawns agents, aggregates results

import {
  SalesBrief, ParsedDirective, PersonalityProfile, VehicleData,
  SalespersonMatch, SalesPitch, VehicleListing,
  QuestionAnswer, Salesperson, DealerContext, PersonalityType,
} from '../types';
import { decodeVin } from '../skills/decodeVin';
import { classifyPersonality } from '../skills/classifyPersonality';
import { matchSalesperson } from '../skills/matchSalesperson';
import { generateSalesPitch } from '../skills/generatePitch';
import { buildListing } from '../skills/buildListing';

// ─── Directive Parsing ───────────────────────────────────────────────

/**
 * Extract a VIN from natural language input.
 */
function extractVin(input: string): string | null {
  const match = input.match(/[A-HJ-NPR-Z0-9]{17}/i);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Detect if a personality type is preset in the directive.
 */
function extractPresetPersonality(input: string): PersonalityType | null {
  const patterns: [RegExp, PersonalityType][] = [
    [/\b(driver|dominant|assertive|decisive)\b/i, 'Driver'],
    [/\b(analytical|conscientious|data.driven|cautious)\b/i, 'Analytical'],
    [/\b(friendly|steady|warm|relationship)\b/i, 'Friendly'],
    [/\b(expressive|influential|enthusiastic|spontaneous)\b/i, 'Expressive'],
  ];

  for (const [pattern, type] of patterns) {
    if (pattern.test(input)) return type;
  }
  return null;
}

/**
 * Parse a natural language directive into structured intent.
 */
export function parseDirective(input: string): ParsedDirective {
  return {
    hasVin: /[A-HJ-NPR-Z0-9]{17}/i.test(input),
    hasBuyerData: /personality|buyer|profile|answers|cues|classify/i.test(input) ||
                  extractPresetPersonality(input) !== null,
    wantsPitch: /pitch|sell|brief|sales|generate/i.test(input) ||
                !(/listing only|decode only|profile only/i.test(input)),
    wantsMatch: /match|rep|salesperson|who should/i.test(input),
    wantsListing: /listing|post|marketplace|autotrader|craigslist|facebook/i.test(input),
    presetPersonality: extractPresetPersonality(input),
    vin: extractVin(input),
    buyerAnswers: [],
  };
}

// ─── Sample Data ─────────────────────────────────────────────────────

const SAMPLE_ROSTER: Salesperson[] = [
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
    specialties: ['family', 'suv', 'sedans'],
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
    available: true,
  },
];

/**
 * Build a default personality profile from a preset type.
 */
function buildPresetProfile(type: PersonalityType): PersonalityProfile {
  const profiles: Record<PersonalityType, PersonalityProfile> = {
    Driver: {
      primaryType: 'Driver',
      secondaryType: null,
      confidence: 90,
      reasoning: 'Preset as Driver personality',
      communicationTips: ['Be direct and concise', 'Lead with results', 'Let them feel in control'],
      avoidTopics: ['Long stories', 'Too many options', 'Emotional appeals'],
      buyingMotivators: ['Performance', 'Exclusivity', 'Status'],
    },
    Analytical: {
      primaryType: 'Analytical',
      secondaryType: null,
      confidence: 90,
      reasoning: 'Preset as Analytical personality',
      communicationTips: ['Lead with data', 'Provide comparisons', 'Give them time'],
      avoidTopics: ['Pressure tactics', 'Emotional manipulation', 'Rushing'],
      buyingMotivators: ['Value', 'Reliability', 'Data-backed decisions'],
    },
    Friendly: {
      primaryType: 'Friendly',
      secondaryType: null,
      confidence: 90,
      reasoning: 'Preset as Friendly personality',
      communicationTips: ['Build rapport', 'Emphasize safety', 'Be patient'],
      avoidTopics: ['Aggressive closing', 'Tech overload', 'Pressure'],
      buyingMotivators: ['Family safety', 'Comfort', 'Peace of mind'],
    },
    Expressive: {
      primaryType: 'Expressive',
      secondaryType: null,
      confidence: 90,
      reasoning: 'Preset as Expressive personality',
      communicationTips: ['Match their energy', 'Paint a picture', 'Use stories'],
      avoidTopics: ['Boring specs', 'Spreadsheets', 'Monotone delivery'],
      buyingMotivators: ['Style', 'Uniqueness', 'Social status'],
    },
  };

  return profiles[type];
}

// ─── Orchestrator Execution ──────────────────────────────────────────

interface OrchestratorOptions {
  directive: string;
  buyerAnswers?: QuestionAnswer[];
  observedCues?: string[];
  roster?: Salesperson[];
  dealerContext?: DealerContext;
}

/**
 * Execute the full orchestration pipeline.
 *
 * This is the main entry point — pass a natural language directive
 * and the Orchestrator figures out which agents to run.
 */
export async function orchestrate(options: OrchestratorOptions): Promise<SalesBrief> {
  const startTime = Date.now();
  const errors: string[] = [];
  const agentsRun: string[] = [];

  console.log('\n🎯 Orchestrator: Parsing directive...');
  const parsed = parseDirective(options.directive);
  parsed.buyerAnswers = options.buyerAnswers || [];

  console.log(`   VIN detected: ${parsed.vin || 'none'}`);
  console.log(`   Preset personality: ${parsed.presetPersonality || 'none'}`);
  console.log(`   Wants pitch: ${parsed.wantsPitch}`);
  console.log(`   Wants match: ${parsed.wantsMatch}`);
  console.log(`   Wants listing: ${parsed.wantsListing}`);

  // ── Phase 1: Parallel data gathering ──────────────────────────────
  console.log('\n⚡ Phase 1: Gathering data (parallel)...');

  let vehicleData: VehicleData | undefined;
  let personalityProfile: PersonalityProfile | undefined;

  const phase1Tasks: Promise<void>[] = [];

  // VIN Decode
  if (parsed.vin) {
    phase1Tasks.push(
      (async () => {
        try {
          console.log('   🔍 VinDecoderAgent: Calling NHTSA...');
          agentsRun.push('VinDecoderAgent');
          vehicleData = await decodeVin(parsed.vin!);
          console.log(`   ✅ VinDecoderAgent: ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} ${vehicleData.trim} (confidence: ${vehicleData.confidence})`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`VinDecoderAgent: ${msg}`);
          console.error(`   ❌ VinDecoderAgent: ${msg}`);
        }
      })()
    );
  }

  // Personality Classification
  if (parsed.presetPersonality) {
    personalityProfile = buildPresetProfile(parsed.presetPersonality);
    console.log(`   🧠 PersonalityClassifier: Using preset → ${parsed.presetPersonality}`);
    agentsRun.push('PersonalityClassifierAgent (preset)');
  } else if (parsed.buyerAnswers.length >= 3) {
    phase1Tasks.push(
      (async () => {
        try {
          console.log('   🧠 PersonalityClassifierAgent: Analyzing buyer...');
          agentsRun.push('PersonalityClassifierAgent');
          personalityProfile = await classifyPersonality(parsed.buyerAnswers, options.observedCues);
          console.log(`   ✅ PersonalityClassifierAgent: ${personalityProfile.primaryType} (confidence: ${personalityProfile.confidence}%)`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`PersonalityClassifierAgent: ${msg}`);
          console.error(`   ❌ PersonalityClassifierAgent: ${msg}`);
          // Fallback to Friendly
          personalityProfile = buildPresetProfile('Friendly');
          console.log('   ⚠️ Falling back to Friendly personality');
        }
      })()
    );
  } else {
    // No buyer data and no preset — default to Friendly
    personalityProfile = buildPresetProfile('Friendly');
    console.log('   ℹ️ No buyer data — defaulting to Friendly personality');
    agentsRun.push('PersonalityClassifierAgent (default)');
  }

  await Promise.all(phase1Tasks);

  // ── Phase 2: Sales Matchmaker ─────────────────────────────────────
  let salespersonMatch: SalespersonMatch | undefined;

  if (parsed.wantsMatch && personalityProfile) {
    console.log('\n🤝 Phase 2: Matching salesperson...');
    try {
      agentsRun.push('SalesMatchmakerAgent');
      const roster = options.roster || SAMPLE_ROSTER;
      salespersonMatch = matchSalesperson(personalityProfile, roster, vehicleData);
      console.log(`   ✅ SalesMatchmakerAgent: ${salespersonMatch.recommended.name} (score: ${salespersonMatch.matchScore})`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`SalesMatchmakerAgent: ${msg}`);
      console.error(`   ❌ SalesMatchmakerAgent: ${msg}`);
    }
  }

  // ── Phase 3: Sales Pitch ──────────────────────────────────────────
  let salesPitch: SalesPitch | undefined;

  if (parsed.wantsPitch && vehicleData && personalityProfile) {
    console.log('\n✍️ Phase 3: Generating sales pitch...');
    try {
      agentsRun.push('SalesPitchAgent');
      salesPitch = await generateSalesPitch(vehicleData, personalityProfile, options.dealerContext);
      console.log(`   ✅ SalesPitchAgent: "${salesPitch.headline}"`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`SalesPitchAgent: ${msg}`);
      console.error(`   ❌ SalesPitchAgent: ${msg}`);
    }
  }

  // ── Phase 4: Listing (conditional) ────────────────────────────────
  let vehicleListing: VehicleListing | undefined;

  if (parsed.wantsListing && vehicleData) {
    console.log('\n📝 Phase 4: Building listing...');
    try {
      agentsRun.push('ListingAgent');
      vehicleListing = await buildListing(vehicleData);
      console.log(`   ✅ ListingAgent: "${vehicleListing.title}"`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`ListingAgent: ${msg}`);
      console.error(`   ❌ ListingAgent: ${msg}`);
    }
  }

  // ── Aggregate ─────────────────────────────────────────────────────
  const totalTimeMs = Date.now() - startTime;

  console.log(`\n🏁 Orchestrator: Complete in ${totalTimeMs}ms (${agentsRun.length} agents)`);
  if (errors.length > 0) {
    console.log(`   ⚠️ ${errors.length} error(s): ${errors.join('; ')}`);
  }

  return {
    directive: options.directive,
    vehicle: vehicleData!,
    buyerProfile: personalityProfile!,
    salespersonMatch: salespersonMatch!,
    pitch: salesPitch!,
    listing: vehicleListing,
    metadata: {
      totalTimeMs,
      agentsRun,
      errors,
      timestamp: new Date().toISOString(),
    },
  };
}
