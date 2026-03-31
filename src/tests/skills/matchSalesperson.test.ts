import { matchSalesperson } from '../../skills/matchSalesperson';
import { PersonalityProfile, Salesperson, VehicleData } from '../../types';

describe('matchSalespersonSkill', () => {
  const dummyRoster: Salesperson[] = [
    {
      id: 'r1',
      name: 'Sarah (Truck Expert)',
      strengths: ['Analytical', 'Driver'],
      specialties: ['trucks', 'fleet'],
      closeRate: 68,
      currentLoad: 1, // Low load
      available: true
    },
    {
      id: 'r2',
      name: 'Mike (Family Cars)',
      strengths: ['Friendly', 'Expressive'],
      specialties: ['suv', 'family'],
      closeRate: 55,
      currentLoad: 1,
      available: true
    },
    {
      id: 'r3',
      name: 'Jordan (Swamped Truck Expert)',
      strengths: ['Analytical', 'Driver'],
      specialties: ['trucks'],
      closeRate: 65,
      currentLoad: 6, // Massive load penalty
      available: true
    }
  ];

  const dummyBuyer: PersonalityProfile = {
    primaryType: 'Analytical',
    confidence: 90,
    buyingMotivators: ['Towing capacity'],
    communicationTips: [], avoidTopics: [], reasoning: ''
  };

  const dummyTruck: VehicleData = {
    vin: '', year: 2024, make: 'Ford', model: 'F-150', trim: '',
    bodyClass: 'Pickup', driveType: '', engineCylinders: 0, engineDisplacement: '',
    fuelType: '', transmissionStyle: '', gvwr: '', wheelbase: '',
    msrp: null, plantCountry: '', doors: 0, seatRows: 0,
    steeringLocation: '', abs: false, tpms: false, esc: false, airBagCount: 0,
    confidence: 100, rawNhtsa: {}
  };

  it('should match Sarah for an Analytical truck buyer, punishing Jordan for high load', () => {
    const match = matchSalesperson(dummyBuyer, dummyRoster, dummyTruck);
    
    expect(match.recommended.name).toBe('Sarah (Truck Expert)');
    expect(match.alternates[0].name).toBe('Jordan (Swamped Truck Expert)');
  });

  it('should match Mike for a Friendly buyer looking at SUVs', () => {
    const friendlyBuyer = { ...dummyBuyer, primaryType: 'Friendly' as const };
    const suv = { ...dummyTruck, bodyClass: 'SUV' };

    const match = matchSalesperson(friendlyBuyer, dummyRoster, suv);
    
    expect(match.recommended.name).toBe('Mike (Family Cars)');
  });
});
