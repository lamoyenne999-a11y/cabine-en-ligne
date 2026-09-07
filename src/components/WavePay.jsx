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
// page de paiement Wave). On ne montre le bouton "Payer avec Wave" que si c'est le cas,
// sinon on ne propose que le numéro à copier (fiable à 100 %).
function isValidPayLink(link) {
  return !!link && /^https:\/\/[^\s]+\/m\//i.test(String(link).trim());
}

export function WavePayBox({ amount, merchant, merchantName, payLink }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (merchant && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(merchant).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  // Ouvre le lien de paiement sans casser l'app.
  // Sur le web (PWA), on ouvre dans un NOUVEL ONGLET (sinon Linking.openURL navigue la
  // page courante → l'utilisateur est renvoyé à l'accueil et la demande est "perdue").
  const openLink = () => {
    if (!isValidPayLink(payLink)) return;
    const url = String(payLink).trim();
    // Web : nouvel onglet (window.open). Natif : Linking.openURL.
    if (typeof window !== 'undefined' && window.open) {
      window.open(url, '_blank', 'noopener');
    } else if (typeof Linking !== 'undefined') {
      Linking.openURL(url).catch(() => {});
    }
  };
  if (!merchant) return null;
  const hasLink = isValidPayLink(payLink);
  const amt = (amount || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ');

  // Avec un lien Wave marchand : on pousse le CTA de paiement en 1 clic,
  // comme pour l'abonnement — le client est redirigé vers l'app Wave.
  if (hasLink) {
    return (
      <View style={s.infoBox}>
        <Pressable onPress={openLink} style={s.payLinkBtn}>
          <Ionicons name="water" size={20} color="#fff" style={{ marginRight: 8 }} />
          <T size={font.body} weight="800" color="#fff">
            {amount ? `Payer ${amt} FCFA avec Wave` : 'Payer avec Wave'}
          </T>
        </Pressable>
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
          Ouvre le lien Wave du gérant pour le régler en un clic. Aucun argent ne passe par l'app.
        </T>

        {/* Backup : numéro à copier si le lien ne s'ouvre pas */}
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
          {copied ? 'Numéro copié ✓' : 'Si le lien ne fonctionne pas, copiez ce numéro et payez dans votre app Wave.'}
        </T>
      </View>
    );
  }

  // Sans lien : on affiche le numéro à copier + une aide claire.
  return (
    <View style={s.infoBox}>
      <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginBottom: 4 }}>
        {amount ? `Envoyez ${amt} FCFA au Wave marchand :` : 'Envoyez l\'argent au Wave marchand :'}
      </T>
      <View style={s.merchant}>
        <Ionicons name="storefront" size={18} color={colors.primary} style={{ marginRight: 8 }} />
        <Pressable onPress={copy} style={{ flex: 1 }}>
          <T size={font.body} weight="800" color={colors.text}>{merchant}</T>
          <T size={font.xs} weight="600" color={colors.muted}>{merchantName}</T>
        </Pressable>
        <Pressable onPress={copy} hitSlop={8} style={s.copyBtn}>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.primary} />
        </Pressable>
      </View>
      <T size={font.sm} weight="600" color={copied ? colors.success : colors.muted} style={{ marginTop: 10 }}>
        {copied ? 'Numéro copié — collez-le dans votre app Wave.' : (<>Appuyez sur le numéro pour le copier, puis ouvrez l'app <T size={font.sm} weight="800" color={colors.wave}>Wave</T> et collez-le.</>)}
      </T>
      <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 6 }}>
        Aucun argent n'est stocké sur l'app.
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
