import React, { useState } from 'react';
import { waveFee } from '../wave';
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
//  Boîte d'information « paiement Wave » réutilisable. Deux modes :
//   - mode 'number' (DÉFAUT) : paiement des DEMANDES — le client
//     transfère le montant au numéro Wave PERSONNEL du gérant.
//   - mode 'link' : paiement de l'ABONNEMENT — ouvre le lien du
//     compte marchand Wave de la PLATEFORME (PLATFORM_PAY_LINK).
// ============================================================
// Un lien marchand Wave valide commence par https:// et contient un "m/" (URL d'une
// page de paiement Wave). S'il est absent/invalide, on fait un repli fiable (copie du numéro).
export function isValidPayLink(link) {
  return !!link && /^https:\/\/[^\s]+\/m\//i.test(String(link).trim());
}
// Lien Wave Business avec le montant pré-rempli (?amount=). Le client n'a plus qu'à
// confirmer avec son code secret dans Wave.
export function payLinkWithAmount(link, amount) {
  const base = String(link || '').trim().split('?')[0];
  const n = Math.round(Number(amount) || 0);
  return n > 0 ? `${base}${base.endsWith('/') ? '' : '/'}?amount=${n}` : base;
}
function openLink(url) {
  if (typeof window !== 'undefined' && window.open) window.open(url, '_blank', 'noopener');
  else if (typeof Linking !== 'undefined') Linking.openURL(url).catch(() => {});
}

export function WavePayBox({ amount, merchant, merchantName, payLink, mode = 'number', compact, includeFees = true }) {
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
  // frais Wave (5 F jusqu'à 500 F, puis 1 % par tranche de 500 F) sont prélevés sur LE compte du client ; le gérant reçoit la
  // TOTALITÉ du montant (contrairement au lien marchand, qui prélève 1 % sur le gérant).
  // mode 'link' : ouverture du lien de paiement marchand (utilisé pour l'abonnement).
  // Un lien Wave Business valide est TOUJOURS prioritaire (plateforme ou gérant) :
  // paiement en un clic, montant pré-rempli, pas de frais côté client (Wave prélève
  // ~1 % sur le compte marchand du gérant). Sinon : transfert au numéro (frais client).
  const hasLink = isValidPayLink(payLink);
  const pay = () => {
    if (hasLink) {
      openLink(mode === 'link' ? String(payLink).trim() : payLinkWithAmount(payLink, amount));
      setJustOpened(true);
      setTimeout(() => setJustOpened(false), 2500);
      return;
    }
    // Par défaut (et repli) : copier le numéro pour un transfert direct.
    copy();
  };
  if (!merchant && !hasLink) return null;
  const fmtN = (n) => (n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
  const amt = fmtN(amount);
  // Frais Wave à la charge du client (barème réel, voir src/wave.js) : on affiche le TOTAL à envoyer pour
  // que le gérant reçoive bien le montant exact de la demande.
  const fees = mode === 'number' && !hasLink && includeFees && amount ? waveFee(amount) : 0;
  const total = (amount || 0) + fees;
  const btnLabel = amount ? `Payer ${fees ? fmtN(total) : amt} FCFA par Wave` : 'Payer par Wave';

  return (
    <View style={[s.infoBox, compact && s.infoBoxCompact]}>
      {/* Bouton bleu "payer" : copie le numéro (transfert direct) ou ouvre le lien (abonnement). */}
      <Pressable onPress={pay} style={[s.payLinkBtn, compact && s.payLinkBtnCompact]}>
        <Ionicons name="water" size={compact ? 18 : 20} color="#fff" style={{ marginRight: 8 }} />
        <T size={compact ? font.sm : font.body} weight="800" color="#fff">{btnLabel}</T>
      </Pressable>
      {hasLink ? (
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
          {justOpened ? 'Wave ouvert ✓ — confirmez le paiement, puis revenez appuyer sur « J\'ai payé ».' : mode === 'link' ? 'Ouvre le lien de paiement Wave. Aucun argent ne passe par l\'app.' : `Ouvre Wave avec ${amt} F déjà renseignés — aucun frais pour vous. Ou par transfert au numéro ci-dessous (dans ce cas, frais Wave à votre charge${amount && waveFee(amount) ? ` : envoyez ${fmtN((amount || 0) + waveFee(amount))} F` : ''}) :`}
        </T>
      ) : (
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
          {compact
            ? (fees ? `${amt} F + ${fmtN(fees)} F de frais Wave — envoyez ${fmtN(total)} F à ce numéro depuis votre app Wave :` : 'Copiez le numéro et payez depuis votre app Wave :')
            : (fees
              ? `Envoyez ${fmtN(total)} F au numéro ci-dessous depuis votre app Wave : ${amt} F + ${fmtN(fees)} F de frais Wave. Ainsi ${merchantName || 'le gérant'} reçoit bien ${amt} F.`
              : `Transférez ${amount ? `${amt} F` : 'le montant'} au numéro ci-dessous depuis votre app Wave.`)}
        </T>
      )}

      {/* Numéro du gérant (toujours visible, copiable) */}
      {merchant ? <View style={[s.merchant, { marginTop: compact ? 8 : 12 }]}>
        <Ionicons name="storefront" size={compact ? 16 : 18} color={colors.primary} style={{ marginRight: 8 }} />
        <Pressable onPress={copy} style={{ flex: 1 }}>
          <T size={font.body} weight="800" color={colors.text}>{merchant}</T>
          <T size={font.xs} weight="600" color={colors.muted}>{merchantName}</T>
        </Pressable>
        <Pressable onPress={copy} hitSlop={8} style={[s.copyBtn, compact && { width: 34, height: 34 }]}>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.primary} />
        </Pressable>
      </View> : null}
      {!compact && !hasLink && (
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
          {copied ? 'Numéro copié ✓ — payez depuis votre app Wave.' : 'Appuyez sur le numéro pour le copier et payez depuis votre app Wave.'}
        </T>
      )}
    </View>
  );
}

// ============================================================
//  Paiement via Wave — l'argent ne passe PAS par l'app.
//  - Demandes (mode 'number') : affiche le numéro Wave PERSONNEL
//    du gérant ; le client lui transfère le montant (frais Wave
//    côté client, le gérant reçoit la totalité).
//  - Abonnement (mode 'link') : ouvre le lien du compte marchand
//    Wave de la plateforme (pas de frais sur le gérant ici).
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
