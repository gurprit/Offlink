import React, {useEffect, useMemo, useState} from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Button} from '../components/Button';
import {FriendMap} from '../components/FriendMap';
import {FriendRadar} from '../components/FriendRadar';
import {OfflinkFriend, OfflinkSighting} from '../models/types';
import {OfflinkLocation} from '../services/LocationService';

type MapMode = 'map' | 'radar';

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
  const [mode, setMode] = useState<MapMode>('map');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const friendIds = useMemo(
    () => new Set(friends.map(friend => friend.userId.trim().toUpperCase())),
    [friends],
  );

  const friendSightings = useMemo(
    () =>
      sightings.filter(
        sighting =>
          friendIds.has(sighting.userId.trim().toUpperCase()) &&
          typeof sighting.latitude === 'number' &&
          typeof sighting.longitude === 'number' &&
          now - sighting.lastSeenAt < 1000 * 60 * 60,
      ),
    [sightings, friendIds, now],
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Offlink Finder</Text>
          <Text style={styles.title}>
            {mode === 'map' ? 'Friends nearby' : 'Close-range radar'}
          </Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{selected: mode === 'map'}}
          onPress={() => setMode('map')}
          style={[styles.tab, mode === 'map' && styles.tabActive]}>
          <Text style={[styles.tabText, mode === 'map' && styles.tabTextActive]}>
            MAP
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{selected: mode === 'radar'}}
          onPress={() => setMode('radar')}
          style={[styles.tab, mode === 'radar' && styles.tabActive]}>
          <Text style={[styles.tabText, mode === 'radar' && styles.tabTextActive]}>
            RADAR
          </Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{friendSightings.length}</Text>
          <Text style={styles.statLabel}>friends</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{sightings.length}</Text>
          <Text style={styles.statLabel}>sightings</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>
            {currentLocation
              ? `±${Math.round(currentLocation.accuracy || 0)}m`
              : '...'}
          </Text>
          <Text style={styles.statLabel}>GPS</Text>
        </View>
      </View>

      <View style={styles.content}>
        {mode === 'map' ? (
          <FriendMap
            friendSightings={friendSightings}
            currentLocation={currentLocation}
          />
        ) : (
          <FriendRadar
            friendSightings={friendSightings}
            currentLocation={currentLocation}
          />
        )}
      </View>

      <Text style={styles.helper}>
        {mode === 'map'
          ? 'Map for the wider area · switch to Radar when you get close'
          : 'Direction uses your phone compass · distance uses the latest Offlink location'}
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
    marginBottom: 12,
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
  tabBar: {
    backgroundColor: '#101010',
    borderColor: '#2a2a2a',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
    padding: 4,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 10,
  },
  tabActive: {
    backgroundColor: '#8b5cf6',
  },
  tabText: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
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
  content: {
    flex: 1,
  },
  helper: {
    color: '#888',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
});
