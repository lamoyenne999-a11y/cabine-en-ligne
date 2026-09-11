import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, Pressable, Animated, Easing, ScrollView, Dimensions, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, font } from '../theme';
import { T } from './ui';

// ============================================================
//  Bottom sheet
//  - Le contenu est scrollable et borné en hauteur (~80 % de l'écran)
//    pour qu'un long contenu (liste de notifications…) ne recouvre
//    jamais tout l'écran : on peut toujours toucher le voile sombre
//    pour fermer, en plus du bouton de fermeture éventuel.
//  - La poignée (le petit trait) est draggable : on la tire vers le
//    bas pour fermer le panneau, en plus de la croix et du voile.
// ============================================================
export function BottomSheet({ visible, onClose, children }) {
  const slide = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      drag.setValue(0);
      Animated.timing(slide, { toValue: 1, duration: 220, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
    } else {
      slide.setValue(0);
      drag.setValue(0);
    }
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (e, g) => { if (g.dy > 0) drag.setValue(g.dy); },
      onPanResponderRelease: (e, g) => {
        if (g.dy > 110 || g.vy > 0.9) {
          drag.setValue(0);
          onCloseRef.current();
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
      },
    })
  ).current;

  const translateY = Animated.add(
    slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }),
    drag
  );

  const maxH = Math.round(Dimensions.get('window').height * 0.8);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={overlay.overlay} onPress={onClose}>
        <Animated.View style={[overlay.sheet, { transform: [{ translateY }] }]}>
          <Pressable onPress={() => {}}>
            <View style={overlay.handleZone} {...pan.panHandlers}>
              <View style={overlay.handle} />
            </View>
            <ScrollView style={{ maxHeight: maxH }} showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
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
    paddingHorizontal: 22,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  handleZone: {
    paddingVertical: 14,
    alignItems: 'center',
    // Empêche le navigateur de scroller/zoomer pendant le glissement
    // de la poignée (compat web / iOS Safari).
    touchAction: 'none',
  },
  handle: { width: 64, height: 5, borderRadius: 3, backgroundColor: colors.muted2 },
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
