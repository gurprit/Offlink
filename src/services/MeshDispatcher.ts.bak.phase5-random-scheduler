import {setGattPayload} from './GattService';
import {getNextRelayPacket, getRelayQueueSize} from './MeshRelayQueue';
import {stringifyMeshEnvelope} from './MeshSyncService';

let lastDispatchAt = 0;
const MIN_DISPATCH_INTERVAL_MS = 3000;

export async function dispatchNextMeshPacket(
  reason: string,
): Promise<boolean> {
  const now = Date.now();

  if (now - lastDispatchAt < MIN_DISPATCH_INTERVAL_MS) {
    return false;
  }

  const nextPacket = getNextRelayPacket();

  if (!nextPacket) {
    return false;
  }

  lastDispatchAt = now;

  console.log(
    'OFFLINK_MESH_DISPATCH',
    JSON.stringify({
      reason,
      packetId: nextPacket.id,
      origin: nextPacket.origin,
      ttl: nextPacket.ttl,
      remaining: getRelayQueueSize(),
    }),
  );

  await setGattPayload(stringifyMeshEnvelope(nextPacket));

  return true;
}
