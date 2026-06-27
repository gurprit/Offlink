import {
  MeshDiagnosticsLastPacket,
  MeshDiagnosticsSnapshot,
} from '../models/types';

const diagnostics: MeshDiagnosticsSnapshot = {
  packetsCreated: 0,
  packetsReceived: 0,
  packetsRelayed: 0,
  packetsDropped: 0,
  duplicatesDropped: 0,
  ttlExpired: 0,
  invalidPackets: 0,
  relayFailures: 0,
  currentQueueSize: 0,
  queuePeak: 0,
  lastRelayDelayMs: null,
  averageRelayDelayMs: null,
  lastPacket: null,
  updatedAt: Date.now(),
};

let relayDelayTotal = 0;
let relayDelayCount = 0;

function touch() {
  diagnostics.updatedAt = Date.now();
}

function setLastPacket(packet: MeshDiagnosticsLastPacket) {
  diagnostics.lastPacket = packet;
  touch();
}

export function getMeshDiagnosticsSnapshot(): MeshDiagnosticsSnapshot {
  return {
    ...diagnostics,
    lastPacket: diagnostics.lastPacket ? {...diagnostics.lastPacket} : null,
  };
}

export function resetMeshDiagnostics() {
  diagnostics.packetsCreated = 0;
  diagnostics.packetsReceived = 0;
  diagnostics.packetsRelayed = 0;
  diagnostics.packetsDropped = 0;
  diagnostics.duplicatesDropped = 0;
  diagnostics.ttlExpired = 0;
  diagnostics.invalidPackets = 0;
  diagnostics.relayFailures = 0;
  diagnostics.currentQueueSize = 0;
  diagnostics.queuePeak = 0;
  diagnostics.lastRelayDelayMs = null;
  diagnostics.averageRelayDelayMs = null;
  diagnostics.lastPacket = null;

  relayDelayTotal = 0;
  relayDelayCount = 0;

  touch();
}

export function recordMeshPacketCreated(packet: {
  id: string;
  origin: string;
  ttl: number;
  hopCount: number;
  timestamp: number;
}) {
  diagnostics.packetsCreated += 1;

  setLastPacket({
    ...packet,
    event: 'created',
  });
}

export function recordMeshPacketAccepted(packet: {
  id: string;
  origin: string;
  ttl: number;
  hopCount: number;
  timestamp: number;
}) {
  diagnostics.packetsReceived += 1;

  setLastPacket({
    ...packet,
    event: 'received',
  });
}

export function recordMeshPacketDropped(
  packet: {
    id?: string;
    origin?: string;
    ttl?: number;
    hopCount?: number;
    timestamp?: number;
  },
  reason: string,
) {
  diagnostics.packetsDropped += 1;

  if (reason === 'duplicate') {
    diagnostics.duplicatesDropped += 1;
  }

  if (reason === 'expired') {
    diagnostics.ttlExpired += 1;
  }

  if (reason === 'invalid') {
    diagnostics.invalidPackets += 1;
  }

  setLastPacket({
    id: packet.id || 'unknown',
    origin: packet.origin || 'unknown',
    ttl: typeof packet.ttl === 'number' ? packet.ttl : -1,
    hopCount: typeof packet.hopCount === 'number' ? packet.hopCount : -1,
    timestamp: packet.timestamp || Date.now(),
    event: 'dropped',
    reason,
  });
}

export function recordMeshPacketRelayed(packet: {
  id: string;
  origin: string;
  ttl: number;
  hopCount: number;
  timestamp: number;
}) {
  diagnostics.packetsRelayed += 1;

  setLastPacket({
    ...packet,
    event: 'relayed',
  });
}

export function recordMeshRelayFailure() {
  diagnostics.relayFailures += 1;
  touch();
}

export function recordMeshQueueSize(size: number) {
  diagnostics.currentQueueSize = size;
  diagnostics.queuePeak = Math.max(diagnostics.queuePeak, size);
  touch();
}

export function recordMeshRelayDelay(delayMs: number) {
  diagnostics.lastRelayDelayMs = delayMs;
  relayDelayTotal += delayMs;
  relayDelayCount += 1;
  diagnostics.averageRelayDelayMs = Math.round(relayDelayTotal / relayDelayCount);
  touch();
}
