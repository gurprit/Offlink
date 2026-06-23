import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
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
import {requestBlePermissions, startBleScanTest, startBleBroadcastTest, stopBleBroadcastTest} from '../services/BleService';
import {
  loadFriends,
  loadProfile,
  saveFriends,
  saveProfile as persistProfile,
} from '../services/StorageService';
import {ALL_EMOJIS} from '../data/emojis';

export function HomeScreen({
  onShowNearby,
}: {
  onShowNearby?: () => void;
}) {
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [emojiChoices, setEmojiChoices] = useState<string[]>([]);
  const [savedProfile, setSavedProfile] = useState<OfflinkProfile | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [friends, setFriends] = useState<OfflinkFriend[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const qrValue = useMemo(() => {
    return savedProfile ? makeQrPayload(savedProfile) : '';
  }, [savedProfile]);

  function generateEmojiChoices() {
    const shuffled = [...ALL_EMOJIS].sort(() => Math.random() - 0.5);
    setEmojiChoices(shuffled.slice(0, 10));
  }

  useEffect(() => {
    async function initialise() {
      const profile = await loadProfile();
      const savedFriends = await loadFriends();

      generateEmojiChoices();

      if (profile) {
        setSavedProfile(profile);
        setSelectedEmoji(profile.emoji || '');
        setIsEditingProfile(false);
      } else {
        setIsEditingProfile(true);
      }

      setFriends(savedFriends);
    }

    initialise();
  }, []);

  async function handleSaveProfile() {
    if (!selectedEmoji) {
      Alert.alert('Choose an emoji', 'Select an emoji identity before saving.');
      return;
    }

    const profile: OfflinkProfile = {
      userId: savedProfile?.userId || makeShortId(),
      emoji: selectedEmoji,
    };

    await persistProfile(profile);
    setSavedProfile(profile);
    setIsEditingProfile(false);
  }

  function handleEditProfile() {
    if (savedProfile) {
      setSelectedEmoji(savedProfile.emoji || '');
    }

    generateEmojiChoices();
    setIsEditingProfile(true);
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
        'This does not look like an Offlink QR code.',
      );
      return;
    }

    if (friend.userId === savedProfile?.userId) {
      Alert.alert('That is you', 'You cannot add yourself as a friend.');
      return;
    }

    const alreadyExists = friends.some(item => item.userId === friend.userId);

    if (alreadyExists) {
      Alert.alert('Already added', 'This friend is already in your friends list.');
      return;
    }

    await handleSaveFriends([...friends, friend]);
    setIsScanning(false);
  }

  async function handleScannedFriend(value: string) {
    await addFriendFromValue(value);
  }

  async function handleRemoveFriend(userId: string) {
    const nextFriends = friends.filter(friend => friend.userId !== userId);
    await handleSaveFriends(nextFriends);
  }

  async function handleRequestBlePermissions() {
    const granted = await requestBlePermissions();

    Alert.alert(
      'BLE permissions',
      granted ? 'Bluetooth permissions granted.' : 'Bluetooth permissions were not granted.',
    );
  }

  async function handleStartBleScanTest() {
    try {
      const seenCount = await startBleScanTest();

      Alert.alert('BLE scan test', `Scan finished. Saw ${seenCount} BLE results.`);
    } catch (error) {
      Alert.alert('BLE scan failed', String(error));
    }
  }

  async function handleStartBleBroadcastTest() {
    try {
      await startBleBroadcastTest();
      Alert.alert('BLE broadcast test', 'Broadcast started.');
    } catch (error) {
      Alert.alert('BLE broadcast failed', String(error));
    }
  }

  async function handleStopBleBroadcastTest() {
    try {
      await stopBleBroadcastTest();
      Alert.alert('BLE broadcast test', 'Broadcast stopped.');
    } catch (error) {
      Alert.alert('Stop broadcast failed', String(error));
    }
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
          <Text style={styles.cardTitle}>Nearby test</Text>
          <Button
            label="📡 Show Nearby Users"
            onPress={() => onShowNearby?.()}
          />

          <View style={{height: 12}} />

          <Button
            label="Request BLE Permissions"
            onPress={handleRequestBlePermissions}
          />

          <View style={{height: 12}} />

          <Button
            label="Start BLE Scan Test"
            onPress={handleStartBleScanTest}
          />

          <View style={{height: 12}} />

          <Button
            label="Start BLE Broadcast Test"
            onPress={handleStartBleBroadcastTest}
          />

          <View style={{height: 12}} />

          <Button
            label="Stop BLE Broadcast Test"
            onPress={handleStopBleBroadcastTest}
          />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Your emoji identity</Text>

          {savedProfile && !isEditingProfile ? (
            <View>
              <View style={styles.profileBox}>
                <Text style={styles.profileEmoji}>{savedProfile.emoji}</Text>

                <Text style={styles.label}>Offlink ID</Text>
                <Text style={styles.value}>{savedProfile.userId}</Text>

                <Text style={styles.helper}>
                  Friends will see this emoji when they discover you nearby.
                </Text>
              </View>

              <View style={styles.saveButtonWrap}>
                <Button label="Change Emoji" onPress={handleEditProfile} />
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.helper}>
                Pick one emoji. This is your identity on Offlink.
              </Text>

              <View style={styles.emojiGrid}>
                {emojiChoices.map(emoji => (
                  <Text
                    key={emoji}
                    style={[
                      styles.emojiButton,
                      selectedEmoji === emoji && styles.selectedEmoji,
                    ]}
                    onPress={() => setSelectedEmoji(emoji)}>
                    {emoji}
                  </Text>
                ))}
              </View>

              <Button label="🎲 New Emoji Set" onPress={generateEmojiChoices} />

              <View style={styles.saveButtonWrap}>
                <Button label="Save Emoji Identity" onPress={handleSaveProfile} />
              </View>

              {savedProfile ? (
                <View style={styles.saveButtonWrap}>
                  <Button label="Cancel" onPress={() => setIsEditingProfile(false)} />
                </View>
              ) : null}
            </View>
          )}
        </Card>

        {savedProfile ? (
          <Card>
            <Text style={styles.cardTitle}>Your QR</Text>

            <View style={styles.qrBox}>
              <QRCode value={qrValue} size={190} backgroundColor="#ffffff" color="#050505" />
            </View>

            <Text style={styles.helper}>Share this QR so friends can add you.</Text>
          </Card>
        ) : null}

        <Card>
          <Text style={styles.cardTitle}>Add friend</Text>

          <Button label="Scan QR to Add Friend" onPress={() => setIsScanning(true)} />

          <View style={{height: 12}} />

          <Button
            label="Show Nearby Users"
            onPress={() => onShowNearby?.()}
          />

          <Text style={styles.helper}>
            Scan your friend's QR code to add them.
          </Text>
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
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 12,
  },
  emojiButton: {
    fontSize: 34,
    margin: 8,
    padding: 8,
  },
  selectedEmoji: {
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 12,
  },
  saveButtonWrap: {
    marginTop: 12,
  },
  profileBox: {
    marginTop: 4,
    backgroundColor: '#0b0b0b',
    borderRadius: 18,
    padding: 16,
  },
  profileEmoji: {
    width: '100%',
    color: '#ffffff',
    fontSize: 104,
    lineHeight: 124,
    textAlign: 'center',
    marginBottom: 8,
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
    textAlign: 'center',
  },
  qrBox: {
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
});
