import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Button} from '../components/Button';
import {NearbyOfflinkUser} from '../models/types';

function getProximityLabel(rssi?: number): string {
  if (typeof rssi !== 'number') {
    return 'Signal unknown';
  }

  if (rssi >= -55) {
    return 'Very close';
  }

  if (rssi >= -70) {
    return 'Nearby';
  }

  return 'Far';
}

function getSignalBars(rssi?: number): string {
  if (typeof rssi !== 'number') {
    return '○○○○○';
  }

  if (rssi >= -50) {
    return '●●●●●';
  }

  if (rssi >= -60) {
    return '●●●●○';
  }

  if (rssi >= -70) {
    return '●●●○○';
  }

  if (rssi >= -80) {
    return '●●○○○';
  }

  return '●○○○○';
}

export function NearbyScreen({
  nearbyUsers,
  discoveredCount,
  friendCount,
  onBack,
}: {
  nearbyUsers: NearbyOfflinkUser[];
  discoveredCount: number;
  friendCount: number;
  onBack: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Nearby Friends</Text>

      <Button label="Back" onPress={onBack} />

      <View style={styles.spacer} />

      <Text style={styles.debug}>
        Friends: {friendCount} · Discovered: {discoveredCount} · Nearby friends: {nearbyUsers.length}
      </Text>

      <Text style={styles.sortHint}>
        Closest friends appear first
      </Text>

      <View style={styles.spacer} />

      {nearbyUsers.length === 0 ? (
        <Text style={styles.empty}>
          No nearby friends found yet.
        </Text>
      ) : (
        nearbyUsers.map(user => (
          <View key={user.userId} style={styles.row}>
            <Text style={styles.emoji}>{user.emoji}</Text>
            <View>
              <Text style={styles.id}>{user.userId}</Text>
              <Text style={styles.signal}>
                {getSignalBars(user.rssi)}
              </Text>

              <Text style={styles.meta}>
                {getProximityLabel(user.rssi)}
                {typeof user.rssi === 'number' ? ` (${user.rssi} dBm)` : ''}
              </Text>

              <Text style={styles.meta}>
                Seen {Math.max(
                  0,
                  Math.floor((now - user.lastSeenAt) / 1000),
                )}s ago
              </Text>
            </View>
          </View>
        ))
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  spacer: {
    height: 16,
  },
  debug: {
    color: '#777',
    fontSize: 13,
    textAlign: 'center',
  },
  sortHint: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  empty: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  emoji: {
    fontSize: 32,
    marginRight: 16,
  },
  id: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  signal: {
    color: '#fff',
    fontSize: 18,
    letterSpacing: 2,
    marginTop: 4,
  },
  meta: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 4,
  },
});
