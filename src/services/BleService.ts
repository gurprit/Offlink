import {PermissionsAndroid, Platform} from 'react-native';
import {BleManager} from 'react-native-ble-plx';
import BLEAdvertiser from 'react-native-ble-advertiser';
import {OfflinkProfile, NearbyOfflinkUser} from '../models/types';
import {OfflinkLocation} from './LocationService';
import {ALL_EMOJIS} from '../data/emojis';
import MeshTopology from './MeshTopology';

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

// Android's advertiser start/stop calls are asynchronous. Offlink can request a
// restart while an earlier session cleanup is still stopping the advertiser,
// which can otherwise leave the newly-started broadcast immediately stopped.
// Keep advertiser mutations strictly ordered so the newest requested state wins.
let bleAdvertiserOperation: Promise<void> = Promise.resolve();
let bleAdvertiserOperationId = 0;

function queueBleAdvertiserOperation(
  operationName: string,
  operation: (operationId: number) => Promise<void>,
): Promise<void> {
  const operationId = ++bleAdvertiserOperationId;

  console.log(
    'OFFLINK_BLE_OPERATION_QUEUED',
    JSON.stringify({operationId, operationName}),
  );

  const nextOperation = bleAdvertiserOperation
    .catch(() => {})
    .then(async () => {
      console.log(
        'OFFLINK_BLE_OPERATION_START',
        JSON.stringify({operationId, operationName}),
      );

      try {
        await operation(operationId);

        console.log(
          'OFFLINK_BLE_OPERATION_SUCCESS',
          JSON.stringify({operationId, operationName}),
        );
      } catch (error) {
        console.log(
          'OFFLINK_BLE_OPERATION_ERROR',
          JSON.stringify({
            operationId,
            operationName,
            error: String(error),
          }),
        );
        throw error;
      }
    });

  bleAdvertiserOperation = nextOperation.catch(() => {});
  return nextOperation;
}

function encodeEmojiForBle(emoji: string): string {
  const index = ALL_EMOJIS.indexOf(emoji || '🙂');
  return String(index >= 0 ? index : 0);
}

function decodeEmojiFromBle(value: string): string {
  const index = Number(value);
  return ALL_EMOJIS[index] || '🙂';
}

export function makeBlePayload(
  profile: OfflinkProfile,
  location?: OfflinkLocation | null,
): string {
  const emojiCode = encodeEmojiForBle(profile.emoji || '🙂');

  return `${BLE_APP_PREFIX}|${profile.userId}|${emojiCode}`;
}

export function parseBlePayload(input: string): NearbyOfflinkUser | null {
  const parts = input.trim().split('|');

  if (parts.length < 3) {
    return null;
  }

  const [prefix, userId, emojiValue] = parts;
  const emoji = decodeEmojiFromBle(emojiValue);
  const meshId = userId;

  if (prefix !== BLE_APP_PREFIX || !userId || !meshId || !emoji) {
    return null;
  }

  return {
    userId,
    meshId,
    emoji,
    lastSeenAt: Date.now(),
  };
}

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  const androidVersion = Number(Platform.Version);

  if (androidVersion >= 31) {
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

  if (androidVersion >= 23) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  return true;
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
  console.log(
    'OFFLINK_BROADCAST_REQUESTED',
    JSON.stringify({
      userId: profile.userId,
      meshId: profile.meshId,
      hasLocation: Boolean(location),
      payload: makeBlePayload(profile, location),
    }),
  );

  return queueBleAdvertiserOperation('start-broadcast', async operationId => {
    BLEAdvertiser.setCompanyId(OFFLINK_COMPANY_ID);

    console.log(
      'OFFLINK_BROADCAST_PRESTOP',
      JSON.stringify({operationId, userId: profile.userId}),
    );
    await BLEAdvertiser.stopBroadcast().catch(error =>
      console.log(
        'OFFLINK_BROADCAST_PRESTOP_ERROR',
        JSON.stringify({operationId, error: String(error)}),
      ),
    );

    console.log(
      'OFFLINK_BROADCAST_NATIVE_START',
      JSON.stringify({operationId, userId: profile.userId}),
    );

    await BLEAdvertiser.broadcast(
      OFFLINK_SERVICE_UUID,
      stringToByteArray(makeBlePayload(profile, location)),
      {
        advertiseMode: 2,
        txPowerLevel: 3,
        connectable: true,
        includeDeviceName: false,
        includeTxPowerLevel: false,
      },
    );

    console.log(
      'OFFLINK_BROADCAST_STARTED',
      JSON.stringify({operationId, userId: profile.userId}),
    );
  });
}

export async function startBleBroadcastTest(): Promise<void> {
  await startBleBroadcast({
    userId: 'TEST',
    meshId: 'MESH-TEST-NODE',
    emoji: 'LION',
  });
}

export async function stopBleBroadcastTest(): Promise<void> {
  console.log('OFFLINK_BROADCAST_STOP_REQUESTED');

  return queueBleAdvertiserOperation('stop-broadcast', async operationId => {
    await BLEAdvertiser.stopBroadcast();
    console.log(
      'OFFLINK_BROADCAST_STOPPED',
      JSON.stringify({operationId}),
    );
  });
}


export function startOfflinkScan(
  onUserFound: (user: NearbyOfflinkUser) => void,
): () => void {
  console.log('OFFLINK_SCAN_NATIVE_START');

  bleManager.startDeviceScan(null, null, (error, device) => {
    if (error) {
      console.log('OFFLINK_SCAN_ERROR', String(error));
      return;
    }

    const user = parseBleManufacturerData(device?.manufacturerData);

    if (!user) {
      return;
    }

    const rssi = device?.rssi ?? -100;

    MeshTopology.updateNode(
      user.meshId,
      user.emoji,
      rssi,
      1,
      null,
      user.userId,
    );

    const userWithSignal = {
      ...user,
      deviceId: device?.id,
      rssi,
    };

    console.log('OFFLINK_USER_FOUND', JSON.stringify(userWithSignal));
    console.log('OFFLINK_MESH_TOPOLOGY', JSON.stringify(MeshTopology.getTopology()));
    onUserFound(userWithSignal);
  });

  return () => {
    console.log('OFFLINK_SCAN_NATIVE_STOP');
    bleManager.stopDeviceScan();
  };
}
