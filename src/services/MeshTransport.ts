export type MeshPayloadType = 'presence' | 'friend_location' | 'debug';

export interface MeshPacket {
  id: string;
  senderId: string;
  createdAt: number;
  hopCount: number;
  ttl: number;
  type: MeshPayloadType;
  payload: unknown;
}

const DEFAULT_TTL = 8;
const MAX_SEEN_PACKETS = 500;

const seenPacketIds: string[] = [];

function makePacketId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createMeshPacket(
  senderId: string,
  type: MeshPayloadType,
  payload: unknown,
  ttl = DEFAULT_TTL,
): MeshPacket {
  return {
    id: makePacketId(),
    senderId,
    createdAt: Date.now(),
    hopCount: 0,
    ttl,
    type,
    payload,
  };
}

export function encodeMeshPacket(packet: MeshPacket): string {
  return JSON.stringify(packet);
}

export function decodeMeshPacket(value: string): MeshPacket | null {
  try {
    const parsed = JSON.parse(value);

    if (
      !parsed ||
      typeof parsed.id !== 'string' ||
      typeof parsed.senderId !== 'string' ||
      typeof parsed.createdAt !== 'number' ||
      typeof parsed.hopCount !== 'number' ||
      typeof parsed.ttl !== 'number' ||
      typeof parsed.type !== 'string'
    ) {
      return null;
    }

    return parsed as MeshPacket;
  } catch {
    return null;
  }
}

export function hasSeenPacket(packetId: string): boolean {
  return seenPacketIds.includes(packetId);
}

export function markPacketSeen(packetId: string): void {
  if (seenPacketIds.includes(packetId)) {
    return;
  }

  seenPacketIds.push(packetId);

  if (seenPacketIds.length > MAX_SEEN_PACKETS) {
    seenPacketIds.shift();
  }
}

export function preparePacketForRelay(packet: MeshPacket): MeshPacket | null {
  if (packet.ttl <= 1) {
    return null;
  }

  return {
    ...packet,
    hopCount: packet.hopCount + 1,
    ttl: packet.ttl - 1,
  };
}

export function acceptIncomingPacket(packet: MeshPacket): boolean {
  if (hasSeenPacket(packet.id)) {
    return false;
  }

  markPacketSeen(packet.id);
  return true;
}
