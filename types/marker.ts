export type MarkerType =
  | 'safe'        // Safe Zone
  | 'danger'      // Danger Zone  
  | 'uncertain'   // Uncertain/Unknown
  | 'medical'     // Medical Facility
  | 'food'        // Food/Water Distribution
  | 'shelter'     // Shelter/Refuge
  | 'checkpoint'  // Checkpoint (Neutral)
  | 'combat'      // Active Combat
  | 'sos';        // SOS Emergency Request

export type VoteType = 'agree' | 'disagree';

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Marker {
  id: string;
  type: MarkerType;
  latitude: number;
  longitude: number;
  title: string;
  description: string;
  createdBy: string;         // device ID
  createdAt: number;         // timestamp (ms)
  lastVerified: number;      // timestamp (ms)
  agrees: number;            // number of agrees
  disagrees: number;         // number of disagrees
  confidenceScore: number;   // 0-100
  photos?: string[];         // optional photo URIs
  syncedToServer: boolean;   // for P2P sync later
  radius?: number;           // affected area radius in meters (optional)
}

export interface Vote {
  markerId: string;
  userId: string;            // device ID
  vote: VoteType;
  votedAt: number;           // timestamp (ms)
}

export interface MarkerIconConfig {
  type: MarkerType;
  color: string;             // Background color of marker container
  iconSvg: string;           // SVG string (you'll add these)
  size: number;
  label: string;
}

// Confidence level thresholds
export const ConfidenceLevel = {
  HIGH: 80,       // 80-100% - Bright color
  MEDIUM: 50,     // 50-79%  - Standard color
  LOW: 20,        // 20-49%  - Faded color
  CRITICAL: 0,    // 0-19%   - Very faded/disputed
} as const;

// Helper to get confidence color
export function getConfidenceColor(
  baseColor: string,
  confidence: number
): string {
  if (confidence >= ConfidenceLevel.HIGH) return baseColor;
  if (confidence >= ConfidenceLevel.MEDIUM) return `${baseColor}CC`; // 80% opacity
  if (confidence >= ConfidenceLevel.LOW) return `${baseColor}99`; // 60% opacity
  return `${baseColor}66`; // 40% opacity
}
