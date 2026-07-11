import {setGattTransportPayload} from './GattService';
import {getNextRelayPacket, getRelayQueueSize} from './MeshRelayQueue';
import {stringifyMeshEnvelope} from './MeshSyncService';
import {
  recordMeshPacketRelayed,
  recordMeshRelayDelay,
  recordMeshRelayFailure,
} from './MeshDiagnosticsService';

const MIN_RELAY_DELAY_MS = 100;
const MAX_RELAY_DELAY_MS = 500;
const MIN_DISPATCH_INTERVAL_MS = 750;

let lastDispatchAt = 0;
let dispatchInFlight = false;
let scheduledDispatch: ReturnType<typeof setTimeout> | null = null;

function getRandomRelayDelay(): number {
  return (
    MIN_RELAY_DELAY_MS +
    Math.floor(Math.random() * (MAX_RELAY_DELAY_MS - MIN_RELAY_DELAY_MS + 1))
  );
}

async function runScheduledDispatch(reason: string): Promise<boolean> {
  if (dispatchInFlight) {
    return false;
  }

  const now = Date.now();
  const waitForInterval = Math.max(
    0,
    MIN_DISPATCH_INTERVAL_MS - (now - lastDispatchAt),
  );

  if (waitForInterval > 0) {
    await new Promise(resolve => setTimeout(resolve, waitForInterval));
  }

  const nextPacket = getNextRelayPacket();

  if (!nextPacket) {
    return false;
  }

  dispatchInFlight = true;

  try {
    lastDispatchAt = Date.now();

    console.log(
      'OFFLINK_MESH_DISPATCH',
      JSON.stringify({
        reason,
        packetId: nextPacket.id,
        origin: nextPacket.origin,
        ttl: nextPacket.ttl,
        hopCount: nextPacket.hopCount,
        remaining: getRelayQueueSize(),
      }),
    );

    await setGattTransportPayload(
      stringifyMeshEnvelope(nextPacket),
    );
    recordMeshPacketRelayed(nextPacket);
    return true;
  } finally {
    dispatchInFlight = false;
  }
}

export async function dispatchNextMeshPacket(
  reason: string,
): Promise<boolean> {
  if (scheduledDispatch || dispatchInFlight) {
    return false;
  }

  const relayDelay = getRandomRelayDelay();
  recordMeshRelayDelay(relayDelay);

  console.log(
    'OFFLINK_MESH_DISPATCH_SCHEDULED',
    JSON.stringify({
      reason,
      delayMs: relayDelay,
      queueSize: getRelayQueueSize(),
    }),
  );

  return new Promise(resolve => {
    scheduledDispatch = setTimeout(() => {
      scheduledDispatch = null;

      runScheduledDispatch(reason)
        .then(resolve)
        .catch(error => {
          recordMeshRelayFailure();
          console.log('OFFLINK_MESH_DISPATCH_RUN_ERROR', String(error));
          resolve(false);
        });
    }, relayDelay);
  });
}
