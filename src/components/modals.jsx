import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, Pressable, ActivityIndicator, PanResponder, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, shadow } from '../theme';
import { T, Btn } from './ui';

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
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
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

// ============================================================
//  Wave payment simulation modal
// ============================================================
export function WaveModal({
  visible, onClose, onSuccess, title = 'Paiement',
  amountLabel, amount, recipient, recipientDetail, kind = 'payment',
}) {
  const [step, setStep] = useState('review'); // review | processing | success
  useEffect(() => {
    if (visible) setStep('review');
  }, [visible]);

  const confirm = () => {
    setStep('processing');
    setTimeout(() => setStep('success'), 1700);
  };
  const finish = () => {
    onSuccess && onSuccess();
    onClose();
    setStep('review');
  };

  const amountText = `${(amount || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF`;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={overlay.centerOverlay}>
        <View style={overlay.waveCard}>
          {step === 'review' && (
            <>
              <View style={overlay.waveTop}>
                <View style={overlay.waveLogo}>
                  <Ionicons name="water" size={22} color={colors.waveAccent} />
                  <T size={20} weight="800" color="#fff">Wave</T>
                </View>
                <Pressable onPress={onClose} hitSlop={10}>
                  <Ionicons name="close" size={24} color="rgba(255,255,255,0.8)" />
                </Pressable>
              </View>

              <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                <T size={font.sm} weight="600" color="rgba(255,255,255,0.75)">{title}</T>
                <T size={34} weight="800" color="#fff" style={{ marginTop: 6 }}>{amountText}</T>
              </View>

              <View style={overlay.waveBody}>
                <WaveRow icon="storefront" label={kind === 'retrait' ? 'Vers votre compte' : 'Destinataire'} value={recipient} sub={recipientDetail} />
                <WaveRow icon="phone-portrait" label="Numéro Wave" value="• • • • • • • •" sub="Vérifié" />
                <View style={overlay.waveNote}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <T size={font.sm} weight="600" color={colors.textSoft} style={{ marginLeft: 8, flex: 1 }}>
                    Transaction sécurisée par Wave. Vous confirmerez dans votre application Wave.
                  </T>
                </View>
                <Btn title="Confirmer" icon="lock-closed" onPress={confirm} color={colors.waveAccent} textColor={colors.wave} style={{ marginTop: 12 }} />
              </View>
            </>
          )}

          {step === 'processing' && (
            <View style={overlay.waveCenter}>
              <ActivityIndicator size="large" color={colors.waveAccent} />
              <T size={font.h3} weight="800" color="#fff" style={{ marginTop: 18 }}>Traitement…</T>
              <T size={font.sm} weight="600" color="rgba(255,255,255,0.75)" style={{ marginTop: 6, textAlign: 'center' }}>
                Envoi de votre {kind === 'retrait' ? 'retrait' : 'paiement'} via Wave en cours
              </T>
            </View>
          )}

          {step === 'success' && (
            <View style={overlay.waveCenter}>
              <Ionicons name="checkmark-circle" size={78} color={colors.success} />
              <T size={font.h3} weight="800" color="#fff" style={{ marginTop: 16 }}>{kind === 'retrait' ? 'Retrait effectué' : 'Paiement confirmé'}</T>
              <T size={font.sm} weight="600" color="rgba(255,255,255,0.85)" style={{ marginTop: 6, textAlign: 'center' }}>
                {amountText} {kind === 'retrait' ? 'envoyés vers votre compte Wave' : 'envoyés à ' + (recipient || '')}
              </T>
              <Btn title="Fermer" onPress={finish} color={colors.waveAccent} textColor={colors.wave} style={{ marginTop: 20, width: '100%' }} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function WaveRow({ icon, label, value, sub }) {
  return (
    <View style={overlay.waveRow}>
      <View style={overlay.waveRowIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <T size={font.xs} weight="600" color={colors.muted}>{label}</T>
        <T size={font.body} weight="700" color={colors.text} style={{ marginTop: 2 }}>{value}</T>
        {sub ? <T size={font.xs} weight="500" color={colors.muted}>{sub}</T> : null}
      </View>
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

  waveCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.wave,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 26,
  },
  waveTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  waveLogo: { flexDirection: 'row', alignItems: 'center' },
  waveBody: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    minHeight: 220,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  waveRowIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  waveNote: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.successBg,
    borderRadius: radius.md, padding: 12, marginTop: 12,
  },
  waveCenter: { alignItems: 'center', justifyContent: 'center', padding: 32, minHeight: 260 },
};
