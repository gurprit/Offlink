import React from 'react';
import {StyleSheet, View} from 'react-native';

type CardProps = {
  children: React.ReactNode;
};

export function Card({children}: CardProps) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#151515',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#303030',
    marginBottom: 18,
  },
});
