import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Btn, Card, SectionTitle, Segmented } from '../../components/ui';
import { Header } from '../../components/Shell';
import { BottomSheet, Dialog, DialogButtons } from '../../components/modals';
import { WavePaySheet, WavePayBox } from '../../components/WavePay';
import { useStore } from '../../store';

const money = (n) => `${(n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} F`;

const TYPES = [
  { key: 'unites', label: 'Unités', icon: 'phone-portrait-outline' },
  { key: 'minutes', label: 'Minutes', icon: 'call-outline' },
  { key: 'internet', label: 'Internet', icon: 'wifi-outline' },
];

const TYPE_LABEL = { unites: 'Unités', minutes: 'Minutes', internet: 'Internet' };

export default function ClientHome() {
  const { state, createDemande, markPaid, cancelDemande, refresh } = useStore();
  // Recharge les gérants dès l'ouverture de l'écran pour afficher le lien
  // Wave marchand ajouté par un gérant (même s'il l'a ajouté après connexion).
  useEffect(() => { refresh(); }, []); // eslint-disable-line
  const [type, setType] = useState('unites');
  const [amount, setAmount] = useState('');
  const [who, setWho] = useState('moi');
  const [benefName, setBenefName] = useState('');
  const [benefPhone, setBenefPhone] = useState('');
  // Gérant sélectionné : soit un contact déjà ajouté (id = contact), soit un
  // gérant inscrit proposé par l'app (userId = compte gérant).
  const [sel, setSel] = useState(null);
  const [showGerants, setShowGerants] = useState(false);
  const [sent, setSent] = useState(false);
  const [lastDemande, setLastDemande] = useState(null);
  const [paying, setPaying] = useState(null);

  const gerant = sel;
  const amountNum = parseInt(amount, 10) || 0;
  // Gérants inscrits proposés = ceux que le client n'a pas encore ajoutés.
  const addedIds = new Set((state.gerants || []).map((g) => g.userId));
  const suggested = (state.availableGerants || []).filter((g) => !g.alreadyAdded && !addedIds.has(g.userId));

  const submit = async () => {
    if (amountNum <= 0) return;
    if (!sel) { setShowGerants(true); return; }
    const payload = {
      gerantId: sel.id || undefined,
      gerantUserId: sel.userId || undefined,
      gerantName: sel.name,
      gerantWave: sel.waveNumber,
      gerantPayLink: sel.payLink || '',
      type,
      amount: amountNum,
      benefName: who === 'autre' ? benefName : (state.user?.name || 'Moi'),
      benefPhone: who === 'autre' ? benefPhone : (state.user?.phone || ''),
    };
    // Affiche la confirmation immédiatement (pas de blocage sur le réseau),
    // puis remplace par la vraie demande dès qu'elle est créée.
    setSent(true);
    // Réinitialise tout le formulaire pour qu'une nouvelle demande soit facile.
    setAmount(''); setWho('moi'); setBenefName(''); setBenefPhone(''); setType('unites'); setSel(null);
    try {
      const created = await createDemande(payload);
      if (created && created.id) setLastDemande(created);
      // Rafraîchit le client (demandes + gérants) pour voir la demande créée.
      refresh();
    } catch { /* garde la confirmation affichée même si l'envoi échoue */ }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Accueil" noPad />
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
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
            <TextInput value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))} placeholder="Ex : 2000" placeholderTextColor={colors.muted2} keyboardType="number-pad" style={s.inputText} />
          </View>

          <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginTop: space.lg, marginBottom: 10 }}>Bénéficiaire</T>
          <Segmented value={who} onChange={setWho} options={[{ value: 'moi', label: 'Pour moi' }, { value: 'autre', label: 'Pour quelqu\'un' }]} />

          {who === 'autre' && (
            <>
              <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginTop: space.lg, marginBottom: 7 }}>Nom du bénéficiaire</T>
              <View style={s.input}><Ionicons name="person-outline" size={18} color={colors.primary} style={{ marginRight: 10 }} /><TextInput value={benefName} onChangeText={setBenefName} placeholder="Ex : Moussa" placeholderTextColor={colors.muted2} style={s.inputText} /></View>
              <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginTop: space.lg, marginBottom: 7 }}>Numéro du bénéficiaire</T>
              <View style={s.input}><Ionicons name="call-outline" size={18} color={colors.primary} style={{ marginRight: 10 }} /><TextInput value={benefPhone} onChangeText={(t) => setBenefPhone(t.replace(/[^0-9]/g, ''))} placeholder="Ex : 07 07 07 07 07" placeholderTextColor={colors.muted2} keyboardType="phone-pad" style={s.inputText} /></View>
            </>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg }}>
            <T size={font.sm} weight="700" color={colors.textSoft}>Gérant</T>
            {gerant && (
              <View style={s.onlineChip}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: gerant.online === false ? colors.muted2 : colors.success, marginRight: 5 }} />
                <T size={font.xs} weight="700" color={gerant.online === false ? colors.muted : colors.success}>{gerant.online === false ? 'Hors ligne' : 'En ligne'}</T>
              </View>
            )}
          </View>
          <Pressable onPress={() => setShowGerants(true)} style={[s.input, { marginTop: 8 }]}>
            <View style={s.gerantPick}>
              <Ionicons name="storefront-outline" size={20} color={colors.primary} style={{ marginRight: 10 }} />
              <Text style={[s.inputText, gerant ? { color: colors.text, fontWeight: '700' } : null]} numberOfLines={1}>{gerant ? gerant.name : 'Sélectionner un gérant'}</Text>
              <Ionicons name="chevron-down" size={18} color={colors.muted2} />
            </View>
          </Pressable>

          {/* Lien Wave marchand du gérant, visible dès sa sélection */}
          {gerant && (
            <View style={s.waveInfo}>
              <View style={s.waveTitle}>
                <Ionicons name="water" size={16} color={colors.wave} />
                <T size={font.sm} weight="800" color={colors.wave} style={{ marginLeft: 6 }}>PAIEMENT WAVE DIRECT</T>
              </View>
              <WavePayBox
                amount={amountNum || undefined}
                merchant={gerant.waveNumber}
                merchantName={gerant.name}
                payLink={gerant.payLink || ''}
              />
              <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 10 }}>
                {gerant.payLink
                  ? <>Cliquez sur « Payer avec Wave en ligne » pour payer avant d'envoyer la demande, ou envoyez-la d'abord et payez après que {gerant.name} accepte.</>
                  : <>Appuyez sur le numéro pour le copier et payez dans votre app Wave. Une fois que {gerant.name} aura ajouté son lien marchand, le paiement se fera en un clic.</>}
              </T>
            </View>
          )}

          <Btn title="Envoyer la demande" icon="paper-plane" onPress={submit} style={{ marginTop: space.lg }} />
          <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 10 }}>
            Le gérant vous créditera après votre paiement Wave direct. Aucun argent n'est stocké sur l'app.
          </T>
        </Card>
      </ScrollView>

      {/* Gérant picker */}
      <BottomSheet visible={showGerants} onClose={() => setShowGerants(false)}>
        <View style={s.sheetHandle} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
          <T size={font.h3} weight="800" color={colors.text}>Choisir un gérant</T>
          <Pressable onPress={() => setShowGerants(false)}><Ionicons name="close" size={24} color={colors.muted} /></Pressable>
        </View>

        {/* Gérants déjà inscrits, proposés (sans avoir à les ajouter) */}
        {suggested.length > 0 && (
          <>
            <T size={font.sm} weight="800" color={colors.primary} style={{ marginBottom: 4 }}>Gérants disponibles (déjà inscrits)</T>
            <T size={font.xs} weight="600" color={colors.muted2} style={{ marginBottom: 8 }}>Vous pouvez leur envoyer une demande directement, sans les ajouter.</T>
            {suggested.map((g) => (
              <Pressable key={g.userId} onPress={() => { setSel({ userId: g.userId, name: g.name, phone: g.phone, waveNumber: g.waveNumber, payLink: g.payLink || '', online: true }); setShowGerants(false); }} style={s.gerantRow}>
                <View style={s.availIcon}><Ionicons name="storefront-outline" size={18} color={colors.primary} /></View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <T size={font.body} weight="800" color={colors.text}>{g.name}</T>
                  <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2 }}>{g.phone}</T>
                </View>
                <T size={font.xs} weight="700" color={colors.success}>Disponible</T>
              </Pressable>
            ))}
          </>
        )}

        {/* Gérants déjà ajoutés par le client */}
        {state.gerants.length > 0 && (
          <>
            <T size={font.sm} weight="800" color={colors.text} style={{ marginBottom: 4, marginTop: space.md }}>Mes gérants ajoutés</T>
            {state.gerants.map((g) => {
              const on = sel?.id === g.id;
              return (
                <Pressable key={g.id} onPress={() => { setSel({ id: g.id, userId: g.userId, name: g.name, phone: g.phone, waveNumber: g.waveNumber, payLink: g.payLink || '', online: g.online }); setShowGerants(false); }} style={[s.gerantRow, on && { opacity: 0.7 }]}>
                  <View style={{ flex: 1 }}>
                    <T size={font.body} weight="800" color={colors.text}>{g.name}</T>
                    <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2 }}>{g.phone}</T>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.online ? colors.success : colors.muted2, marginRight: 5 }} />
                    <T size={font.xs} weight="700" color={g.online ? colors.success : colors.muted}>{g.online ? 'En ligne' : 'Hors ligne'}</T>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}

        {suggested.length === 0 && state.gerants.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Ionicons name="storefront-outline" size={36} color={colors.muted2} />
            <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 8, textAlign: 'center' }}>Aucun gérant disponible pour le moment.</T>
          </View>
        )}
        <Btn title="Fermer" outline onPress={() => setShowGerants(false)} style={{ marginTop: space.lg }} />
      </BottomSheet>

      {/* Demande lancée / envoyée */}
      <Dialog visible={sent}>
        <View style={{ alignItems: 'center', paddingVertical: 6 }}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          <T size={font.h3} weight="900" color={colors.text} style={{ marginTop: 12 }}>Demande lancée !</T>
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4, textAlign: 'center' }}>
            Votre demande a bien été envoyée à {lastDemande?.gerantName || gerant?.name}.
          </T>
        </View>

        {/* Récapitulatif de la demande */}
        <View style={s.summary}>
          <View style={s.summaryRow}><T size={font.sm} weight="600" color={colors.muted}>Service</T><T size={font.sm} weight="800" color={colors.text}>{TYPE_LABEL[lastDemande?.type] || TYPES.find((t) => t.key === type)?.label || 'Demande'}</T></View>
          <View style={s.summaryRow}><T size={font.sm} weight="600" color={colors.muted}>Montant</T><T size={font.sm} weight="800" color={colors.text}>{money(lastDemande?.amount || amountNum)}</T></View>
          <View style={s.summaryRow}><T size={font.sm} weight="600" color={colors.muted}>Gérant</T><T size={font.sm} weight="800" color={colors.text}>{lastDemande?.gerantName || gerant?.name}</T></View>
        </View>

        {/* Proposition de paiement immédiat via lien Wave */}
        <T size={font.sm} weight="700" color={colors.wave} style={{ marginTop: space.md, marginBottom: 8 }}>
          PAYEZ MAINTENANT EN CLAIR VIA WAVE
        </T>
        <WavePayBox
          amount={lastDemande?.amount || amountNum}
          merchant={lastDemande?.gerantWave || gerant?.waveNumber}
          merchantName={lastDemande?.gerantName || gerant?.name}
          payLink={lastDemande?.gerantPayLink || gerant?.payLink || ''}
        />

        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <Btn title="Plus tard" outline onPress={() => setSent(false)} style={{ flex: 1 }} />
          <Btn title="J'ai payé" icon="checkmark" onPress={() => { if (lastDemande) markPaid(lastDemande.id); setSent(false); }} style={{ flex: 1 }} />
        </View>
        <Pressable onPress={() => { if (lastDemande) cancelDemande(lastDemande.id); setSent(false); }} style={{ alignItems: 'center', marginTop: 14 }}>
          <T size={font.sm} weight="700" color={colors.danger}>Annuler ma demande</T>
        </Pressable>
        <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 12 }}>
          Vous pouvez aussi payer après que le gérant ait accepté votre demande (dans l'historique).
        </T>
      </Dialog>

      {/* Paiement direct de la demande créée */}
      <WavePaySheet
        visible={!!paying}
        onClose={() => setPaying(null)}
        onConfirm={() => { if (paying) markPaid(paying.id); setPaying(null); }}
        title="Payer via Wave"
        amount={paying?.amount}
        merchant={paying?.gerantWave}
        merchantName={paying?.gerantName}
        payLink={paying?.gerantPayLink || ''}
      />
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: 120, paddingTop: space.md },
  payBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, marginLeft: 8 },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  typeCard: { flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 18, marginHorizontal: 4, borderWidth: 1.6, borderColor: colors.border },
  typeCardOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeIcon: { marginBottom: 8 },
  input: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 14, height: 52 },
  inputText: { flex: 1, fontSize: font.body, color: colors.text, paddingVertical: 0, outlineStyle: 'none' },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.muted2, alignSelf: 'center', marginBottom: 16 },
  gerantRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  gerantPick: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  onlineChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  availIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  waveInfo: { backgroundColor: '#E7F0FE', borderRadius: radius.md, padding: 14, marginTop: space.lg },
  waveTitle: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  summary: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 14, marginTop: space.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
});
