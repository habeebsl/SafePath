/**
 * Alert component exports - Native version
 * Uses React Native's built-in Alert
 */

import { Alert as RNAlert } from 'react-native';
import React from 'react';

// Re-export React Native's Alert for native
export const Alert = RNAlert;

// Dummy AlertProvider for native (not needed, but exported for consistency)
export const AlertProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
