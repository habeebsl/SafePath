import React from 'react';
import { FontAwesome5, FontAwesome6, MaterialIcons } from '@expo/vector-icons';

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: any;
  library?: 'fa5' | 'fa6' | 'material';
};

/**
 * Unified Icon component using @expo/vector-icons
 * Icons are bundled with the app and work offline
 */
export function Icon({ name, size = 24, color = '#000', style, library = 'fa5' }: IconProps) {
  const iconProps = { name: name as any, size, color, style };
  
  switch (library) {
    case 'fa6':
      return <FontAwesome6 {...iconProps} />;
    case 'material':
      return <MaterialIcons {...iconProps} />;
    case 'fa5':
    default:
      return <FontAwesome5 {...iconProps} />;
  }
}
