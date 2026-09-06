import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, Pressable, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, font } from '../theme';
import { T } from './ui';

// ============================================================
//  Bottom sheet
// ============================================================
export function BottomSheet({ visible, onClose, children }) {
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.timing(slide, { toValue: 1, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.cubic) }).start();
    } else {
      slide.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Pressable style={overlay.overlay} onPress={onClose}>
        <Animated.View
          style={[
            overlay.sheet,
            {
              transform: [{
                translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }),
              }],
            },
          ]}
        >
          <Pressable onPress={() => {}}>
            {children}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ============================================================
//  Centered alert dialog
// ============================================================
export function Dialog({ visible, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={overlay.centerOverlay}>
        <View style={overlay.dialog}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function DialogButtons({ cancel, confirm, onCancel, onConfirm }) {
  return (
    <View style={overlay.dialogBtns}>
      {cancel ? (
        <Pressable style={overlay.dialogBtn} onPress={onCancel}>
          <T size={font.body} weight="700" color={colors.textSoft}>{cancel}</T>
        </Pressable>
      ) : null}
      {confirm ? (
        <Pressable style={overlay.dialogBtn} onPress={onConfirm}>
          <T size={font.body} weight="800" color={colors.primary}>{confirm}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

const overlay = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20,8,30,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  centerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20,8,30,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 24,
  },
  dialogBtns: {
    flexDirection: 'row',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginHorizontal: -22,
    marginBottom: -22,
  },
  dialogBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
};
