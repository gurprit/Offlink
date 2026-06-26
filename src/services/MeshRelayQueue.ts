import {OfflinkMeshEnvelope} from './MeshSyncService';

const MAX_QUEUE_SIZE = 50;
const MAX_PACKET_AGE_MS = 1000 * 60 * 10;

const queue: OfflinkMeshEnvelope[] = [];
const queuedPacketIds = new Set<string>();

function pruneQueue() {
  const now = Date.now();

  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const packet = queue[index];

    if (
      now - packet.timestamp > MAX_PACKET_AGE_MS ||
      packet.ttl <= 0 ||
      !packet.id
    ) {
      queuedPacketIds.delete(packet.id);
      queue.splice(index, 1);
    }
  }

  while (queue.length > MAX_QUEUE_SIZE) {
    const removed = queue.shift();

    if (removed?.id) {
      queuedPacketIds.delete(removed.id);
    }
  }
}

export function enqueueRelayPacket(packet: OfflinkMeshEnvelope): boolean {
  pruneQueue();

  if (!packet.id || queuedPacketIds.has(packet.id) || packet.ttl <= 0) {
    return false;
  }

  queue.push(packet);
  queuedPacketIds.add(packet.id);

  return true;
}

export function getNextRelayPacket(): OfflinkMeshEnvelope | null {
  pruneQueue();

  const packet = queue.shift();

  if (!packet) {
    return null;
  }

  queuedPacketIds.delete(packet.id);

  return packet;
}

export function getRelayQueueSize(): number {
  pruneQueue();
  return queue.length;
}

export function clearRelayQueue() {
  queue.splice(0, queue.length);
  queuedPacketIds.clear();
}
