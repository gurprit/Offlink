import AsyncStorage from '@react-native-async-storage/async-storage';
import {OfflinkFriend, OfflinkProfile, OfflinkSighting} from '../models/types';
import {ensureMeshId} from './MeshIdentityService';

const PROFILE_KEY = 'offlink_profile';
const FRIENDS_KEY = 'offlink_friends';
const SIGHTINGS_KEY = 'offlink_sightings';

export async function loadProfile(): Promise<OfflinkProfile | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);

  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as Partial<OfflinkProfile>;

  if (!parsed.userId || !parsed.emoji) {
    return null;
  }

  const profile: OfflinkProfile = {
    userId: parsed.userId,
    emoji: parsed.emoji,
    meshId: ensureMeshId(parsed.meshId),
  };

  if (profile.meshId !== parsed.meshId) {
    await saveProfile(profile);
  }

  return profile;
}

export async function saveProfile(profile: OfflinkProfile): Promise<void> {
  await AsyncStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
      ...profile,
      meshId: ensureMeshId(profile.meshId),
    }),
  );
}

export async function loadFriends(): Promise<OfflinkFriend[]> {
  const raw = await AsyncStorage.getItem(FRIENDS_KEY);
  return raw ? (JSON.parse(raw) as OfflinkFriend[]) : [];
}

export async function saveFriends(friends: OfflinkFriend[]): Promise<void> {
  await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
}

export async function loadSightings(): Promise<OfflinkSighting[]> {
  const raw = await AsyncStorage.getItem(SIGHTINGS_KEY);
  return raw ? (JSON.parse(raw) as OfflinkSighting[]) : [];
}

export async function saveSightings(sightings: OfflinkSighting[]): Promise<void> {
  await AsyncStorage.setItem(SIGHTINGS_KEY, JSON.stringify(sightings));
}
