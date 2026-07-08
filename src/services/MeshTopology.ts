import {MeshNode} from '../models/MeshNode';
import {
  recordRemoteRouteApplied,
  recordRemoteRouteSkippedDirect,
  recordRemoteRouteSkippedSelf,
  recordRemoteRouteSkippedWorse,
} from './MeshDiagnosticsService';

const DIRECT_NODE_TIMEOUT_MS = 45_000;
const REMOTE_NODE_TIMEOUT_MS = 120_000;
const CLEANUP_INTERVAL_MS = 5_000;


function calculateRouteScore({
  quality,
  hops,
  connected,
  ageMs,
}: {
  quality: number;
  hops: number;
  connected: boolean;
  ageMs: number;
}): number {
  const hopPenalty = Math.max(0, hops - 1) * 18;
  const directBonus = connected ? 12 : 0;
  const agePenalty = Math.min(35, Math.floor(ageMs / 5000) * 5);

  return Math.max(
    0,
    Math.min(100, Math.round(quality + directBonus - hopPenalty - agePenalty)),
  );
}

function shouldReplaceRoute({
  existing,
  nextScore,
  nextHops,
  nextConnected,
}: {
  existing: MeshNode | undefined;
  nextScore: number;
  nextHops: number;
  nextConnected: boolean;
}): boolean {
  if (!existing) {
    return true;
  }

  if (nextConnected && !existing.connected) {
    return true;
  }

  if (!nextConnected && existing.connected && Date.now() - existing.lastSeen < 15000) {
    return false;
  }

  const existingScore = existing.routeScore ?? existing.quality;

  if (nextScore >= existingScore + 8) {
    return true;
  }

  if (nextHops < existing.hops && nextScore >= existingScore - 10) {
    return true;
  }

  return false;
}

function calculateQuality(rssi: number): number {
  if (rssi >= -50) {
    return 100;
  }

  if (rssi <= -95) {
    return 5;
  }

  return Math.round(((rssi + 95) / 45) * 95 + 5);
}

class MeshTopologyStore {
  private nodes = new Map<string, MeshNode>();
  private listeners = new Set<() => void>();
  private selfMeshId: string | null = null;

  setSelfMeshId(meshId: string | null) {
    this.selfMeshId = meshId;
    this.removeSelfRoutes();
  }

  updateNode(
    id: string,
    name: string,
    rssi: number,
    hops = 1,
    via: string | null = null,
    userId?: string,
  ) {
    if (this.isSelfRoute(id, via)) {
      recordRemoteRouteSkippedSelf();
      recordRemoteRouteSkippedDirect();
      return;
    }

    const now = Date.now();
    const existing = this.nodes.get(id);

    const quality = calculateQuality(rssi);
    const routeScore = calculateRouteScore({
      quality,
      hops,
      connected: true,
      ageMs: 0,
    });

    this.nodes.set(id, {
      ...(existing ?? {}),
      id,
      userId: userId ?? existing?.userId,
      name,
      rssi,
      quality,
      routeScore,
      routeReason: 'direct BLE route',
      firstSeen: existing?.firstSeen ?? now,
      lastSeen: now,
      lastUpdated: now,
      hops,
      via,
      discoveredVia: via ? `via ${via}` : 'direct',
      connected: true,
    });

    this.notify();
  }

  updateRemoteNode(
    id: string,
    name: string,
    quality: number,
    hops: number,
    via: string,
    userId?: string,
  ) {
    if (this.isSelfRoute(id, via)) {
      recordRemoteRouteSkippedSelf();
      return;
    }

    const matchingDirectNode = [...this.nodes.values()].find(node => {
      if (!node.connected) {
        return false;
      }

      return (
        node.id === id ||
        node.userId === id ||
        (userId ? node.id === userId || node.userId === userId : false)
      );
    });

    if (matchingDirectNode) {
      console.log(
        'OFFLINK_TOPOLOGY_REFLECTION_DROPPED',
        JSON.stringify({
          remoteId: id,
          remoteUserId: userId,
          directId: matchingDirectNode.id,
          directUserId: matchingDirectNode.userId,
          via,
        }),
      );
      return;
    }

    const now = Date.now();
    const existing = this.nodes.get(id);
    const safeQuality = Math.max(0, Math.min(100, Math.round(quality)));
    const estimatedRssi = Math.round(-95 + (safeQuality / 100) * 45);

    const routeScore = calculateRouteScore({
      quality: safeQuality,
      hops,
      connected: false,
      ageMs: existing ? now - existing.lastSeen : 0,
    });

    if (
      !shouldReplaceRoute({
        existing,
        nextScore: routeScore,
        nextHops: hops,
        nextConnected: false,
      })
    ) {
      recordRemoteRouteSkippedWorse();
      return;
    }

    recordRemoteRouteApplied();

    this.nodes.set(id, {
      ...(existing ?? {}),
      id,
      userId: userId ?? existing?.userId,
      name,
      rssi: existing?.rssi ?? estimatedRssi,
      quality: safeQuality,
      routeScore,
      routeReason: `remote route via ${via}`,
      firstSeen: existing?.firstSeen ?? now,
      lastSeen: now,
      lastUpdated: now,
      hops,
      via,
      discoveredVia: `via ${via}`,
      connected: false,
    });

    this.notify();
  }

  removeExpiredNodes() {
    const now = Date.now();
    for (const [id, node] of this.nodes) {
      const ageMs = now - node.lastSeen;
      const timeoutMs = node.connected ? DIRECT_NODE_TIMEOUT_MS : REMOTE_NODE_TIMEOUT_MS;

      if (ageMs > timeoutMs) {
        this.nodes.delete(id);
      }
    }

    this.notify();
  }

  getTopology(): MeshNode[] {
    const now = Date.now();

    return [...this.nodes.values()].map(node => ({
      ...node,
      routeScore: calculateRouteScore({
        quality: node.quality,
        hops: node.hops,
        connected: node.connected,
        ageMs: now - node.lastSeen,
      }),
    })).sort((a, b) => {
      const scoreDiff = (b.routeScore ?? b.quality) - (a.routeScore ?? a.quality);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return b.lastSeen - a.lastSeen;
    });
  }

  getNearestNodes(): MeshNode[] {
    return [...this.nodes.values()].sort((a, b) => b.rssi - a.rssi);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  clear() {
    this.nodes.clear();
    this.notify();
  }

  private isSelfRoute(id: string, via: string | null): boolean {
    return Boolean(
      this.selfMeshId &&
        (id === this.selfMeshId || via === this.selfMeshId),
    );
  }

  private removeSelfRoutes() {
    if (!this.selfMeshId) {
      return;
    }

    for (const [id, node] of this.nodes) {
      if (id === this.selfMeshId || node.via === this.selfMeshId) {
        this.nodes.delete(id);
      }
    }

    this.notify();
  }

  private notify() {
    setTimeout(() => {
      this.listeners.forEach(listener => listener());
    }, 0);
  }
}

const meshTopology = new MeshTopologyStore();

setInterval(() => {
  meshTopology.removeExpiredNodes();
}, CLEANUP_INTERVAL_MS);

export default meshTopology;
