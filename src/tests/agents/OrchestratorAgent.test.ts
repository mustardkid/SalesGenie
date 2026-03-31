import { OrchestratorAgent } from '../../agents/OrchestratorAgent';
import * as decodeVinModule from '../../skills/decodeVin';
import * as classifyPersonalityModule from '../../skills/classifyPersonality';
import * as matchSalespersonModule from '../../skills/matchSalesperson';
import * as generatePitchModule from '../../skills/generatePitch';
import { orchestrate } from '../../agents/OrchestratorAgent';

jest.mock('../../skills/decodeVin');
jest.mock('../../skills/classifyPersonality');
jest.mock('../../skills/matchSalesperson');
jest.mock('../../skills/generatePitch');

describe('OrchestratorAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs Phase 1 (VIN & Personality) in parallel, then phases 2 & 3', async () => {
    (decodeVinModule.decodeVin as jest.Mock).mockResolvedValue({ vin: '12345', confidence: 95 });
    (classifyPersonalityModule.classifyPersonality as jest.Mock).mockResolvedValue({ primaryType: 'Friendly', confidence: 90 });
    (matchSalespersonModule.matchSalesperson as jest.Mock).mockReturnValue({ recommended: { id: 'SP-1', name: 'Test' }, matchScore: 85 });
    (generatePitchModule.generateSalesPitch as jest.Mock).mockResolvedValue({ headline: 'Buy this car', pitch: 'It is great' });

    const result = await orchestrate({ 
      directive: 'sell me a car with vin 1234567890123456A and match me with a salesperson',
      buyerAnswers: [{questionId: '1', question: 'a', answer: 'a'}, {questionId: '2', question: 'b', answer: 'b'}, {questionId: '3', question: 'c', answer: 'c'} ]
    });

    expect(decodeVinModule.decodeVin).toHaveBeenCalled();
    expect(classifyPersonalityModule.classifyPersonality).toHaveBeenCalled();
    expect(matchSalespersonModule.matchSalesperson).toHaveBeenCalled();
    expect(generatePitchModule.generateSalesPitch).toHaveBeenCalled();

    expect(result.salespersonMatch.recommended.id).toBe('SP-1');
  });

  it('handles low confidence fallback for VinDecoder gracefully (error added to aggregate)', async () => {
    (decodeVinModule.decodeVin as jest.Mock).mockRejectedValue(new Error('VinDecoder confidence < 80%'));
    (classifyPersonalityModule.classifyPersonality as jest.Mock).mockResolvedValue({ primaryType: 'Friendly', confidence: 90 });
    
    const result = await orchestrate({ 
      directive: '1234567890123456A', 
      buyerAnswers: [{questionId: '3', question: 'c', answer: 'c'}, {questionId: '3', question: 'c', answer: 'c'}, {questionId: '3', question: 'c', answer: 'c'}]
    });

    expect(decodeVinModule.decodeVin).toHaveBeenCalled();
    
    expect(result.metadata.errors[0]).toContain('VinDecoder confidence < 80%');
  });
});
