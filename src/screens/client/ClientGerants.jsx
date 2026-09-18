import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Btn, Card, Field } from '../../components/ui';
import { Header } from '../../components/Shell';
import { BottomSheet } from '../../components/modals';
import { useStore } from '../../store';
import QrToggle from '../../components/QrToggle';
import { RatingBadge } from '../../components/Rating';
import { buildShareUrl } from '../../config';

export default function ClientGerants() {
  const { state, addGerant, removeGerant } = useStore();
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedNum, setCopiedNum] = useState(null);

  // La recherche ne porte QUE sur les gérants que le client a déjà ajoutés.
  const searching = q.trim() !== '';
  const gerants = state.gerants.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()) || g.phone.includes(q));
  // Gérants inscrits proposés = ceux que le client n'a pas encore ajoutés.
  const addedIds = new Set((state.gerants || []).map((g) => g.userId));
  const suggested = (state.availableGerants || []).filter((g) => !g.alreadyAdded && !addedIds.has(g.userId));
  const shareUrl = state.user ? buildShareUrl(state.user.id) : '';

  const add = async () => {
    if (!phone.trim()) { setErr('Numéro requis'); return; }
    setErr('');
    try {
      const r = await addGerant({ phone, name: name.trim() });
      if (!r || !r.id) { setErr('Ce numéro ne correspond à aucun gérant inscrit sur Cabine En Ligne.'); return; }
      setName(''); setPhone(''); setShow(false);
    } catch (e) {
      setErr(e && e.message ? e.message : 'Ce numéro ne correspond à aucun gérant inscrit. Vérifiez le numéro ou invitez-le à s\'inscrire.');
    }
  };

  // Ajout en 1 clic d'un gérant déjà inscrit (sans rien taper).
  const quickAdd = async (g) => {
    setErr('');
    try {
      const r = await addGerant({ phone: g.phone, name: g.name });
      if (!r || !r.id) { setErr('Ce gérant n\'a pas pu être ajouté.'); return; }
      setName(''); setPhone(''); setShow(false);
    } catch (e) {
      setErr(e && e.message ? e.message : 'Impossible d\'ajouter ce gérant. Réessayez.');
    }
  };

  const copy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    } else {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Mes gérants" noPad />

      {/* ===== Zone FIXE (ne bouge pas quand on scrolle la liste) ===== */}
      <View style={s.top}>
        {/* Lien de partage */}
        <Card style={{ marginBottom: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="link" size={20} color={colors.primary} style={{ marginRight: 10 }} />
            <T size={font.sm} weight="800" color={colors.text}>Mon lien de profil</T>
          </View>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 4, marginBottom: 10 }}>
            Partagez ce lien : les gens pourront vous ajouter et transacter avec vous.
          </T>
          <View style={s.linkRow}>
            <Text numberOfLines={1} style={s.linkText}>{shareUrl || '--'}</Text>
            <Pressable onPress={copy} style={s.copyBtn}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />
            </Pressable>
          </View>
          {copied && <T size={font.xs} weight="600" color={colors.success} style={{ marginTop: 6 }}>Lien copié !</T>}
          <QrToggle value={shareUrl} title={state.user?.name} role="Client" />
        </Card>

        {/* Recherche parmi mes gérants */}
        <View style={s.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Rechercher parmi mes gérants…" placeholderTextColor={colors.muted2} style={s.searchText} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
          <T size={font.h3} weight="800" color={colors.text}>Liste des gérants</T>
          <Btn title="Ajouter" icon="add" size="sm" onPress={() => setShow(true)} />
        </View>
      </View>

      {/* ===== Liste SCROLLABLE (seule cette partie défile) ===== */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
        {/* Gérants à ajouter : inscrits sur l'app mais pas encore dans les
            contacts. Masqué pendant une recherche (on cherche parmi SES gérants). */}
        {!searching && (
          <>
            <T size={font.sm} weight="800" color={colors.primary} style={{ marginBottom: 6 }}>À ajouter (déjà inscrits sur l'app)</T>
            {suggested.length > 0 ? (
              suggested.map((g) => (
                <Card key={g.userId} style={{ marginBottom: space.sm, borderWidth: 1.5, borderColor: colors.primary }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                        <T size={font.body} weight="800" color={colors.text}>{g.name}</T>
                        {g.certified ? (
                          <View style={s.certBadge}>
                            <Ionicons name="shield-checkmark" size={12} color="#fff" />
                            <T size={font.xs} weight="800" color="#fff" style={{ marginLeft: 3 }}>Certifié</T>
                          </View>
                        ) : null}
                        <RatingBadge rating={g.rating} />
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                        <Ionicons name="call-outline" size={14} color={colors.primary} />
                        <T size={font.sm} weight="600" color={colors.muted} style={{ marginLeft: 6 }}>{g.phone}</T>
                      </View>
                    </View>
                    <Pressable onPress={() => quickAdd(g)} style={s.addBtn}>
                      <Ionicons name="add" size={16} color="#fff" />
                      <T size={font.xs} weight="800" color="#fff" style={{ marginLeft: 4 }}>Ajouter</T>
                    </Pressable>
                  </View>
                </Card>
              ))
            ) : (
              <T size={font.xs} weight="600" color={colors.muted2} style={{ marginBottom: space.md }}>
                {(state.availableGerants || []).length > 0
                  ? 'Tous les gérants inscrits sur l\'app sont déjà dans vos contacts. ✅'
                  : 'Aucun autre gérant inscrit sur l\'app pour le moment. Partagez votre lien : quand un gérant s\'inscrit, il apparaîtra ici avec un bouton « Ajouter ».'}
              </T>
            )}
          </>
        )}

        {gerants.map((g) => (
          <Card key={g.id} style={{ marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <T size={font.body} weight="800" color={colors.text}>{g.name}</T>
                  {g.suspended ? (
                    <View style={s.suspendBadge}><T size={font.xs} weight="800" color={colors.warn}>Suspendu</T></View>
                  ) : (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.online ? colors.success : colors.muted2, marginLeft: 8 }} />
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                  <Ionicons name="call-outline" size={14} color={colors.primary} />
                  <T size={font.sm} weight="600" color={colors.muted} style={{ marginLeft: 6 }}>{g.phone}</T>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                  <Ionicons name="water" size={14} color={colors.wave} />
                  <T size={font.sm} weight="700" color={colors.wave} style={{ marginLeft: 6 }}>Numéro Wave : {g.waveNumber}</T>
                </View>
                <Pressable
                  onPress={() => {
                    const n = g.waveNumber || g.phone || '';
                    if (n && typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(n).catch(() => {});
                    setCopiedNum(n);
                    setTimeout(() => setCopiedNum(null), 1800);
                  }}
                  style={s.payBtn}
                >
                  <Ionicons name={copiedNum === (g.waveNumber || g.phone) ? 'checkmark' : 'copy-outline'} size={14} color="#fff" style={{ marginRight: 6 }} />
                  <T size={font.xs} weight="800" color="#fff">{copiedNum === (g.waveNumber || g.phone) ? 'Numéro copié ✓' : 'Copier le numéro Wave'}</T>
                </Pressable>
                <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 4 }}>
                  Transférez le montant à ce numéro — les frais Wave (1 %) sont sur votre compte, le gérant reçoit la totalité.
                </T>
              </View>
              <Pressable onPress={() => removeGerant(g.id)} hitSlop={8} style={{ paddingLeft: 12 }}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        ))}

        {searching && gerants.length === 0 && (
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Ionicons name="search-outline" size={36} color={colors.muted2} />
            <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 8, textAlign: 'center' }}>
              Aucun gérant ne correspond à « {q} ».
            </T>
          </Card>
        )}
      </ScrollView>

      <BottomSheet visible={show} onClose={() => setShow(false)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
          <T size={font.h3} weight="800" color={colors.text}>Ajouter un gérant</T>
          <Pressable onPress={() => setShow(false)}><Ionicons name="close" size={24} color={colors.muted} /></Pressable>
        </View>

        {/* Ajout rapide : les gérants déjà inscrits, en 1 clic, sans taper. */}
        {suggested.length > 0 && (
          <>
            <T size={font.sm} weight="800" color={colors.primary} style={{ marginBottom: 4 }}>Gérants inscrits — ajouter en 1 clic</T>
            <T size={font.xs} weight="600" color={colors.muted2} style={{ marginBottom: 8 }}>Touchez « Ajouter » sur le gérant de votre choix, sans rien taper.</T>
            {suggested.map((g) => (
              <View key={g.userId} style={s.suggestRow}>
                <View style={s.suggestIcon}><Ionicons name="storefront-outline" size={18} color={colors.primary} /></View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <T size={font.body} weight="800" color={colors.text}>{g.name}</T>
                  <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 1 }}>{g.phone}</T>
                </View>
                <Btn title="Ajouter" icon="add" size="sm" onPress={() => quickAdd(g)} />
              </View>
            ))}
            <View style={s.divider} />
            <T size={font.xs} weight="700" color={colors.muted} style={{ textAlign: 'center', marginTop: 4, marginBottom: 8 }}>— ou ajouter manuellement —</T>
          </>
        )}

        <Field label="Nom de la cabine" placeholder="Ex : Nom Cabine" value={name} onChangeText={setName} icon="storefront-outline" />
        <Field label="Numéro de téléphone" placeholder="Ex : 07 07 07 07 07" value={phone} onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))} icon="call-outline" keyboardType="phone-pad" />
        <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 4, marginBottom: space.sm }}>
          Le numéro doit appartenir à un gérant déjà inscrit sur Cabine En Ligne.
        </T>
        {err ? <T size={font.sm} weight="600" color={colors.danger} style={{ marginBottom: space.md }}>{err}</T> : null}
        <Btn title="Ajouter" icon="add" onPress={add} />
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: space.lg, paddingTop: space.md },
  list: { paddingHorizontal: space.lg, paddingBottom: 120 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14, height: 50, marginBottom: space.md },
  searchText: { flex: 1, marginLeft: 10, fontSize: font.input, color: colors.text, outlineStyle: 'none' },
  linkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: 8 },
  linkText: { flex: 1, fontSize: font.xs, color: colors.primary, marginRight: 8 },
  copyBtn: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  payBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.waveAccent, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, marginTop: 6, alignSelf: 'flex-start' },
  suggestRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  suggestIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  suspendBadge: { backgroundColor: '#FDF0E0', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.success, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, marginLeft: 8 },
  certBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
});
