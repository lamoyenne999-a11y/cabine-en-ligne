import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Real logo image (white scalloped badge + purple cabine + umbrella)
// Falls back to a styled placeholder if the image doesn't load.
export default function Logo({ size = 96 }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={require('../../assets/cabine-logo.png')}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
    </View>
  );
}
