import {OfflinkFriend, OfflinkProfile} from '../models/types';

const DEFAULT_EMOJI = '🙂';

export function makeShortId() {
  return 'OL-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function makeQrPayload(profile: OfflinkProfile) {
  return JSON.stringify({
    app: 'offlink',
    type: 'profile',
    version: 3,
    userId: profile.userId,
    emoji: profile.emoji || DEFAULT_EMOJI,
    displayName: profile.displayName?.trim() || undefined,
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
        emoji:
          typeof parsed.emoji === 'string' && parsed.emoji
            ? parsed.emoji
            : DEFAULT_EMOJI,
        displayName:
          typeof parsed.displayName === 'string'
            ? parsed.displayName.trim().slice(0, 32) || undefined
            : undefined,
        addedAt: Date.now(),
      };
    }
  } catch {
    return null;
  }

  return null;
}