// ─── Configuration ───────────────────────────────────────────────────
// Environment variables and API configuration

import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  // NHTSA API (free, no key required)
  nhtsa: {
    baseUrl: 'https://vpic.nhtsa.dot.gov/api/vehicles',
    timeout: 5000,
    retries: 3,
  },

  // Gemini AI
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-2.5-flash', // DO NOT CHANGE — only tested model
    maxOutputTokens: 4096,
    temperature: 0.7,
  },

  // Orchestrator
  orchestrator: {
    defaultDirective: 'D-001', // Full Sales Brief
    maxRetries: 2,
    timeouts: {
      vinDecode: 5000,
      personalityClassify: 8000,
      salesMatch: 2000,
      salesPitch: 10000,
      buildListing: 8000,
    },
  },
} as const;

// Validate critical configuration
export function validateConfig(): void {
  if (!config.gemini.apiKey) {
    console.warn(
      '⚠️  GEMINI_API_KEY not set. Personality classification and pitch generation will fail.\n' +
      '   Set it in .env or as an environment variable.'
    );
  }
}
