import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Btn, Card, Field } from '../../components/ui';
import { Page } from '../../components/Shell';
import { BottomSheet } from '../../components/modals';
import { useStore } from '../../store';
import { buildShareUrl } from '../../config';

export default function ClientGerants() {
  const { state, addGerant, removeGerant } = useStore();
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const gerants = state.gerants.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()) || g.phone.includes(q));
  const shareUrl = state.user ? buildShareUrl(state.user.id) : '';

  const add = async () => {
    if (!phone.trim()) { setErr('Numéro requis'); return; }
    setErr('');
    await addGerant({ phone, name: name.trim() });
    setName(''); setPhone(''); setShow(false);
  };

  const copy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    } else {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Page title="Mes gérants" contentStyle={{ paddingTop: space.md }}>
      {/* Lien de partage */}
      <Card style={{ marginBottom: space.lg }}>
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
      </Card>

      <View style={s.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Rechercher un gérant…" placeholderTextColor={colors.muted2} style={s.searchText} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <T size={font.h3} weight="800" color={colors.text}>Liste des gérants</T>
        <Btn title="Ajouter" icon="add" size="sm" onPress={() => setShow(true)} />
      </View>

      {gerants.map((g) => (
        <Card key={g.id} style={{ marginBottom: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T size={font.body} weight="800" color={colors.text}>{g.name}</T>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.online ? colors.success : colors.muted2, marginLeft: 8 }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                <Ionicons name="call-outline" size={14} color={colors.primary} />
                <T size={font.sm} weight="600" color={colors.muted} style={{ marginLeft: 6 }}>{g.phone}</T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                <Ionicons name="water" size={14} color={colors.wave} />
                <T size={font.sm} weight="700" color={colors.wave} style={{ marginLeft: 6 }}>Wave marchand : {g.waveNumber}</T>
              </View>
            </View>
            <Pressable onPress={() => removeGerant(g.id)} hitSlop={8} style={{ paddingLeft: 12 }}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        </Card>
      ))}

      <BottomSheet visible={show} onClose={() => setShow(false)}>
        <View style={s.sheetHandle} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg }}>
          <T size={font.h3} weight="800" color={colors.text}>Ajouter un gérant</T>
          <Pressable onPress={() => setShow(false)}><Ionicons name="close" size={24} color={colors.muted} /></Pressable>
        </View>
        <Field label="Nom de la cabine" placeholder="Ex : Cabine Marie" value={name} onChangeText={setName} icon="storefront-outline" />
        <Field label="Numéro de téléphone" placeholder="Ex : 07 07 07 07 07" value={phone} onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))} icon="call-outline" keyboardType="phone-pad" />
        {err ? <T size={font.sm} weight="600" color={colors.danger} style={{ marginBottom: space.md }}>{err}</T> : null}
        <Btn title="Ajouter" icon="add" onPress={add} />
      </BottomSheet>
    </Page>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14, height: 50, marginBottom: space.lg },
  searchText: { flex: 1, marginLeft: 10, fontSize: font.body, color: colors.text, outlineStyle: 'none' },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.muted2, alignSelf: 'center', marginBottom: 16 },
  linkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: 8 },
  linkText: { flex: 1, fontSize: font.xs, color: colors.primary, marginRight: 8 },
  copyBtn: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
