import {
  MeshDiagnosticsLastPacket,
  MeshDiagnosticsSnapshot,
} from '../models/types';
import {recordMeshFlightEvent} from './MeshFlightRecorder';

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
  remoteRoutesApplied: 0,
  remoteRoutesSkippedSelf: 0,
  remoteRoutesSkippedDirect: 0,
  remoteRoutesSkippedWorse: 0,
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

  recordMeshFlightEvent({
    type: 'packet_created',
    message: 'Mesh packet created',
    data: {
      packetId: packet.id,
      origin: packet.origin,
      ttl: packet.ttl,
      hopCount: packet.hopCount,
    },
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

  recordMeshFlightEvent({
    type: 'packet_received',
    message: 'Mesh packet accepted',
    level: 'success',
    data: {
      packetId: packet.id,
      origin: packet.origin,
      ttl: packet.ttl,
      hopCount: packet.hopCount,
    },
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

  recordMeshFlightEvent({
    type: 'packet_dropped',
    message: `Mesh packet dropped: ${reason}`,
    level:
      reason === 'duplicate' || reason === 'own-origin'
        ? 'warning'
        : 'error',
    data: {
      packetId: packet.id || 'unknown',
      origin: packet.origin || 'unknown',
      ttl:
        typeof packet.ttl === 'number'
          ? packet.ttl
          : -1,
      hopCount:
        typeof packet.hopCount === 'number'
          ? packet.hopCount
          : -1,
      reason,
    },
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

  recordMeshFlightEvent({
    type: 'packet_relayed',
    message: 'Mesh packet relayed',
    level: 'success',
    data: {
      packetId: packet.id,
      origin: packet.origin,
      ttl: packet.ttl,
      hopCount: packet.hopCount,
    },
  });
}

export function recordMeshRelayFailure() {
  diagnostics.relayFailures += 1;
  touch();

  recordMeshFlightEvent({
    type: 'packet_dropped',
    message: 'Mesh relay dispatch failed',
    level: 'error',
    data: {
      relayFailures: diagnostics.relayFailures,
    },
  });
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


export function recordRemoteRouteApplied() {
  diagnostics.remoteRoutesApplied = (diagnostics.remoteRoutesApplied ?? 0) + 1;
  touch();
}

export function recordRemoteRouteSkippedSelf() {
  diagnostics.remoteRoutesSkippedSelf = (diagnostics.remoteRoutesSkippedSelf ?? 0) + 1;
  touch();
}

export function recordRemoteRouteSkippedDirect() {
  diagnostics.remoteRoutesSkippedDirect = (diagnostics.remoteRoutesSkippedDirect ?? 0) + 1;
  touch();
}

export function recordRemoteRouteSkippedWorse() {
  diagnostics.remoteRoutesSkippedWorse = (diagnostics.remoteRoutesSkippedWorse ?? 0) + 1;
  touch();
}
