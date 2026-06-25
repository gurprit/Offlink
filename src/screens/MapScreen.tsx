import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Camera, MapView, PointAnnotation, UserLocation} from '@maplibre/maplibre-react-native';
import {Button} from '../components/Button';
import {OfflinkSighting} from '../models/types';
import {OfflinkLocation} from '../services/LocationService';

const OFFLINK_TEST_MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
    },
  ],
};



function getOffsetCoordinate(
  longitude: number,
  latitude: number,
  id: string,
): [number, number] {
  const charTotal = id
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0);

  const angle = (charTotal % 360) * (Math.PI / 180);
  const distance = 0.00018;

  return [
    longitude + Math.cos(angle) * distance,
    latitude + Math.sin(angle) * distance,
  ];
}

export function MapScreen({
  sightings,
  currentLocation,
  onBack,
}: {
  sightings: OfflinkSighting[];
  currentLocation: OfflinkLocation | null;
  onBack: () => void;
}) {
  const centerCoordinate: [number, number] = currentLocation
    ? [currentLocation.longitude, currentLocation.latitude]
    : [-0.1276, 51.5072];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Offline Map</Text>
        <Button label="Back" onPress={onBack} />
      </View>

      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          mapStyle={JSON.stringify(OFFLINK_TEST_MAP_STYLE)}>
          <Camera
            zoomLevel={15}
            centerCoordinate={centerCoordinate}
          />
          <UserLocation visible />

          {sightings
            .filter(
              sighting =>
                typeof sighting.latitude === 'number' &&
                typeof sighting.longitude === 'number',
            )
            .map(sighting => (
              <PointAnnotation
                key={sighting.userId}
                id={sighting.userId}
                coordinate={getOffsetCoordinate(sighting.longitude!, sighting.latitude!, sighting.userId)}>
                <View style={styles.sightingMarker}>
                  <Text style={styles.sightingMarkerEmoji}>
                    {sighting.emoji}
                  </Text>
                  <Text style={styles.sightingMarkerMeta}>
                    {sighting.source === 'direct' ? 'BLE' : `${sighting.hops || 1} hop`}
                  </Text>
                </View>
              </PointAnnotation>
            ))}
        </MapView>
      </View>

      <Text style={styles.helper}>
        Real map · {sightings.length} stored sightings
        {currentLocation
          ? ` · GPS ±${Math.round(currentLocation.accuracy || 0)}m`
          : ' · Waiting for GPS'}
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
  sightingMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sightingMarkerEmoji: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderColor: '#050505',
    borderWidth: 2,
    fontSize: 28,
    height: 44,
    lineHeight: 40,
    overflow: 'hidden',
    textAlign: 'center',
    width: 44,
  },
  sightingMarkerMeta: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    color: '#050505',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  helper: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },
});
