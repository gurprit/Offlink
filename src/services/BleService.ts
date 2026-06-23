import {PermissionsAndroid, Platform} from 'react-native';
import {BleManager} from 'react-native-ble-plx';
import BLEAdvertiser from 'react-native-ble-advertiser';
import {OfflinkProfile, NearbyOfflinkUser} from '../models/types';

const BLE_APP_PREFIX = 'OL';
const OFFLINK_COMPANY_ID = 0x1234;
const OFFLINK_SERVICE_UUID = '0000feed-0000-1000-8000-00805f9b34fb';

function stringToByteArray(value: string): number[] {
  return Array.from(value).map(char => char.charCodeAt(0));
}
const bleManager = new BleManager();

export function makeBlePayload(profile: OfflinkProfile): string {
  return [
    BLE_APP_PREFIX,
    profile.userId,
    profile.emoji || '🙂',
  ].join('|');
}

export function parseBlePayload(input: string): NearbyOfflinkUser | null {
  const parts = input.trim().split('|');

  if (parts.length < 3) {
    return null;
  }

  const [prefix, userId, emoji] = parts;

  if (prefix !== BLE_APP_PREFIX || !userId || !emoji) {
    return null;
  }

  return {
    userId,
    emoji,
    lastSeenAt: Date.now(),
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
      bleManager.startDeviceScan(null, null, error => {
        if (error) {
          bleManager.stopDeviceScan();
          reject(error);
          return;
        }

        seenCount += 1;
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


export async function startBleBroadcastTest(): Promise<void> {
  BLEAdvertiser.setCompanyId(OFFLINK_COMPANY_ID);

  await BLEAdvertiser.broadcast(
    OFFLINK_SERVICE_UUID,
    stringToByteArray('OL|TEST|LION'),
    {
      advertiseMode: 2,
      txPowerLevel: 3,
      connectable: false,
      includeDeviceName: false,
      includeTxPowerLevel: false,
    },
  );
}

export async function stopBleBroadcastTest(): Promise<void> {
  await BLEAdvertiser.stopBroadcast();
}
