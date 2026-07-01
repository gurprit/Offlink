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
import {readGattPayloadFromDevice, setGattPayload, startGattServer} from './src/services/GattService';
import {createMeshPayload, mergeMeshSightings, parseMeshPayload, stringifyMeshEnvelope} from './src/services/MeshSyncService';
import {evaluateMeshPacket, relayPacket} from './src/services/MeshEngine';
import {enqueueRelayPacket, getRelayQueueSize} from './src/services/MeshRelayQueue';
import {dispatchNextMeshPacket} from './src/services/MeshDispatcher';
import {recordGattFailure, recordGattSuccess} from './src/services/MeshNeighbourReliability';
import {applyTopologyPayload, publishLocalTopology, setLocalMeshId} from './src/services/MeshTopologyExchangeService';

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
  const topologyCursorRef = useRef(0);
  const topologyHeartbeatInFlightRef = useRef(false);

  useEffect(() => {
    let stopScan: (() => void) | null = null;
    let stopLocationWatch: (() => void) | null = null;
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

    const scanWatchdogTimer = setInterval(() => {
      if (stopScan) {
        stopScan();
      }

      stopScan = startOfflinkScan(user => {
        handleNearbyUserFound(user);
      });

      console.log('OFFLINK_SCAN_WATCHDOG_RESTARTED');
    }, 12000);

    const topologySyncTimer = setInterval(() => {
      if (topologyHeartbeatInFlightRef.current) {
        console.log('OFFLINK_TOPOLOGY_HEARTBEAT_SKIPPED_IN_FLIGHT');
        return;
      }

      topologyHeartbeatInFlightRef.current = true;

      (async () => {
        try {
          const users = nearbyUsersRef.current.slice(0, 4);

          console.log(
            'OFFLINK_TOPOLOGY_HEARTBEAT',
            JSON.stringify({
              nearbyCount: users.length,
              users: users.map(user => ({
                userId: user.userId,
                meshId: user.meshId,
                deviceId: user.deviceId,
                rssi: user.rssi,
              })),
            }),
          );

          if (users.length > 0) {
            const index = topologyCursorRef.current % users.length;
            topologyCursorRef.current += 1;

            await syncMeshFromDevice(users[index]);
          }

          const meshId = ownMeshIdRef.current;
          if (meshId) {
            await publishLocalTopology(meshId).catch(error =>
              console.log('OFFLINK_TOPOLOGY_HEARTBEAT_PUBLISH_ERROR', String(error)),
            );
          }
        } finally {
          topologyHeartbeatInFlightRef.current = false;
        }
      })().catch(error => {
        topologyHeartbeatInFlightRef.current = false;
        console.log('OFFLINK_TOPOLOGY_HEARTBEAT_ERROR', String(error));
      });
    }, 3000);

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

        publishLocalTopology(savedProfile.meshId).catch(error =>
          console.log('OFFLINK_TOPOLOGY_INITIAL_PUBLISH_ERROR', String(error)),
        );

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

      if (stopLocationWatch) {
        stopLocationWatch();
      }

      clearInterval(staleUserTimer);
      clearInterval(scanWatchdogTimer);
      clearInterval(topologySyncTimer);
      stopBleBroadcastTest().catch(() => {});
    };
  }, []);

  const nearbyFriends = useMemo(() => {
    const friendIds = new Set(friends.map(friend => friend.userId));

    return nearbyUsers.filter(user => friendIds.has(user.userId));
  }, [friends, nearbyUsers]);

  function publishGattMesh(nextSightings: OfflinkSighting[]) {
    const meshId = ownMeshIdRef.current;

    if (!meshId) {
      return;
    }

    publishLocalTopology(meshId).catch(error =>
      console.log('OFFLINK_TOPOLOGY_PUBLISH_ERROR', String(error)),
    );
  }

  async function syncMeshFromDevice(user: NearbyOfflinkUser) {
    if (!user.deviceId || !ownUserIdRef.current) {
      console.log(
        'OFFLINK_GATT_SYNC_SKIPPED_MISSING_DATA',
        JSON.stringify({
          userId: user.userId,
          deviceId: user.deviceId,
          hasOwnUserId: Boolean(ownUserIdRef.current),
        }),
      );
      return;
    }

    const deviceId = user.deviceId;
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

    try {
      console.log(
        'OFFLINK_GATT_SYNC_START',
        JSON.stringify({userId: user.userId, meshId: user.meshId, deviceId}),
      );

      const rawPayload = await readGattPayloadFromDevice(deviceId);

      console.log(
        'OFFLINK_GATT_SYNC_PAYLOAD',
        JSON.stringify({
          userId: user.userId,
          length: rawPayload.length,
          startsWith: rawPayload.slice(0, 24),
        }),
      );

      if (
        applyTopologyPayload(
          rawPayload,
          ownMeshIdRef.current,
          ownUserIdRef.current,
          user.userId,
        )
      ) {
        console.log('OFFLINK_TOPOLOGY_SYNC_APPLIED', user.userId);

        if (ownMeshIdRef.current) {
          publishLocalTopology(ownMeshIdRef.current, true).catch(error =>
            console.log('OFFLINK_TOPOLOGY_REPUBLISH_ERROR', String(error)),
          );
        }

        lastGattSyncRef.current[deviceId] = Date.now();
        recordGattSuccess(user.userId);
        return;
      }

      const envelope = parseMeshPayload(rawPayload);

      if (!envelope) {
        console.log('OFFLINK_MESH_PACKET_DROP', 'parse-failed');
        lastGattFailureRef.current[deviceId] = Date.now();
        recordGattFailure(user.userId);
        return;
      }

      const decision = evaluateMeshPacket(envelope, ownUserIdRef.current);

      console.log(
        'OFFLINK_MESH_PACKET_DECISION',
        JSON.stringify({
          packetId: envelope.id,
          origin: envelope.origin,
          ttl: envelope.ttl,
          hopCount: envelope.hopCount,
          reason: decision.reason,
          accepted: decision.accepted,
          shouldRelay: decision.shouldRelay,
          sightings: envelope.payload.sightings.length,
        }),
      );

      if (!decision.accepted) {
        lastGattSyncRef.current[deviceId] = Date.now();
        recordGattSuccess(user.userId);
        return;
      }

      const payload = envelope.payload;

      setSightings(currentSightings => {
        const nextSightings = mergeMeshSightings({
          currentSightings,
          incomingSightings: payload.sightings,
          ownUserId: ownUserIdRef.current,
          seenBy: payload.senderId,
        });

        sightingsRef.current = nextSightings;
        saveSightings(nextSightings).catch(() => {});

        if (decision.shouldRelay) {
          const relayedEnvelope = relayPacket(envelope);
          const didQueue = enqueueRelayPacket(relayedEnvelope);

          console.log(
            'OFFLINK_MESH_PACKET_RELAY',
            JSON.stringify({
              packetId: relayedEnvelope.id,
              origin: relayedEnvelope.origin,
              ttl: relayedEnvelope.ttl,
              hopCount: relayedEnvelope.hopCount,
              queued: didQueue,
              queueSize: getRelayQueueSize(),
            }),
          );
        }

        publishGattMesh(nextSightings);

        lastGattSyncRef.current[deviceId] = Date.now();
        recordGattSuccess(user.userId);

        return nextSightings;
      });
    } catch (error) {
      lastGattFailureRef.current[deviceId] = Date.now();
      recordGattFailure(user.userId);
      console.log('OFFLINK_GATT_SYNC_ERROR', String(error));
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
