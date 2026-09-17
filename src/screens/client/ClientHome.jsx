import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Btn, Card, SectionTitle, Segmented } from '../../components/ui';
import { Header } from '../../components/Shell';
import { BottomSheet, Dialog, DialogButtons } from '../../components/modals';
import { WavePaySheet, WavePayBox } from '../../components/WavePay';
import { useStore } from '../../store';
import { RatingBadge } from '../../components/Rating';
import SuspendedBanner from '../../components/SuspendedBanner';

const money = (n) => `${(n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} F`;

const TYPES = [
  { key: 'unites', label: 'Unités', icon: 'phone-portrait-outline' },
  { key: 'minutes', label: 'Minutes', icon: 'call-outline' },
  { key: 'internet', label: 'Internet', icon: 'wifi-outline' },
  { key: 'forfait', label: 'Appel + Internet', icon: 'layers-outline' },
];

const TYPE_LABEL = { unites: 'Unités', minutes: 'Minutes', internet: 'Internet', forfait: 'Appel + Internet' };

export default function ClientHome() {
  const { state, createDemande, markPaid, cancelDemande, refresh } = useStore();
  // Recharge les gérants dès l'ouverture de l'écran pour afficher le numéro
  // Wave du gérant à jour (même s'il l'a modifié après connexion).
  useEffect(() => { refresh(); }, []); // eslint-disable-line
  const [type, setType] = useState('unites');
  const [amount, setAmount] = useState('');
  const [who, setWho] = useState('moi');
  const [benefPhone, setBenefPhone] = useState('');
  // Gérant sélectionné : soit un contact déjà ajouté (id = contact), soit un
  // gérant inscrit proposé par l'app (userId = compte gérant).
  const [sel, setSel] = useState(null);
  const [showGerants, setShowGerants] = useState(false);
  const [sent, setSent] = useState(false);
  const [lastDemande, setLastDemande] = useState(null);
  const [paying, setPaying] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');

  const gerant = sel;
  const amountNum = parseInt(amount, 10) || 0;
  // Gérants inscrits proposés = ceux que le client n'a pas encore ajoutés.
  const addedIds = new Set((state.gerants || []).map((g) => g.userId));
  const suggested = (state.availableGerants || []).filter((g) => !g.alreadyAdded && !addedIds.has(g.userId));
  // On masque les gérants SUSPENDUS du choix : un gérant suspendu ne doit pas
  // apparaître quand le client veut faire une demande.
  const myGerants = (state.gerants || []).filter((g) => !g.suspended);

  // Validation : on n'envoie jamais la demande tant qu'il manque une info.
  const validate = () => {
    const e = {};
    if (amountNum <= 0) e.amount = 'Indiquez le montant à recharger.';
    if (!sel) e.gerant = 'Sélectionnez un gérant.';
    if (who === 'autre') {
      if (!benefPhone.trim()) e.benefPhone = 'Indiquez le numéro de la personne à créditer.';
    }
    return e;
  };

  // Efface l'erreur d'un champ dès que le client le corrige.
  const clearErr = (key) => setErrors((prev) => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
  // Dès que le formulaire est complet, les indications rouges disparaissent d'elles-mêmes
  // (sans attendre un nouvel appui sur « Envoyer »). On ne fait que RETIRER des erreurs ici,
  // jamais en ajouter : les erreurs n'apparaissent qu'après un appui sur « Envoyer ».
  useEffect(() => {
    setErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const now = validate();
      const kept = {};
      for (const k of Object.keys(prev)) if (now[k]) kept[k] = prev[k];
      return Object.keys(kept).length === Object.keys(prev).length ? prev : kept;
    });
  }, [amount, benefPhone, who, sel]);

  const submit = async () => {
    const e = validate();
    setErrors(e);
    // On efface une éventuelle erreur d'envoi précédente dès qu'on relance la validation.
    setSubmitError('');
    if (Object.keys(e).length > 0) return;
    const payload = {
      gerantId: sel.id || undefined,
      gerantUserId: sel.userId || undefined,
      gerantName: sel.name,
      gerantWave: sel.waveNumber,
      gerantPayLink: sel.payLink || '',
      type,
      amount: amountNum,
      // Pour quelqu'un : on n'identifie le bénéficiaire que par son numéro (pas de nom).
      benefName: who === 'autre' ? benefPhone : (state.user?.name || 'Moi'),
      benefPhone: who === 'autre' ? benefPhone : (state.user?.phone || ''),
    };
    try {
      // On n'affiche la confirmation QUE si la demande a réellement été créée.
      const created = await createDemande(payload);
      if (created && created.id) setLastDemande(created);
      setSent(true);
      // Réinitialise tout le formulaire pour qu'une nouvelle demande soit facile.
      setAmount(''); setWho('moi'); setBenefPhone(''); setType('unites'); setSel(null);
      // Rafraîchit le client (demandes + gérants) pour voir la demande créée.
      refresh();
    } catch (err) {
      // Pas de confirmation trompeuse : on affiche la vraie erreur.
      setSubmitError(err && err.message ? err.message : 'Impossible d\'envoyer la demande. Réessayez.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Accueil" noPad />
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <SuspendedBanner style={{ marginTop: 4 }} />
        <SectionTitle style={{ marginTop: 4 }}>Nouvelle demande</SectionTitle>
        <T size={font.sm} weight="600" color={colors.textSoft} style={{ marginTop: 2, marginBottom: 6 }}>
          Pas besoin de vous déplacer : choisissez un gérant, payez par Wave, on vous crédite à distance. ⚡
        </T>

        {/* Type selector */}
        <View style={s.typeRow}>
          {TYPES.map((t) => {
            const on = type === t.key;
            return (
              <Pressable key={t.key} onPress={() => setType(t.key)} style={[s.typeCard, on && s.typeCardOn]}>
                <View style={[s.typeIcon, on && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Ionicons name={t.icon} size={24} color={on ? '#fff' : colors.primary} />
                </View>
                <T size={font.sm} weight="700" color={on ? '#fff' : colors.text} numberOfLines={2} style={{ textAlign: 'center' }}>{t.label}</T>
              </Pressable>
            );
          })}
        </View>
        {type === 'forfait' && (
          <T size={font.xs} weight="600" color={colors.primary} style={{ marginTop: 8 }}>
            Appel + Internet — indiquez simplement le montant.
          </T>
        )}

        {/* Form */}
        <Card style={{ marginTop: space.lg }}>
          <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginBottom: 7 }}>Montant (XOF) <T color={colors.danger}>*</T></T>
          <View style={[s.input, errors.amount && s.err]}>
            <TextInput value={amount} onChangeText={(t) => { setAmount(t.replace(/[^0-9]/g, '')); clearErr('amount'); }} placeholder="Ex : 2000" placeholderTextColor={colors.muted2} keyboardType="number-pad" style={s.inputText} />
          </View>
          {errors.amount && <T size={font.sm} weight="600" color={colors.danger} style={s.errText}>{errors.amount}</T>}

          <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginTop: space.lg, marginBottom: 10 }}>Bénéficiaire</T>
          <Segmented value={who} onChange={(v) => { setWho(v); setErrors((prev) => ({ ...prev, benefPhone: undefined })); }} options={[{ value: 'moi', label: 'Pour moi' }, { value: 'autre', label: 'Pour quelqu\'un' }]} />

          {who === 'autre' && (
            <>
              <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginTop: space.lg, marginBottom: 7 }}>Numéro de la personne à créditer <T color={colors.danger}>*</T></T>
              <View style={[s.input, errors.benefPhone && s.err]}><Ionicons name="call-outline" size={18} color={errors.benefPhone ? colors.danger : colors.primary} style={{ marginRight: 10 }} /><TextInput value={benefPhone} onChangeText={(t) => { setBenefPhone(t.replace(/[^0-9]/g, '')); clearErr('benefPhone'); }} placeholder="Ex : 07 07 07 07 07" placeholderTextColor={colors.muted2} keyboardType="phone-pad" style={s.inputText} /></View>
              {errors.benefPhone && <T size={font.sm} weight="600" color={colors.danger} style={s.errText}>{errors.benefPhone}</T>}
            </>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg }}>
            <T size={font.sm} weight="700" color={colors.textSoft}>Gérant <T color={colors.danger}>*</T></T>
            {gerant && (
              <View style={s.onlineChip}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: gerant.online === false ? colors.muted2 : colors.success, marginRight: 5 }} />
                <T size={font.xs} weight="700" color={gerant.online === false ? colors.muted : colors.success}>{gerant.online === false ? 'Hors ligne' : 'En ligne'}</T>
              </View>
            )}
          </View>
          <Pressable onPress={() => setShowGerants(true)} style={[s.input, { marginTop: 8 }, errors.gerant && s.err]}>
            <View style={s.gerantPick}>
              <Ionicons name="storefront-outline" size={20} color={errors.gerant ? colors.danger : colors.primary} style={{ marginRight: 10 }} />
              <Text style={[s.inputText, gerant ? { color: colors.text, fontWeight: '700' } : null]} numberOfLines={1}>{gerant ? gerant.name : 'Sélectionner un gérant'}</Text>
              {gerant ? (
                <Pressable onPress={() => { setSel(null); clearErr('gerant'); }} hitSlop={10} style={{ paddingLeft: 8 }}>
                  <Ionicons name="close-circle" size={20} color={colors.muted} />
                </Pressable>
              ) : (
                <Ionicons name="chevron-down" size={18} color={errors.gerant ? colors.danger : colors.muted2} />
              )}
            </View>
          </Pressable>
          {errors.gerant && <T size={font.sm} weight="600" color={colors.danger} style={s.errText}>{errors.gerant}</T>}

          {/* Le paiement Wave est proposé APRÈS l'envoi de la demande (dialogue de
              confirmation puis historique « À payer »), pour ne jamais repousser
              le bouton « Envoyer la demande ». */}
          {Object.keys(errors).length > 0 && (
            <View style={s.errBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} style={{ marginRight: 8 }} />
              <T size={font.sm} weight="700" color={colors.danger} style={{ flex: 1 }}>
                Il manque des informations pour envoyer la demande. Remplissez les champs signalés en rouge ci-dessus.
              </T>
            </View>
          )}

          {submitError ? (
            <View style={s.errBox}>
              <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} style={{ marginRight: 8 }} />
              <T size={font.sm} weight="700" color={colors.danger} style={{ flex: 1 }}>{submitError}</T>
            </View>
          ) : null}

          <Btn title="Envoyer la demande" icon="paper-plane" onPress={submit} style={{ marginTop: space.lg }} />
          <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 10 }}>
            Le gérant vous créditera après votre paiement Wave direct. Aucun argent n'est stocké sur l'app.
          </T>
        </Card>
      </ScrollView>

      {/* Gérant picker */}
      <BottomSheet visible={showGerants} onClose={() => setShowGerants(false)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
          <T size={font.h3} weight="800" color={colors.text}>Choisir un gérant</T>
          <Pressable onPress={() => setShowGerants(false)}><Ionicons name="close" size={24} color={colors.muted} /></Pressable>
        </View>

        {/* PRIORITÉ : les gérants déjà ajoutés par le client (il les connaît) */}
        {myGerants.length > 0 && (
          <>
            <T size={font.sm} weight="800" color={colors.text} style={{ marginBottom: 4 }}>Vos gérants (priorité)</T>
            <T size={font.xs} weight="600" color={colors.muted2} style={{ marginBottom: 8 }}>Ceux que vous avez déjà ajoutés — vous les connaissez, c\'est plus sûr.</T>
            {myGerants.map((g) => {
              const on = sel?.id === g.id;
              return (
                <Pressable key={g.id} onPress={() => { setSel({ id: g.id, userId: g.userId, name: g.name, phone: g.phone, waveNumber: g.waveNumber, payLink: g.payLink || '', online: g.online }); clearErr('gerant'); setShowGerants(false); }} style={[s.gerantRow, on && { opacity: 0.7 }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                      <T size={font.body} weight="800" color={colors.text}>{g.name}</T>
                      {g.certified && (
                        <View style={s.certBadge}>
                          <Ionicons name="shield-checkmark" size={12} color="#fff" />
                          <T size={font.xs} weight="800" color="#fff" style={{ marginLeft: 3 }}>Certifié</T>
                        </View>
                      )}
                      <RatingBadge rating={g.rating} />
                    </View>
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

        {/* Autres gérants de confiance (badge certifié) — proposés en complément */}
        {suggested.length > 0 && (
          <>
            <T size={font.sm} weight="800" color={colors.primary} style={{ marginBottom: 4, marginTop: state.gerants.length > 0 ? space.md : 0 }}>Autres gérants inscrits</T>
            <T size={font.xs} weight="600" color={colors.muted2} style={{ marginBottom: 8 }}>
              {suggested.some((g) => g.certified)
                ? 'Gérants inscrits sur l\'app. Le badge « Certifié » signale ceux vérifiés par Cabine En Ligne.'
                : 'Gérants inscrits sur l\'app. Vérifiez le nom et le numéro avant d\'envoyer votre demande.'}
            </T>
            {suggested.map((g) => (
              <Pressable key={g.userId} onPress={() => { setSel({ userId: g.userId, name: g.name, phone: g.phone, waveNumber: g.waveNumber, payLink: g.payLink || '', online: true }); clearErr('gerant'); setShowGerants(false); }} style={s.gerantRow}>
                <View style={s.availIcon}><Ionicons name="storefront-outline" size={18} color={colors.primary} /></View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <T size={font.body} weight="800" color={colors.text}>{g.name}</T>
                    {g.certified && (
                      <View style={s.certBadge}>
                        <Ionicons name="shield-checkmark" size={12} color="#fff" />
                        <T size={font.xs} weight="800" color="#fff" style={{ marginLeft: 3 }}>Certifié</T>
                      </View>
                    )}
                    <RatingBadge rating={g.rating} />
                  </View>
                  <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2 }}>{g.phone}</T>
                </View>
                <T size={font.xs} weight="700" color={colors.success}>Disponible</T>
              </Pressable>
            ))}
          </>
        )}

        {suggested.length === 0 && myGerants.length === 0 && (
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
            Votre demande a bien été envoyée à {lastDemande?.gerantName || gerant?.name}. Il a 5 minutes pour répondre.
          </T>
        </View>

        {/* Récapitulatif de la demande */}
        <View style={s.summary}>
          <View style={s.summaryRow}><T size={font.sm} weight="600" color={colors.muted}>Service</T><T size={font.sm} weight="800" color={colors.text}>{TYPE_LABEL[lastDemande?.type] || TYPES.find((t) => t.key === type)?.label || 'Demande'}</T></View>
          <View style={s.summaryRow}><T size={font.sm} weight="600" color={colors.muted}>Montant</T><T size={font.sm} weight="800" color={colors.text}>{money(lastDemande?.amount || amountNum)}</T></View>
          <View style={s.summaryRow}><T size={font.sm} weight="600" color={colors.muted}>Gérant</T><T size={font.sm} weight="800" color={colors.text}>{lastDemande?.gerantName || gerant?.name}</T></View>
        </View>

        {/* Proposition de paiement immédiat par transfert au numéro Wave du gérant */}
        <T size={font.sm} weight="700" color={colors.wave} style={{ marginTop: space.md, marginBottom: 8 }}>
          PAYEZ PAR TRANSFERT AU NUMÉRO WAVE DU GÉRANT
        </T>
        <WavePayBox
          amount={lastDemande?.amount || amountNum}
          merchant={lastDemande?.gerantWave || gerant?.waveNumber}
          merchantName={lastDemande?.gerantName || gerant?.name}
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
      />
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: 120, paddingTop: space.md },
  payBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, marginLeft: 8 },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  typeCard: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 18, minHeight: 88, marginHorizontal: 4, borderWidth: 1.6, borderColor: colors.border },
  typeCardOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeIcon: { marginBottom: 8 },
  input: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 14, height: 52 },
  inputText: { flex: 1, fontSize: font.input, color: colors.text, paddingVertical: 0, outlineStyle: 'none' },
  err: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerBg },
  errText: { marginTop: 6 },
  errBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 12, marginTop: space.lg },
  gerantRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  gerantPick: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  onlineChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  availIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  certBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  summary: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 14, marginTop: space.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
});
