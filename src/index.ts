#!/usr/bin/env node
// ─── SalesGenie CLI ─────────────────────────────────────────────────
// Entry point for running directives from the command line

import { orchestrate } from './agents/OrchestratorAgent';
import { validateConfig } from './config';
import { QuestionAnswer } from './types';

/**
 * Parse command-line arguments.
 */
function parseArgs(): { vin?: string; personality?: string; directive?: string; listing?: boolean } {
  const args = process.argv.slice(2);
  const result: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--vin':
        result.vin = args[++i];
        break;
      case '--personality':
        result.personality = args[++i];
        break;
      case '--directive':
        result.directive = args[++i];
        break;
      case '--listing':
        result.listing = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🚗 SalesGenie CLI                         ║
║            Agent-Driven VIN Sales Intelligence               ║
╚══════════════════════════════════════════════════════════════╝

USAGE:
  npx ts-node src/index.ts [OPTIONS]

OPTIONS:
  --vin <VIN>              17-character Vehicle Identification Number
  --personality <TYPE>     Preset buyer personality: Driver, Analytical, 
                           Friendly, or Expressive
  --directive <TEXT>       Natural language directive (overrides other flags)
  --listing                Include marketplace listing generation
  --help                   Show this help message

EXAMPLES:
  # Full sales brief with preset personality
  npx ts-node src/index.ts --vin 3C6UR5FL1KG501234 --personality Analytical

  # VIN decode only
  npx ts-node src/index.ts --directive "Decode VIN 3C6UR5FL1KG501234"

  # Full brief with listing
  npx ts-node src/index.ts --vin WBAJB0C51JB084901 --personality Expressive --listing

  # Natural language directive
  npx ts-node src/index.ts --directive "Scan VIN 1FTEW1E53NFC12345 and generate a pitch for a Driver buyer"

ENVIRONMENT:
  GEMINI_API_KEY           Required for personality classification and pitch generation
                           Set in .env file or as environment variable
  `);
}

function printSalesBrief(brief: any): void {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    📋 SALES BRIEF                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (brief.vehicle) {
    console.log('\n── Vehicle ────────────────────────────────────────────────');
    console.log(`   ${brief.vehicle.year} ${brief.vehicle.make} ${brief.vehicle.model} ${brief.vehicle.trim}`);
    console.log(`   VIN: ${brief.vehicle.vin}`);
    console.log(`   Engine: ${brief.vehicle.engineDisplacement} ${brief.vehicle.engineCylinders}-cyl (${brief.vehicle.fuelType})`);
    console.log(`   Drive: ${brief.vehicle.driveType}`);
    console.log(`   Body: ${brief.vehicle.bodyClass}`);
    console.log(`   GVWR: ${brief.vehicle.gvwr}`);
    console.log(`   Confidence: ${brief.vehicle.confidence}%`);
  }

  if (brief.buyerProfile) {
    console.log('\n── Buyer Profile ──────────────────────────────────────────');
    console.log(`   Type: ${brief.buyerProfile.primaryType}${brief.buyerProfile.secondaryType ? ` / ${brief.buyerProfile.secondaryType}` : ''}`);
    console.log(`   Confidence: ${brief.buyerProfile.confidence}%`);
    console.log(`   Motivators: ${brief.buyerProfile.buyingMotivators.join(', ')}`);
    console.log(`   Tips: ${brief.buyerProfile.communicationTips.join('; ')}`);
  }

  if (brief.salespersonMatch) {
    console.log('\n── Rep Match ──────────────────────────────────────────────');
    console.log(`   Recommended: ${brief.salespersonMatch.recommended.name} (score: ${brief.salespersonMatch.matchScore})`);
    console.log(`   Reason: ${brief.salespersonMatch.reason}`);
    console.log(`   Handoff: "${brief.salespersonMatch.handoffScript}"`);
  }

  if (brief.pitch) {
    console.log('\n── Sales Pitch ────────────────────────────────────────────');
    console.log(`   📌 ${brief.pitch.headline}`);
    console.log(`\n   ${brief.pitch.pitch}`);

    if (brief.pitch.talkingPoints?.length > 0) {
      console.log('\n   Talking Points:');
      for (const tp of brief.pitch.talkingPoints) {
        console.log(`   • ${tp.topic}: ${tp.point}`);
      }
    }

    if (brief.pitch.objectionHandlers?.length > 0) {
      console.log('\n   Objection Handlers:');
      for (const oh of brief.pitch.objectionHandlers) {
        console.log(`   • "${oh.objection}" → ${oh.response} (${oh.technique})`);
      }
    }

    if (brief.pitch.closingStrategy) {
      console.log(`\n   Closing Strategy: ${brief.pitch.closingStrategy}`);
    }
    if (brief.pitch.urgencyHook) {
      console.log(`   Urgency: ${brief.pitch.urgencyHook}`);
    }
  }

  if (brief.listing) {
    console.log('\n── Listing ────────────────────────────────────────────────');
    console.log(`   Title: ${brief.listing.title}`);
    if (brief.listing.bullets) {
      for (const bullet of brief.listing.bullets) {
        console.log(`   • ${bullet}`);
      }
    }
  }

  console.log('\n── Metadata ───────────────────────────────────────────────');
  console.log(`   Time: ${brief.metadata.totalTimeMs}ms`);
  console.log(`   Agents: ${brief.metadata.agentsRun.join(' → ')}`);
  if (brief.metadata.errors.length > 0) {
    console.log(`   Errors: ${brief.metadata.errors.join('; ')}`);
  }
  console.log('');
}

// ─── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('');
  console.log('🚗 SalesGenie — Agent-Driven VIN Sales Intelligence');
  console.log('───────────────────────────────────────────────────');

  validateConfig();

  const args = parseArgs();

  // Build directive from arguments
  let directive: string;

  if (args.directive) {
    directive = args.directive as string;
  } else if (args.vin) {
    directive = `Scan VIN ${args.vin}`;
    if (args.personality) directive += ` for a ${args.personality} buyer`;
    if (args.listing) directive += ' and build a listing';
    directive += ' and generate a sales brief with match';
  } else {
    // Demo mode with a sample VIN
    console.log('\n📋 No VIN provided — running demo with sample VIN...\n');
    directive = 'Scan VIN 3C6UR5FL1KG501234 and generate a pitch for an Analytical buyer with match';
  }

  console.log(`\n📨 Directive: "${directive}"\n`);

  try {
    const brief = await orchestrate({ directive });
    printSalesBrief(brief);
  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
