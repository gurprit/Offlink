import {NearbyOfflinkUser, OfflinkSighting} from '../models/types';
import {readGattPayloadFromDevice} from './GattService';
import {
  mergeMeshSightings,
  parseMeshPayload,
} from './MeshSyncService';
import {evaluateMeshPacket, relayPacket} from './MeshEngine';
import {enqueueRelayPacket, getRelayQueueSize} from './MeshRelayQueue';
import {recordGattFailure, recordGattSuccess} from './MeshNeighbourReliability';
import {applyTopologyPayload, publishLocalTopology} from './MeshTopologyExchangeService';

export type ProcessIncomingMeshPacketArgs = {
  user: NearbyOfflinkUser;
  ownUserId: string | null;
  ownMeshId: string | null;
  currentSightings: OfflinkSighting[];
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

  const rawPayload = await readGattPayloadFromDevice(user.deviceId);

  console.log(
    'OFFLINK_GATT_SYNC_PAYLOAD',
    JSON.stringify({
      userId: user.userId,
      length: rawPayload.length,
      startsWith: rawPayload.slice(0, 24),
    }),
  );

  if (applyTopologyPayload(rawPayload, ownMeshId, ownUserId, user.userId)) {
    console.log('OFFLINK_TOPOLOGY_SYNC_APPLIED', user.userId);

    if (ownMeshId) {
      publishLocalTopology(ownMeshId, true).catch(error =>
        console.log('OFFLINK_TOPOLOGY_REPUBLISH_ERROR', String(error)),
      );
    }

    recordGattSuccess(user.userId);

    return {
      nextSightings: null,
      handled: true,
    };
  }

  const envelope = parseMeshPayload(rawPayload);

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
      sightings: envelope.payload.sightings.length,
    }),
  );

  if (!decision.accepted) {
    recordGattSuccess(user.userId);

    return {
      nextSightings: null,
      handled: true,
    };
  }

  const nextSightings = mergeMeshSightings({
    currentSightings,
    incomingSightings: envelope.payload.sightings,
    ownUserId,
    seenBy: envelope.payload.senderId,
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
