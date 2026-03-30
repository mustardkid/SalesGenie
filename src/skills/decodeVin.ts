// ─── decodeVinSkill ──────────────────────────────────────────────────
// Calls NHTSA DecodeVinValuesExtended API and returns structured VehicleData

import { VehicleData } from '../types';
import { config } from '../config';

/**
 * Validate a VIN string for basic format compliance.
 */
export function validateVin(vin: string): { valid: boolean; error?: string } {
  if (!vin || typeof vin !== 'string') {
    return { valid: false, error: 'VIN is required' };
  }

  const cleaned = vin.trim().toUpperCase();

  if (cleaned.length !== 17) {
    return { valid: false, error: `VIN must be 17 characters (got ${cleaned.length})` };
  }

  if (/[IOQ]/.test(cleaned)) {
    return { valid: false, error: 'VIN cannot contain I, O, or Q' };
  }

  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
    return { valid: false, error: 'VIN contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Calculate decode confidence based on which fields are present.
 */
function calculateConfidence(result: Record<string, string>): number {
  let score = 100;

  const criticalFields = ['Make', 'Model', 'ModelYear'];
  const importantFields = ['Trim', 'BodyClass', 'DriveType', 'EngineCylinders'];
  const niceToHave = ['BasePrice', 'EngineHP', 'WheelBaseShort'];

  for (const field of criticalFields) {
    if (!result[field] || result[field] === 'Not Applicable' || result[field] === '') score -= 25;
  }

  for (const field of importantFields) {
    if (!result[field] || result[field] === 'Not Applicable' || result[field] === '') score -= 10;
  }

  for (const field of niceToHave) {
    if (!result[field] || result[field] === 'Not Applicable' || result[field] === '') score -= 3;
  }

  // Check NHTSA error code
  if (result['ErrorCode'] && result['ErrorCode'] !== '0') score -= 20;

  return Math.max(0, score);
}

/**
 * Map NHTSA response fields to our VehicleData interface.
 */
function mapNhtsaToVehicleData(vin: string, result: Record<string, string>): VehicleData {
  return {
    vin: vin.toUpperCase(),
    year: parseInt(result['ModelYear'] || '0', 10),
    make: result['Make'] || 'Unknown',
    model: result['Model'] || 'Unknown',
    trim: result['Trim'] || result['Series'] || '',
    bodyClass: result['BodyClass'] || '',
    driveType: result['DriveType'] || '',
    engineCylinders: parseInt(result['EngineCylinders'] || '0', 10),
    engineDisplacement: result['DisplacementL'] ? `${parseFloat(result['DisplacementL']).toFixed(1)}L` : '',
    fuelType: result['FuelTypePrimary'] || '',
    transmissionStyle: result['TransmissionStyle'] || '',
    gvwr: result['GVWR'] || '',
    wheelbase: result['WheelBaseShort'] || '',
    msrp: result['BasePrice'] ? parseFloat(result['BasePrice']) : null,
    plantCountry: result['PlantCountry'] || '',
    doors: parseInt(result['Doors'] || '0', 10),
    seatRows: parseInt(result['SeatRows'] || '0', 10),
    steeringLocation: result['SteeringLocation'] || 'Left',
    abs: result['ABS'] === 'Standard',
    tpms: result['TPMS'] === 'Direct' || result['TPMS'] === 'Indirect',
    esc: result['ESC'] === 'Standard',
    airBagCount: countAirbags(result),
    confidence: calculateConfidence(result),
    rawNhtsa: result,
  };
}

/**
 * Count total airbag locations from NHTSA fields.
 */
function countAirbags(result: Record<string, string>): number {
  const airbagFields = [
    'AirBagLocFront', 'AirBagLocSide', 'AirBagLocCurtain',
    'AirBagLocSeatCushion', 'AirBagLocKnee',
  ];
  let count = 0;
  for (const field of airbagFields) {
    if (result[field] && result[field] !== 'Not Applicable' && result[field] !== '') {
      count++;
    }
  }
  return count;
}

/**
 * Sleep helper for retry backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Decode a VIN using the NHTSA vPIC API.
 * 
 * @param vin - 17-character Vehicle Identification Number
 * @param modelYear - Optional model year hint for better accuracy
 * @returns Structured VehicleData or throws on failure after retries
 */
export async function decodeVin(vin: string, modelYear?: number): Promise<VehicleData> {
  // Validate first
  const validation = validateVin(vin);
  if (!validation.valid) {
    throw new Error(`INVALID_VIN: ${validation.error}`);
  }

  const cleanVin = vin.trim().toUpperCase();
  let url = `${config.nhtsa.baseUrl}/DecodeVinValuesExtended/${cleanVin}?format=json`;
  if (modelYear) {
    url += `&modelyear=${modelYear}`;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.nhtsa.retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.nhtsa.timeout);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`NHTSA returned HTTP ${response.status}`);
      }

      const data: any = await response.json();

      if (!data.Results || !data.Results[0]) {
        throw new Error('NHTSA returned empty results');
      }

      const result = data.Results[0] as Record<string, string>;
      return mapNhtsaToVehicleData(cleanVin, result);

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`VIN decode attempt ${attempt}/${config.nhtsa.retries} failed: ${lastError.message}`);

      if (attempt < config.nhtsa.retries) {
        await sleep(attempt * 500); // exponential-ish backoff
      }
    }
  }

  throw new Error(`NHTSA_UNAVAILABLE: All ${config.nhtsa.retries} attempts failed. Last error: ${lastError?.message}`);
}
