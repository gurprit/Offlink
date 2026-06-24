import React from 'react';
import {
  DimensionValue,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Button} from '../components/Button';
import {OfflinkSighting} from '../models/types';

function getMarkerPosition(index: number): {left: DimensionValue; top: DimensionValue} {
  const positions: {left: DimensionValue; top: DimensionValue}[] = [
    {left: '22%', top: '28%'},
    {left: '62%', top: '34%'},
    {left: '44%', top: '58%'},
    {left: '76%', top: '66%'},
    {left: '18%', top: '72%'},
  ];

  return positions[index % positions.length];
}

export function MapScreen({
  sightings,
  onBack,
}: {
  sightings: OfflinkSighting[];
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Offline Map</Text>
      <Button label="Back" onPress={onBack} />

      <View style={styles.map}>
        <View style={styles.gridLineVerticalOne} />
        <View style={styles.gridLineVerticalTwo} />
        <View style={styles.gridLineHorizontalOne} />
        <View style={styles.gridLineHorizontalTwo} />

        <View style={styles.youMarker}>
          <Text style={styles.youText}>📍</Text>
          <Text style={styles.youLabel}>You</Text>
        </View>

        {sightings.slice(0, 5).map((sighting, index) => (
          <View
            key={sighting.userId}
            style={[
              styles.friendMarker,
              getMarkerPosition(index),
            ]}>
            <Text style={styles.markerEmoji}>{sighting.emoji}</Text>
            <Text style={styles.markerLabel}>{sighting.userId}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.helper}>
        Map v1 uses stored sightings as marker data. Real location comes next.
      </Text>
    </SafeAreaView>
  );
}

const lineBase = {
  position: 'absolute' as const,
  backgroundColor: '#242424',
};

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
  map: {
    flex: 1,
    backgroundColor: '#101010',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 24,
    marginTop: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  gridLineVerticalOne: {
    ...lineBase,
    width: 1,
    height: '100%',
    left: '33%',
  },
  gridLineVerticalTwo: {
    ...lineBase,
    width: 1,
    height: '100%',
    left: '66%',
  },
  gridLineHorizontalOne: {
    ...lineBase,
    height: 1,
    width: '100%',
    top: '33%',
  },
  gridLineHorizontalTwo: {
    ...lineBase,
    height: 1,
    width: '100%',
    top: '66%',
  },
  youMarker: {
    position: 'absolute',
    left: '45%',
    top: '78%',
    alignItems: 'center',
  },
  youText: {
    fontSize: 34,
  },
  youLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  friendMarker: {
    position: 'absolute',
    alignItems: 'center',
    backgroundColor: '#181818',
    borderColor: '#444',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  markerEmoji: {
    fontSize: 28,
  },
  markerLabel: {
    color: '#aaa',
    fontSize: 10,
    marginTop: 2,
  },
  helper: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },
});
