import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Button} from '../components/Button';
import {OfflinkSighting} from '../models/types';

export function SightingsScreen({
  sightings,
  onBack,
}: {
  sightings: OfflinkSighting[];
  onBack: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Sightings</Text>
      <Button label="Back" onPress={onBack} />

      <View style={styles.spacer} />

      {sightings.length === 0 ? (
        <Text style={styles.empty}>No sightings stored yet.</Text>
      ) : (
        sightings.map(sighting => (
          <View key={sighting.userId} style={styles.row}>
            <Text style={styles.emoji}>{sighting.emoji}</Text>
            <View>
              <Text style={styles.id}>{sighting.userId}</Text>
              <Text style={styles.meta}>
                {sighting.source === 'direct' ? 'Direct sighting' : 'Mesh sighting'}
                {typeof sighting.hops === 'number' ? ` · ${sighting.hops} hops` : ''}
              </Text>
              <Text style={styles.meta}>
                Seen {Math.max(0, Math.floor((now - sighting.lastSeenAt) / 1000))}s ago
                {typeof sighting.rssi === 'number' ? ` · ${sighting.rssi} dBm` : ''}
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
  meta: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 4,
  },
});
