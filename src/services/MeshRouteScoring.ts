import {getNeighbourReliability} from './MeshNeighbourReliability';
import {getRouteMemory} from './MeshRouteMemory';

export type MeshRouteScoringInput = {
  destinationId: string;
  quality: number;
  hops: number;
  connected: boolean;
  ageMs: number;
  via: string | null;
};

export type MeshRouteScoreBreakdown = {
  totalScore: number;
  baseScore: number;
  directBonus: number;
  hopPenalty: number;
  agePenalty: number;
  memoryBonus: number;
  reliabilityBonus: number;
  observationPenalty: number;
  memoryDecayPenalty: number;
  evidenceScale: number;
  reason: string;
};

const MAX_MEMORY_BONUS = 8;
const MAX_RELIABILITY_BONUS = 7;
const MAX_TOTAL_LEARNED_BONUS =
  MAX_MEMORY_BONUS + MAX_RELIABILITY_BONUS;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function calculateMemoryDecayPenalty(
  lastObservedAt: number,
  now: number,
): number {
  const ageMs = Math.max(0, now - lastObservedAt);

  if (ageMs <= 60_000) {
    return 0;
  }

  if (ageMs <= 5 * 60_000) {
    return 2;
  }

  if (ageMs <= 30 * 60_000) {
    return 4;
  }

  return 8;
}

function calculateObservationPenalty(
  observations: number,
): number {
  if (observations <= 1) {
    return 6;
  }

  if (observations <= 3) {
    return 3;
  }

  return 0;
}

/**
 * Learned routing bonuses should grow slowly.
 *
 * A newly observed relay receives no historical advantage. Repeated
 * observations gradually unlock more of its memory and reliability
 * bonus until the route has enough evidence to be fully trusted.
 */
function calculateEvidenceScale(
  observations: number,
): number {
  if (observations <= 1) {
    return 0;
  }

  if (observations <= 3) {
    return 0.25;
  }

  if (observations <= 9) {
    return 0.5;
  }

  if (observations <= 19) {
    return 0.75;
  }

  return 1;
}

export function scoreMeshRoute(
  input: MeshRouteScoringInput,
  now = Date.now(),
): MeshRouteScoreBreakdown {
  const safeQuality = clamp(
    Math.round(input.quality),
    0,
    100,
  );

  const safeHops = Math.max(
    1,
    Math.round(input.hops),
  );

  const hopPenalty =
    Math.max(0, safeHops - 1) * 18;

  const directBonus = input.connected ? 12 : 0;

  const agePenalty = Math.min(
    35,
    Math.floor(
      Math.max(0, input.ageMs) / 5000,
    ) * 5,
  );

  const baseScore = clamp(
    Math.round(
      safeQuality +
        directBonus -
        hopPenalty -
        agePenalty,
    ),
    0,
    100,
  );

  if (input.connected || !input.via) {
    return {
      totalScore: baseScore,
      baseScore,
      directBonus,
      hopPenalty,
      agePenalty,
      memoryBonus: 0,
      reliabilityBonus: 0,
      observationPenalty: 0,
      memoryDecayPenalty: 0,
      evidenceScale: 0,
      reason:
        `direct base ${baseScore}` +
        ` (Q${safeQuality}` +
        ` +${directBonus} direct` +
        ` -${hopPenalty} hops` +
        ` -${agePenalty} age)`,
    };
  }

  const memory = getRouteMemory(
    input.destinationId,
    input.via,
  );

  const reliability =
    getNeighbourReliability(input.via);

  const observations =
    memory?.observations ?? 0;

  const evidenceScale =
    calculateEvidenceScale(observations);

  const rawMemoryBonus = memory
    ? clamp(
        Math.round(
          memory.confidenceScore *
            (MAX_MEMORY_BONUS / 100),
        ),
        0,
        MAX_MEMORY_BONUS,
      )
    : 0;

  const rawReliabilityBonus = clamp(
    Math.round(
      reliability.score *
        (MAX_RELIABILITY_BONUS / 100),
    ),
    0,
    MAX_RELIABILITY_BONUS,
  );

  const memoryBonus = clamp(
    Math.round(
      rawMemoryBonus * evidenceScale,
    ),
    0,
    MAX_MEMORY_BONUS,
  );

  const reliabilityBonus = clamp(
    Math.round(
      rawReliabilityBonus * evidenceScale,
    ),
    0,
    MAX_RELIABILITY_BONUS,
  );

  const observationPenalty = memory
    ? calculateObservationPenalty(
        memory.observations,
      )
    : 6;

  const memoryDecayPenalty = memory
    ? calculateMemoryDecayPenalty(
        memory.lastObservedAt,
        now,
      )
    : 0;

  const learnedBonus = clamp(
    memoryBonus + reliabilityBonus,
    0,
    MAX_TOTAL_LEARNED_BONUS,
  );

  const totalScore = clamp(
    Math.round(
      baseScore +
        learnedBonus -
        observationPenalty -
        memoryDecayPenalty,
    ),
    0,
    100,
  );

  return {
    totalScore,
    baseScore,
    directBonus,
    hopPenalty,
    agePenalty,
    memoryBonus,
    reliabilityBonus,
    observationPenalty,
    memoryDecayPenalty,
    evidenceScale,
    reason:
      `remote base ${baseScore}` +
      ` +${memoryBonus} memory` +
      ` +${reliabilityBonus} reliability` +
      ` -${observationPenalty} observations` +
      ` -${memoryDecayPenalty} memory age` +
      ` (${Math.round(evidenceScale * 100)}% evidence)`,
  };
}
