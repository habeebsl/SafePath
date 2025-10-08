import { View, Text, StyleSheet } from 'react-native';
import { useLocation } from '@/contexts/LocationContext';

export default function LocationStatus() {
  const { location, isTracking } = useLocation();

  if (!isTracking || !location) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.indicator} />
      <Text style={styles.text}>
        📍 {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    margin: 10,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CD964',
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
