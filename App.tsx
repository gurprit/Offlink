import React, {useEffect, useMemo, useRef, useState} from 'react';
import 'react-native-get-random-values';

import {HomeScreen} from './src/screens/HomeScreen';
import {NearbyScreen} from './src/screens/NearbyScreen';
import {SightingsScreen} from './src/screens/SightingsScreen';
import {MapScreen} from './src/screens/MapScreen';
import {MeshDiagnosticsScreen} from './src/screens/MeshDiagnosticsScreen';
import {NearbyOfflinkUser, OfflinkFriend, OfflinkSighting} from './src/models/types';
import {loadFriends, loadProfile, loadSightings, saveFriends, saveSightings} from './src/services/StorageService';
import {
  requestBlePermissions,
  startBleBroadcast,
  startOfflinkScan,
  stopBleBroadcastTest,
} from './src/services/BleService';
import {OfflinkLocation, watchCurrentLocation} from './src/services/LocationService';
import {
  consumeInboundGattTopology,
  setGattTransportPayload,
  startGattServer,
} from './src/services/GattService';
import {createMeshPayload, stringifyMeshEnvelope} from './src/services/MeshSyncService';
import {getRelayQueueSize} from './src/services/MeshRelayQueue';
import {dispatchNextMeshPacket} from './src/services/MeshDispatcher';

import {
  applyTopologyPayload,
  publishLocalTopology,
  setLocalMeshId,
} from './src/services/MeshTopologyExchangeService';
import {startMeshScheduler} from './src/services/MeshScheduler';
import {processIncomingMeshPacket} from './src/services/MeshTransportService';

export default function App() {
  const [showNearby, setShowNearby] = useState(false);
  const [showSightings, setShowSightings] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showMeshDiagnostics, setShowMeshDiagnostics] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyOfflinkUser[]>([]);
  const nearbyUsersRef = useRef<NearbyOfflinkUser[]>([]);
  const [friends, setFriends] = useState<OfflinkFriend[]>([]);
  const [sightings, setSightings] = useState<OfflinkSighting[]>([]);
  const [bleStatus, setBleStatus] = useState('BLE starting...');
  const [gattSyncStatus, setGattSyncStatus] = useState({
    state: 'idle',
    targetUserId: null as string | null,
    targetDeviceId: null as string | null,
    lastStartedAt: null as number | null,
    lastSuccessAt: null as number | null,
    lastFailureAt: null as number | null,
    lastError: null as string | null,
  });
  const [ownUserId, setOwnUserId] = useState<string | null>(null);
  const [ownMeshId, setOwnMeshId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<OfflinkLocation | null>(null);
  const currentLocationRef = useRef<OfflinkLocation | null>(null);
  const ownUserIdRef = useRef<string | null>(null);
  const ownMeshIdRef = useRef<string | null>(null);
  const sightingsRef = useRef<OfflinkSighting[]>([]);
  const syncInFlightRef = useRef<Set<string>>(new Set());
  const lastGattSyncRef = useRef<Record<string, number>>({});
  const lastGattFailureRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let stopScan: (() => void) | null = null;
    let stopLocationWatch: (() => void) | null = null;
    let inboundTopologyTimer:
      ReturnType<typeof setInterval> | null = null;
    let isMounted = true;
    const staleUserTimer = setInterval(() => {
      setNearbyUsers(currentUsers => {
        const nextUsers = currentUsers.filter(
          user => Date.now() - user.lastSeenAt < 30000,
        );

        nearbyUsersRef.current = nextUsers;
        return nextUsers;
      });
    }, 5000);

    async function initialise() {
      const savedFriends = await loadFriends();
      const savedSightings = await loadSightings();
      const savedProfile = await loadProfile();

      if (!isMounted) {
        return;
      }

      setFriends(savedFriends);
      sightingsRef.current = savedSightings;
      setSightings(savedSightings);

      if (!savedProfile) {
        setBleStatus('Save an emoji identity to start BLE.');
        return;
      }

      ownUserIdRef.current = savedProfile.userId;
      ownMeshIdRef.current = savedProfile.meshId;
      setOwnUserId(savedProfile.userId);
      setOwnMeshId(savedProfile.meshId);
      setLocalMeshId(savedProfile.meshId);

      const granted = await requestBlePermissions();

      if (!isMounted) {
        return;
      }

      if (!granted) {
        setBleStatus('Bluetooth permissions needed.');
        return;
      }

      try {
        stopLocationWatch = await watchCurrentLocation(
          location => {
            currentLocationRef.current = location;
            setCurrentLocation(location);
            startBleBroadcast(savedProfile, location).catch(error =>
              console.log('OFFLINK_BROADCAST_LOCATION_ERROR', error),
            );
          },
          error => console.log('OFFLINK_LOCATION_WATCH_ERROR', error),
        );

        await startBleBroadcast(savedProfile, currentLocationRef.current);

        await startGattServer(
          createMeshPayload(savedProfile.userId, sightingsRef.current),
        );

        await publishLocalTopology(savedProfile.meshId).catch(error =>
          console.log('OFFLINK_TOPOLOGY_INITIAL_PUBLISH_ERROR', String(error)),
        );

        inboundTopologyTimer = setInterval(() => {
          consumeInboundGattTopology()
            .then(payload => {
              if (!payload) {
                return;
              }

              const applied = applyTopologyPayload(
                payload,
                savedProfile.meshId,
                savedProfile.userId,
              );

              console.log(
                'OFFLINK_INBOUND_TOPOLOGY_CONSUMED',
                JSON.stringify({
                  applied,
                  length: payload.length,
                  startsWith: payload.slice(0, 24),
                }),
              );
            })
            .catch(error =>
              console.log(
                'OFFLINK_INBOUND_TOPOLOGY_CONSUME_ERROR',
                String(error),
              ),
            );
        }, 1000);

        stopScan = startMeshScheduler({
          getNearbyUsers: () => nearbyUsersRef.current,
          startScan: () =>
            startOfflinkScan(user => {
              handleNearbyUserFound(user);
            }),
          syncUser: syncMeshFromDevice,
          publishTopology: async () => {
            const meshId = ownMeshIdRef.current;

            if (!meshId) {
              return;
            }

            await publishLocalTopology(meshId);
          },
        });

        setBleStatus('BLE active: scheduled scan and topology sync.');
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

      if (stopLocationWatch) {
        stopLocationWatch();
      }

      clearInterval(staleUserTimer);

      if (inboundTopologyTimer) {
        clearInterval(inboundTopologyTimer);
      }

      stopBleBroadcastTest().catch(() => {});
    };
  }, []);

  const nearbyFriends = useMemo(() => {
    const friendIds = new Set(friends.map(friend => friend.userId));

    return nearbyUsers.filter(user => friendIds.has(user.userId));
  }, [friends, nearbyUsers]);

  function publishGattMesh(nextSightings: OfflinkSighting[]) {
    const userId = ownUserIdRef.current;
    const meshId = ownMeshIdRef.current;

    if (!userId || !meshId) {
      return;
    }

    setGattTransportPayload(
      createMeshPayload(userId, nextSightings),
    ).catch(error =>
      console.log('OFFLINK_MESH_TRANSPORT_PUBLISH_ERROR', String(error)),
    );

    publishLocalTopology(meshId).catch(error =>
      console.log('OFFLINK_TOPOLOGY_PUBLISH_ERROR', String(error)),
    );
  }

  async function syncMeshFromDevice(user: NearbyOfflinkUser) {
    const freshestUser =
      nearbyUsersRef.current.find(
        candidate => candidate.meshId === user.meshId,
      ) ?? user;

    if (!freshestUser.deviceId || !ownUserIdRef.current) {
      console.log(
        'OFFLINK_GATT_SYNC_SKIPPED_MISSING_DATA',
        JSON.stringify({
          userId: freshestUser.userId,
          deviceId: freshestUser.deviceId,
          hasOwnUserId: Boolean(ownUserIdRef.current),
        }),
      );
      return;
    }

    const syncUser = freshestUser;
    const deviceId = freshestUser.deviceId;
    const localMeshId = ownMeshIdRef.current;

    if (!deviceId || !localMeshId) {
      return;
    }

    if (localMeshId > syncUser.meshId) {
      console.log(
        'OFFLINK_GATT_SYNC_SKIPPED_RESPONDER_ROLE',
        JSON.stringify({
          ownMeshId: localMeshId,
          peerMeshId: syncUser.meshId,
        }),
      );
      return;
    }

    const lastSyncAt = lastGattSyncRef.current[deviceId] || 0;
    const lastFailureAt = lastGattFailureRef.current[deviceId] || 0;
    const now = Date.now();

    if (now - lastSyncAt < 4000) {
      console.log('OFFLINK_GATT_SYNC_SKIPPED_THROTTLE', user.userId);
      return;
    }

    if (now - lastFailureAt < 5000) {
      console.log('OFFLINK_GATT_SYNC_SKIPPED_FAILURE_BACKOFF', user.userId);
      return;
    }

    if (syncInFlightRef.current.has(deviceId)) {
      console.log('OFFLINK_GATT_SYNC_SKIPPED_IN_FLIGHT', user.userId);
      return;
    }

    syncInFlightRef.current.add(deviceId);

    setGattSyncStatus(current => ({
      ...current,
      state: 'syncing',
      targetUserId: user.userId,
      targetDeviceId: deviceId,
      lastStartedAt: Date.now(),
      lastError: null,
    }));

    try {
      const localTopologyPayload =
        await publishLocalTopology(localMeshId);

      const result = await processIncomingMeshPacket({
        user: syncUser,
        ownUserId: ownUserIdRef.current,
        ownMeshId: localMeshId,
        currentSightings: sightingsRef.current,
        localTopologyPayload,
        publishGattMesh,
        saveSightings: nextSightings => {
          sightingsRef.current = nextSightings;
          saveSightings(nextSightings).catch(() => {});
        },
      });

      if (result.nextSightings) {
        sightingsRef.current = result.nextSightings;
        setSightings(result.nextSightings);
      }

      lastGattSyncRef.current[deviceId] = Date.now();

      if (!result.handled) {
        const failureAt = Date.now();
        lastGattFailureRef.current[deviceId] = failureAt;

        setGattSyncStatus(current => ({
          ...current,
          state: 'failed',
          lastFailureAt: failureAt,
          lastError: 'Payload was not handled.',
        }));
      } else {
        setGattSyncStatus(current => ({
          ...current,
          state: 'success',
          lastSuccessAt: Date.now(),
          lastError: null,
        }));
      }
    } catch (error) {
      const failureAt = Date.now();
      const message = String(error);

      lastGattFailureRef.current[deviceId] = failureAt;

      setGattSyncStatus(current => ({
        ...current,
        state: 'failed',
        lastFailureAt: failureAt,
        lastError: message,
      }));

      console.log('OFFLINK_GATT_SYNC_ERROR', message);
    } finally {
      syncInFlightRef.current.delete(deviceId);
    }
  }

  function handleNearbyUserFound(user: NearbyOfflinkUser) {
    const location = currentLocationRef.current;
    setNearbyUsers(currentUsers => {
      const withoutExisting = currentUsers.filter(
        currentUser => currentUser.meshId !== user.meshId,
      );

      const nextUsers = [user, ...withoutExisting]
        .filter(item => Date.now() - item.lastSeenAt < 30000)
        .sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));

      nearbyUsersRef.current = nextUsers;
      return nextUsers;
    });

    setSightings(currentSightings => {
      const existingSighting = currentSightings.find(
        sighting => sighting.userId === user.userId,
      );

      const directSighting: OfflinkSighting = {
        userId: user.userId,
        emoji: user.emoji,
        lastSeenAt: user.lastSeenAt,
        updatedAt: Date.now(),
        seenBy: ownUserId || 'unknown',
        source: 'direct',
        rssi: user.rssi,
        hops: 0,
        latitude: user.latitude ?? location?.latitude ?? existingSighting?.latitude,
        longitude: user.longitude ?? location?.longitude ?? existingSighting?.longitude,
        accuracy: user.accuracy ?? location?.accuracy ?? existingSighting?.accuracy,
      };

      const nextSightings = [
        directSighting,
        ...currentSightings.filter(sighting => sighting.userId !== user.userId),
      ]
        .filter(sighting => Date.now() - sighting.lastSeenAt < 1000 * 60 * 60)
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt);

      sightingsRef.current = nextSightings;
      saveSightings(nextSightings).catch(() => {});
      publishGattMesh(nextSightings);
      return nextSightings;
    });

    dispatchNextMeshPacket('nearby-user-found').catch(error =>
      console.log('OFFLINK_MESH_DISPATCH_ERROR', String(error)),
    );

    // GATT topology sync is handled by the serial heartbeat.
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

  if (showMeshDiagnostics) {
    return (
      <MeshDiagnosticsScreen
        onBack={() => setShowMeshDiagnostics(false)}
        bleStatus={bleStatus}
        nearbyUsers={nearbyUsers}
        gattSyncStatus={gattSyncStatus}
      />
    );
  }

  if (showMap) {
    return (
      <MapScreen
        sightings={sightings}
        friends={friends}
        currentLocation={currentLocation}
        onBack={() => setShowMap(false)}
      />
    );
  }

  if (showSightings) {
    return (
      <SightingsScreen
        sightings={sightings}
        onBack={() => setShowSightings(false)}
      />
    );
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
      onShowSightings={() => setShowSightings(true)}
      onShowMap={() => setShowMap(true)}
      onShowMeshDiagnostics={() => setShowMeshDiagnostics(true)}
      onNearbyUserFound={handleNearbyUserFound}
      onFriendsChanged={setFriends}
      bleStatus={bleStatus}
    />
  );
}
