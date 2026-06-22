import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  StatusBar,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {Button} from '../components/Button';
import {Card} from '../components/Card';
import {FriendItem} from '../components/FriendItem';
import {ScannerScreen} from './ScannerScreen';
import {OfflinkFriend, OfflinkProfile} from '../models/types';
import {makeQrPayload, makeShortId, parseFriendInput} from '../services/FriendService';
import {
  loadFriends,
  loadProfile,
  saveFriends,
  saveProfile as persistProfile,
} from '../services/StorageService';

export function HomeScreen() {
  const [nickname, setNickname] = useState('');
  const [savedProfile, setSavedProfile] = useState<OfflinkProfile | null>(null);
  const [friendInput, setFriendInput] = useState('');
  const [friends, setFriends] = useState<OfflinkFriend[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const qrValue = useMemo(() => {
    return savedProfile ? makeQrPayload(savedProfile) : '';
  }, [savedProfile]);

  useEffect(() => {
    async function initialise() {
      const profile = await loadProfile();
      const savedFriends = await loadFriends();

      if (profile) {
        setSavedProfile(profile);
        setNickname(profile.nickname);
      }

      setFriends(savedFriends);
    }

    initialise();
  }, []);

  async function handleSaveProfile() {
    const trimmedName = nickname.trim();

    if (!trimmedName) {
      Alert.alert('Nickname needed', 'Enter a nickname before saving.');
      return;
    }

    const profile: OfflinkProfile = {
      nickname: trimmedName,
      userId: savedProfile?.userId || makeShortId(),
    };

    await persistProfile(profile);
    setSavedProfile(profile);
  }

  async function handleSaveFriends(nextFriends: OfflinkFriend[]) {
    setFriends(nextFriends);
    await saveFriends(nextFriends);
  }

  async function addFriendFromValue(value: string) {
    const friend = parseFriendInput(value);

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

    await handleSaveFriends([...friends, friend]);
    setFriendInput('');
    setIsScanning(false);
  }

  async function handleAddFriend() {
    await addFriendFromValue(friendInput);
  }

  async function handleScannedFriend(value: string) {
    await addFriendFromValue(value);
  }

  async function handleRemoveFriend(userId: string) {
    const nextFriends = friends.filter(friend => friend.userId !== userId);
    await handleSaveFriends(nextFriends);
  }

  if (isScanning) {
    return (
      <ScannerScreen
        onClose={() => setIsScanning(false)}
        onScanned={handleScannedFriend}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#050505" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.logo}>OFFLINK</Text>
          <Text style={styles.tagline}>Find your friends. No signal needed.</Text>
        </View>

        <Card>
          <Text style={styles.cardTitle}>Your offline profile</Text>

          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="Enter nickname"
            placeholderTextColor="#777"
          />

          <Button label="Save Profile" onPress={handleSaveProfile} />

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
        </Card>

        {savedProfile ? (
          <Card>
            <Text style={styles.cardTitle}>Your friend QR</Text>

            <View style={styles.qrBox}>
              <QRCode value={qrValue} size={190} backgroundColor="#ffffff" color="#050505" />
            </View>

            <Text style={styles.helper}>
              Camera scanning comes next. For now, this QR stores your Offlink profile data.
            </Text>
          </Card>
        ) : null}

        <Card>
          <Text style={styles.cardTitle}>Add friend</Text>

          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={friendInput}
            onChangeText={setFriendInput}
            placeholder="Paste QR payload or test with: OL-ABC123|Sam"
            placeholderTextColor="#777"
            multiline
          />

          <Button label="Add Friend" onPress={handleAddFriend} />

          <View style={styles.scanButtonWrap}>
            <Button label="Scan QR" onPress={() => setIsScanning(true)} />
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Friends</Text>

          {friends.length === 0 ? (
            <Text style={styles.helper}>
              No friends added yet. Soon, only these people will appear in nearby discovery.
            </Text>
          ) : (
            friends.map(friend => (
              <FriendItem
                key={friend.userId}
                friend={friend}
                onRemove={handleRemoveFriend}
              />
            ))
          )}
        </Card>
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
  scanButtonWrap: {
    marginTop: 12,
  },
  qrBox: {
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
});
