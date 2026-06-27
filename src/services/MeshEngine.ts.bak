import 'react-native-get-random-values';

const DEFAULT_TTL = 5;
const MAX_CACHE = 500;
const SEEN_PACKET_TTL_MS = 1000 * 60 * 10;

const seenPackets = new Map<string, number>();

export type MeshPacket<T> = {
  id: string;
  origin: string;
  ttl: number;
  timestamp: number;
  payload: T;
};

export type MeshPacketDecision = {
  accepted: boolean;
  shouldRelay: boolean;
  reason: 'accepted' | 'duplicate' | 'own-origin' | 'expired' | 'invalid';
};

function generatePacketId(): string {
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  ).toUpperCase();
}

function pruneSeenPackets() {
  const now = Date.now();

  for (const [packetId, seenAt] of seenPackets.entries()) {
    if (now - seenAt > SEEN_PACKET_TTL_MS) {
      seenPackets.delete(packetId);
    }
  }

  while (seenPackets.size > MAX_CACHE) {
    const first = seenPackets.keys().next().value;

    if (!first) {
      break;
    }

    seenPackets.delete(first);
  }
}

export function createMeshPacket<T>(
  origin: string,
  payload: T,
): MeshPacket<T> {
  return {
    id: generatePacketId(),
    origin,
    ttl: DEFAULT_TTL,
    timestamp: Date.now(),
    payload,
  };
}

export function evaluateMeshPacket<T>(
  packet: MeshPacket<T>,
  ownUserId?: string | null,
): MeshPacketDecision {
  pruneSeenPackets();

  if (!packet.id || !packet.origin || typeof packet.ttl !== 'number') {
    return {
      accepted: false,
      shouldRelay: false,
      reason: 'invalid',
    };
  }

  if (seenPackets.has(packet.id)) {
    return {
      accepted: false,
      shouldRelay: false,
      reason: 'duplicate',
    };
  }

  seenPackets.set(packet.id, Date.now());

  if (packet.origin && ownUserId && packet.origin === ownUserId) {
    return {
      accepted: false,
      shouldRelay: false,
      reason: 'own-origin',
    };
  }

  if (packet.ttl <= 0) {
    return {
      accepted: false,
      shouldRelay: false,
      reason: 'expired',
    };
  }

  return {
    accepted: true,
    shouldRelay: packet.ttl > 1,
    reason: 'accepted',
  };
}

export function shouldAcceptPacket<T>(
  packet: MeshPacket<T>,
  ownUserId?: string | null,
): boolean {
  return evaluateMeshPacket(packet, ownUserId).accepted;
}

export function shouldRelayPacket<T>(packet: MeshPacket<T>): boolean {
  return packet.ttl > 1;
}

export function relayPacket<T>(
  packet: MeshPacket<T>,
): MeshPacket<T> {
  return {
    ...packet,
    ttl: packet.ttl - 1,
  };
}
