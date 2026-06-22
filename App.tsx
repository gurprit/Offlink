import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import 'react-native-get-random-values';

const PROFILE_KEY = 'offlink_profile';
const FRIENDS_KEY = 'offlink_friends';

type OfflinkProfile = {
  nickname: string;
  userId: string;
};

type OfflinkFriend = {
  nickname: string;
  userId: string;
  addedAt: number;
};

function makeShortId() {
  return 'OL-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function makeQrPayload(profile: OfflinkProfile) {
  return JSON.stringify({
    app: 'offlink',
    type: 'profile',
    version: 1,
    userId: profile.userId,
    nickname: profile.nickname,
  });
}

function parseFriendInput(input: string): OfflinkFriend | null {
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
    // Fall back to manual format below.
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

export default function App() {
  const [nickname, setNickname] = useState('');
  const [savedProfile, setSavedProfile] = useState<OfflinkProfile | null>(null);
  const [friendInput, setFriendInput] = useState('');
  const [friends, setFriends] = useState<OfflinkFriend[]>([]);

  const qrValue = useMemo(() => {
    if (!savedProfile) {
      return '';
    }

    return makeQrPayload(savedProfile);
  }, [savedProfile]);

  useEffect(() => {
    loadProfile();
    loadFriends();
  }, []);

  async function loadProfile() {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);

    if (raw) {
      const profile = JSON.parse(raw) as OfflinkProfile;
      setSavedProfile(profile);
      setNickname(profile.nickname);
    }
  }

  async function loadFriends() {
    const raw = await AsyncStorage.getItem(FRIENDS_KEY);

    if (raw) {
      setFriends(JSON.parse(raw) as OfflinkFriend[]);
    }
  }

  async function saveProfile() {
    const trimmedName = nickname.trim();

    if (!trimmedName) {
      Alert.alert('Nickname needed', 'Enter a nickname before saving.');
      return;
    }

    const profile: OfflinkProfile = {
      nickname: trimmedName,
      userId: savedProfile?.userId || makeShortId(),
    };

    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setSavedProfile(profile);
  }

  async function saveFriends(nextFriends: OfflinkFriend[]) {
    setFriends(nextFriends);
    await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(nextFriends));
  }

  async function addFriend() {
    const friend = parseFriendInput(friendInput);

    if (!friend) {
      Alert.alert(
        'Could not add friend',
        'Paste an Offlink QR payload, or use this test format: OL-ABC123|Sam',
      );
      return;
    }

    if (friend.userId === savedProfile?.userId) {
      Alert.alert('That is you', 'You cannot add yourself as a friend.');
      return;
    }

    const alreadyExists = friends.some(item => item.userId === friend.userId);

    if (alreadyExists) {
      Alert.alert('Already added', `${friend.nickname} is already in your friends list.`);
      return;
    }

    await saveFriends([...friends, friend]);
    setFriendInput('');
  }

  async function removeFriend(userId: string) {
    const nextFriends = friends.filter(friend => friend.userId !== userId);
    await saveFriends(nextFriends);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#050505" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.logo}>OFFLINK</Text>
          <Text style={styles.tagline}>Find your friends. No signal needed.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your offline profile</Text>

          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="Enter nickname"
            placeholderTextColor="#777"
          />

          <TouchableOpacity style={styles.button} onPress={saveProfile}>
            <Text style={styles.buttonText}>Save Profile</Text>
          </TouchableOpacity>

          {savedProfile ? (
            <View style={styles.profileBox}>
              <Text style={styles.label}>Nickname</Text>
              <Text style={styles.value}>{savedProfile.nickname}</Text>

              <Text style={styles.label}>Offlink ID</Text>
              <Text style={styles.value}>{savedProfile.userId}</Text>
            </View>
          ) : (
            <Text style={styles.helper}>
              This ID will be used for QR friend adding and Bluetooth discovery.
            </Text>
          )}
        </View>

        {savedProfile ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your friend QR</Text>

            <View style={styles.qrBox}>
              <QRCode value={qrValue} size={190} backgroundColor="#ffffff" color="#050505" />
            </View>

            <Text style={styles.helper}>
              Camera scanning comes next. For now, this QR stores your Offlink profile data.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add friend</Text>

          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={friendInput}
            onChangeText={setFriendInput}
            placeholder='Paste QR payload or test with: OL-ABC123|Sam'
            placeholderTextColor="#777"
            multiline
          />

          <TouchableOpacity style={styles.button} onPress={addFriend}>
            <Text style={styles.buttonText}>Add Friend</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Friends</Text>

          {friends.length === 0 ? (
            <Text style={styles.helper}>
              No friends added yet. Soon, only these people will appear in nearby discovery.
            </Text>
          ) : (
            friends.map(friend => (
              <View key={friend.userId} style={styles.friendRow}>
                <View style={styles.friendTextWrap}>
                  <Text style={styles.friendName}>{friend.nickname}</Text>
                  <Text style={styles.friendId}>{friend.userId}</Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeFriend(friend.userId)}>
                  <Text style={styles.deleteText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
  },
  header: {
    marginTop: 28,
    marginBottom: 24,
  },
  logo: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 3,
  },
  tagline: {
    color: '#bdbdbd',
    fontSize: 16,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#151515',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#303030',
    marginBottom: 18,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 16,
    color: '#ffffff',
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#050505',
    fontSize: 18,
    fontWeight: '900',
  },
  profileBox: {
    marginTop: 18,
    backgroundColor: '#0b0b0b',
    borderRadius: 18,
    padding: 16,
  },
  label: {
    color: '#888',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  value: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  helper: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  qrBox: {
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  friendRow: {
    backgroundColor: '#0b0b0b',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#262626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  friendName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  friendId: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteText: {
    color: '#fff',
    fontWeight: '800',
  },
});
