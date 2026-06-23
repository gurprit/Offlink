import {OfflinkFriend, OfflinkProfile} from '../models/types';

const DEFAULT_EMOJI = '🙂';

export function makeShortId() {
  return 'OL-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function makeQrPayload(profile: OfflinkProfile) {
  return JSON.stringify({
    app: 'offlink',
    type: 'profile',
    version: 2,
    userId: profile.userId,
    emoji: profile.emoji || DEFAULT_EMOJI,
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
      typeof parsed.userId === 'string'
    ) {
      return {
        userId: parsed.userId,
        emoji: typeof parsed.emoji === 'string' && parsed.emoji ? parsed.emoji : DEFAULT_EMOJI,
        addedAt: Date.now(),
      };
    }
  } catch {
    return null;
  }

  return null;
}