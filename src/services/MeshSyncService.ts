import {OfflinkSighting} from '../models/types';
import {MeshPacket, createMeshPacket} from './MeshEngine';

export type OfflinkMeshSightingsPayload = {
  v: 1;
  kind?: 'sightings';
  senderId: string;
  createdAt: number;
  sightings: OfflinkSighting[];
};

export type OfflinkMeshAckPayload = {
  v: 1;
  kind: 'ack';
  senderId: string;
  createdAt: number;
  ackFor: string;
};

export type OfflinkMeshPayload =
  | OfflinkMeshSightingsPayload
  | OfflinkMeshAckPayload;

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

  const payload: OfflinkMeshSightingsPayload = {
    v: 1,
    kind: 'sightings',
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
      parsed.payload?.senderId
    ) {
      if (
        parsed.payload.kind === 'ack' &&
        typeof parsed.payload.ackFor === 'string'
      ) {
        return parsed;
      }

      if (
        (!parsed.payload.kind || parsed.payload.kind === 'sightings') &&
        Array.isArray(parsed.payload.sightings)
      ) {
        return parsed;
      }
    }

    // Backwards compatibility for older pre-packet GATT payloads.
    if (
      'v' in parsed &&
      parsed.v === 1 &&
      'senderId' in parsed &&
      typeof parsed.senderId === 'string' &&
      'sightings' in parsed &&
      Array.isArray(parsed.sightings)
    ) {
      return createMeshPacket(parsed.senderId, parsed);
    }

    return null;
  } catch {
    return null;
  }
}


export function createMeshAckEnvelope(
  senderId: string,
  ackFor: string,
): OfflinkMeshEnvelope {
  return createMeshPacket(senderId, {
    v: 1,
    kind: 'ack',
    senderId,
    createdAt: Date.now(),
    ackFor,
  });
}

export function isMeshAckEnvelope(
  envelope: OfflinkMeshEnvelope,
): envelope is MeshPacket<OfflinkMeshAckPayload> {
  return envelope.payload.kind === 'ack';
}

export function isMeshSightingsEnvelope(
  envelope: OfflinkMeshEnvelope,
): envelope is MeshPacket<OfflinkMeshSightingsPayload> {
  return !envelope.payload.kind || envelope.payload.kind === 'sightings';
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
