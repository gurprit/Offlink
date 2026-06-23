import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Button} from '../components/Button';
import {NearbyOfflinkUser} from '../models/types';

export function NearbyScreen({
  nearbyUsers,
  onBack,
}: {
  nearbyUsers: NearbyOfflinkUser[];
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Nearby Offlink Users</Text>

      <Button label="Back" onPress={onBack} />

      <View style={styles.spacer} />

      {nearbyUsers.length === 0 ? (
        <Text style={styles.empty}>
          No nearby Offlink users found yet.
        </Text>
      ) : (
        nearbyUsers.map(user => (
          <View key={user.userId} style={styles.row}>
            <Text style={styles.emoji}>{user.emoji}</Text>
            <View>
              <Text style={styles.id}>{user.userId}</Text>
              <Text style={styles.meta}>
                Last seen just now
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
