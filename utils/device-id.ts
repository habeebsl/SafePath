import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { logger } from '@/utils/logger';

const DEVICE_ID_KEY = 'safepath_device_id';

/**
 * Get or create a unique device ID
 * Stored securely on device
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Try to get existing ID
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    
    if (!deviceId) {
      // Generate new ID
      deviceId = generateDeviceId();
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  } catch (error) {
    logger.error('Error getting device ID:', error);
    // Fallback to session ID
    return generateDeviceId();
  }
}

/**
 * Generate a unique device ID
 */
function generateDeviceId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const platform = Platform.OS;
  
  return `${platform}_${timestamp}_${random}`;
}

/**
 * Reset device ID (useful for testing)
 */
export async function resetDeviceId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
  } catch (error) {
    logger.error('Error resetting device ID:', error);
  }
}
