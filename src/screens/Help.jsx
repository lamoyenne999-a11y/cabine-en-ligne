import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T, Card, Btn } from '../components/ui';
import { Page } from '../components/Shell';
import { PLATFORM_WAVE, PLATFORM_NAME, PLATFORM_PAY_LINK } from '../components/WavePay';
import InstallGuide from '../components/InstallGuide';
import { useStore } from '../store';

const STEPS = [
  { icon: 'create-outline', title: '1. Faites une demande', text: "Choisissez Unités, Minutes, Internet ou Appel + Internet, le montant et le gérant de votre choix." },
  { icon: 'water-outline', title: '2. Payez le gérant en direct', text: 'Le gérant accepte votre demande. Vous transférez le montant à son numéro Wave personnel depuis votre app Wave (frais Wave sur votre compte : 5 F jusqu\'à 500 F, puis 1 % par tranche de 500 F — le gérant reçoit la totalité). Aucun argent ne passe par l\'app.' },
  { icon: 'checkmark-done-outline', title: '3. Le gérant vous sert', text: 'Une fois payé, le gérant crédite le numéro indiqué. Vous suivez tout dans votre Historique.' },
];

// Étapes côté gérant (le parcours vu de la cabine).
const STEPS_GERANT = [
  { icon: 'notifications-outline', title: '1. Une demande arrive', text: 'Vous recevez une notification avec le type (Unités, Minutes, Internet…), le montant et le numéro à créditer. Touchez « Accepter » si vous pouvez servir, sinon « Indisponible » avec le motif.' },
  { icon: 'water-outline', title: '2. Le client vous paie sur Wave', text: 'Le client transfère le montant sur votre numéro Wave (ou votre lien Wave Business). Vérifiez la réception dans votre app Wave, puis touchez « Argent reçu ✓ ».' },
  { icon: 'checkmark-done-outline', title: '3. Vous créditez, puis « J\'ai servi »', text: 'Créditez le numéro indiqué, puis touchez « J\'ai servi le client ✓ ». Le client confirme de son côté (« Oui, bien reçu »). En cas de problème, chacun peut signaler un souci, même après.' },
];

// Conseils pour bien utiliser l'app et éviter les mauvaises surprises.
const GUIDE_CLIENT = [
  { icon: 'person-circle-outline', title: 'Choisissez un gérant que vous connaissez', text: 'Faites vos demandes de préférence chez le gérant de votre quartier, celui que vous voyez tous les jours, ou chez la Cabine officielle. Son nom et son numéro sont affichés : si vous ne le connaissez pas, appelez-le avant votre première demande.' },
  { icon: 'ribbon-outline', title: 'Fiez-vous aux badges et aux avis', text: '« Cabine officielle » = gérée par Cabine En Ligne. « Certifié » = identité vérifiée par nous. Les étoiles et le nombre de demandes servies vous indiquent la fiabilité du gérant.' },
  { icon: 'time-outline', title: 'Payez seulement après « Acceptée »', text: 'N\'envoyez jamais d\'argent avant que le gérant ait accepté votre demande. Une fois acceptée, payez exactement le montant demandé, au numéro Wave affiché dans l\'app (pas à un autre numéro reçu par message).' },
  { icon: 'receipt-outline', title: 'Gardez votre reçu Wave', text: 'Après le transfert, touchez « J\'ai payé (Wave) » dans l\'app et conservez la capture du reçu Wave : c\'est votre preuve si quelque chose se passe mal.' },
  { icon: 'alert-circle-outline', title: 'Un souci ? Signalez-le dans l\'app', text: 'Rien reçu, montant incomplet, gérant qui ne répond plus : touchez « Un souci ? » sur la demande dans votre Historique (ou « Demander remboursement » si vous avez déjà payé). Le gérant et le propriétaire sont prévenus.' },
  { icon: 'cash-outline', title: 'Montants : à partir de 100 F, par palier de 50 F', text: 'Exemples : 100, 150, 200, 500, 1 000 F. Les frais Wave (5 F jusqu\'à 500 F, puis 1 % par tranche de 500 F) sont à votre charge.' },
];
const GUIDE_GERANT = [
  { icon: 'shield-checkmark-outline', title: 'Vérifiez l\'argent AVANT de servir', text: 'Ouvrez votre app Wave et vérifiez le transfert reçu : montant exact, nom et numéro de l\'expéditeur, heure. Ne vous fiez ni à une capture d\'écran envoyée par message, ni à la parole du client : seule votre propre app Wave fait foi.' },
  { icon: 'hand-left-outline', title: 'Ne touchez « Argent reçu » que si c\'est vrai', text: 'Ce bouton engage votre responsabilité : il indique au client que vous avez bien été payé. Rien reçu ? Touchez « Pas reçu ✗ » : le client est relancé automatiquement. Montant incomplet ? « Montant incomplet » : le manquant lui est indiqué.' },
  { icon: 'people-outline', title: 'Servir avant paiement : uniquement des clients connus', text: 'Vous pouvez servir d\'abord et être payé ensuite, mais réservez cela à vos clients habituels. Pour un nouveau client, attendez le transfert Wave. Utilisez alors « J\'ai servi (sans attendre le paiement) », puis « Argent reçu ✓ » dès que le transfert arrive.' },
  { icon: 'phone-portrait-outline', title: 'Créditez exactement le numéro indiqué', text: 'Le numéro bénéficiaire est affiché sur la demande (il peut être différent de celui du client). Recopiez-le soigneusement ; en cas de doute, appelez le client depuis l\'app avant de créditer.' },
  { icon: 'radio-outline', title: 'Restez joignable et à jour', text: 'Activez les notifications, répondez vite aux demandes (le client voit votre délai). Plus de stock ou de réseau ? Utilisez « Indisponible » avec le motif plutôt que de laisser attendre : votre note en dépend.' },
  { icon: 'link-outline', title: 'Lien Wave Business : plus simple pour vos clients', text: 'Si vous avez un compte Wave Business, ajoutez votre lien dans Profil : le client paie en un clic, le montant est prérempli, et vous recevez la totalité (les frais restent à sa charge).' },
];
const FAQ = [
  { q: 'L\'argent passe-t-il par Cabine En Ligne ?', a: 'Non, jamais. Le client paie directement le gérant sur Wave. L\'app sert à passer la demande, suivre son état et garder une trace.' },
  { q: 'Le gérant dit qu\'il n\'a rien reçu alors que j\'ai payé.', a: 'Vérifiez sur votre reçu Wave le numéro destinataire et le montant. S\'ils sont corrects, montrez le reçu au gérant (appel depuis l\'app) et, si besoin, touchez « Un souci ? » dans l\'Historique : le propriétaire peut intervenir.' },
  { q: 'Que se passe-t-il à la fin de l\'essai gratuit ?', a: 'Un client ne peut plus envoyer de demandes et un gérant n\'en reçoit plus, jusqu\'à l\'abonnement (100 F / mois). Votre historique et vos contacts sont conservés.' },
  { q: 'Comment créer mon code de parrainage ?', a: 'Les gérants le créent librement depuis « Mes parrainages ». Les clients y ont accès après avoir payé au moins 1 mois d\'abonnement. Vous gagnez une commission sur chaque abonnement payé par vos invités.' },
  { q: 'Je me suis trompé(e) de montant ou de numéro.', a: 'Tant que la demande n\'est pas acceptée, annulez-la et refaites-en une. Si elle est déjà acceptée, appelez le gérant depuis l\'app avant de payer.' },
];

function Accordion({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ marginTop: space.lg }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={s.accHead} accessibilityRole="button">
        <View style={s.stepIcon}><Ionicons name={icon} size={20} color={colors.primary} /></View>
        <T size={font.h3} weight="800" color={colors.text} style={{ flex: 1, marginLeft: 12 }}>{title}</T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
      </Pressable>
      {open ? children : null}
    </Card>
  );
}

export default function Help({ onBack }) {
  const { state } = useStore();
  const isGerant = state.role === 'gerant';
  const steps = isGerant ? STEPS_GERANT : STEPS;
  const guide = isGerant ? GUIDE_GERANT : GUIDE_CLIENT;
  const subOffer = state.role === 'gerant'
    ? '100 FCFA / mois (ou 1000 FCFA / an) après 3 mois d\'essai gratuit — tarif de lancement'
    : '100 FCFA / mois (ou 1000 FCFA / an) après 1 mois d\'essai gratuit';
  const openPay = () => { if (PLATFORM_PAY_LINK) Linking.openURL(PLATFORM_PAY_LINK).catch(() => {}); };
  const call = () => { if (PLATFORM_WAVE) Linking.openURL(`tel:${PLATFORM_WAVE}`).catch(() => {}); };

  return (
    <Page title="Aide & Support" onBack={onBack}>
      <Card>
        <View style={s.heroIcon}><Ionicons name="help-circle" size={30} color={colors.primary} /></View>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: 10, textAlign: 'center' }}>Comment ça marche ?</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4, textAlign: 'center' }}>Simplifié, sécurisé, zéro argent stocké.</T>
        {steps.map((st) => (
          <View key={st.title} style={s.step}>
            <View style={s.stepIcon}><Ionicons name={st.icon} size={20} color={colors.primary} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T size={font.body} weight="800" color={colors.text}>{st.title}</T>
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2 }}>{st.text}</T>
            </View>
          </View>
        ))}

        {/* Notice d'installation (Android + iPhone) — ajoutée dans « Comment ça marche » */}
        <InstallGuide />
      </Card>

      {/* Bien utiliser l'app : conseils de sécurité selon le rôle */}
      <Accordion title={isGerant ? 'Bien travailler avec l\'app (gérant)' : 'Bien utiliser l\'app (client)'} icon="bulb-outline" defaultOpen>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 8 }}>
          {isGerant
            ? 'Votre règle d\'or : soyez sûr(e) d\'avoir reçu votre argent, avant ou après avoir servi.'
            : 'Votre règle d\'or : sachez toujours chez quel gérant vous faites votre demande.'}
        </T>
        {guide.map((g) => (
          <View key={g.title} style={s.step}>
            <View style={s.tipIcon}><Ionicons name={g.icon} size={18} color={colors.success} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T size={font.body} weight="800" color={colors.text}>{g.title}</T>
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2, lineHeight: 19 }}>{g.text}</T>
            </View>
          </View>
        ))}
      </Accordion>

      <Accordion title="Questions fréquentes" icon="chatbubbles-outline">
        {FAQ.map((f) => (
          <View key={f.q} style={{ marginTop: space.md }}>
            <T size={font.body} weight="800" color={colors.text}>{f.q}</T>
            <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2, lineHeight: 19 }}>{f.a}</T>
          </View>
        ))}
      </Accordion>

      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 4 }}>Abonnement</T>
        <T size={font.sm} weight="600" color={colors.muted}>
          {subOffer}. Payez via votre app Wave au numéro ci-dessous, ou en ligne via le lien du compte marchand.
        </T>
        <View style={s.payRow}>
          <View style={s.payIcon}><Ionicons name="water" size={20} color={colors.wave} /></View>
          <View style={{ flex: 1 }}>
            <T size={font.xs} weight="600" color={colors.muted}>Wave marchand {PLATFORM_NAME}</T>
            <T size={font.h3} weight="800" color={colors.wave}>{PLATFORM_WAVE}</T>
          </View>
          <Pressable onPress={openPay} style={s.openBtn}>
            <T size={font.xs} weight="800" color="#fff">Payer</T>
          </Pressable>
        </View>
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: space.md }}>Support</T>
        <View style={s.contactRow}>
          <Ionicons name="call-outline" size={18} color={colors.primary} />
          <View style={{ marginLeft: 12 }}>
            <T size={font.xs} weight="600" color={colors.muted}>Assistance (appel / WhatsApp)</T>
            <T size={font.body} weight="800" color={colors.text}>{PLATFORM_WAVE}</T>
          </View>
        </View>
        <Btn title="Appeler le support" icon="call" onPress={call} style={{ marginTop: space.md }} />
      </Card>

      <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: space.lg, marginBottom: 20 }}>
        Cabine En Ligne ne stocke jamais votre argent : les paiements se font en direct via Wave.
      </T>
    </Page>
  );
}

const s = StyleSheet.create({
  heroIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginTop: space.lg },
  stepIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  tipIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  accHead: { flexDirection: 'row', alignItems: 'center' },
  payRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.md, backgroundColor: '#E7F0FE', borderRadius: radius.md, padding: 12 },
  payIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  openBtn: { backgroundColor: colors.waveAccent, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, marginLeft: 8 },
  contactRow: { flexDirection: 'row', alignItems: 'center' },
});
