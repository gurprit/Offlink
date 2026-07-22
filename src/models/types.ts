export type OfflinkProfile = {
  userId: string;
  meshId: string;
  emoji: string;
  displayName?: string;
};

export type OfflinkFriend = {
  userId: string;
  emoji: string;
  displayName?: string;
  addedAt: number;
};

export type NearbyOfflinkUser = {
  userId: string;
  meshId: string;
  emoji: string;
  displayName?: string;
  lastSeenAt: number;
  deviceId?: string;
  rssi?: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
};

export type FriendLocationRecord = {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  sequence: number;
  sourceNodeId: string;
  hops: number;
};

export type OfflinkSighting = {
  userId: string;
  emoji: string;
  displayName?: string;
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
  remoteRoutesApplied: number;
  remoteRoutesSkippedSelf: number;
  remoteRoutesSkippedDirect: number;
  remoteRoutesSkippedWorse: number;
  updatedAt: number;
};
