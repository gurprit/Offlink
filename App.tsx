import React, {useEffect, useMemo, useState} from 'react';
import 'react-native-get-random-values';

import {HomeScreen} from './src/screens/HomeScreen';
import {NearbyScreen} from './src/screens/NearbyScreen';
import {NearbyOfflinkUser, OfflinkFriend} from './src/models/types';
import {loadFriends} from './src/services/StorageService';

export default function App() {
  const [showNearby, setShowNearby] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyOfflinkUser[]>([]);
  const [friends, setFriends] = useState<OfflinkFriend[]>([]);

  useEffect(() => {
    async function initialise() {
      const savedFriends = await loadFriends();
      setFriends(savedFriends);
    }

    initialise();
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

      return [user, ...withoutExisting];
    });
  }

  if (showNearby) {
    return (
      <NearbyScreen
        nearbyUsers={nearbyFriends}
        onBack={() => setShowNearby(false)}
      />
    );
  }

  return (
    <HomeScreen
      onShowNearby={() => setShowNearby(true)}
      onNearbyUserFound={handleNearbyUserFound}
      onFriendsChanged={setFriends}
    />
  );
}
