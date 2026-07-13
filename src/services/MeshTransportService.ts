import {NearbyOfflinkUser, OfflinkSighting} from '../models/types';
import {readGattPayloadsFromDevice} from './GattService';
import {
  createMeshAckEnvelope,
  isMeshAckEnvelope,
  isMeshFriendLocationsEnvelope,
  isMeshSightingsEnvelope,
  mergeMeshSightings,
  parseMeshPayload,
} from './MeshSyncService';
import {evaluateMeshPacket, relayPacket} from './MeshEngine';
import {enqueueRelayPacket, getRelayQueueSize} from './MeshRelayQueue';
import {dispatchNextMeshPacket} from './MeshDispatcher';
import MeshTopology from './MeshTopology';
import {recordGattFailure, recordGattSuccess} from './MeshNeighbourReliability';
import {applyTopologyPayload, publishLocalTopology} from './MeshTopologyExchangeService';
import {applyFriendLocation} from './FriendLocationService';

export type ProcessIncomingMeshPacketArgs = {
  user: NearbyOfflinkUser;
  ownUserId: string | null;
  ownMeshId: string | null;
  currentSightings: OfflinkSighting[];
  localTopologyPayload: string;
  publishGattMesh: (nextSightings: OfflinkSighting[]) => void;
  saveSightings: (nextSightings: OfflinkSighting[]) => void;
};

export type ProcessIncomingMeshPacketResult = {
  nextSightings: OfflinkSighting[] | null;
  handled: boolean;
};

export async function processIncomingMeshPacket({
  user,
  ownUserId,
  ownMeshId,
  currentSightings,
  localTopologyPayload,
  publishGattMesh,
  saveSightings,
}: ProcessIncomingMeshPacketArgs): Promise<ProcessIncomingMeshPacketResult> {
  if (!user.deviceId || !ownUserId) {
    console.log(
      'OFFLINK_GATT_SYNC_SKIPPED_MISSING_DATA',
      JSON.stringify({
        userId: user.userId,
        deviceId: user.deviceId,
        hasOwnUserId: Boolean(ownUserId),
      }),
    );

    return {
      nextSightings: null,
      handled: false,
    };
  }

  console.log(
    'OFFLINK_GATT_SYNC_START',
    JSON.stringify({
      userId: user.userId,
      meshId: user.meshId,
      deviceId: user.deviceId,
    }),
  );

  const gattPayloads = await readGattPayloadsFromDevice(
    user.deviceId,
    localTopologyPayload,
  );
  const topologyPayload = gattPayloads.topology;
  const meshPayload = gattPayloads.transport;

  console.log(
    'OFFLINK_GATT_SYNC_PAYLOAD',
    JSON.stringify({
      userId: user.userId,
      topologyLength: topologyPayload.length,
      transportLength: meshPayload.length,
      topologyStartsWith: topologyPayload.slice(0, 24),
      transportStartsWith: meshPayload.slice(0, 24),
    }),
  );

  const didApplyTopology = applyTopologyPayload(
    topologyPayload,
    ownMeshId,
    ownUserId,
    user.userId,
  );

  if (didApplyTopology) {
    console.log('OFFLINK_TOPOLOGY_SYNC_APPLIED', user.userId);

    if (ownMeshId) {
      publishLocalTopology(ownMeshId, true).catch(error =>
        console.log('OFFLINK_TOPOLOGY_REPUBLISH_ERROR', String(error)),
      );
    }
  }

  if (didApplyTopology && !meshPayload) {
    recordGattSuccess(user.userId);

    return {
      nextSightings: null,
      handled: true,
    };
  }
  const envelope = meshPayload ? parseMeshPayload(meshPayload) : null;

  if (!envelope) {
    console.log('OFFLINK_MESH_PACKET_DROP', 'parse-failed');
    recordGattFailure(user.userId);

    return {
      nextSightings: null,
      handled: false,
    };
  }

  const decision = evaluateMeshPacket(envelope, ownUserId);

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
      kind: envelope.payload.kind || 'sightings',
      sightings: isMeshSightingsEnvelope(envelope)
        ? envelope.payload.sightings.length
        : 0,
    }),
  );

  if (!decision.accepted) {
    recordGattSuccess(user.userId);

    return {
      nextSightings: null,
      handled: true,
    };
  }

  if (isMeshAckEnvelope(envelope)) {
    console.log(
      'OFFLINK_MESH_ACK_RECEIVED',
      JSON.stringify({
        ackFor: envelope.payload.ackFor,
        from: envelope.payload.senderId,
        packetId: envelope.id,
        ttl: envelope.ttl,
        hopCount: envelope.hopCount,
      }),
    );

    if (decision.shouldRelay) {
      const relayedAck = relayPacket(envelope);
      const didQueueAck = enqueueRelayPacket(relayedAck);

      console.log(
        'OFFLINK_MESH_ACK_RELAY',
        JSON.stringify({
          packetId: relayedAck.id,
          ackFor: relayedAck.payload.ackFor,
          origin: relayedAck.origin,
          ttl: relayedAck.ttl,
          hopCount: relayedAck.hopCount,
          queued: didQueueAck,
          queueSize: getRelayQueueSize(),
        }),
      );
    }

    recordGattSuccess(user.userId);

    return {
      nextSightings: null,
      handled: true,
    };
  }

  if (isMeshFriendLocationsEnvelope(envelope)) {
    const ackEnvelope = createMeshAckEnvelope(
      ownUserId,
      envelope.id,
    );
    const didQueueAck = enqueueRelayPacket(ackEnvelope);

    console.log(
      'OFFLINK_MESH_ACK_CREATED',
      JSON.stringify({
        packetId: ackEnvelope.id,
        ackFor: envelope.id,
        origin: ackEnvelope.origin,
        queued: didQueueAck,
        queueSize: getRelayQueueSize(),
        kind: 'friend_locations',
      }),
    );

    if (didQueueAck) {
      dispatchNextMeshPacket(
        'friend-location-ack-created',
      ).catch(error =>
        console.log(
          'OFFLINK_MESH_ACK_DISPATCH_ERROR',
          String(error),
        ),
      );
    }

    let stored = 0;
    let updated = 0;
    let ignored = 0;
    let invalid = 0;

    envelope.payload.locations.forEach(location => {
      if (location.userId === ownUserId) {
        ignored += 1;
        return;
      }

      const result = applyFriendLocation({
        ...location,
        hops: Math.min(
          10,
          Math.max(
            location.hops ?? 0,
            envelope.hopCount + 1,
          ),
        ),
      });

      if (result === 'stored') {
        stored += 1;
      } else if (result === 'updated') {
        updated += 1;
      } else if (result === 'invalid') {
        invalid += 1;
      } else {
        ignored += 1;
      }
    });

    console.log(
      'OFFLINK_FRIEND_LOCATIONS_RECEIVED',
      JSON.stringify({
        packetId: envelope.id,
        origin: envelope.origin,
        senderId: envelope.payload.senderId,
        receivedFrom: user.userId,
        count: envelope.payload.locations.length,
        stored,
        updated,
        ignored,
        invalid,
        hopCount: envelope.hopCount,
        ttl: envelope.ttl,
      }),
    );

    if (decision.shouldRelay) {
      const relayedEnvelope = relayPacket(envelope);
      const didQueueRelay =
        enqueueRelayPacket(relayedEnvelope);

      console.log(
        'OFFLINK_FRIEND_LOCATION_PACKET_RELAY',
        JSON.stringify({
          packetId: relayedEnvelope.id,
          origin: relayedEnvelope.origin,
          ttl: relayedEnvelope.ttl,
          hopCount: relayedEnvelope.hopCount,
          queued: didQueueRelay,
          queueSize: getRelayQueueSize(),
        }),
      );
    }

    recordGattSuccess(user.userId);

    return {
      nextSightings: null,
      handled: true,
    };
  }

  if (!isMeshSightingsEnvelope(envelope)) {
    console.log('OFFLINK_MESH_PACKET_DROP', 'unknown-kind');
    recordGattFailure(user.userId);

    return {
      nextSightings: null,
      handled: false,
    };
  }

  const ackEnvelope = createMeshAckEnvelope(ownUserId, envelope.id);
  const didQueueAck = enqueueRelayPacket(ackEnvelope);

  console.log(
    'OFFLINK_MESH_ACK_CREATED',
    JSON.stringify({
      packetId: ackEnvelope.id,
      ackFor: envelope.id,
      origin: ackEnvelope.origin,
      queued: didQueueAck,
      queueSize: getRelayQueueSize(),
    }),
  );

  if (didQueueAck) {
    dispatchNextMeshPacket('ack-created').catch(error =>
      console.log(
        'OFFLINK_MESH_ACK_DISPATCH_ERROR',
        String(error),
      ),
    );
  }

  const nextSightings = mergeMeshSightings({
    currentSightings,
    incomingSightings: envelope.payload.sightings,
    ownUserId,
    seenBy: envelope.payload.senderId,
  });

  envelope.payload.sightings
    .filter(sighting => sighting.userId !== ownUserId)
    .filter(
      sighting =>
        sighting.userId !== envelope.payload.senderId,
    )
    .forEach(sighting => {
      const rssi = sighting.rssi ?? -85;
      const quality = Math.max(
        5,
        Math.min(
          100,
          Math.round(((rssi + 95) / 45) * 95 + 5),
        ),
      );

      const hops = Math.max(
        2,
        Math.min(8, (sighting.hops ?? 0) + 2),
      );

      MeshTopology.updateRemoteNode(
        sighting.userId,
        sighting.emoji || 'remote',
        quality,
        hops,
        user.meshId || user.userId,
        sighting.userId,
      );

      console.log(
        'OFFLINK_TRANSPORT_REMOTE_ROUTE_APPLIED',
        JSON.stringify({
          userId: sighting.userId,
          via: user.meshId || user.userId,
          hops,
          quality,
          sourcePacket: envelope.id,
        }),
      );
    });

  saveSightings(nextSightings);

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
  recordGattSuccess(user.userId);

  return {
    nextSightings,
    handled: true,
  };
}
