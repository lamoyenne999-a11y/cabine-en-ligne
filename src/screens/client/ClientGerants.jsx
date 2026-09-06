import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Btn, Card, Field } from '../../components/ui';
import { Page } from '../../components/Shell';
import { BottomSheet } from '../../components/modals';
import { useStore } from '../../store';

export default function ClientGerants() {
  const { state, addGerant, deleteGerant } = useStore();
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const gerants = state.gerants.filter((g) =>
    g.name.toLowerCase().includes(q.toLowerCase()) || g.phone.includes(q),
  );
  const enLigne = state.gerants.filter((g) => g.online).length;

  const add = () => {
    if (!name.trim() || !phone.trim()) return;
    addGerant({ name: name.trim(), phone: phone.trim() });
    setName(''); setPhone(''); setShow(false);
  };

  return (
    <Page title="Mes Gérants" contentStyle={{ paddingTop: space.md }}>
      <View style={s.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher un gérant…"
          placeholderTextColor={colors.muted2}
          style={s.searchText}
        />
      </View>

      <View style={{ flexDirection: 'row', marginBottom: space.xl }}>
        <Card style={{ flex: 1, paddingVertical: 20, alignItems: 'center' }}>
          <T size={font.h2} weight="800" color={colors.primary}>{state.gerants.length}</T>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>Gérants ajoutés</T>
        </Card>
        <Card style={{ flex: 1, paddingVertical: 20, alignItems: 'center', marginLeft: space.md }}>
          <T size={font.h2} weight="800" color={colors.primary}>{enLigne}</T>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>En ligne</T>
        </Card>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <T size={font.h3} weight="800" color={colors.text}>Liste des gérants</T>
        <Btn title="Ajouter" icon="add" size="sm" onPress={() => setShow(true)} />
      </View>

      {gerants.map((g) => (
        <Card key={g.id} style={{ marginBottom: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T size={font.body} weight="800" color={colors.text}>{g.name}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                <Ionicons name="call-outline" size={14} color={colors.primary} />
                <T size={font.sm} weight="600" color={colors.muted} style={{ marginLeft: 6 }}>{g.phone}</T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                <Ionicons name="star" size={14} color={colors.warn} />
                <T size={font.sm} weight="800" color={colors.warn} style={{ marginLeft: 5 }}>{g.rating}</T>
                <T size={font.xs} weight="600" color={colors.muted} style={{ marginLeft: 4 }}>({g.tx} transactions)</T>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.online ? colors.success : colors.muted2, marginRight: 5 }} />
                <T size={font.xs} weight="700" color={g.online ? colors.success : colors.muted}>{g.online ? 'En ligne' : 'Hors ligne'}</T>
              </View>
              <Pressable onPress={() => deleteGerant(g.id)} hitSlop={8} style={{ marginTop: 8 }}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        </Card>
      ))}

      <BottomSheet visible={show} onClose={() => setShow(false)}>
        <View style={s.handle} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg }}>
          <T size={font.h3} weight="800" color={colors.text}>Ajouter un gérant</T>
          <Pressable onPress={() => setShow(false)}><Ionicons name="close" size={24} color={colors.muted} /></Pressable>
        </View>
        <Field label="Nom du gérant" placeholder="Ex: Boutique Amadou" value={name} onChangeText={setName} icon="storefront-outline" />
        <Field label="Numéro de téléphone" placeholder="Ex: 77 123 45 67" value={phone} onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))} icon="call-outline" keyboardType="phone-pad" />
        <Btn title="Ajouter" icon="add" onPress={add} />
      </BottomSheet>
    </Page>
  );
}

const s = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: radius.md, paddingHorizontal: 14, height: 50, marginBottom: space.lg,
  },
  searchText: { flex: 1, marginLeft: 10, fontSize: font.body, color: colors.text, outlineStyle: 'none' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.muted2, alignSelf: 'center', marginBottom: 16 },
});
