import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

const NativeHeading = NativeModules.OfflinkHeading;

type HeadingSubscription = {
  remove: () => void;
};

export type HeadingUpdate = {
  heading: number;
  accuracy?: number;
};

export function subscribeToHeading(
  listener: (update: HeadingUpdate) => void,
): HeadingSubscription {
  if (Platform.OS !== 'android' || !NativeHeading) {
    return {remove: () => {}};
  }

  const emitter = new NativeEventEmitter(NativeHeading);
  const subscription = emitter.addListener('offlinkHeadingChanged', listener);
  NativeHeading.start?.();

  return {
    remove: () => {
      subscription.remove();
      NativeHeading.stop?.();
    },
  };
}
