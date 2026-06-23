import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {NearbyOfflinkUser} from '../models/types';

const MOCK_USERS: NearbyOfflinkUser[] = [
  {
    userId: 'OL-AAAAAA',
    emoji: '😀',
    lastSeenAt: Date.now(),
  },
  {
    userId: 'OL-BBBBBB',
    emoji: '🚀',
    lastSeenAt: Date.now(),
  },
  {
    userId: 'OL-CCCCCC',
    emoji: '🐸',
    lastSeenAt: Date.now(),
  },
];

export function NearbyScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Nearby Offlink Users</Text>

      {MOCK_USERS.map(user => (
        <View key={user.userId} style={styles.row}>
          <Text style={styles.emoji}>{user.emoji}</Text>
          <Text style={styles.id}>{user.userId}</Text>
        </View>
      ))}
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
  },
});
