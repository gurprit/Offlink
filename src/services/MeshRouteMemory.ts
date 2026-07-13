export type MeshRouteMemoryStats = {
  destinationId: string;
  via: string;
  observations: number;
  selections: number;
  averageQuality: number;
  lastQuality: number;
  firstObservedAt: number;
  lastObservedAt: number;
  lastSelectedAt: number | null;
  confidenceScore: number;
};

const routeMemory = new Map<string, MeshRouteMemoryStats>();

function makeRouteMemoryKey(
  destinationId: string,
  via: string,
): string {
  return `${destinationId}::${via}`;
}

function calculateConfidenceScore(
  stats: Pick<
    MeshRouteMemoryStats,
    'observations' | 'selections' | 'averageQuality'
  >,
): number {
  /*
   * Stage 1 confidence is deliberately conservative.
   *
   * Quality contributes most of the score, while repeated observations
   * and genuine route selections gradually increase confidence.
   */
  const observationConfidence = Math.min(
    20,
    Math.round(Math.log2(stats.observations + 1) * 4),
  );

  const selectionConfidence = Math.min(
    20,
    stats.selections * 4,
  );

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        stats.averageQuality * 0.6 +
          observationConfidence +
          selectionConfidence,
      ),
    ),
  );
}

export function recordRouteObservation({
  destinationId,
  via,
  quality,
}: {
  destinationId: string;
  via: string;
  quality: number;
}): MeshRouteMemoryStats {
  const now = Date.now();
  const safeQuality = Math.max(
    0,
    Math.min(100, Math.round(quality)),
  );

  const key = makeRouteMemoryKey(destinationId, via);
  const existing = routeMemory.get(key);

  const observations = (existing?.observations ?? 0) + 1;
  const averageQuality = existing
    ? Math.round(
        (
          existing.averageQuality *
            existing.observations +
          safeQuality
        ) / observations,
      )
    : safeQuality;

  const next: MeshRouteMemoryStats = {
    destinationId,
    via,
    observations,
    selections: existing?.selections ?? 0,
    averageQuality,
    lastQuality: safeQuality,
    firstObservedAt: existing?.firstObservedAt ?? now,
    lastObservedAt: now,
    lastSelectedAt: existing?.lastSelectedAt ?? null,
    confidenceScore: 0,
  };

  next.confidenceScore = calculateConfidenceScore(next);
  routeMemory.set(key, next);

  return {...next};
}

export function recordRouteSelected({
  destinationId,
  via,
}: {
  destinationId: string;
  via: string;
}): MeshRouteMemoryStats {
  const now = Date.now();
  const key = makeRouteMemoryKey(destinationId, via);
  const existing = routeMemory.get(key);

  const next: MeshRouteMemoryStats = existing
    ? {
        ...existing,
        selections: existing.selections + 1,
        lastSelectedAt: now,
      }
    : {
        destinationId,
        via,
        observations: 0,
        selections: 1,
        averageQuality: 0,
        lastQuality: 0,
        firstObservedAt: now,
        lastObservedAt: now,
        lastSelectedAt: now,
        confidenceScore: 0,
      };

  next.confidenceScore = calculateConfidenceScore(next);
  routeMemory.set(key, next);

  console.log(
    'OFFLINK_ROUTE_MEMORY_SELECTED',
    JSON.stringify(next),
  );

  return {...next};
}

export function getRouteMemory(
  destinationId: string,
  via: string,
): MeshRouteMemoryStats | null {
  const stats = routeMemory.get(
    makeRouteMemoryKey(destinationId, via),
  );

  return stats ? {...stats} : null;
}

export function getAllRouteMemory(): MeshRouteMemoryStats[] {
  return [...routeMemory.values()]
    .map(stats => ({...stats}))
    .sort((a, b) => {
      if (b.confidenceScore !== a.confidenceScore) {
        return b.confidenceScore - a.confidenceScore;
      }

      if (b.selections !== a.selections) {
        return b.selections - a.selections;
      }

      return b.lastObservedAt - a.lastObservedAt;
    });
}

export function resetRouteMemory(): void {
  routeMemory.clear();
}
