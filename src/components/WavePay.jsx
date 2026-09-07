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

export function WavePayBox({ amount, merchant, merchantName, payLink }) {
  const [copied, setCopied] = useState(false);
  const [justOpened, setJustOpened] = useState(false);
  const copy = () => {
    if (merchant && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(merchant).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  // Toujours proposer le paiement. Si un lien marchand valide existe, on l'ouvre dans
  // un NOUVEL onglet web (l'app reste intacte). Sinon, on copie le numéro et on guide.
  const pay = () => {
    const link = String(payLink || '').trim();
    if (isValidPayLink(link)) {
      if (typeof window !== 'undefined' && window.open) {
        window.open(link, '_blank', 'noopener');
      } else if (typeof Linking !== 'undefined') {
        Linking.openURL(link).catch(() => {});
      }
      setJustOpened(true);
      setTimeout(() => setJustOpened(false), 2500);
    } else {
      // Pas de lien marchand → on copie le numéro (100 % fiable) et on guide vers l'app.
      copy();
    }
  };
  if (!merchant) return null;
  const hasLink = isValidPayLink(payLink);
  const amt = (amount || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ');

  return (
    <View style={s.infoBox}>
      {/* Bouton bleu "payer" : toujours présent. Ouvre Wave (lien) ou copie le numéro. */}
      <Pressable onPress={pay} style={s.payLinkBtn}>
        <Ionicons name="water" size={20} color="#fff" style={{ marginRight: 8 }} />
        <T size={font.body} weight="800" color="#fff">
          {amount ? `Payer ${amt} FCFA avec Wave` : 'Payer avec Wave'}
        </T>
      </Pressable>
      <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
        {hasLink
          ? 'Ouvre le lien Wave du gérant pour le régler en un clic. Aucun argent ne passe par l\'app.'
          : 'Numéro copié — ouvrez votre app Wave et envoyez le montant à ce numéro.'}
      </T>

      {/* Numéro du gérant (toujours visible, copiable) — secours si le lien ne s'ouvre pas */}
      <View style={[s.merchant, { marginTop: 12 }]}>
        <Ionicons name="storefront" size={18} color={colors.primary} style={{ marginRight: 8 }} />
        <Pressable onPress={copy} style={{ flex: 1 }}>
          <T size={font.body} weight="800" color={colors.text}>{merchant}</T>
          <T size={font.xs} weight="600" color={colors.muted}>{merchantName}</T>
        </Pressable>
        <Pressable onPress={copy} hitSlop={8} style={s.copyBtn}>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.primary} />
        </Pressable>
      </View>
      <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
        {copied ? 'Numéro copié ✓' : 'Appuyez sur le numéro pour le copier et payez dans votre app Wave.'}
      </T>
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
export function WavePaySheet({ visible, onClose, onConfirm, title, amount, merchant, merchantName, subtitle, payLink }) {
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

      <WavePayBox amount={amount} merchant={merchant} merchantName={merchantName} payLink={payLink} />

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
  copyBtn: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  payLinkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.waveAccent, borderRadius: radius.md, paddingVertical: 13, marginTop: 14 },
});
