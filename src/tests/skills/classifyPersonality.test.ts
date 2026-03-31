import { classifyPersonality } from '../../skills/classifyPersonality';

global.fetch = jest.fn();

describe('classifyPersonalitySkill', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('should successfully parse a Markdown-fenced JSON response from Gemini', async () => {
    const geminiResponseText = `
\`\`\`json
{
  "primaryType": "Analytical",
  "secondaryType": "Driver",
  "confidence": 85,
  "reasoning": "Focused on specs and numbers",
  "buyingMotivators": ["Safety ratings", "Fuel economy"],
  "communicationTips": ["Use data", "Don't rush"],
  "avoidTopics": ["Fluff", "High-pressure tactics"]
}
\`\`\`
    `;

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: geminiResponseText }] }
        }]
      })
    });

    const result = await classifyPersonality([
      { question: "What matters?", answer: "Specs" },
      { question: "How do you decide?", answer: "Research" },
      { question: "What do you want?", answer: "Data" }
    ]);
    
    expect(result.primaryType).toBe('Analytical');
    expect(result.confidence).toBe(85);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should default to Friendly if Gemini returns confidence under 40% even after retrying', async () => {
    // We mock the first call (low confidence) and the second automatic retry call (also low confidence)
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: '{"primaryType": "Driver", "confidence": 30, "buyingMotivators": [], "communicationTips": [], "avoidTopics": [], "reasoning": "Unsure"}' }] }
          }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: '{"primaryType": "Driver", "confidence": 35, "buyingMotivators": [], "communicationTips": [], "avoidTopics": [], "reasoning": "Still unsure"}' }] }
          }]
        })
      });

    const result = await classifyPersonality([
      { question: "What do you like?", answer: "Cars I guess." },
      { question: "Colors?", answer: "Red." },
      { question: "Why?", answer: "Because." }
    ]);
    
    expect(result.primaryType).toBe('Friendly'); // Safest fallback archetype
    expect(fetch).toHaveBeenCalledTimes(2); // Initial try + follow-up try
  });
});
