import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T } from './ui';
import { Dialog, DialogButtons } from './modals';

// Numéro Wave de la plateforme (pour payer l'abonnement).
export const PLATFORM_WAVE = '0788281933';
export const PLATFORM_NAME = 'Cabine En Ligne';

// ============================================================
//  Boîte « paiement Wave » réutilisable.
//  IMPORTANT (règle produit) : AUCUN lien de paiement Wave.
//  - Le client TRANSFÈRE directement le montant au numéro Wave
//    PERSONNEL du gérant depuis sa propre app Wave.
//  - Les frais Wave (1 % sur les transferts) sont à la charge du
//    CLIENT : le gérant reçoit la TOTALITÉ du montant demandé.
//  - Pas de lien marchand : un compte Wave Business facturerait 1 %
//    au gérant et risquerait d'être bloqué — néfaste pour lui et l'app.
// ============================================================
export function WavePayBox({ amount, merchant, merchantName, compact }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (merchant && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(merchant).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  if (!merchant) return null;
  const amt = (amount || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ');

  return (
    <View style={[s.infoBox, compact && s.infoBoxCompact]}>
      {/* Bouton « payer » : copie le numéro Wave pour un transfert direct. */}
      <Pressable onPress={copy} style={[s.payBtn, compact && s.payBtnCompact]}>
        <Ionicons name="water" size={compact ? 18 : 20} color="#fff" style={{ marginRight: 8 }} />
        <T size={compact ? font.sm : font.body} weight="800" color="#fff">{amount ? `Copier le numéro pour payer ${amt} F` : 'Copier le numéro Wave'}</T>
      </Pressable>
      <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
        {compact
          ? 'Frais Wave (1 %) à votre charge. Transférez le montant depuis votre app Wave.'
          : `Transférez ${amount ? `${amt} F` : 'le montant'} au numéro ci-dessous depuis votre app Wave. Les frais Wave (1 %) sont prélevés sur votre compte — ${merchantName} reçoit la totalité.`}
      </T>

      {/* Numéro du gérant (toujours visible, copiable) */}
      <View style={[s.merchant, { marginTop: compact ? 8 : 12 }]}>
        <Ionicons name="storefront" size={compact ? 16 : 18} color={colors.primary} style={{ marginRight: 8 }} />
        <Pressable onPress={copy} style={{ flex: 1 }}>
          <T size={font.body} weight="800" color={colors.text}>{merchant}</T>
          <T size={font.xs} weight="600" color={colors.muted}>{merchantName}</T>
        </Pressable>
        <Pressable onPress={copy} hitSlop={8} style={[s.copyBtn, compact && { width: 34, height: 34 }]}>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.primary} />
        </Pressable>
      </View>
      {!compact && (
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
          {copied ? 'Numéro copié ✓ — payez depuis votre app Wave.' : 'Appuyez sur le numéro pour le copier et payez depuis votre app Wave.'}
        </T>
      )}
    </View>
  );
}

// ============================================================
//  Paiement direct via Wave — l'argent ne passe PAS par l'app.
//  On affiche le numéro Wave PERSONNEL du gérant : le client lui
//  transfère le montant depuis sa propre app Wave (frais 1 % côté
//  client, le gérant reçoit la totalité).
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

      <WavePayBox amount={amount} merchant={merchant} merchantName={merchantName} />

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
  infoBoxCompact: { padding: 10, marginTop: 10 },
  merchant: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.sm, padding: 10, borderWidth: 1, borderColor: colors.border },
  copyBtn: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.waveAccent, borderRadius: radius.md, paddingVertical: 13, marginTop: 14 },
  payBtnCompact: { paddingVertical: 10, marginTop: 8 },
});
