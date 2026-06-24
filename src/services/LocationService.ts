import {PermissionsAndroid, Platform} from 'react-native';

export type OfflinkLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

type GeolocationPosition = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
};

type GeolocationError = {
  message?: string;
};

type GeolocationLike = {
  getCurrentPosition: (
    success: (position: GeolocationPosition) => void,
    error: (error: GeolocationError) => void,
    options: {
      enableHighAccuracy: boolean;
      timeout: number;
      maximumAge: number;
    },
  ) => void;
};

const geolocation = (navigator as unknown as {geolocation?: GeolocationLike}).geolocation;

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
    if (!geolocation) {
      resolve(null);
      return;
    }

    geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      error => {
        console.log('OFFLINK_LOCATION_ERROR', String(error));
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
