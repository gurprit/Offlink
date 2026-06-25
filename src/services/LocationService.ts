import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation, {
  GeoPosition,
  GeoError,
} from 'react-native-geolocation-service';

export type OfflinkLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );

  return result === 'granted';
}

export async function getCurrentLocation(): Promise<OfflinkLocation | null> {
  const granted = await requestLocationPermission();

  if (!granted) {
    return null;
  }

  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      (position: GeoPosition) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error: GeoError) => {
        console.log('OFFLINK_LOCATION_ERROR', String(error.message || error.code));
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 15000,
      },
    );
  });
}


export async function watchCurrentLocation(
  onLocation: (location: OfflinkLocation) => void,
  onError?: (error: string) => void,
): Promise<() => void> {
  const granted = await requestLocationPermission();

  if (!granted) {
    onError?.('Location permission not granted.');
    return () => {};
  }

  const watchId = Geolocation.watchPosition(
    (position: GeoPosition) => {
      onLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
    (error: GeoError) => {
      onError?.(String(error.message || error.code));
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 2,
      interval: 3000,
      fastestInterval: 1000,
      showsBackgroundLocationIndicator: false,
    },
  );

  return () => {
    Geolocation.clearWatch(watchId);
  };
}
