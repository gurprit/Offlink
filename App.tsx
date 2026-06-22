import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';

const PROFILE_KEY = 'offlink_profile';

type OfflinkProfile = {
  nickname: string;
  userId: string;
};

function makeShortId() {
  return 'OL-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function App() {
  const [nickname, setNickname] = useState('');
  const [savedProfile, setSavedProfile] = useState<OfflinkProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (raw) {
      const profile = JSON.parse(raw) as OfflinkProfile;
      setSavedProfile(profile);
      setNickname(profile.nickname);
    }
  }

  async function saveProfile() {
    const trimmedName = nickname.trim();

    if (!trimmedName) {
      return;
    }

    const profile: OfflinkProfile = {
      nickname: trimmedName,
      userId: savedProfile?.userId || makeShortId(),
    };

    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setSavedProfile(profile);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#050505" />

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
            This ID will be used later for QR friend adding and Bluetooth discovery.
          </Text>
        )}
      </View>

      <View style={styles.footerCard}>
        <Text style={styles.footerTitle}>MVP path</Text>
        <Text style={styles.footerText}>1. Save profile</Text>
        <Text style={styles.footerText}>2. Add friends by QR</Text>
        <Text style={styles.footerText}>3. Detect nearby friends over Bluetooth</Text>
        <Text style={styles.footerText}>4. Share sightings phone-to-phone</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
    padding: 20,
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
    marginTop: 16,
  },
  footerCard: {
    marginTop: 18,
    backgroundColor: '#101010',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#252525',
  },
  footerTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 10,
  },
  footerText: {
    color: '#bbb',
    fontSize: 15,
    marginBottom: 6,
  },
});
