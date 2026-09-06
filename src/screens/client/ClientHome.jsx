import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, shadow } from '../../theme';
import { T, Btn, Card, SectionTitle, Segmented } from '../../components/ui';
import { Header } from '../../components/Shell';
import { BottomSheet, Dialog, DialogButtons, WaveModal } from '../../components/modals';
import { useStore } from '../../store';

const TYPES = [
  { key: 'unites', label: 'Unités', icon: 'phone-portrait-outline' },
  { key: 'minutes', label: 'Minutes', icon: 'call-outline' },
  { key: 'internet', label: 'Internet', icon: 'wifi-outline' },
];

export default function ClientHome() {
  const { state, sendDemande, subscribe } = useStore();
  const [type, setType] = useState('unites');
  const [amount, setAmount] = useState('');
  const [who, setWho] = useState('moi');
  const [benefPhone, setBenefPhone] = useState('');
  const [gerantId, setGerantId] = useState(null);

  const [showGerants, setShowGerants] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | searching | pay | sent | sub

  const gerant = state.gerants.find((g) => g.id === gerantId);
  const sub = state.activeSubscription;
  const amountNum = parseInt(amount, 10) || 0;
  const displayPhone = who === 'autre' ? benefPhone : (state.user?.phone || '');

  const handleSendDemande = () => {
    if (amountNum <= 0) return;
    if (!gerantId) { setShowGerants(true); return; }
    setPhase('searching');
    setTimeout(() => setPhase('pay'), 1700);
  };

  const resetForm = () => {
    setAmount('');
    setWho('moi');
    setBenefPhone('');
    setPhase('idle');
  };

  const onWaveSuccess = () => {
    sendDemande({ type, amount: amountNum, beneficiary: displayPhone, gerantId });
    setPhase('sent');
    resetForm();
  };

  const paySubscription = () => setPhase('sub');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Accueil" noPad />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Active subscription banner */}
        <Card style={s.subBanner}>
          {sub ? (
            <>
              <View style={s.subIcon}>
                <Ionicons name="sparkles" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T size={font.xs} weight="700" color={colors.primary}>ABONNEMENT ACTIF</T>
                <T size={font.h3} weight="800" color={colors.text}>{sub.name}</T>
                <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>
                  {state.hideBalance ? '• • • • XOF' : sub.amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ') + ' XOF'} · renouvelé le {sub.renews}
                </T>
              </View>
              <Pressable onPress={paySubscription} style={s.payBtn}>
                <T size={font.xs} weight="800" color="#fff">Payer</T>
              </Pressable>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <View>
                <T size={font.h3} weight="800" color={colors.text}>Aucun abonnement</T>
                <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>Choisissez un forfait</T>
              </View>
              <Pressable onPress={paySubscription} style={s.payBtn}>
                <T size={font.xs} weight="800" color="#fff">S'abonner</T>
              </Pressable>
            </View>
          )}
        </Card>

        <SectionTitle style={{ marginTop: 4 }}>Nouvelle demande</SectionTitle>

        {/* Type selector */}
        <View style={s.typeRow}>
          {TYPES.map((t) => {
            const on = type === t.key;
            return (
              <Pressable key={t.key} onPress={() => setType(t.key)} style={[s.typeCard, on && s.typeCardOn]}>
                <View style={[s.typeIcon, on && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Ionicons name={t.icon} size={24} color={on ? '#fff' : colors.primary} />
                </View>
                <T size={font.sm} weight="700" color={on ? '#fff' : colors.text}>{t.label}</T>
              </Pressable>
            );
          })}
        </View>

        {/* Form */}
        <Card style={{ marginTop: space.lg }}>
          <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginBottom: 7 }}>Montant (XOF)</T>
          <View style={s.input}>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
              placeholder="Ex: 5000"
              placeholderTextColor={colors.muted2}
              keyboardType="number-pad"
              style={s.inputText}
            />
          </View>

          <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginTop: space.lg, marginBottom: 10 }}>
            Bénéficiaire
          </T>
          <Segmented
            value={who}
            onChange={setWho}
            options={[
              { value: 'moi', label: 'Pour moi' },
              { value: 'autre', label: "Pour quelqu'un" },
            ]}
          />

          {who === 'autre' && (
            <>
              <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginTop: space.lg, marginBottom: 7 }}>
                Numéro du bénéficiaire
              </T>
              <View style={s.input}>
                <Ionicons name="call-outline" size={18} color={colors.primary} style={{ marginRight: 10 }} />
                <TextInput
                  value={benefPhone}
                  onChangeText={(t) => setBenefPhone(t.replace(/[^0-9]/g, ''))}
                  placeholder="Ex: 77 123 45 67"
                  placeholderTextColor={colors.muted2}
                  keyboardType="phone-pad"
                  style={s.inputText}
                />
              </View>
            </>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg }}>
            <T size={font.sm} weight="700" color={colors.textSoft}>Choisir un gérant</T>
            {gerant ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 5 }} />
                <T size={font.xs} weight="700" color={colors.success}>En ligne</T>
              </View>
            ) : null}
          </View>
          <Pressable onPress={() => setShowGerants(true)} style={[s.input, { marginTop: 8 }]}>
            <View style={s.gerantPick}>
              <Ionicons name={gerant ? 'storefront' : 'people-outline'} size={20} color={colors.primary} style={{ marginRight: 10 }} />
              <Text style={[s.inputText, gerant ? { color: colors.text, fontWeight: '700' } : null]} numberOfLines={1}>
                {gerant ? `${gerant.name}` : 'Sélectionner un gérant'}
              </Text>
              {gerant ? <T size={font.xs} weight="600" color={colors.muted2} style={{ marginHorizontal: 8 }}>{gerant.phone}</T> : null}
              <Ionicons name="chevron-down" size={18} color={colors.muted2} />
            </View>
          </Pressable>

          <Btn
            title="Envoyer la demande"
            icon="paper-plane"
            onPress={handleSendDemande}
            style={{ marginTop: space.lg }}
          />
          <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 10 }}>
            Le gérant vous créditera via la demande. Paiement direct via Wave.
          </T>
        </Card>
      </ScrollView>

      {/* Gérant picker sheet */}
      <BottomSheet visible={showGerants} onClose={() => setShowGerants(false)}>
        <View style={s.sheetHandle} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
          <T size={font.h3} weight="800" color={colors.text}>Choisir un gérant</T>
          <Pressable onPress={() => setShowGerants(false)}>
            <Ionicons name="close" size={24} color={colors.muted} />
          </Pressable>
        </View>
        {state.gerants.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => { setGerantId(g.id); setShowGerants(false); }}
            style={[s.gerantRow, gerantId === g.id && s.gerantRowOn]}
          >
            <View style={{ flex: 1 }}>
              <T size={font.body} weight="800" color={colors.text}>{g.name}</T>
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2 }}>{g.phone}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Ionicons name="star" size={13} color={colors.warn} />
                <T size={font.xs} weight="700" color={colors.warn} style={{ marginLeft: 3 }}>{g.rating}</T>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.online ? colors.success : colors.muted2, marginRight: 5 }} />
              <T size={font.xs} weight="700" color={g.online ? colors.success : colors.muted}>{g.online ? 'En ligne' : 'Hors ligne'}</T>
            </View>
          </Pressable>
        ))}
        <Btn title="Valider" onPress={() => setShowGerants(false)} style={{ marginTop: space.lg }} />
      </BottomSheet>

      {/* Searching overlay */}
      <Dialog visible={phase === 'searching'}>
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: 18 }}>Recherche de gérants…</T>
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 6, textAlign: 'center' }}>
            Votre demande est en cours de traitement
          </T>
        </View>
      </Dialog>

      {/* Sent success dialog */}
      <Dialog visible={phase === 'sent'}>
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: 14 }}>Demande envoyée !</T>
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 6, textAlign: 'center' }}>
            Votre demande a été transférée à {gerant?.name || 'un gérant'}. Suivez son traitement dans l'historique.
          </T>
        </View>
        <DialogButtons confirm="OK" onConfirm={() => setPhase('idle')} />
      </Dialog>

      {/* Wave direct payment to gérant */}
      <WaveModal
        visible={phase === 'pay'}
        onClose={() => setPhase('idle')}
        onSuccess={onWaveSuccess}
        title="Paiement au gérant"
        amount={amountNum}
        recipient={gerant?.name}
        recipientDetail={gerant?.phone}
      />

      {/* Wave subscription payment */}
      <WaveModal
        visible={phase === 'sub'}
        onClose={() => setPhase('idle')}
        onSuccess={() => {
          subscribe({ plan: sub?.plan || 'minutes', name: sub?.name || 'Forfait Minutes', amount: sub?.amount || 3000, renews: '14/10/2026' });
          setPhase('idle');
        }}
        title="Abonnement"
        amount={sub?.amount || 3000}
        recipient="Cabine En Ligne"
        recipientDetail="Compte abonnement"
      />
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: 120, paddingTop: space.md },
  subBanner: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xl, padding: space.md },
  subIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  payBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: radius.pill, marginLeft: 8,
  },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  typeCard: {
    flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md,
    paddingVertical: 18, marginHorizontal: 4, borderWidth: 1.6, borderColor: colors.border,
  },
  typeCardOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeIcon: { marginBottom: 8 },
  input: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg,
    borderRadius: radius.md, paddingHorizontal: 14, height: 52,
  },
  inputText: { flex: 1, fontSize: font.body, color: colors.text, paddingVertical: 0, outlineStyle: 'none' },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.muted2, alignSelf: 'center', marginBottom: 16 },
  gerantRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  gerantRowOn: { opacity: 0.7 },
  gerantPick: { flexDirection: 'row', alignItems: 'center', flex: 1 },
});
