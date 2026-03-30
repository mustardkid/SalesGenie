// ─── generateSalesPitchSkill ─────────────────────────────────────────
// Uses Gemini to generate a personality-aware sales pitch

import { VehicleData, PersonalityProfile, DealerContext, SalesPitch, PersonalityType } from '../types';
import { config } from '../config';

/**
 * Extract clean JSON from Gemini responses.
 * Handles: ```json fences, **bold markers**, stray text before/after JSON.
 */
function extractJson(text: string): string {
  // Step 1: Strip markdown code fences
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Step 2: Strip bold markers (**) that Gemini sometimes wraps around JSON
  cleaned = cleaned.replace(/\*\*/g, '');

  // Step 3: Extract the first complete JSON object { ... }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }

  return cleaned.trim();
}

/**
 * Personality-specific pitch rules injected into the Gemini prompt.
 */
const PERSONALITY_RULES: Record<PersonalityType, string> = {
  Driver: `
PITCH RULES FOR DRIVER BUYER:
- Be direct and concise — max 5 sentences
- Lead with power, performance, and exclusivity
- Use words like "best-in-class", "dominant", "unmatched"
- Close with urgency: "This won't last"
- Avoid fluff, stories, or emotional appeals`,

  Analytical: `
PITCH RULES FOR ANALYTICAL BUYER:
- Lead with data: specs, ratings, TCO analysis
- Include specific numbers (towing capacity, fuel economy, resale %)
- Compare to competitors with factual advantages
- Close with logic: "The data speaks for itself"
- Avoid pressure tactics or emotional manipulation`,

  Friendly: `
PITCH RULES FOR FRIENDLY BUYER:
- Use warm, inclusive language ("your family", "you'll love")
- Lead with safety, comfort, and reliability
- Tell a brief relatable story or scenario
- Close with reassurance: "You're making a great choice"
- Avoid aggressive tactics or data overload`,

  Expressive: `
PITCH RULES FOR EXPRESSIVE BUYER:
- Use exciting, visual language ("head-turner", "jaw-dropping")
- Lead with style, uniqueness, and lifestyle fit
- Paint a picture: "Imagine pulling up to..."
- Close with FOMO: "This color/trim is rare"
- Avoid boring spec sheets or lengthy comparisons`,
};

/**
 * Build the Gemini prompt for pitch generation.
 */
function buildPitchPrompt(
  vehicle: VehicleData,
  personality: PersonalityProfile,
  dealerContext?: DealerContext
): string {
  let prompt = `You are an elite automotive sales copywriter with 15 years of experience at premium dealerships. You write pitches that close deals.

VEHICLE DATA:
Year: ${vehicle.year}
Make: ${vehicle.make}
Model: ${vehicle.model}
Trim: ${vehicle.trim || 'Base'}
Engine: ${vehicle.engineDisplacement} ${vehicle.engineCylinders}-cylinder (${vehicle.fuelType})
Drive: ${vehicle.driveType}
Body: ${vehicle.bodyClass}
Transmission: ${vehicle.transmissionStyle}
GVWR: ${vehicle.gvwr}

BUYER PROFILE:
Type: ${personality.primaryType} (${personality.confidence}% confidence)
Motivators: ${personality.buyingMotivators.join(', ')}
Communication tips: ${personality.communicationTips.join('; ')}
Avoid: ${personality.avoidTopics.join(', ')}
`;

  if (dealerContext) {
    prompt += `
DEALER CONTEXT:
Current promos: ${dealerContext.currentPromos.join(', ') || 'None'}
Days on lot: ${dealerContext.inventoryDays}
`;
    if (dealerContext.competitorPricing.length > 0) {
      prompt += `Competitor pricing: ${dealerContext.competitorPricing.join(', ')}\n`;
    }
  }

  prompt += PERSONALITY_RULES[personality.primaryType];

  prompt += `

OUTPUT FORMAT — valid JSON only, no markdown fences:
{
  "headline": "attention-grabbing single line with specific vehicle spec",
  "pitch": "exactly 5 sentences tailored to the buyer personality above",
  "talkingPoints": [
    { "topic": "Feature Name", "point": "Specific data point", "whyItMatters": "Why this matters for this buyer type" }
  ],
  "objectionHandlers": [
    { "objection": "Common objection", "response": "Tailored response", "technique": "Sales technique name" }
  ],
  "closingStrategy": "The recommended close technique for this personality type",
  "urgencyHook": "Time or scarcity based motivator"
}

Generate at least 3 talking points and at least 2 objection handlers.
Reference at least 2 specific vehicle specs in the pitch.`;

  return prompt;
}

/**
 * Validate pitch quality.
 */
function validatePitch(pitch: SalesPitch, personality: PersonalityType): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!pitch.talkingPoints || pitch.talkingPoints.length < 3) {
    issues.push('Need at least 3 talking points');
  }

  if (!pitch.objectionHandlers || pitch.objectionHandlers.length < 2) {
    issues.push('Need at least 2 objection handlers');
  }

  if (!pitch.pitch) {
    issues.push('Pitch text is empty');
  }

  if (!pitch.headline) {
    issues.push('Headline is empty');
  }

  // Personality language check
  const signals: Record<PersonalityType, RegExp> = {
    Driver: /best|power|dominate|fastest|unmatched|elite|class-leading|command/i,
    Analytical: /data|percent|compared|ratio|cost|value|rated|TCO|efficiency|spec|number/i,
    Friendly: /family|safe|comfort|peace of mind|enjoy|love|warm|trust|reliable/i,
    Expressive: /imagine|stunning|head-turn|exclusive|rare|adventure|style|unique|gorgeous/i,
  };

  if (pitch.pitch && !signals[personality]?.test(pitch.pitch)) {
    issues.push(`Pitch doesn't use ${personality}-specific language`);
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Generate a personality-aware sales pitch.
 *
 * @param vehicle - Decoded vehicle data
 * @param personality - Buyer personality profile
 * @param dealerContext - Optional dealer promos and context
 * @returns Complete SalesPitch with talking points and objection handlers
 */
export async function generateSalesPitch(
  vehicle: VehicleData,
  personality: PersonalityProfile,
  dealerContext?: DealerContext
): Promise<SalesPitch> {
  if (!config.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;

  let bestPitch: SalesPitch | null = null;
  let bestIssueCount = Infinity;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const prompt = buildPitchPrompt(vehicle, personality, dealerContext);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: config.gemini.maxOutputTokens,
          temperature: config.gemini.temperature,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} — ${errorText}`);
    }

    const data: any = await response.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      console.warn(`Pitch generation attempt ${attempt}: empty response`);
      continue;
    }

    const cleaned = extractJson(text);

    let pitch: SalesPitch;
    try {
      pitch = JSON.parse(cleaned);
    } catch (parseError) {
      console.warn(`   ⚠️ Pitch attempt ${attempt}/3: JSON parse failed — response may be truncated`);
      console.warn(`   Raw length: ${text.length} chars, cleaned length: ${cleaned.length} chars`);
      continue;
    }

    const validation = validatePitch(pitch, personality.primaryType);

    if (validation.valid) {
      return pitch; // Perfect — return immediately
    }

    if (validation.issues.length < bestIssueCount) {
      bestPitch = pitch;
      bestIssueCount = validation.issues.length;
    }

    console.warn(
      `Pitch attempt ${attempt}/3 had issues: ${validation.issues.join(', ')}`
    );
  }

  // Return best attempt with warning
  if (bestPitch) {
    console.warn('⚠️ Returning best pitch attempt — some quality gates failed');
    return bestPitch;
  }

  throw new Error('Failed to generate pitch after 3 attempts');
}
