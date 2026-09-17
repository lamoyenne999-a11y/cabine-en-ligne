import React from 'react';
import { View, Image } from 'react-native';

// Logo Cabine En Ligne : médaillon rond blanc + logo (cabine et parasol).
// `size` = diamètre du médaillon. Le logo occupe ~80 % du médaillon.
export default function Logo({ size = 96, badge = true }) {
  const inner = badge ? Math.round(size * 0.8) : size;
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: badge ? '#fff' : 'transparent',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: badge ? 0.18 : 0, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: badge ? 4 : 0,
      }}
    >
      <Image
        source={require('../../assets/cabine-logo.png')}
        style={{ width: inner, height: inner, resizeMode: 'contain' }}
      />
    </View>
  );
}
