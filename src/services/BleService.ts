import {PermissionsAndroid, Platform} from 'react-native';
import {BleManager} from 'react-native-ble-plx';
import BLEAdvertiser from 'react-native-ble-advertiser';
import {OfflinkProfile, NearbyOfflinkUser} from '../models/types';
import {OfflinkLocation} from './LocationService';
import {ALL_EMOJIS} from '../data/emojis';

const BLE_APP_PREFIX = 'OL';
const OFFLINK_COMPANY_ID = 0x1234;
const OFFLINK_SERVICE_UUID = '0000feed-0000-1000-8000-00805f9b34fb';

function stringToByteArray(value: string): number[] {
  return Array.from(value).map(char => char.charCodeAt(0));
}

function decodeBase64(value: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';

  let buffer = 0;
  let bits = 0;

  for (const char of value.replace(/=+$/, '')) {
    const index = chars.indexOf(char);

    if (index < 0) {
      continue;
    }

    buffer = (buffer << 6) | index;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

export function parseBleManufacturerData(manufacturerData: string | null | undefined): NearbyOfflinkUser | null {
  if (!manufacturerData) {
    return null;
  }

  const decoded = decodeBase64(manufacturerData);
  const payloadStart = decoded.indexOf('OL|');

  if (payloadStart < 0) {
    return null;
  }

  return parseBlePayload(decoded.slice(payloadStart));
}
const bleManager = new BleManager();

function encodeEmojiForBle(emoji: string): string {
  const index = ALL_EMOJIS.indexOf(emoji || '🙂');
  return String(index >= 0 ? index : 0);
}

function decodeEmojiFromBle(value: string): string {
  const index = Number(value);
  return ALL_EMOJIS[index] || '🙂';
}

function encodeCoordinate(value: number | undefined): string {
  return typeof value === 'number' ? value.toFixed(5) : '';
}

function encodeAccuracy(value: number | undefined): string {
  return typeof value === 'number' ? String(Math.round(value)) : '';
}

function decodeOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function makeBlePayload(
  profile: OfflinkProfile,
  location?: OfflinkLocation | null,
): string {
  return [
    BLE_APP_PREFIX,
    profile.userId,
    encodeEmojiForBle(profile.emoji || '🙂'),
    encodeCoordinate(location?.latitude),
    encodeCoordinate(location?.longitude),
    encodeAccuracy(location?.accuracy),
  ].join('|');
}

export function parseBlePayload(input: string): NearbyOfflinkUser | null {
  const parts = input.trim().split('|');

  if (parts.length < 3) {
    return null;
  }

  const [prefix, userId, emojiValue, latitudeValue, longitudeValue, accuracyValue] = parts;
  const emoji = decodeEmojiFromBle(emojiValue);
  const latitude = decodeOptionalNumber(latitudeValue);
  const longitude = decodeOptionalNumber(longitudeValue);
  const accuracy = decodeOptionalNumber(accuracyValue);

  if (prefix !== BLE_APP_PREFIX || !userId || !emoji) {
    return null;
  }

  return {
    userId,
    emoji,
    lastSeenAt: Date.now(),
    latitude,
    longitude,
    accuracy,
  };
}

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
  ]);

  return (
    result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === 'granted' &&
    result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === 'granted' &&
    result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE] === 'granted'
  );
}


export async function startBleScanTest(): Promise<number> {
  return new Promise((resolve, reject) => {
    let seenCount = 0;

    try {
      bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          bleManager.stopDeviceScan();
          reject(error);
          return;
        }

        seenCount += 1;

        if (
          device?.manufacturerData ||
          device?.serviceUUIDs?.some(uuid => uuid.toLowerCase().includes('feed'))
        ) {
          console.log(
            'BLE_SCAN_RESULT_JSON',
            JSON.stringify({
              id: device?.id,
              name: device?.name,
              localName: device?.localName,
              manufacturerData: device?.manufacturerData,
              serviceUUIDs: device?.serviceUUIDs,
            }),
          );
        }
      });

      setTimeout(() => {
        bleManager.stopDeviceScan();
        resolve(seenCount);
      }, 10000);
    } catch (error) {
      bleManager.stopDeviceScan();
      reject(error);
    }
  });
}


export async function startBleBroadcast(
  profile: OfflinkProfile,
  location?: OfflinkLocation | null,
): Promise<void> {
  BLEAdvertiser.setCompanyId(OFFLINK_COMPANY_ID);

  await BLEAdvertiser.stopBroadcast().catch(() => {});

  await BLEAdvertiser.broadcast(
    OFFLINK_SERVICE_UUID,
    stringToByteArray(makeBlePayload(profile, location)),
    {
      advertiseMode: 2,
      txPowerLevel: 3,
      connectable: false,
      includeDeviceName: false,
      includeTxPowerLevel: false,
    },
  );
}

export async function startBleBroadcastTest(): Promise<void> {
  await startBleBroadcast({
    userId: 'TEST',
    emoji: 'LION',
  });
}

export async function stopBleBroadcastTest(): Promise<void> {
  await BLEAdvertiser.stopBroadcast();
}


export function startOfflinkScan(
  onUserFound: (user: NearbyOfflinkUser) => void,
): () => void {
  bleManager.startDeviceScan(null, null, (error, device) => {
    if (error) {
      console.log('OFFLINK_SCAN_ERROR', String(error));
      return;
    }

    const user = parseBleManufacturerData(device?.manufacturerData);

    if (!user) {
      return;
    }

    const userWithSignal = {
      ...user,
      rssi: device?.rssi ?? undefined,
    };

    console.log('OFFLINK_USER_FOUND', JSON.stringify(userWithSignal));
    onUserFound(userWithSignal);
  });

  return () => {
    bleManager.stopDeviceScan();
  };
}
