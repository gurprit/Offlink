import AsyncStorage from '@react-native-async-storage/async-storage';
import {OfflinkFriend, OfflinkProfile, OfflinkSighting} from '../models/types';
import {ensureMeshId} from './MeshIdentityService';

const PROFILE_KEY = 'offlink_profile';
const FRIENDS_KEY = 'offlink_friends';
const SIGHTINGS_KEY = 'offlink_sightings';

export async function loadProfile(): Promise<OfflinkProfile | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);

  console.log(
    'OFFLINK_PROFILE_LOAD',
    JSON.stringify({hasProfile: Boolean(raw)}),
  );

  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as Partial<OfflinkProfile>;

  if (!parsed.userId || !parsed.emoji) {
    console.log(
      'OFFLINK_PROFILE_LOAD_INVALID',
      JSON.stringify({
        hasUserId: Boolean(parsed.userId),
        hasEmoji: Boolean(parsed.emoji),
      }),
    );
    return null;
  }

  const profile: OfflinkProfile = {
    userId: parsed.userId,
    emoji: parsed.emoji,
    meshId: ensureMeshId(parsed.meshId),
    displayName:
      typeof parsed.displayName === 'string'
        ? parsed.displayName.trim().slice(0, 32) || undefined
        : undefined,
  };

  if (profile.meshId !== parsed.meshId) {
    console.log(
      'OFFLINK_PROFILE_MESH_ID_CREATED',
      JSON.stringify({userId: profile.userId, meshId: profile.meshId}),
    );
    await saveProfile(profile);
  }

  console.log(
    'OFFLINK_PROFILE_LOAD_SUCCESS',
    JSON.stringify({userId: profile.userId, meshId: profile.meshId}),
  );

  return profile;
}

export async function saveProfile(profile: OfflinkProfile): Promise<void> {
  const profileToSave = {
    ...profile,
    meshId: ensureMeshId(profile.meshId),
  };

  console.log(
    'OFFLINK_PROFILE_SAVE_START',
    JSON.stringify({
      userId: profileToSave.userId,
      meshId: profileToSave.meshId,
    }),
  );

  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profileToSave));

  console.log(
    'OFFLINK_PROFILE_SAVE_SUCCESS',
    JSON.stringify({
      userId: profileToSave.userId,
      meshId: profileToSave.meshId,
    }),
  );
}

export async function loadFriends(): Promise<OfflinkFriend[]> {
  const raw = await AsyncStorage.getItem(FRIENDS_KEY);

  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as OfflinkFriend[];

  return parsed.map(friend => ({
    ...friend,
    displayName:
      typeof friend.displayName === 'string'
        ? friend.displayName.trim().slice(0, 32) || undefined
        : undefined,
  }));
}

export async function saveFriends(friends: OfflinkFriend[]): Promise<void> {
  console.log(
    'OFFLINK_FRIENDS_SAVE',
    JSON.stringify({
      count: friends.length,
      userIds: friends.map(friend => friend.userId),
    }),
  );

  await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
}

export async function loadSightings(): Promise<OfflinkSighting[]> {
  const raw = await AsyncStorage.getItem(SIGHTINGS_KEY);
  return raw ? (JSON.parse(raw) as OfflinkSighting[]) : [];
}

export async function saveSightings(sightings: OfflinkSighting[]): Promise<void> {
  await AsyncStorage.setItem(SIGHTINGS_KEY, JSON.stringify(sightings));
}
