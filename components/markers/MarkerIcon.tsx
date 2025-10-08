import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { MarkerType } from '@/types/marker';
import { ICON_PATHS } from '@/constants/marker-icons';

interface MarkerIconProps {
  type: MarkerType;
  size?: number;
  color?: string;
}

export function MarkerIcon({ type, size = 24, color = '#fff' }: MarkerIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path d={ICON_PATHS[type]} />
    </Svg>
  );
}
