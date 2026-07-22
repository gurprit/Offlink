import React, {useState} from 'react';
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

function formatHopCount(hops?: number): string {
  const hopCount = Math.max(1, hops || 1);

  return `${hopCount} ${hopCount === 1 ? 'hop' : 'hops'}`;
}

export function FriendMap({
  friendSightings,
  currentLocation,
  containerStyle,
}: FriendMapProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const firstFriendSighting = friendSightings[0];

  const centerCoordinate: [number, number] = currentLocation
    ? [currentLocation.longitude, currentLocation.latitude]
    : typeof firstFriendSighting?.longitude === 'number' &&
        typeof firstFriendSighting?.latitude === 'number'
      ? [firstFriendSighting.longitude, firstFriendSighting.latitude]
      : [-0.1276, 51.5072];

  const handlePinSelected = (userId: string) => {
    setSelectedUserId(currentUserId =>
      currentUserId === userId ? null : userId,
    );
  };

  return (
    <View style={[styles.mapWrap, containerStyle]}>
      <MapView
        style={styles.map}
        mapStyle={JSON.stringify(OFFLINK_TEST_MAP_STYLE)}>
        <Camera zoomLevel={15} centerCoordinate={centerCoordinate} />

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

        {friendSightings.map(sighting => {
          const isSelected = selectedUserId === sighting.userId;
          const isDirect = sighting.source === 'direct';

          return (
            <PointAnnotation
              id={`offlink-friend-${sighting.userId}`}
              key={sighting.userId}
              coordinate={getOffsetCoordinate(
                sighting.longitude!,
                sighting.latitude!,
                sighting.userId,
              )}
              onSelected={() => handlePinSelected(sighting.userId)}>
              <View
                style={[
                  styles.sightingMarker,
                  isSelected && styles.sightingMarkerSelected,
                ]}>
                {isSelected ? (
                  <>
                    <View
                      style={[
                        styles.friendDetailsCard,
                        isDirect
                          ? styles.friendDetailsCardDirect
                          : styles.friendDetailsCardRelayed,
                      ]}>
                      <Text style={styles.friendDetailsHeading}>
                        {sighting.emoji || '👤'} Friend
                      </Text>

                      <Text
                        style={[
                          styles.friendConnectionStatus,
                          isDirect
                            ? styles.friendConnectionDirect
                            : styles.friendConnectionRelayed,
                        ]}>
                        {isDirect
                          ? 'Direct connection'
                          : `Relayed · ${formatHopCount(sighting.hops)}`}
                      </Text>

                      <Text style={styles.friendLastSeen}>
                        Last seen {formatAge(sighting.lastSeenAt)}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.cardPointer,
                        isDirect
                          ? styles.cardPointerDirect
                          : styles.cardPointerRelayed,
                      ]}
                    />
                  </>
                ) : null}

                <View
                  style={[
                    styles.friendPin,
                    isDirect
                      ? styles.friendPinDirect
                      : styles.friendPinRelayed,
                  ]}>
                  <Text style={styles.friendPinEmoji}>
                    {sighting.emoji || '👤'}
                  </Text>
                </View>
              </View>
            </PointAnnotation>
          );
        })}
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
    justifyContent: 'flex-end',
    minHeight: 76,
    minWidth: 76,
  },
  sightingMarkerSelected: {
    minHeight: 176,
    minWidth: 210,
  },
  friendPin: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    borderWidth: 4,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  friendPinDirect: {
    borderColor: '#ffffff',
  },
  friendPinRelayed: {
    borderColor: '#8b5cf6',
  },
  friendPinEmoji: {
    color: '#050505',
    fontSize: 34,
    lineHeight: 42,
    textAlign: 'center',
  },
  friendDetailsCard: {
    alignItems: 'center',
    backgroundColor: '#050505',
    borderRadius: 16,
    borderWidth: 2,
    elevation: 10,
    minWidth: 190,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  friendDetailsCardDirect: {
    borderColor: '#ffffff',
  },
  friendDetailsCardRelayed: {
    borderColor: '#8b5cf6',
  },
  friendDetailsHeading: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  friendConnectionStatus: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 5,
    textAlign: 'center',
  },
  friendConnectionDirect: {
    color: '#ffffff',
  },
  friendConnectionRelayed: {
    color: '#a78bfa',
  },
  friendLastSeen: {
    color: '#b8b8b8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
  cardPointer: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 9,
    borderRightColor: 'transparent',
    borderRightWidth: 9,
    borderTopWidth: 10,
    height: 0,
    marginBottom: 3,
    width: 0,
  },
  cardPointerDirect: {
    borderTopColor: '#ffffff',
  },
  cardPointerRelayed: {
    borderTopColor: '#8b5cf6',
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
