import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {Camera, useCameraDevice, useCodeScanner} from 'react-native-vision-camera';

type ScannerScreenProps = {
  onClose: () => void;
  onScanned: (value: string) => void;
};

export function ScannerScreen({onClose, onScanned}: ScannerScreenProps) {
  const [hasPermission, setHasPermission] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const device = useCameraDevice('back');

  useEffect(() => {
    async function requestPermission() {
      const permission = await Camera.requestCameraPermission();
      setHasPermission(permission === 'granted');
    }

    requestPermission();
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (hasScanned) {
        return;
      }

      const value = codes[0]?.value;

      if (value) {
        setHasScanned(true);
        onScanned(value);
      }
    },
  });

  if (!hasPermission) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Camera permission needed</Text>
        <Text style={styles.text}>
          Offlink needs camera access to scan friend QR codes.
        </Text>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>No camera found</Text>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        codeScanner={codeScanner}
      />

      <View style={styles.overlay}>
        <View>
          <Text style={styles.title}>Scan Offlink QR</Text>
          <Text style={styles.text}>Point at a friend's Offlink QR code.</Text>
        </View>

        <View style={styles.scanBox} />

        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    width: '100%',
    padding: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 40,
    textAlign: 'center',
  },
  text: {
    color: '#dddddd',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  scanBox: {
    width: 250,
    height: 250,
    borderWidth: 4,
    borderColor: '#ffffff',
    borderRadius: 28,
    backgroundColor: 'transparent',
  },
  button: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginBottom: 32,
  },
  buttonText: {
    color: '#050505',
    fontSize: 18,
    fontWeight: '900',
  },
});
