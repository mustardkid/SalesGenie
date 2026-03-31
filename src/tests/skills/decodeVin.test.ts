import { decodeVin } from '../../skills/decodeVin';

// Mock the global fetch API
global.fetch = jest.fn();

describe('decodeVinSkill', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('should decode a valid VIN and return high confidence', async () => {
    // Mock the NHTSA response for a perfect decode
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        Results: [{
          ErrorCode: "0",
          Make: "RAM",
          Model: "3500",
          ModelYear: "2024",
          Trim: "Laramie Longhorn",
          BodyClass: "Pickup",
          DriveType: "4WD/4-Wheel Drive/4x4",
          EngineCylinders: "8",
          DisplacementL: "6.4",
          FuelTypePrimary: "Gasoline",
          TransmissionStyle: "Automatic",
          GVWR: "Class 3: 10,001 - 14,000 lb",
          WheelBaseShort: "169.3",
          BasePrice: "72575",
          PlantCountry: "UNITED STATES",
          Doors: "4",
          SeatRows: "2",
          SteeringLocation: "Left",
          MakeID: "424",
          ModelID: "1165"
        }]
      })
    });

    const result = await decodeVin('3C6UR5FL1KG501234');

    expect(result.make).toBe('RAM');
    expect(result.year).toBe(2024);
    expect(result.confidence).toBeGreaterThan(80);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should heavily penalize confidence if Check Digit fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        Results: [{
          ErrorCode: "1", // 1 means error in check digit
          Make: "RAM",
          Model: "3500",
          ModelYear: "2024"
        }]
      })
    });

    const result = await decodeVin('3C6UR5FL0KG501234'); // Intentional bad check digit
    expect(result.make).toBe('RAM');
    expect(result.confidence).toBeLessThan(80); // Should be flagged for HUMAN_REVIEW
  });

  it('should heavily penalize if make/model/year are missing', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        Results: [{
          ErrorCode: "0",
          Make: "",
          Model: "",
          ModelYear: ""
        }]
      })
    });

    const result = await decodeVin('3C6UR5FL1KG501234');
    expect(result.confidence).toBeLessThan(50); // Massive penalty for missing core identifiers
  });
});
