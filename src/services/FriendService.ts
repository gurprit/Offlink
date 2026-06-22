import {OfflinkFriend, OfflinkProfile} from '../models/types';

export function makeShortId() {
  return 'OL-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function makeQrPayload(profile: OfflinkProfile) {
  return JSON.stringify({
    app: 'offlink',
    type: 'profile',
    version: 1,
    userId: profile.userId,
    nickname: profile.nickname,
  });
}

export function parseFriendInput(input: string): OfflinkFriend | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (
      parsed?.app === 'offlink' &&
      parsed?.type === 'profile' &&
      typeof parsed.userId === 'string' &&
      typeof parsed.nickname === 'string'
    ) {
      return {
        userId: parsed.userId,
        nickname: parsed.nickname,
        addedAt: Date.now(),
      };
    }
  } catch {
    // Manual fallback below.
  }

  const parts = trimmed.split('|').map(part => part.trim());

  if (parts.length === 2 && parts[0] && parts[1]) {
    return {
      userId: parts[0],
      nickname: parts[1],
      addedAt: Date.now(),
    };
  }

  return null;
}
