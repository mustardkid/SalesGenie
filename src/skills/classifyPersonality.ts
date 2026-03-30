// ─── classifyPersonalitySkill ────────────────────────────────────────
// Uses Gemini to classify buyer into DISC-variant personality archetype

import { QuestionAnswer, PersonalityProfile, PersonalityType } from '../types';
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
 * Default questions for buyer personality profiling.
 */
export const DEFAULT_QUESTIONS: { id: string; question: string }[] = [
  { id: 'q1', question: "What's the most important thing you're looking for in your next vehicle?" },
  { id: 'q2', question: 'How do you usually make big purchase decisions?' },
  { id: 'q3', question: 'What do you love about your current vehicle — or hate about it?' },
  { id: 'q4', question: 'Who else is involved in this decision?' },
  { id: 'q5', question: 'What would make you drive off the lot today?' },
];

/**
 * Generate a follow-up question when classification confidence is low.
 */
export function generateFollowUp(ambiguousTypes: PersonalityType[]): string {
  const sorted = [...ambiguousTypes].sort();
  const key = sorted.join('-');

  const followUps: Record<string, string> = {
    'Analytical-Driver': 'If you could only pick one — raw performance or proven reliability — which wins?',
    'Driver-Expressive': "Are you drawn to a vehicle because it's the most powerful, or because it turns heads?",
    'Analytical-Friendly': 'When choosing between the safest option and the best-rated option, which pulls you more?',
    'Expressive-Friendly': 'Is it more important that your family loves it, or that you love looking at it?',
    'Driver-Friendly': 'Do you prioritize getting things done, or making sure everyone is comfortable?',
    'Analytical-Expressive': 'Do you trust the numbers, or do you trust your gut?',
  };

  return followUps[key] || 'What would make this the perfect vehicle for you?';
}

/**
 * Build the Gemini classification prompt.
 */
function buildPrompt(answers: QuestionAnswer[], observedCues?: string[]): string {
  let prompt = `You are a DISC-model sales psychology expert with 20 years of experience profiling car buyers.

Analyze the following buyer responses and behavioral cues to classify their personality archetype.

BUYER RESPONSES:
`;

  for (const a of answers) {
    prompt += `Q: ${a.question}\nA: ${a.answer}\n\n`;
  }

  if (observedCues && observedCues.length > 0) {
    prompt += `SALESPERSON OBSERVATIONS:\n`;
    for (const cue of observedCues) {
      prompt += `- ${cue}\n`;
    }
    prompt += '\n';
  }

  prompt += `Classify the buyer into exactly one PRIMARY type and optionally one SECONDARY type.
Types: Driver, Analytical, Friendly, Expressive.

RULES:
1. Assign exactly ONE primary type
2. Optionally assign ONE secondary type (if buyer shows strong dual traits)
3. Set confidence from 0-100 (80+ = clear, 60-79 = likely, <60 = ambiguous)
4. Provide 3+ specific communication tips for this buyer
5. List 2+ topics to AVOID with this buyer
6. List 3+ buying motivators for this buyer

Respond with valid JSON only. No markdown fences. Schema:
{
  "primaryType": "Driver" | "Analytical" | "Friendly" | "Expressive",
  "secondaryType": "Driver" | "Analytical" | "Friendly" | "Expressive" | null,
  "confidence": number,
  "reasoning": "string explaining your classification",
  "communicationTips": ["string"],
  "avoidTopics": ["string"],
  "buyingMotivators": ["string"]
}`;

  return prompt;
}

/**
 * Call Gemini API for personality classification.
 */
async function callGemini(prompt: string): Promise<PersonalityProfile> {
  if (!config.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;

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
    throw new Error('Gemini returned empty response');
  }

  // CRITICAL: Extract JSON from Gemini response
  const cleaned = extractJson(text);
  const profile: PersonalityProfile = JSON.parse(cleaned);

  return profile;
}

/**
 * Classify a buyer's personality from their answers and optional observed cues.
 *
 * @param answers - Array of question-answer pairs (minimum 3)
 * @param observedCues - Optional salesperson observations
 * @returns PersonalityProfile with type, confidence, and communication tips
 */
export async function classifyPersonality(
  answers: QuestionAnswer[],
  observedCues?: string[]
): Promise<PersonalityProfile> {
  if (answers.length < 3) {
    throw new Error('At least 3 buyer answers are required for classification');
  }

  const prompt = buildPrompt(answers, observedCues);
  const profile = await callGemini(prompt);

  // Validate the response
  const validTypes: PersonalityType[] = ['Driver', 'Analytical', 'Friendly', 'Expressive'];
  if (!validTypes.includes(profile.primaryType)) {
    throw new Error(`Invalid personality type returned: ${profile.primaryType}`);
  }

  return profile;
}
