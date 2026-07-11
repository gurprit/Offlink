import {NativeModules} from 'react-native';
import {BleManager, Device} from 'react-native-ble-plx';
import {parseBleManufacturerData} from './BleService';
import MeshTopology from './MeshTopology';
import {createMeshTopologySummary, decodeMeshTopologySummary, encodeMeshTopologySummary} from './MeshTopologyProtocol';

const SERVICE_UUID = '0000feed-0000-1000-8000-00805f9b34fb';
const TOPOLOGY_CHARACTERISTIC_UUID =
  '0000beef-0000-1000-8000-00805f9b34fb';

const TRANSPORT_META_CHARACTERISTIC_UUID =
  '0000cafe-0000-1000-8000-00805f9b34fb';

const TRANSPORT_CONTROL_CHARACTERISTIC_UUID =
  '0000caf1-0000-1000-8000-00805f9b34fb';

const TRANSPORT_CHUNK_CHARACTERISTIC_UUID =
  '0000caf2-0000-1000-8000-00805f9b34fb';

const MAX_TRANSPORT_CHUNKS = 32;

const {OfflinkGatt} = NativeModules;
const gattClient = new BleManager();

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function encodeBase64(value: string): string {
  const bytes = Array.from(value).map(character =>
    character.charCodeAt(0),
  );

  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];

    const triplet =
      (first << 16) |
      ((second ?? 0) << 8) |
      (third ?? 0);

    output += chars[(triplet >> 18) & 63];
    output += chars[(triplet >> 12) & 63];
    output +=
      second === undefined
        ? '='
        : chars[(triplet >> 6) & 63];
    output +=
      third === undefined
        ? '='
        : chars[triplet & 63];
  }

  return output;
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

export async function startGattServer(payload = 'Hello from Offlink GATT'): Promise<void> {
  await OfflinkGatt.startServer(payload);
}

export async function stopGattServer(): Promise<void> {
  await OfflinkGatt.stopServer();
}

export async function setGattPayload(payload: string): Promise<void> {
  await OfflinkGatt.setPayload(payload);
}

export async function setGattTransportPayload(
  payload: string,
): Promise<void> {
  await OfflinkGatt.setTransportPayload(payload);
}


async function findNearestOfflinkDevice(timeoutMs = 6000): Promise<Device> {
  return new Promise((resolve, reject) => {
    let didFinish = false;

    const timer = setTimeout(() => {
      if (didFinish) {
        return;
      }

      didFinish = true;
      gattClient.stopDeviceScan();
      reject(new Error('No Offlink BLE device found during GATT scan.'));
    }, timeoutMs);

    gattClient.startDeviceScan(null, null, (error, device) => {
      if (didFinish) {
        return;
      }

      if (error) {
        didFinish = true;
        clearTimeout(timer);
        gattClient.stopDeviceScan();
        reject(error);
        return;
      }

      const user = parseBleManufacturerData(device?.manufacturerData);

      if (!user || !device) {
        return;
      }

      didFinish = true;
      clearTimeout(timer);
      gattClient.stopDeviceScan();

      setTimeout(() => resolve(device), 500);
    });
  });
}

export async function readGattPayloadFromNearest(): Promise<string> {
  const device = await findNearestOfflinkDevice();
  return readGattPayloadFromDevice(device.id);
}

export async function readGattPayloadFromDevice(deviceId: string): Promise<string> {
  console.log('OFFLINK_GATT_CONNECT_START', deviceId);

  const device = await withTimeout(
    gattClient.connectToDevice(deviceId, {timeout: 8000}),
    9000,
    'GATT connect',
  );

  try {
    console.log('OFFLINK_GATT_DISCOVER_START', deviceId);

    await withTimeout(
      device.discoverAllServicesAndCharacteristics(),
      6000,
      'GATT discover',
    );

    console.log('OFFLINK_GATT_READ_START', deviceId);

    const characteristic = await withTimeout(
      device.readCharacteristicForService(
        SERVICE_UUID,
        TOPOLOGY_CHARACTERISTIC_UUID,
      ),
      6000,
      'GATT read',
    );

    const decoded = decodeBase64(characteristic.value || '');

    console.log(
      'OFFLINK_GATT_READ_SUCCESS',
      JSON.stringify({deviceId, length: decoded.length}),
    );

    return decoded;
  } finally {
    await gattClient.cancelDeviceConnection(device.id).catch(() => {});
  }
}



export type OfflinkGattPayloads = {
  topology: string;
  transport: string;
};

export async function readGattPayloadsFromDevice(
  deviceId: string,
): Promise<OfflinkGattPayloads> {
  console.log('OFFLINK_GATT_CONNECT_START', deviceId);

  const device = await withTimeout(
    gattClient.connectToDevice(deviceId, {timeout: 8000}),
    9000,
    'GATT connect',
  );

  try {
    console.log('OFFLINK_GATT_DISCOVER_START', deviceId);

    await withTimeout(
      device.discoverAllServicesAndCharacteristics(),
      6000,
      'GATT discover',
    );

    const topologyCharacteristic = await withTimeout(
      device.readCharacteristicForService(
        SERVICE_UUID,
        TOPOLOGY_CHARACTERISTIC_UUID,
      ),
      6000,
      'GATT topology read',
    );

    let transport = '';

    try {
      const metadataCharacteristic = await withTimeout(
        device.readCharacteristicForService(
          SERVICE_UUID,
          TRANSPORT_META_CHARACTERISTIC_UUID,
        ),
        6000,
        'GATT transport metadata read',
      );

      const metadata = decodeBase64(
        metadataCharacteristic.value || '',
      );

      const metadataParts = metadata.split('|');
      const chunkCount = Number(metadataParts[2] || 0);
      const encodedLength = Number(metadataParts[3] || 0);

      if (
        metadataParts[0] !== 'OLTX' ||
        metadataParts[1] !== '1' ||
        !Number.isInteger(chunkCount) ||
        chunkCount < 0 ||
        chunkCount > MAX_TRANSPORT_CHUNKS ||
        !Number.isInteger(encodedLength) ||
        encodedLength < 0
      ) {
        throw new Error(
          `Invalid transport metadata: ${metadata}`,
        );
      }

      const chunks: string[] = [];

      for (
        let chunkIndex = 0;
        chunkIndex < chunkCount;
        chunkIndex += 1
      ) {
        await withTimeout(
          device.writeCharacteristicWithResponseForService(
            SERVICE_UUID,
            TRANSPORT_CONTROL_CHARACTERISTIC_UUID,
            encodeBase64(String(chunkIndex)),
          ),
          6000,
          `GATT transport chunk ${chunkIndex} select`,
        );

        const chunkCharacteristic = await withTimeout(
          device.readCharacteristicForService(
            SERVICE_UUID,
            TRANSPORT_CHUNK_CHARACTERISTIC_UUID,
          ),
          6000,
          `GATT transport chunk ${chunkIndex} read`,
        );

        chunks.push(
          decodeBase64(chunkCharacteristic.value || ''),
        );
      }

      const encodedTransport = chunks.join('');

      if (encodedTransport.length !== encodedLength) {
        throw new Error(
          `Transport length mismatch: expected ${encodedLength}, got ${encodedTransport.length}`,
        );
      }

      transport = decodeBase64(encodedTransport);

      console.log(
        'OFFLINK_GATT_TRANSPORT_REASSEMBLED',
        JSON.stringify({
          deviceId,
          chunkCount,
          encodedLength,
          decodedLength: transport.length,
        }),
      );
    } catch (error) {
      console.log(
        'OFFLINK_GATT_TRANSPORT_READ_ERROR',
        JSON.stringify({
          deviceId,
          error: String(error),
        }),
      );
    }

    const topology = decodeBase64(
      topologyCharacteristic.value || '',
    );

    console.log(
      'OFFLINK_GATT_DUAL_READ_SUCCESS',
      JSON.stringify({
        deviceId,
        topologyLength: topology.length,
        transportLength: transport.length,
      }),
    );

    return {
      topology,
      transport,
    };
  } finally {
    await gattClient.cancelDeviceConnection(device.id).catch(() => {});
  }
}

export async function readTopologyFromNearest(): Promise<string> {
  const payload = await readGattPayloadFromNearest();
  const summary = decodeMeshTopologySummary(payload);

  if (!summary) {
    console.log('OFFLINK_TOPOLOGY_READ_IGNORED', payload);
    return payload;
  }

  console.log('OFFLINK_TOPOLOGY_READ', JSON.stringify(summary));

  for (const neighbour of summary.neighbours) {
    if (neighbour.id === summary.nodeId) {
      continue;
    }

    MeshTopology.updateRemoteNode(
      neighbour.id,
      'remote',
      neighbour.quality,
      neighbour.hops + 1,
      summary.nodeId,
    );
  }

  return payload;
}


export async function publishTopologyToGatt(selfId: string): Promise<string> {
  const summary = createMeshTopologySummary(selfId, MeshTopology.getTopology());
  const encoded = encodeMeshTopologySummary(summary);

  await setGattPayload(encoded);

  console.log('OFFLINK_TOPOLOGY_PUBLISHED', encoded);

  return encoded;
}
