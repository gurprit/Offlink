import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  StatusBar,
  TextInput,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {Button} from '../components/Button';
import {Card} from '../components/Card';
import {FriendMap} from '../components/FriendMap';
import {ScannerScreen} from './ScannerScreen';
import {OfflinkFriend, OfflinkProfile, OfflinkSighting} from '../models/types';
import {makeQrPayload, makeShortId, parseFriendInput} from '../services/FriendService';
import {requestBlePermissions, startBleScanTest, startBleBroadcast, stopBleBroadcastTest, parseBleManufacturerData, startOfflinkScan} from '../services/BleService';
import {startGattServer, stopGattServer, readGattPayloadFromNearest} from '../services/GattService';
import {
  loadFriends,
  loadProfile,
  saveFriends,
  saveProfile as persistProfile,
} from '../services/StorageService';
import {ALL_EMOJIS} from '../data/emojis';
import {ensureMeshId} from '../services/MeshIdentityService';
import type {OfflinkPermissionResult} from '../services/PermissionService';
import type {OfflinkLocation} from '../services/LocationService';

function formatFriendAge(timestamp: number, now: number): string {
  const seconds = Math.max(1, Math.round((now - timestamp) / 1000));

  if (seconds < 10) {
    return 'Just now';
  }

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.round(hours / 24)}d ago`;
}

function formatFriendHopCount(hops?: number): string {
  const hopCount = Math.max(1, hops || 1);

  return `${hopCount} ${hopCount === 1 ? 'hop' : 'hops'}`;
}

export function HomeScreen({
  onShowNearby,
  onNearbyUserFound,
  onFriendsChanged,
  bleStatus,
  onShowSightings,
  onShowMap,
  onShowMeshDiagnostics,
  permissionResult,
  onEnableOfflink,
  onOpenOfflinkSettings,
  onCheckOfflinkPermissions,
  sightings,
  currentLocation,
}: {
  onShowNearby?: () => void;
  onShowSightings?: () => void;
  onShowMap?: () => void;
  onShowMeshDiagnostics?: () => void;
  onNearbyUserFound?: (user: import('../models/types').NearbyOfflinkUser) => void;
  onFriendsChanged?: (friends: OfflinkFriend[]) => void;
  bleStatus?: string;
  permissionResult: OfflinkPermissionResult | null;
  onEnableOfflink: () => void;
  onOpenOfflinkSettings: () => void;
  onCheckOfflinkPermissions: () => void;
  sightings: OfflinkSighting[];
  currentLocation: OfflinkLocation | null;
}) {
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [emojiChoices, setEmojiChoices] = useState<string[]>([]);
  const [savedProfile, setSavedProfile] = useState<OfflinkProfile | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [friends, setFriends] = useState<OfflinkFriend[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [manualFriendId, setManualFriendId] = useState('');
  const [showDeveloperTools, setShowDeveloperTools] = useState(false);
  const logoTapCountRef = useRef(0);
  const logoTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nearestDeviceId, setNearestDeviceId] = useState<string | null>(null);
  const [friendListNow, setFriendListNow] = useState(Date.now());

  const qrValue = useMemo(() => {
    return savedProfile ? makeQrPayload(savedProfile) : '';
  }, [savedProfile]);

  const friendSightings = useMemo(() => {
    const friendIds = new Set(friends.map(friend => friend.userId));

    return sightings.filter(
      sighting =>
        friendIds.has(sighting.userId) &&
        typeof sighting.latitude === 'number' &&
        typeof sighting.longitude === 'number',
    );
  }, [friends, sightings]);

  const friendRows = useMemo(() => {
    const sightingByUserId = new Map(
      friendSightings.map(sighting => [sighting.userId, sighting]),
    );

    return friends
      .map(friend => ({
        friend,
        sighting: sightingByUserId.get(friend.userId),
      }))
      .sort((left, right) => {
        const leftLastSeen = left.sighting?.lastSeenAt || 0;
        const rightLastSeen = right.sighting?.lastSeenAt || 0;

        return rightLastSeen - leftLastSeen;
      });
  }, [friendSightings, friends]);

  function handleLogoPress() {
    logoTapCountRef.current += 1;

    if (logoTapTimerRef.current) {
      clearTimeout(logoTapTimerRef.current);
    }

    logoTapTimerRef.current = setTimeout(() => {
      const tapCount = logoTapCountRef.current;

      logoTapCountRef.current = 0;
      logoTapTimerRef.current = null;

      if (tapCount >= 5) {
        setShowDeveloperTools(value => !value);
        return;
      }

      if (tapCount >= 2) {
        onShowMeshDiagnostics?.();
      }
    }, 450);
  }

  function generateEmojiChoices() {
    const shuffled = [...ALL_EMOJIS].sort(() => Math.random() - 0.5);
    setEmojiChoices(shuffled.slice(0, 10));
  }

  useEffect(() => {
    return () => {
      if (logoTapTimerRef.current) {
        clearTimeout(logoTapTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setFriendListNow(Date.now());
    }, 5000);

    return () => clearInterval(timer);
  }, []);

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
      meshId: ensureMeshId(savedProfile?.meshId),
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
    onFriendsChanged?.(nextFriends);
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

  async function handleAddManualFriend() {
    const userId = manualFriendId.trim().toUpperCase();

    if (!userId) {
      Alert.alert('Enter an Offlink ID', 'Type the friend ID first.');
      return;
    }

    if (userId === savedProfile?.userId) {
      Alert.alert('That is you', 'You cannot add yourself as a friend.');
      return;
    }

    const alreadyExists = friends.some(friend => friend.userId === userId);

    if (alreadyExists) {
      Alert.alert('Already added', 'This friend is already in your friends list.');
      return;
    }

    const friend: OfflinkFriend = {
      userId,
      emoji: '🙂',
      addedAt: Date.now(),
    };

    await handleSaveFriends([...friends, friend]);
    setManualFriendId('');
    Alert.alert('Friend added', `${userId} was added.`);
  }

  function handleRemoveFriend(userId: string) {
    Alert.alert(
      'Remove friend?',
      `${userId} will no longer appear on your map or friends list.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const nextFriends = friends.filter(
              friend => friend.userId !== userId,
            );

            void handleSaveFriends(nextFriends);
          },
        },
      ],
    );
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
      if (!savedProfile) {
        Alert.alert('No profile', 'Save your emoji identity before broadcasting.');
        return;
      }

      await startBleBroadcast(savedProfile);
      Alert.alert('BLE broadcast test', `Broadcast started for ${savedProfile.userId}.`);
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

  function handleDecodeBleTest() {
    const parsed = parseBleManufacturerData('NBJPTHxURVNUfExJT04=');

    Alert.alert(
      'BLE decode test',
      parsed ? `${parsed.userId} ${parsed.emoji}` : 'Could not decode payload.',
    );
  }

  async function handleStartGattServer() {
    try {
      await startGattServer('Hello from Offlink GATT');
      Alert.alert('GATT server', 'Started. Nearby Offlink phones can now read the test payload.');
    } catch (error) {
      Alert.alert('GATT server failed', String(error));
    }
  }

  async function handleStopGattServer() {
    try {
      await stopGattServer();
      Alert.alert('GATT server', 'Stopped.');
    } catch (error) {
      Alert.alert('GATT stop failed', String(error));
    }
  }

  async function handleReadGattFromNearest() {
    try {
      const payload = await readGattPayloadFromNearest();

      Alert.alert(
        'GATT read success',
        payload || 'Read worked, but payload was empty.',
      );
    } catch (error) {
      Alert.alert('GATT read failed', String(error));
    }
  }

  function handleStartLiveOfflinkScan() {
    const stopScan = startOfflinkScan(user => {
      if (user.deviceId) {
        setNearestDeviceId(user.deviceId);
      }

      onNearbyUserFound?.(user);
    });

    Alert.alert('Offlink scan', 'Live Offlink scan started for 15 seconds.');

    setTimeout(() => {
      stopScan();
      Alert.alert('Offlink scan', 'Live Offlink scan stopped.');
    }, 15000);
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
          <Text style={styles.logo} onPress={handleLogoPress}>OFFLINK</Text>
          <Text style={styles.tagline}>Find your friends. No signal needed.</Text>
        </View>

        {!permissionResult?.granted ? (
          <Card>
            <Text style={styles.onboardingEmoji}>📡</Text>
            <Text style={styles.cardTitle}>Welcome to Offlink</Text>

            {permissionResult === null ? (
            <Text
              style={[
                styles.helper,
                {
                  textAlign: 'left',
                },
              ]}>
                Checking whether Offlink is ready to use...
              </Text>
            ) : (
              <>
                <Text style={styles.onboardingText}>
                  Offlink uses Bluetooth to discover nearby phones and location
                  to share your position with friends across the offline mesh.
                </Text>

                <View style={styles.permissionBox}>
                  <Text style={styles.permissionLabel}>
                    {permissionResult.bluetoothGranted ? '✓' : '○'} Bluetooth
                  </Text>
                  <Text style={styles.permissionLabel}>
                    {permissionResult.locationGranted ? '✓' : '○'} Location
                  </Text>
                </View>

                <Text style={styles.privacyText}>
                  Nothing is uploaded to the internet.
                </Text>

                <View style={styles.saveButtonWrap}>
                  <Button
                    label={
                      permissionResult.status === 'blocked'
                        ? 'Open Android Settings'
                        : 'Enable Offlink'
                    }
                    onPress={() =>
                      permissionResult.status === 'blocked'
                        ? onOpenOfflinkSettings?.()
                        : onEnableOfflink?.()
                    }
                  />
                </View>

                {permissionResult.status === 'blocked' ? (
                  <View style={styles.saveButtonWrap}>
                    <Button
                      label="Check Permissions Again"
                      onPress={() => onCheckOfflinkPermissions?.()}
                    />
                  </View>
                ) : null}
              </>
            )}
          </Card>
        ) : null}

        {permissionResult?.granted && savedProfile ? (
          <FriendMap
            friendSightings={friendSightings}
            currentLocation={currentLocation}
            containerStyle={{
              height: 440,
              marginBottom: 24,
            }}
          />
        ) : null}

        {permissionResult?.granted ? (
          <Card>
            <View style={styles.nearbyHeader}>
              <Text style={styles.nearbyCardTitle}>Friends</Text>

              <View style={styles.nearbyCountBadge}>
                <Text style={styles.nearbyCountText}>
                  {friendSightings.length}
                </Text>
              </View>
            </View>

            {friendRows.length === 0 ? (
              <View style={styles.nearbyEmpty}>
                <Text style={styles.nearbyEmptyTitle}>
                  No friends added yet
                </Text>

                <Text style={styles.nearbyEmptyText}>
                  Add a friend using their QR code or Offlink ID.
                </Text>
              </View>
            ) : (
              <View style={styles.nearbyFriendList}>
                {friendRows.map(({friend, sighting}, index) => {
                  const isDirect = sighting?.source === 'direct';
                  const isRelayed = Boolean(sighting && !isDirect);

                  return (
                    <View
                      key={friend.userId}
                      style={[
                        styles.nearbyFriendRow,
                        index < friendRows.length - 1 &&
                          styles.nearbyFriendRowBorder,
                      ]}>
                      <View
                        style={[
                          styles.nearbyFriendEmojiWrap,
                          isDirect
                            ? styles.nearbyFriendEmojiDirect
                            : isRelayed
                              ? styles.nearbyFriendEmojiRelayed
                              : styles.nearbyFriendEmojiOffline,
                        ]}>
                        <Text style={styles.nearbyFriendEmoji}>
                          {friend.emoji || sighting?.emoji || '👤'}
                        </Text>
                      </View>

                      <View style={styles.nearbyFriendDetails}>
                        <Text style={styles.nearbyFriendName}>
                          {friend.userId}
                        </Text>

                        <View style={styles.nearbyFriendConnectionRow}>
                          <View
                            style={[
                              styles.nearbyFriendDot,
                              isDirect
                                ? styles.nearbyFriendDotDirect
                                : isRelayed
                                  ? styles.nearbyFriendDotRelayed
                                  : styles.nearbyFriendDotOffline,
                            ]}
                          />

                          <Text
                            style={[
                              styles.nearbyFriendConnection,
                              isRelayed &&
                                styles.nearbyFriendConnectionRelayed,
                              !sighting &&
                                styles.nearbyFriendConnectionOffline,
                            ]}>
                            {isDirect
                              ? 'Direct connection'
                              : isRelayed
                                ? `Relayed · ${formatFriendHopCount(
                                    sighting?.hops,
                                  )}`
                                : 'Not currently visible'}
                          </Text>
                        </View>

                        {sighting ? (
                          <Text style={styles.nearbyFriendLastSeen}>
                            Last seen{' '}
                            {formatFriendAge(
                              sighting.lastSeenAt,
                              friendListNow,
                            )}
                          </Text>
                        ) : null}
                      </View>

                      <Pressable
                        accessibilityLabel={`Remove friend ${friend.userId}`}
                        accessibilityRole="button"
                        hitSlop={12}
                        onPress={() => handleRemoveFriend(friend.userId)}
                        style={({pressed}) => [
                          styles.nearbyFriendRemove,
                          pressed && styles.nearbyFriendRemovePressed,
                        ]}>
                        <Text style={styles.nearbyFriendRemoveText}>✕</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={styles.nearbyBleStatus}>
              {bleStatus || 'Preparing Offlink...'}
            </Text>

          </Card>
        ) : null}

        {showDeveloperTools ? (
          <Card>
            <Text style={styles.cardTitle}>Developer Tools</Text>

            <Button
              label="Show Sightings"
              onPress={() => onShowSightings?.()}
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

            <View style={{height: 12}} />

            <Button
              label="Decode BLE Payload Test"
              onPress={handleDecodeBleTest}
            />

            <View style={{height: 12}} />

            <Button
              label="Start GATT Server"
              onPress={handleStartGattServer}
            />

            <View style={{height: 12}} />

            <Button
              label="Stop GATT Server"
              onPress={handleStopGattServer}
            />

            <View style={{height: 12}} />

            <Button
              label="Read GATT From Nearby Phone"
              onPress={handleReadGattFromNearest}
            />

            <View style={{height: 12}} />

            <Button
              label="Start Live Offlink Scan"
              onPress={handleStartLiveOfflinkScan}
            />

            <View style={{height: 12}} />

            <Button
              label="Mesh Diagnostics"
              onPress={() => onShowMeshDiagnostics?.()}
            />
          </Card>
        ) : null}

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

          <TextInput
            value={manualFriendId}
            onChangeText={setManualFriendId}
            placeholder="Enter Offlink ID, e.g. OL-ABC123"
            placeholderTextColor="#777"
            autoCapitalize="characters"
            style={styles.input}
          />

          <View style={{height: 12}} />

          <Button
            label="Add Friend by ID"
            onPress={handleAddManualFriend}
          />

          <Text style={styles.helper}>
            Scan a QR code or manually enter an Offlink ID.
          </Text>
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
  nearbyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
  },
  nearbyCardTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  nearbyCountBadge: {
    alignItems: 'center',
    backgroundColor: '#242424',
    borderRadius: 14,
    justifyContent: 'center',
    marginLeft: 10,
    minHeight: 28,
    minWidth: 28,
    paddingHorizontal: 8,
  },
  nearbyCountText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  nearbyFriendList: {
    backgroundColor: '#0b0b0b',
    borderColor: '#242424',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  nearbyFriendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  nearbyFriendRowBorder: {
    borderBottomColor: '#242424',
    borderBottomWidth: 1,
  },
  nearbyFriendEmojiWrap: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 25,
    borderWidth: 3,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  nearbyFriendEmojiDirect: {
    borderColor: '#ffffff',
  },
  nearbyFriendEmojiRelayed: {
    borderColor: '#8b5cf6',
  },
  nearbyFriendEmojiOffline: {
    borderColor: '#4b4b4b',
    opacity: 0.58,
  },
  nearbyFriendEmoji: {
    fontSize: 29,
    lineHeight: 36,
    textAlign: 'center',
  },
  nearbyFriendDetails: {
    flex: 1,
    marginLeft: 14,
  },
  nearbyFriendRemove: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginLeft: 8,
    width: 36,
  },
  nearbyFriendRemovePressed: {
    backgroundColor: '#242424',
  },
  nearbyFriendRemoveText: {
    color: '#777777',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  nearbyFriendName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  nearbyFriendConnectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 5,
  },
  nearbyFriendDot: {
    borderRadius: 4,
    height: 8,
    marginRight: 7,
    width: 8,
  },
  nearbyFriendDotDirect: {
    backgroundColor: '#ffffff',
  },
  nearbyFriendDotRelayed: {
    backgroundColor: '#8b5cf6',
  },
  nearbyFriendDotOffline: {
    backgroundColor: '#555555',
  },
  nearbyFriendConnection: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  nearbyFriendConnectionRelayed: {
    color: '#a78bfa',
  },
  nearbyFriendConnectionOffline: {
    color: '#777777',
  },
  nearbyFriendLastSeen: {
    color: '#909090',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  nearbyBleStatus: {
    color: '#858585',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
    textAlign: 'left',
  },
  nearbyEmpty: {
    backgroundColor: '#0b0b0b',
    borderColor: '#242424',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    padding: 18,
  },
  nearbyEmptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  nearbyEmptyText: {
    color: '#8f8f8f',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  onboardingEmoji: {
    fontSize: 46,
    marginBottom: 12,
    textAlign: 'center',
  },
  onboardingText: {
    color: '#d0d0d0',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  permissionBox: {
    backgroundColor: '#0b0b0b',
    borderRadius: 16,
    marginTop: 18,
    padding: 16,
  },
  permissionLabel: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    marginVertical: 5,
  },
  privacyText: {
    color: '#9f9f9f',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
    textAlign: 'center',
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
  input: {
    backgroundColor: '#101010',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 12,
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  qrBox: {
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
});
