import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Camera, MapView, UserLocation} from '@maplibre/maplibre-react-native';
import {Button} from '../components/Button';
import {OfflinkSighting} from '../models/types';

export function MapScreen({
  sightings,
  onBack,
}: {
  sightings: OfflinkSighting[];
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Offline Map</Text>
        <Button label="Back" onPress={onBack} />
      </View>

      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          mapStyle="https://demotiles.maplibre.org/style.json">
          <Camera
            zoomLevel={13}
            centerCoordinate={[-0.1276, 51.5072]}
          />
          <UserLocation visible />
        </MapView>
      </View>

      <Text style={styles.helper}>
        Real map test · {sightings.length} stored sightings
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
    padding: 20,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  mapWrap: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderColor: '#333',
    borderWidth: 1,
  },
  map: {
    flex: 1,
  },
  helper: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },
});
