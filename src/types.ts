// ─── Shared Type Definitions ─────────────────────────────────────────
// All interfaces used across skills and agents

// ─── VIN Decode ──────────────────────────────────────────────────────

export interface VehicleData {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  bodyClass: string;
  driveType: string;
  engineCylinders: number;
  engineDisplacement: string;
  fuelType: string;
  transmissionStyle: string;
  gvwr: string;
  wheelbase: string;
  msrp: number | null;
  plantCountry: string;
  doors: number;
  seatRows: number;
  steeringLocation: string;
  abs: boolean;
  tpms: boolean;
  esc: boolean;
  airBagCount: number;
  confidence: number;
  rawNhtsa: Record<string, string>;
}

// ─── Personality ─────────────────────────────────────────────────────

export type PersonalityType = 'Driver' | 'Analytical' | 'Friendly' | 'Expressive';

export interface QuestionAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface PersonalityProfile {
  primaryType: PersonalityType;
  secondaryType: PersonalityType | null;
  confidence: number;
  reasoning: string;
  communicationTips: string[];
  avoidTopics: string[];
  buyingMotivators: string[];
}

// ─── Salesperson ─────────────────────────────────────────────────────

export interface Salesperson {
  id: string;
  name: string;
  strengths: PersonalityType[];
  specialties: string[];
  currentLoad: number;
  closeRate: number;
  available: boolean;
}

export interface SalespersonMatch {
  recommended: Salesperson;
  matchScore: number;
  reason: string;
  alternates: Salesperson[];
  handoffScript: string;
}

// ─── Sales Pitch ─────────────────────────────────────────────────────

export interface DealerContext {
  currentPromos: string[];
  inventoryDays: number;
  competitorPricing: string[];
  tradeInEstimate: number | null;
}

export interface TalkingPoint {
  topic: string;
  point: string;
  whyItMatters: string;
}

export interface ObjectionHandler {
  objection: string;
  response: string;
  technique: string;
}

export interface SalesPitch {
  headline: string;
  pitch: string;
  talkingPoints: TalkingPoint[];
  objectionHandlers: ObjectionHandler[];
  closingStrategy: string;
  urgencyHook: string;
}

// ─── Listing ─────────────────────────────────────────────────────────

export interface VehicleListing {
  title: string;
  bullets: string[];
  description: string;
  missingPhotoSuggestions: string[];
  seoTags: string[];
  pricePositioning: string;
}

// ─── Orchestrator ────────────────────────────────────────────────────

export interface SalesBrief {
  directive: string;
  vehicle: VehicleData;
  buyerProfile: PersonalityProfile;
  salespersonMatch: SalespersonMatch;
  pitch: SalesPitch;
  listing?: VehicleListing;
  metadata: {
    totalTimeMs: number;
    agentsRun: string[];
    errors: string[];
    timestamp: string;
  };
}

export interface ParsedDirective {
  hasVin: boolean;
  hasBuyerData: boolean;
  wantsPitch: boolean;
  wantsMatch: boolean;
  wantsListing: boolean;
  presetPersonality: PersonalityType | null;
  vin: string | null;
  buyerAnswers: QuestionAnswer[];
}

export interface AgentError {
  agent: string;
  error: string;
  timestamp: string;
  retryCount: number;
}

export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: AgentError;
  durationMs: number;
}

export interface ExecutionPhase {
  parallel: boolean;
  tasks: AgentTask[];
}

export interface AgentTask {
  agent: string;
  input: Record<string, unknown> | string;
}
