import {OfflinkProfile, NearbyOfflinkUser} from '../models/types';

const BLE_APP_PREFIX = 'OL';

export function makeBlePayload(profile: OfflinkProfile): string {
  return [
    BLE_APP_PREFIX,
    profile.userId,
    profile.emoji || '🙂',
  ].join('|');
}

export function parseBlePayload(input: string): NearbyOfflinkUser | null {
  const parts = input.trim().split('|');

  if (parts.length < 3) {
    return null;
  }

  const [prefix, userId, emoji] = parts;

  if (prefix !== BLE_APP_PREFIX || !userId || !emoji) {
    return null;
  }

  return {
    userId,
    emoji,
    lastSeenAt: Date.now(),
  };
}
