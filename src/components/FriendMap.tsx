import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  Camera,
  MapView,
  PointAnnotation,
  UserLocation,
} from '@maplibre/maplibre-react-native';
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

type FriendMapProps = {
  friendSightings: OfflinkSighting[];
  currentLocation: OfflinkLocation | null;
  containerStyle?: StyleProp<ViewStyle>;
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
  const distance = 0.00012;

  return [
    longitude + Math.cos(angle) * distance,
    latitude + Math.sin(angle) * distance,
  ];
}

function formatAge(timestamp: number): string {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  return `${Math.round(minutes / 60)}h ago`;
}

export function FriendMap({
  friendSightings,
  currentLocation,
  containerStyle,
}: FriendMapProps) {
  const firstFriendSighting = friendSightings[0];

  const centerCoordinate: [number, number] = currentLocation
    ? [currentLocation.longitude, currentLocation.latitude]
    : typeof firstFriendSighting?.longitude === 'number' &&
        typeof firstFriendSighting?.latitude === 'number'
      ? [firstFriendSighting.longitude, firstFriendSighting.latitude]
      : [-0.1276, 51.5072];

  return (
    <View style={[styles.mapWrap, containerStyle]}>
      <MapView
        style={styles.map}
        mapStyle={JSON.stringify(OFFLINK_TEST_MAP_STYLE)}>
        <Camera
          zoomLevel={15}
          centerCoordinate={centerCoordinate}
        />

        <UserLocation visible />

        {currentLocation ? (
          <PointAnnotation
            id="offlink-you"
            coordinate={[
              currentLocation.longitude,
              currentLocation.latitude,
            ]}>
            <View style={styles.youMarker}>
              <Text style={styles.youMarkerText}>YOU</Text>
            </View>
          </PointAnnotation>
        ) : null}

        {friendSightings.map(sighting => (
          <PointAnnotation
            id={`offlink-friend-${sighting.userId}`}
            key={sighting.userId}
            coordinate={getOffsetCoordinate(
              sighting.longitude!,
              sighting.latitude!,
              sighting.userId,
            )}>
            <View style={styles.sightingMarker}>
              <Text style={styles.friendPinEmoji}>
                {sighting.emoji || '👤'}
              </Text>

              <Text style={styles.friendPinLabel}>
                {sighting.source === 'direct'
                  ? `${sighting.emoji || '👤'} · ${formatAge(
                      sighting.lastSeenAt,
                    )}`
                  : `${sighting.emoji || '👤'} · ${
                      sighting.hops || 1
                    } hop · ${formatAge(sighting.lastSeenAt)}`}
              </Text>
            </View>
          </PointAnnotation>
        ))}
      </MapView>

      {friendSightings.length === 0 ? (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyTitle}>No friend pins yet</Text>

          <Text style={styles.emptyText}>
            When someone is seen over BLE, their last GPS sighting will appear
            here.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    flex: 1,
    backgroundColor: '#111',
    borderColor: '#333',
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  youMarker: {
    alignItems: 'center',
    backgroundColor: '#050505',
    borderColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 3,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  youMarkerText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  sightingMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 92,
    minWidth: 140,
  },
  friendPinEmoji: {
    backgroundColor: '#ffffff',
    borderColor: '#8b5cf6',
    borderRadius: 28,
    borderWidth: 4,
    color: '#050505',
    fontSize: 34,
    height: 64,
    lineHeight: 56,
    overflow: 'hidden',
    textAlign: 'center',
    width: 64,
  },
  friendPinLabel: {
    backgroundColor: '#050505',
    borderColor: '#8b5cf6',
    borderRadius: 12,
    borderWidth: 2,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emptyOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(5, 5, 5, 0.84)',
    borderRadius: 18,
    left: 24,
    padding: 18,
    position: 'absolute',
    right: 24,
    top: '38%',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: '#aaaaaa',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
});
