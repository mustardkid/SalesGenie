// ─── buildListingSkill ───────────────────────────────────────────────
// Uses Gemini to generate marketplace-ready vehicle listings

import { VehicleData, VehicleListing } from '../types';
import { config } from '../config';

/**
 * Extract clean JSON from Gemini responses.
 * Handles: ```json fences, **bold markers**, stray text before/after JSON.
 */
function extractJson(text: string): string {
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  cleaned = cleaned.replace(/\*\*/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }
  return cleaned.trim();
}

/**
 * Assess photo coverage and suggest missing shots.
 */
export function assessPhotoCoverage(photos: string[]): string[] {
  const expected = [
    'Exterior front 3/4 angle',
    'Exterior rear 3/4 angle',
    'Driver side profile',
    'Passenger side profile',
    'Interior dashboard',
    'Interior rear seats',
    'Engine bay',
    'Cargo area / truck bed',
  ];

  if (!photos || photos.length === 0) {
    return expected.map(p => `Missing: ${p} — add this photo to improve listing quality`);
  }

  // If we have fewer than expected, suggest more
  if (photos.length < expected.length) {
    return expected
      .slice(photos.length)
      .map(p => `Consider adding: ${p}`);
  }

  return [];
}

/**
 * Build a marketplace-ready vehicle listing.
 *
 * @param vehicle - Decoded vehicle data
 * @param photos - Optional photo URLs
 * @param sellerNotes - Optional notes from the seller
 * @param platform - Target platform (autotrader, facebook, craigslist, cargurus)
 */
export async function buildListing(
  vehicle: VehicleData,
  photos?: string[],
  sellerNotes?: string,
  platform?: string
): Promise<VehicleListing> {
  if (!config.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const targetPlatform = platform || 'general';
  const missingPhotos = assessPhotoCoverage(photos || []);

  const prompt = `You are a vehicle listing expert who writes compelling listings that sell vehicles fast.

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
Plant: ${vehicle.plantCountry}

TARGET PLATFORM: ${targetPlatform}
${sellerNotes ? `SELLER NOTES: ${sellerNotes}` : ''}

Create a compelling vehicle listing optimized for ${targetPlatform}.

OUTPUT FORMAT — valid JSON only, no markdown fences:
{
  "title": "SEO-optimized listing title (max 80 chars)",
  "bullets": ["5-8 key selling point bullets"],
  "description": "150-300 word compelling description",
  "seoTags": ["relevant search tags"],
  "pricePositioning": "Market positioning statement"
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: config.gemini.maxOutputTokens,
        temperature: 0.6, // slightly lower temp for listings
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data: any = await response.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!text) {
    throw new Error('Gemini returned empty listing response');
  }

  const cleaned = extractJson(text);
  const listing: VehicleListing = JSON.parse(cleaned);

  // Add our photo assessment
  listing.missingPhotoSuggestions = missingPhotos;

  return listing;
}
