import React, {useState} from 'react';
import 'react-native-get-random-values';

import {HomeScreen} from './src/screens/HomeScreen';
import {NearbyScreen} from './src/screens/NearbyScreen';

export default function App() {
  const [showNearby, setShowNearby] = useState(false);

  if (showNearby) {
    return <NearbyScreen />;
  }

  return (
    <HomeScreen
      onShowNearby={() => setShowNearby(true)}
    />
  );
}
