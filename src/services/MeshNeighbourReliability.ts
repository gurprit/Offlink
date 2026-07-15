import {recordMeshFlightEvent} from './MeshFlightRecorder';

export type MeshNeighbourReliabilityStats = {
  nodeId: string;
  gattSuccesses: number;
  gattFailures: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  score: number;
};

const statsByNode = new Map<string, MeshNeighbourReliabilityStats>();

function getOrCreate(nodeId: string): MeshNeighbourReliabilityStats {
  const existing = statsByNode.get(nodeId);

  if (existing) {
    return existing;
  }

  const created: MeshNeighbourReliabilityStats = {
    nodeId,
    gattSuccesses: 0,
    gattFailures: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    score: 50,
  };

  statsByNode.set(nodeId, created);
  return created;
}

function calculateScore(stats: MeshNeighbourReliabilityStats): number {
  const total = stats.gattSuccesses + stats.gattFailures;

  if (total === 0) {
    return 50;
  }

  const successRate = stats.gattSuccesses / total;
  const failurePenalty = Math.min(40, stats.gattFailures * 5);

  return Math.max(0, Math.min(100, Math.round(successRate * 100 - failurePenalty)));
}

export function recordGattSuccess(nodeId: string) {
  const stats = getOrCreate(nodeId);

  stats.gattSuccesses += 1;
  stats.lastSuccessAt = Date.now();
  stats.score = calculateScore(stats);

  recordMeshFlightEvent({
    type: 'gatt_success',
    message: 'GATT sync succeeded',
    level: 'success',
    data: {
      nodeId,
      score: stats.score,
      successes: stats.gattSuccesses,
      failures: stats.gattFailures,
    },
  });
}

export function recordGattFailure(nodeId: string) {
  const stats = getOrCreate(nodeId);

  stats.gattFailures += 1;
  stats.lastFailureAt = Date.now();
  stats.score = calculateScore(stats);

  recordMeshFlightEvent({
    type: 'gatt_failure',
    message: 'GATT sync failed',
    level: 'warning',
    data: {
      nodeId,
      score: stats.score,
      successes: stats.gattSuccesses,
      failures: stats.gattFailures,
    },
  });
}

export function getNeighbourReliability(nodeId: string): MeshNeighbourReliabilityStats {
  return {...getOrCreate(nodeId)};
}

export function getAllNeighbourReliability(): MeshNeighbourReliabilityStats[] {
  return [...statsByNode.values()]
    .map(stats => ({...stats}))
    .sort((a, b) => b.score - a.score);
}

export function resetNeighbourReliability() {
  statsByNode.clear();
}
