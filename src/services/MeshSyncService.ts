import {OfflinkSighting} from '../models/types';
import {MeshPacket, createMeshPacket} from './MeshEngine';

export type OfflinkMeshPayload = {
  v: 1;
  senderId: string;
  createdAt: number;
  sightings: OfflinkSighting[];
};

export type OfflinkMeshEnvelope = MeshPacket<OfflinkMeshPayload>;

export function createMeshPayload(
  senderId: string,
  sightings: OfflinkSighting[],
): string {
  const freshSightings = sightings
    .filter(sighting => sighting.userId !== senderId)
    .filter(sighting => typeof sighting.latitude === 'number')
    .filter(sighting => typeof sighting.longitude === 'number')
    .filter(sighting => Date.now() - sighting.lastSeenAt < 1000 * 60 * 60)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, 25);

  const payload: OfflinkMeshPayload = {
    v: 1,
    senderId,
    createdAt: Date.now(),
    sightings: freshSightings,
  };

  return JSON.stringify(createMeshPacket(senderId, payload));
}

export function parseMeshPayload(input: string): OfflinkMeshEnvelope | null {
  try {
    const parsed = JSON.parse(input) as OfflinkMeshEnvelope | OfflinkMeshPayload;

    // New Phase 4.2 packet format.
    if (
      'id' in parsed &&
      'origin' in parsed &&
      'ttl' in parsed &&
      'payload' in parsed &&
      parsed.payload?.v === 1 &&
      parsed.payload?.senderId &&
      Array.isArray(parsed.payload?.sightings)
    ) {
      return parsed;
    }

    // Backwards compatibility for older pre-packet GATT payloads.
    if (
      'v' in parsed &&
      parsed.v === 1 &&
      parsed.senderId &&
      Array.isArray(parsed.sightings)
    ) {
      return createMeshPacket(parsed.senderId, parsed);
    }

    return null;
  } catch {
    return null;
  }
}

export function stringifyMeshEnvelope(
  envelope: OfflinkMeshEnvelope,
): string {
  return JSON.stringify(envelope);
}

export function mergeMeshSightings({
  currentSightings,
  incomingSightings,
  ownUserId,
  seenBy,
}: {
  currentSightings: OfflinkSighting[];
  incomingSightings: OfflinkSighting[];
  ownUserId: string | null;
  seenBy: string;
}): OfflinkSighting[] {
  const map = new Map<string, OfflinkSighting>();

  currentSightings.forEach(sighting => {
    map.set(sighting.userId, sighting);
  });

  incomingSightings
    .filter(sighting => sighting.userId !== ownUserId)
    .filter(sighting => typeof sighting.latitude === 'number')
    .filter(sighting => typeof sighting.longitude === 'number')
    .filter(sighting => Date.now() - sighting.lastSeenAt < 1000 * 60 * 60)
    .forEach(sighting => {
      const existing = map.get(sighting.userId);
      const next: OfflinkSighting = {
        ...sighting,
        source: sighting.source === 'direct' ? 'mesh' : sighting.source,
        hops: Math.min((sighting.hops ?? 0) + 1, 10),
        seenBy,
        updatedAt: Date.now(),
      };

      if (!existing || next.lastSeenAt >= existing.lastSeenAt) {
        map.set(next.userId, next);
      }
    });

  return Array.from(map.values())
    .filter(sighting => Date.now() - sighting.lastSeenAt < 1000 * 60 * 60)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}
