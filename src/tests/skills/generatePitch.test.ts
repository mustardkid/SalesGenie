import { generateSalesPitch } from '../../skills/generatePitch';

// Mock config so the test doesn't crash throwing "GEMINI_API_KEY is not configured"
jest.mock('../../config', () => ({
  config: { gemini: { apiKey: 'test-key', model: 'flash', maxOutputTokens: 200, temperature: 0.7 } }
}));

global.fetch = jest.fn();

describe('generatePitchSkill', () => {
  const dummyVehicle = {
    vin: '12345678901234567', year: 2024, make: 'Ford', model: 'F-150', trim: '',
    bodyClass: '', driveType: '', engineCylinders: 0, engineDisplacement: '',
    fuelType: '', transmissionStyle: '', gvwr: '', wheelbase: '',
    msrp: null, plantCountry: '', doors: 0, seatRows: 0,
    steeringLocation: '', abs: false, tpms: false, esc: false, airBagCount: 0,
    confidence: 100, rawNhtsa: {}
  };

  const dummyBuyer = {
    primaryType: 'Analytical' as const,
    confidence: 90,
    buyingMotivators: [], communicationTips: [], avoidTopics: [], reasoning: ''
  };

  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('should successfully parse a valid pitch response', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: '{"headline": "Test", "pitch": "data data data", "talkingPoints": [{},{},{}], "objectionHandlers": [{},{}]}' }]
          }
        }]
      })
    });

    const pitch = await generateSalesPitch(dummyVehicle, dummyBuyer);
    
    expect(pitch.headline).toBe('Test');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry if the first response misses quality gates', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            // Flawed response: only 1 talking point
            content: { parts: [{ text: '{"headline": "Test", "pitch": "data", "talkingPoints": [{}], "objectionHandlers": [{},{}]}' }] }
          }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            // Second attempt: fixed
            content: { parts: [{ text: '{"headline": "Test Fixed", "pitch": "data", "talkingPoints": [{},{},{}], "objectionHandlers": [{},{}]}' }] }
          }]
        })
      });

    const pitch = await generateSalesPitch(dummyVehicle, dummyBuyer);
    
    expect(pitch.headline).toBe('Test Fixed');
    expect(fetch).toHaveBeenCalledTimes(2); // Retries internally
  });
});
