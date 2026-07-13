import {FriendLocationRecord} from '../models/types';
import {OfflinkLocation} from './LocationService';

const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60;
const MAX_HOPS = 10;

let lastOwnLocationSequence = 0;

type FriendLocationListener = (
  locations: FriendLocationRecord[],
) => void;

export type FriendLocationApplyResult =
  | 'stored'
  | 'updated'
  | 'ignored-older'
  | 'ignored-duplicate'
  | 'invalid';

const locationsByUserId = new Map<string, FriendLocationRecord>();
const listeners = new Set<FriendLocationListener>();

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normaliseRecord(
  record: FriendLocationRecord,
): FriendLocationRecord | null {
  if (
    !record ||
    typeof record.userId !== 'string' ||
    record.userId.trim().length === 0 ||
    !isFiniteCoordinate(record.latitude) ||
    !isFiniteCoordinate(record.longitude) ||
    record.latitude < -90 ||
    record.latitude > 90 ||
    record.longitude < -180 ||
    record.longitude > 180 ||
    typeof record.timestamp !== 'number' ||
    !Number.isFinite(record.timestamp) ||
    typeof record.sequence !== 'number' ||
    !Number.isFinite(record.sequence) ||
    typeof record.sourceNodeId !== 'string' ||
    record.sourceNodeId.trim().length === 0
  ) {
    return null;
  }

  return {
    ...record,
    userId: record.userId.trim().toUpperCase(),
    sourceNodeId: record.sourceNodeId.trim(),
    sequence: Math.max(0, Math.floor(record.sequence)),
    accuracy:
      typeof record.accuracy === 'number' &&
      Number.isFinite(record.accuracy)
        ? Math.max(0, record.accuracy)
        : undefined,
    hops: Math.min(
      Math.max(0, Math.floor(record.hops ?? 0)),
      MAX_HOPS,
    ),
  };
}

function sortLocations(
  locations: FriendLocationRecord[],
): FriendLocationRecord[] {
  return locations.sort((a, b) => {
    if (b.timestamp !== a.timestamp) {
      return b.timestamp - a.timestamp;
    }

    return b.sequence - a.sequence;
  });
}

function emitChange(): void {
  const snapshot = getFriendLocations();

  listeners.forEach(listener => {
    listener(snapshot);
  });
}

export function updateOwnLocation({
  userId,
  meshId,
  location,
  timestamp = Date.now(),
}: {
  userId: string;
  meshId: string;
  location: OfflinkLocation;
  timestamp?: number;
}): FriendLocationRecord | null {
  const sequence = Math.max(
    Math.floor(timestamp),
    lastOwnLocationSequence + 1,
  );

  lastOwnLocationSequence = sequence;

  const record: FriendLocationRecord = {
    userId,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    timestamp,
    sequence,
    sourceNodeId: meshId,
    hops: 0,
  };

  const result = applyFriendLocation(record);

  if (
    result === 'invalid' ||
    result === 'ignored-older'
  ) {
    console.log(
      'OFFLINK_OWN_LOCATION_REJECTED',
      JSON.stringify({
        result,
        userId,
        meshId,
        sequence,
        timestamp,
      }),
    );

    return null;
  }

  console.log(
    'OFFLINK_OWN_LOCATION_UPDATED',
    JSON.stringify({
      userId: record.userId,
      meshId: record.sourceNodeId,
      sequence: record.sequence,
      timestamp: record.timestamp,
      accuracy: record.accuracy,
    }),
  );

  return record;
}

export function applyFriendLocation(
  record: FriendLocationRecord,
): FriendLocationApplyResult {
  const next = normaliseRecord(record);

  if (!next) {
    console.log(
      'OFFLINK_FRIEND_LOCATION_REJECTED',
      JSON.stringify({
        reason: 'invalid',
        userId: record?.userId,
      }),
    );

    return 'invalid';
  }

  const existing = locationsByUserId.get(next.userId);

  if (existing) {
    if (next.sequence < existing.sequence) {
      return 'ignored-older';
    }

    if (
      next.sequence === existing.sequence &&
      next.timestamp < existing.timestamp
    ) {
      return 'ignored-older';
    }

    if (
      next.sequence === existing.sequence &&
      next.timestamp === existing.timestamp
    ) {
      return 'ignored-duplicate';
    }
  }

  locationsByUserId.set(next.userId, next);
  emitChange();

  const result: FriendLocationApplyResult = existing
    ? 'updated'
    : 'stored';

  console.log(
    'OFFLINK_FRIEND_LOCATION_APPLIED',
    JSON.stringify({
      result,
      userId: next.userId,
      sequence: next.sequence,
      timestamp: next.timestamp,
      hops: next.hops,
      sourceNodeId: next.sourceNodeId,
    }),
  );

  return result;
}

export function getFriendLocation(
  userId: string,
): FriendLocationRecord | null {
  return (
    locationsByUserId.get(userId.trim().toUpperCase()) ?? null
  );
}

export function getFriendLocations(): FriendLocationRecord[] {
  return sortLocations(Array.from(locationsByUserId.values()));
}

export function getFreshFriendLocations(
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  now = Date.now(),
): FriendLocationRecord[] {
  return getFriendLocations().filter(
    record => now - record.timestamp < maxAgeMs,
  );
}

export function removeExpiredFriendLocations(
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  now = Date.now(),
): number {
  let removed = 0;

  locationsByUserId.forEach((record, userId) => {
    if (now - record.timestamp >= maxAgeMs) {
      locationsByUserId.delete(userId);
      removed += 1;
    }
  });

  if (removed > 0) {
    emitChange();

    console.log(
      'OFFLINK_FRIEND_LOCATIONS_EXPIRED',
      JSON.stringify({
        removed,
        remaining: locationsByUserId.size,
      }),
    );
  }

  return removed;
}

export function removeFriendLocation(userId: string): boolean {
  const removed = locationsByUserId.delete(
    userId.trim().toUpperCase(),
  );

  if (removed) {
    emitChange();
  }

  return removed;
}

export function clearFriendLocations(): void {
  if (locationsByUserId.size === 0) {
    return;
  }

  locationsByUserId.clear();
  emitChange();
}

export function subscribeToFriendLocations(
  listener: FriendLocationListener,
): () => void {
  listeners.add(listener);
  listener(getFriendLocations());

  return () => {
    listeners.delete(listener);
  };
}

export function getFriendLocationCount(): number {
  return locationsByUserId.size;
}
