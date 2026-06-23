import React, {useState} from 'react';
import 'react-native-get-random-values';

import {HomeScreen} from './src/screens/HomeScreen';
import {NearbyScreen} from './src/screens/NearbyScreen';
import {NearbyOfflinkUser} from './src/models/types';

const TEST_NEARBY_USERS: NearbyOfflinkUser[] = [
  {
    userId: 'OL-TEST01',
    emoji: '🦁',
    lastSeenAt: Date.now(),
  },
  {
    userId: 'OL-TEST02',
    emoji: '🛰️',
    lastSeenAt: Date.now(),
  },
];

export default function App() {
  const [showNearby, setShowNearby] = useState(false);
  const [nearbyUsers] = useState<NearbyOfflinkUser[]>(TEST_NEARBY_USERS);

  if (showNearby) {
    return (
      <NearbyScreen
        nearbyUsers={nearbyUsers}
        onBack={() => setShowNearby(false)}
      />
    );
  }

  return (
    <HomeScreen
      onShowNearby={() => setShowNearby(true)}
    />
  );
}
