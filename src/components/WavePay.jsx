import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T } from './ui';
import { Dialog, DialogButtons } from './modals';

// Adresse Wave marchand de la plateforme (pour les abonnements).
export const PLATFORM_WAVE = '0700000001';
export const PLATFORM_NAME = 'Cabine En Ligne';

// ============================================================
//  Paiement direct via Wave — l'argent ne passe PAS par l'app.
//  On affiche simplement le numéro Wave (marchand) auquel le
//  client doit envoyer l'argent depuis sa propre app Wave.
// ============================================================
export function WavePaySheet({ visible, onClose, onConfirm, title, amount, merchant, merchantName, subtitle }) {
  if (!visible) return null;
  const amt = `${(amount || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF`;
  return (
    <Dialog visible={visible} onClose={onClose}>
      <View style={{ alignItems: 'center' }}>
        <View style={s.badge}>
          <Ionicons name="water" size={26} color={colors.wave} />
        </View>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: 12 }}>{title || 'Payer via Wave'}</T>
        <T size={font.body} weight="700" color={colors.primary} style={{ marginTop: 4 }}>{amt}</T>
        {subtitle ? <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4, textAlign: 'center' }}>{subtitle}</T> : null}
      </View>

      <View style={s.infoBox}>
        <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginBottom: 4 }}>Envoyez l'argent au Wave marchand :</T>
        <View style={s.merchant}>
          <Ionicons name="storefront" size={18} color={colors.primary} style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <T size={font.body} weight="800" color={colors.text}>{merchant}</T>
            <T size={font.xs} weight="600" color={colors.muted}>{merchantName}</T>
          </View>
        </View>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 10 }}>
          Ouvrez votre application <T size={font.sm} weight="800" color={colors.wave}>Wave</T> et envoyez
          la somme à ce numéro. Aucun argent n'est stocké sur l'app.
        </T>
      </View>

      <DialogButtons
        cancel="Annuler"
        confirm="J'ai payé"
        onCancel={onClose}
        onConfirm={() => { onConfirm && onConfirm(); }}
      />
    </Dialog>
  );
}

const s = StyleSheet.create({
  badge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E7F0FE', alignItems: 'center', justifyContent: 'center' },
  infoBox: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 14, marginTop: 16 },
  merchant: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.sm, padding: 10, borderWidth: 1, borderColor: colors.border },
});
