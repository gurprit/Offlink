export type OfflinkProfile = {
  userId: string;
  meshId: string;
  emoji: string;
};

export type OfflinkFriend = {
  userId: string;
  emoji: string;
  addedAt: number;
};

export type NearbyOfflinkUser = {
  userId: string;
  meshId: string;
  emoji: string;
  lastSeenAt: number;
  deviceId?: string;
  rssi?: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
};

export type OfflinkSighting = {
  userId: string;
  emoji: string;
  lastSeenAt: number;
  updatedAt: number;
  seenBy: string;
  source: 'direct' | 'mesh';
  rssi?: number;
  hops?: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
};

export type MeshDiagnosticsLastPacket = {
  id: string;
  origin: string;
  ttl: number;
  hopCount: number;
  timestamp: number;
  event: 'created' | 'received' | 'relayed' | 'dropped';
  reason?: string;
};

export type MeshDiagnosticsSnapshot = {
  packetsCreated: number;
  packetsReceived: number;
  packetsRelayed: number;
  packetsDropped: number;
  duplicatesDropped: number;
  ttlExpired: number;
  invalidPackets: number;
  relayFailures: number;
  currentQueueSize: number;
  queuePeak: number;
  lastRelayDelayMs: number | null;
  averageRelayDelayMs: number | null;
  lastPacket: MeshDiagnosticsLastPacket | null;
  updatedAt: number;
};
