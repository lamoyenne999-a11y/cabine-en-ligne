import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T } from './ui';
import { Dialog, DialogButtons } from './modals';

// Adresse Wave marchand de la plateforme (pour les abonnements).
export const PLATFORM_WAVE = '0788281933';
export const PLATFORM_NAME = 'Cabine En Ligne';
// Lien du compte marchand Wave sur lequel on peut payer l'abonnement.
export const PLATFORM_PAY_LINK = 'https://pay.wave.com/m/M_ci_jUXE1N_gWG8_/c/ci/';

// ============================================================
//  Boîte d'information « paiement Wave » réutilisable.
//  Affiche le numéro Wave marchand (copiable) + le lien de
//  paiement cliquable si le gérant en a fourni un. Utilisée dans
//  la confirmation de demande, l'historique et les profils.
// ============================================================
// Un lien marchand Wave valide commence par https:// et contient un "m/" (URL d'une
// page de paiement Wave). S'il est absent/invalide, on fait un repli fiable (copie du numéro).
export function isValidPayLink(link) {
  return !!link && /^https:\/\/[^\s]+\/m\//i.test(String(link).trim());
}

export function WavePayBox({ amount, merchant, merchantName, payLink, mode = 'number', compact }) {
  const [copied, setCopied] = useState(false);
  const [justOpened, setJustOpened] = useState(false);
  const copy = () => {
    if (merchant && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(merchant).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  // mode 'number' (défaut) : paiement des DEMANDES par numéro. Le client copie le
  // numéro Wave du gérant et lui transfère le montant depuis son app Wave. Les
  // frais Wave (1 %) sont prélevés sur LE compte du client ; le gérant reçoit la
  // TOTALITÉ du montant (contrairement au lien marchand, qui prélève 1 % sur le gérant).
  // mode 'link' : ouverture du lien de paiement marchand (utilisé pour l'abonnement).
  const pay = () => {
    if (mode === 'link') {
      const link = String(payLink || '').trim();
      if (isValidPayLink(link)) {
        if (typeof window !== 'undefined' && window.open) {
          window.open(link, '_blank', 'noopener');
        } else if (typeof Linking !== 'undefined') {
          Linking.openURL(link).catch(() => {});
        }
        setJustOpened(true);
        setTimeout(() => setJustOpened(false), 2500);
        return;
      }
    }
    // Par défaut (et repli) : copier le numéro pour un transfert direct.
    copy();
  };
  if (!merchant) return null;
  const hasLink = mode === 'link' && isValidPayLink(payLink);
  const amt = (amount || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
  const btnLabel = amount ? `Payer ${amt} FCFA par Wave` : 'Payer par Wave';

  return (
    <View style={[s.infoBox, compact && s.infoBoxCompact]}>
      {/* Bouton bleu "payer" : copie le numéro (transfert direct) ou ouvre le lien (abonnement). */}
      <Pressable onPress={pay} style={[s.payLinkBtn, compact && s.payLinkBtnCompact]}>
        <Ionicons name="water" size={compact ? 18 : 20} color="#fff" style={{ marginRight: 8 }} />
        <T size={compact ? font.sm : font.body} weight="800" color="#fff">{btnLabel}</T>
      </Pressable>
      {hasLink ? (
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
          Ouvre le lien de paiement Wave. Aucun argent ne passe par l'app.
        </T>
      ) : (
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
          {compact
            ? 'Frais Wave (1 %) côté client. Copiez le numéro et payez depuis votre app Wave.'
            : `Transférez ${amount ? `${amt} F` : 'le montant'} au numéro ci-dessous depuis votre app Wave. Les frais Wave (1 %) sont prélevés sur votre compte — ${merchantName} reçoit la totalité.`}
        </T>
      )}

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
//  On affiche simplement le numéro Wave (marchand) auquel le
//  client doit envoyer l'argent depuis sa propre app Wave.
//  Si un lien de paiement Wave est fourni (payLink), on propose
//  aussi d'ouvrir le compte marchand directement.
// ============================================================
export function WavePaySheet({ visible, onClose, onConfirm, title, amount, merchant, merchantName, subtitle, payLink, mode = 'number' }) {
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

      <WavePayBox amount={amount} merchant={merchant} merchantName={merchantName} payLink={payLink} mode={mode} />

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
  payLinkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.waveAccent, borderRadius: radius.md, paddingVertical: 13, marginTop: 14 },
  payLinkBtnCompact: { paddingVertical: 10, marginTop: 8 },
});
