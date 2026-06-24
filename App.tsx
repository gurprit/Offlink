import React, {useEffect, useMemo, useState} from 'react';
import 'react-native-get-random-values';

import {HomeScreen} from './src/screens/HomeScreen';
import {NearbyScreen} from './src/screens/NearbyScreen';
import {NearbyOfflinkUser, OfflinkFriend, OfflinkSighting} from './src/models/types';
import {loadFriends, loadProfile, loadSightings, saveFriends, saveSightings} from './src/services/StorageService';
import {
  requestBlePermissions,
  startBleBroadcast,
  startOfflinkScan,
  stopBleBroadcastTest,
} from './src/services/BleService';

export default function App() {
  const [showNearby, setShowNearby] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyOfflinkUser[]>([]);
  const [friends, setFriends] = useState<OfflinkFriend[]>([]);
  const [sightings, setSightings] = useState<OfflinkSighting[]>([]);
  const [bleStatus, setBleStatus] = useState('BLE starting...');

  useEffect(() => {
    let stopScan: (() => void) | null = null;
    let isMounted = true;
    const staleUserTimer = setInterval(() => {
      setNearbyUsers(currentUsers =>
        currentUsers.filter(user => Date.now() - user.lastSeenAt < 30000),
      );
    }, 5000);

    async function initialise() {
      const savedFriends = await loadFriends();
      const savedSightings = await loadSightings();
      const savedProfile = await loadProfile();

      if (!isMounted) {
        return;
      }

      setFriends(savedFriends);
      setSightings(savedSightings);

      if (!savedProfile) {
        setBleStatus('Save an emoji identity to start BLE.');
        return;
      }

      const granted = await requestBlePermissions();

      if (!isMounted) {
        return;
      }

      if (!granted) {
        setBleStatus('Bluetooth permissions needed.');
        return;
      }

      try {
        await startBleBroadcast(savedProfile);

        stopScan = startOfflinkScan(user => {
          handleNearbyUserFound(user);
        });

        setBleStatus('BLE active: broadcasting and scanning.');
      } catch (error) {
        setBleStatus(`BLE error: ${String(error)}`);
      }
    }

    initialise();

    return () => {
      isMounted = false;

      if (stopScan) {
        stopScan();
      }

      clearInterval(staleUserTimer);
      stopBleBroadcastTest().catch(() => {});
    };
  }, []);

  const nearbyFriends = useMemo(() => {
    const friendIds = new Set(friends.map(friend => friend.userId));

    return nearbyUsers.filter(user => friendIds.has(user.userId));
  }, [friends, nearbyUsers]);

  function handleNearbyUserFound(user: NearbyOfflinkUser) {
    setNearbyUsers(currentUsers => {
      const withoutExisting = currentUsers.filter(
        currentUser => currentUser.userId !== user.userId,
      );

      const nextUsers = [user, ...withoutExisting]
        .filter(item => Date.now() - item.lastSeenAt < 30000)
        .sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));

      return nextUsers;
    });

    setSightings(currentSightings => {
      const directSighting: OfflinkSighting = {
        userId: user.userId,
        emoji: user.emoji,
        lastSeenAt: user.lastSeenAt,
        source: 'direct',
        rssi: user.rssi,
        hops: 0,
      };

      const nextSightings = [
        directSighting,
        ...currentSightings.filter(sighting => sighting.userId !== user.userId),
      ]
        .filter(sighting => Date.now() - sighting.lastSeenAt < 1000 * 60 * 60)
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt);

      saveSightings(nextSightings).catch(() => {});
      return nextSightings;
    });

    setFriends(currentFriends => {
      const didFindFriend = currentFriends.some(
        friend => friend.userId === user.userId,
      );

      if (!didFindFriend) {
        return currentFriends;
      }

      const nextFriends = currentFriends.map(friend =>
        friend.userId === user.userId
          ? {...friend, emoji: user.emoji}
          : friend,
      );

      saveFriends(nextFriends).catch(() => {});
      return nextFriends;
    });
  }

  if (showNearby) {
    return (
      <NearbyScreen
        nearbyUsers={nearbyFriends}
        discoveredCount={nearbyUsers.length}
        friendCount={friends.length}
        sightingCount={sightings.length}
        onBack={() => setShowNearby(false)}
      />
    );
  }

  return (
    <HomeScreen
      onShowNearby={() => setShowNearby(true)}
      onNearbyUserFound={handleNearbyUserFound}
      onFriendsChanged={setFriends}
      bleStatus={bleStatus}
    />
  );
}
