import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';

type HomeMapCardProps = {
  friendCount: number;
  status?: string;
  onPress: () => void;
};

export function HomeMapCard({friendCount, status, onPress}: HomeMapCardProps) {
  const friendLabel = friendCount === 1 ? '1 friend' : `${friendCount} friends`;

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      accessibilityRole="button"
      accessibilityLabel="Open friend map"
      onPress={onPress}
      style={styles.card}>
      <View style={styles.mapSurface}>
        <View style={[styles.routeLine, styles.routeLineOne]} />
        <View style={[styles.routeLine, styles.routeLineTwo]} />
        <View style={styles.youPin}>
          <View style={styles.youPinCore} />
        </View>
        {friendCount > 0 ? <View style={styles.friendPin}><Text>🙂</Text></View> : null}
        {friendCount > 1 ? <View style={[styles.friendPin, styles.friendPinTwo]}><Text>🦊</Text></View> : null}
      </View>

      <View style={styles.copyRow}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>LIVE MAP</Text>
          <Text style={styles.title}>
            {friendCount > 0 ? `${friendLabel} on Offlink` : 'Your map is ready'}
          </Text>
          <Text numberOfLines={2} style={styles.status}>
            {status || (friendCount > 0 ? 'Finding the latest locations...' : 'Add a friend to start finding each other.')}
          </Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#171717',
    borderColor: '#303030',
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 24,
    overflow: 'hidden',
  },
  mapSurface: {
    backgroundColor: '#20241f',
    height: 210,
    overflow: 'hidden',
    position: 'relative',
  },
  routeLine: {
    backgroundColor: '#3c433b',
    borderRadius: 999,
    height: 16,
    position: 'absolute',
    transform: [{rotate: '-18deg'}],
    width: 310,
  },
  routeLineOne: {
    left: -42,
    top: 64,
  },
  routeLineTwo: {
    right: -120,
    top: 144,
    transform: [{rotate: '28deg'}],
  },
  youPin: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    left: '46%',
    position: 'absolute',
    top: 88,
    width: 36,
  },
  youPinCore: {
    backgroundColor: '#050505',
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  friendPin: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    left: 52,
    position: 'absolute',
    top: 42,
    width: 40,
  },
  friendPinTwo: {
    left: undefined,
    right: 42,
    top: 126,
  },
  copyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    padding: 20,
  },
  copy: {
    flex: 1,
  },
  eyebrow: {
    color: '#8f8f8f',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 5,
  },
  status: {
    color: '#a8a8a8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  arrow: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '300',
    marginLeft: 16,
  },
});
