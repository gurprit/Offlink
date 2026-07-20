import {
  Linking,
  PermissionsAndroid,
  Platform,
  type Permission,
} from 'react-native';

export type OfflinkPermissionStatus =
  | 'granted'
  | 'denied'
  | 'blocked';

export type OfflinkPermissionResult = {
  granted: boolean;
  status: OfflinkPermissionStatus;
  bluetoothGranted: boolean;
  locationGranted: boolean;
};

async function checkPermission(permission: Permission): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  return PermissionsAndroid.check(permission);
}

export async function checkOfflinkPermissions(): Promise<OfflinkPermissionResult> {
  if (Platform.OS !== 'android') {
    return {
      granted: false,
      status: 'denied',
      bluetoothGranted: false,
      locationGranted: false,
    };
  }

  const androidVersion = Number(Platform.Version);

  const locationGranted = await checkPermission(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );

  if (androidVersion < 31) {
    return {
      granted: locationGranted,
      status: locationGranted ? 'granted' : 'denied',
      bluetoothGranted: locationGranted,
      locationGranted,
    };
  }

  const [
    scanGranted,
    connectGranted,
    advertiseGranted,
  ] = await Promise.all([
    checkPermission(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ),
    checkPermission(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ),
    checkPermission(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    ),
  ]);

  const bluetoothGranted =
    scanGranted &&
    connectGranted &&
    advertiseGranted;

  const granted =
    bluetoothGranted &&
    locationGranted;

  return {
    granted,
    status: granted ? 'granted' : 'denied',
    bluetoothGranted,
    locationGranted,
  };
}

export async function requestOfflinkPermissions(): Promise<OfflinkPermissionResult> {
  if (Platform.OS !== 'android') {
    return {
      granted: false,
      status: 'denied',
      bluetoothGranted: false,
      locationGranted: false,
    };
  }

  const androidVersion = Number(Platform.Version);

  if (androidVersion < 23) {
    return {
      granted: true,
      status: 'granted',
      bluetoothGranted: true,
      locationGranted: true,
    };
  }

  const permissions: Permission[] = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ];

  if (androidVersion >= 31) {
    permissions.unshift(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    );
  }

  const result =
    await PermissionsAndroid.requestMultiple(
      permissions,
    );

  const locationResult =
    result[
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    ];

  const locationGranted =
    locationResult ===
    PermissionsAndroid.RESULTS.GRANTED;

  const locationBlocked =
    locationResult ===
    PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

  if (androidVersion < 31) {
    return {
      granted: locationGranted,
      status: locationBlocked
        ? 'blocked'
        : locationGranted
          ? 'granted'
          : 'denied',
      bluetoothGranted: locationGranted,
      locationGranted,
    };
  }

  const bluetoothPermissions = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
  ];

  const bluetoothGranted =
    bluetoothPermissions.every(
      permission =>
        result[permission] ===
        PermissionsAndroid.RESULTS.GRANTED,
    );

  const bluetoothBlocked =
    bluetoothPermissions.some(
      permission =>
        result[permission] ===
        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
    );

  const granted =
    bluetoothGranted &&
    locationGranted;

  const blocked =
    bluetoothBlocked ||
    locationBlocked;

  return {
    granted,
    status: blocked
      ? 'blocked'
      : granted
        ? 'granted'
        : 'denied',
    bluetoothGranted,
    locationGranted,
  };
}

export async function openOfflinkSettings(): Promise<void> {
  await Linking.openSettings();
}
