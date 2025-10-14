import { MarkerIconConfig, MarkerType } from '@/types/marker';

// Format: SVG as a string (will be embedded in HTML)
// Recommended size: 24x24 or 32x32 for best display

const ICON_SVG = {
  // PLACEHOLDER - Add your SVG here
  // Example format: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">...</svg>'
  
  safe: `
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
    <path d="M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Z"/>
    </svg>
  `,
  
  danger: `
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
    <path d="M346-48q-125 0-212.5-88.5T46-350q0-125 86.5-211.5T344-648h13l27-47q12-22 36-28.5t46 6.5l30 17 5-8q23-43 72-56t92 12l35 20-40 69-35-20q-14-8-30.5-3.5T570-668l-5 8 40 23q21 12 27.5 36t-5.5 45l-27 48q23 36 34.5 76.5T646-348q0 125-87.5 212.5T346-48Zm454-560v-80h120v80H800ZM580-828v-120h80v120h-80Zm195 81-56-56 85-85 56 56-85 85Z"/>
    </svg>
  `,
  
  uncertain: `
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
    <path d="M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-200q17 0 29.5-12.5T522-322q0-17-12.5-29.5T480-364q-17 0-29.5 12.5T438-322q0 17 12.5 29.5T480-280Zm-29-128h60v-22q0-11 5-21 6-14 16-23.5t21-19.5q17-17 29.5-38t12.5-46q0-45-34.5-73.5T480-680q-40 0-71.5 23T366-596l54 22q6-20 22.5-34t37.5-14q22 0 38.5 13t16.5 33q0 17-10.5 31.5T501-518q-12 11-24 22.5T458-469q-7 14-7 29.5v31.5Z"/>
    </svg>
  `,
  
  medical: `
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
    <path d="M420-260h120v-100h100v-120H540v-100H420v100H320v120h100v100ZM280-120q-33 0-56.5-23.5T200-200v-440q0-33 23.5-56.5T280-720h400q33 0 56.5 23.5T760-640v440q0 33-23.5 56.5T680-120H280Zm-40-640v-80h480v80H240Z"/>
    </svg>
  `,
  
  food: `
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
    <path d="M240-80v-366q-54-14-87-57t-33-97v-280h80v240h40v-240h80v240h40v-240h80v280q0 54-33 97t-87 57v366h-80Zm400 0v-381q-54-18-87-75.5T520-667q0-89 47-151t113-62q66 0 113 62.5T840-666q0 73-33 130t-87 75v381h-80Z"/>
    </svg>
  `,
  
  shelter: `
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
      <path d="M80-80v-186l350-472-70-94 64-48 56 75 56-75 64 48-70 94 350 472v186H80Zm249-80h302L480-371 329-160Z"/>
    </svg>
  `,
  
  checkpoint: `
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
    <path d="M200-200v-400q0-66 47-113t113-47h80v240h-80v80h80v240H200Zm320 0v-240h80v-80h-80v-240h80q66 0 113 47t47 113v400H520ZM80-280v-400h80v400H80Zm720 0v-400h80v400h-80Z"/>
    </svg>
  `,
  
  combat: `
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
    <path d="M762-96 645-212l-88 88-28-28q-23-23-23-57t23-57l169-169q23-23 57-23t57 23l28 28-88 88 116 117q12 12 12 28t-12 28l-50 50q-12 12-28 12t-28-12Zm118-628L426-270l5 4q23 23 23 57t-23 57l-28 28-88-88L198-96q-12 12-28 12t-28-12l-50-50q-12-12-12-28t12-28l116-117-88-88 28-28q23-23 57-23t57 23l4 5 454-454h160v160ZM278-526 80-724v-160h160l198 198-160 160Z"/>
    </svg>
  `,
  
  sos: `
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
    <path d="M798-120q-125 0-247-54.5T329-329Q229-429 174.5-551T120-798q0-18 12-30t30-12h162q14 0 25 9.5t13 22.5l26 140q2 16-1 27t-11 19l-97 98q20 37 47.5 71.5T387-386q31 31 65 57.5t72 48.5l94-94q9-9 23.5-13.5T670-390l138 28q14 4 23 14.5t9 23.5v162q0 18-12 30t-30 12Z"/>
    </svg>
  `,
};

// SVG path data extracted for React Native rendering
export const ICON_PATHS: Record<MarkerType, string> = {
  safe: 'M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Z',
  danger: 'M346-48q-125 0-212.5-88.5T46-350q0-125 86.5-211.5T344-648h13l27-47q12-22 36-28.5t46 6.5l30 17 5-8q23-43 72-56t92 12l35 20-40 69-35-20q-14-8-30.5-3.5T570-668l-5 8 40 23q21 12 27.5 36t-5.5 45l-27 48q23 36 34.5 76.5T646-348q0 125-87.5 212.5T346-48Zm454-560v-80h120v80H800ZM580-828v-120h80v120h-80Zm195 81-56-56 85-85 56 56-85 85Z',
  uncertain: 'M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-200q17 0 29.5-12.5T522-322q0-17-12.5-29.5T480-364q-17 0-29.5 12.5T438-322q0 17 12.5 29.5T480-280Zm-29-128h60v-22q0-11 5-21 6-14 16-23.5t21-19.5q17-17 29.5-38t12.5-46q0-45-34.5-73.5T480-680q-40 0-71.5 23T366-596l54 22q6-20 22.5-34t37.5-14q22 0 38.5 13t16.5 33q0 17-10.5 31.5T501-518q-12 11-24 22.5T458-469q-7 14-7 29.5v31.5Z',
  medical: 'M420-260h120v-100h100v-120H540v-100H420v100H320v120h100v100ZM280-120q-33 0-56.5-23.5T200-200v-440q0-33 23.5-56.5T280-720h400q33 0 56.5 23.5T760-640v440q0 33-23.5 56.5T680-120H280Zm-40-640v-80h480v80H240Z',
  food: 'M240-80v-366q-54-14-87-57t-33-97v-280h80v240h40v-240h80v240h40v-240h80v280q0 54-33 97t-87 57v366h-80Zm400 0v-381q-54-18-87-75.5T520-667q0-89 47-151t113-62q66 0 113 62.5T840-666q0 73-33 130t-87 75v381h-80Z',
  shelter: 'M80-80v-186l350-472-70-94 64-48 56 75 56-75 64 48-70 94 350 472v186H80Zm249-80h302L480-371 329-160Z',
  checkpoint: 'M200-200v-400q0-66 47-113t113-47h80v240h-80v80h80v240H200Zm320 0v-240h80v-80h-80v-240h80q66 0 113 47t47 113v400H520ZM80-280v-400h80v400H80Zm720 0v-400h80v400h-80Z',
  combat: 'M762-96 645-212l-88 88-28-28q-23-23-23-57t23-57l169-169q23-23 57-23t57 23l28 28-88 88 116 117q12 12 12 28t-12 28l-50 50q-12 12-28 12t-28-12Zm118-628L426-270l5 4q23 23 23 57t-23 57l-28 28-88-88L198-96q-12 12-28 12t-28-12l-50-50q-12-12-12-28t12-28l116-117-88-88 28-28q23-23 57-23t57 23l4 5 454-454h160v160ZM278-526 80-724v-160h160l198 198-160 160Z',
  sos: 'M798-120q-125 0-247-54.5T329-329Q229-429 174.5-551T120-798q0-18 12-30t30-12h162q14 0 25 9.5t13 22.5l26 140q2 16-1 27t-11 19l-97 98q20 37 47.5 71.5T387-386q31 31 65 57.5t72 48.5l94-94q9-9 23.5-13.5T670-390l138 28q14 4 23 14.5t9 23.5v162q0 18-12 30t-30 12Z',
};

// Marker configuration with colors and labels
export const MARKER_CONFIG: Record<MarkerType, MarkerIconConfig> = {
  safe: {
    type: 'safe',
    color: '#22C55E',      // Green
    iconSvg: ICON_SVG.safe,
    size: 40,
    label: 'Safe Zone',
  },
  danger: {
    type: 'danger',
    color: '#EF4444',      // Red
    iconSvg: ICON_SVG.danger,
    size: 40,
    label: 'Danger Zone',
  },
  uncertain: {
    type: 'uncertain',
    color: '#F59E0B',      // Amber/Yellow
    iconSvg: ICON_SVG.uncertain,
    size: 38,
    label: 'Uncertain',
  },
  medical: {
    type: 'medical',
    color: '#3B82F6',      // Blue
    iconSvg: ICON_SVG.medical,
    size: 42,
    label: 'Medical Aid',
  },
  food: {
    type: 'food',
    color: '#92400E',      // Brown
    iconSvg: ICON_SVG.food,
    size: 38,
    label: 'Food/Water',
  },
  shelter: {
    type: 'shelter',
    color: '#7C3AED',      // Purple
    iconSvg: ICON_SVG.shelter,
    size: 38,
    label: 'Shelter',
  },
  checkpoint: {
    type: 'checkpoint',
    color: '#64748B',      // Gray
    iconSvg: ICON_SVG.checkpoint,
    size: 38,
    label: 'Checkpoint',
  },
  combat: {
    type: 'combat',
    color: '#DC2626',      // Dark Red
    iconSvg: ICON_SVG.combat,
    size: 42,
    label: 'Active Combat',
  },
  sos: {
    type: 'sos',
    color: '#DC2626',      // Red
    iconSvg: ICON_SVG.sos,
    size: 44,
    label: 'SOS Emergency',
  },
};

// Helper to get marker configuration
export function getMarkerConfig(type: MarkerType): MarkerIconConfig {
  return MARKER_CONFIG[type];
}

// Helper to generate Leaflet marker HTML with confidence-based color
// Special handling for SOS markers (pentagon shape)
export function generateMarkerHTML(type: MarkerType, confidence: number, status?: 'active' | 'completed'): string {
  const config = getMarkerConfig(type);
  const { color, iconSvg, size } = config;
  
  // SOS markers use different color logic (green when completed)
  const sosColor = (type === 'sos' && status === 'completed') ? '#22C55E' : color;
  
  // Adjust color opacity based on confidence (not applicable for SOS markers)
  let bgColor = sosColor;
  if (type !== 'sos') {
    if (confidence < 80) bgColor = `${color}CC`; // 80% opacity
    if (confidence < 50) bgColor = `${color}99`; // 60% opacity
    if (confidence < 20) bgColor = `${color}66`; // 40% opacity
  }
  
  // Use checkmark icon for completed SOS markers
  const displayIcon = (type === 'sos' && status === 'completed') 
    ? '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>'
    : iconSvg;
  
  return `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background: ${bgColor};
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      position: relative;
    ">
      <div style="transform: rotate(45deg); width: 24px; height: 24px;">
        ${displayIcon}
      </div>
    </div>
  `;
}
