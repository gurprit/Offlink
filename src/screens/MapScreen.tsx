import React, {useEffect, useMemo, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Button} from '../components/Button';
import {FriendMap} from '../components/FriendMap';
import {OfflinkFriend, OfflinkSighting} from '../models/types';
import {OfflinkLocation} from '../services/LocationService';

function normaliseOfflinkId(value: string): string {
  return value.trim().toUpperCase();
}

export function MapScreen({
  sightings,
  friends,
  currentLocation,
  onBack,
}: {
  sightings: OfflinkSighting[];
  friends: OfflinkFriend[];
  currentLocation: OfflinkLocation | null;
  onBack: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const friendSightings = useMemo(
    () =>
      sightings.filter(
        sighting =>
          typeof sighting.latitude === 'number' &&
          typeof sighting.longitude === 'number' &&
          now - sighting.lastSeenAt < 1000 * 60 * 60,
      ),
    [sightings, now],
  );

  const centerCoordinate: [number, number] = currentLocation
    ? [currentLocation.longitude, currentLocation.latitude]
    : friendSightings[0]?.longitude && friendSightings[0]?.latitude
      ? [friendSightings[0].longitude, friendSightings[0].latitude]
      : [-0.1276, 51.5072];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Offlink Map</Text>
          <Text style={styles.title}>Friends nearby</Text>
        </View>

      </View>

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{friendSightings.length}</Text>
          <Text style={styles.statLabel}>friend pins</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{sightings.length}</Text>
          <Text style={styles.statLabel}>total sightings</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>
            {currentLocation ? `±${Math.round(currentLocation.accuracy || 0)}m` : '...'}
          </Text>
          <Text style={styles.statLabel}>GPS</Text>
        </View>
      </View>

      <FriendMap
        friendSightings={friendSightings}
        currentLocation={currentLocation}
      />

      <Text style={styles.helper}>
        Online test map for now · offline map tiles come later
      </Text>

      <Button label="Back" onPress={onBack} />
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
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  kicker: {
    color: '#8b5cf6',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statPill: {
    backgroundColor: '#111',
    borderColor: '#2a2a2a',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  statValue: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  mapWrap: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderColor: '#333',
    borderWidth: 1,
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
  friendAvatar: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#8b5cf6',
    borderRadius: 30,
    borderWidth: 4,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  friendAvatarText: {
    color: '#050505',
    fontSize: 31,
    fontWeight: '900',
    textAlign: 'center',
  },
  friendCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 5,
    minWidth: 104,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  friendName: {
    color: '#050505',
    fontSize: 12,
    fontWeight: '900',
  },
  friendMeta: {
    color: '#8b5cf6',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 1,
  },
  emptyOverlay: {
    backgroundColor: 'rgba(5,5,5,0.84)',
    borderColor: '#333',
    borderRadius: 22,
    borderWidth: 1,
    left: 22,
    padding: 18,
    position: 'absolute',
    right: 22,
    top: 22,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: '#bbb',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 6,
  },
  helper: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },
});
