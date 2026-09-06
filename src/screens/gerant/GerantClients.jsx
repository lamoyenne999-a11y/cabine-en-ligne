import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Btn, Card, Field } from '../../components/ui';
import { Page } from '../../components/Shell';
import { BottomSheet } from '../../components/modals';
import { useStore } from '../../store';

export default function GerantClients() {
  const { state, addClient, deleteClient } = useStore();
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const clients = state.clients.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q),
  );
  const enLigne = state.clients.filter((c) => c.online).length;
  const totalTx = state.clients.reduce((a, c) => a + c.tx, 0);

  const add = () => {
    if (!name.trim() || !phone.trim()) return;
    addClient({ name: name.trim(), phone: phone.trim() });
    setName(''); setPhone(''); setShow(false);
  };

  return (
    <Page title="Mes Clients" contentStyle={{ paddingTop: space.md }}>
      <View style={s.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Rechercher un client…" placeholderTextColor={colors.muted2} style={s.searchText} />
      </View>

      <View style={{ flexDirection: 'row', marginBottom: space.xl }}>
        <Card style={{ flex: 1, paddingVertical: 20, alignItems: 'center' }}>
          <T size={font.h2} weight="800" color={colors.primary}>{state.clients.length}</T>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>Clients ajoutés</T>
        </Card>
        <Card style={{ flex: 1, paddingVertical: 20, alignItems: 'center', marginHorizontal: space.md }}>
          <T size={font.h2} weight="800" color={colors.primary}>{enLigne}</T>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>En ligne</T>
        </Card>
        <Card style={{ flex: 1, paddingVertical: 20, alignItems: 'center' }}>
          <T size={font.h2} weight="800" color={colors.primary}>{totalTx}</T>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>Transactions</T>
        </Card>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <T size={font.h3} weight="800" color={colors.text}>Liste des clients</T>
        <Btn title="Ajouter" icon="add" size="sm" onPress={() => setShow(true)} />
      </View>

      {clients.map((c) => (
        <Card key={c.id} style={{ marginBottom: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T size={font.body} weight="800" color={colors.text}>{c.name}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                <Ionicons name="call-outline" size={14} color={colors.primary} />
                <T size={font.sm} weight="600" color={colors.muted} style={{ marginLeft: 6 }}>{c.phone}</T>
              </View>
              <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 5 }}>{c.tx} transactions effectuées</T>
              <T size={font.xs} weight="600" color={colors.muted}>Ajouté le {c.added}</T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.online ? colors.success : colors.muted2, marginRight: 5 }} />
                <T size={font.xs} weight="700" color={c.online ? colors.success : colors.muted}>{c.online ? 'En ligne' : 'Hors ligne'}</T>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <View style={s.action}>
                  <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
                </View>
                <Pressable onPress={() => deleteClient(c.id)} hitSlop={8} style={[s.action, { marginLeft: 8 }]}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          </View>
        </Card>
      ))}

      <BottomSheet visible={show} onClose={() => setShow(false)}>
        <View style={s.handle} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg }}>
          <T size={font.h3} weight="800" color={colors.text}>Ajouter un client</T>
          <Pressable onPress={() => setShow(false)}><Ionicons name="close" size={24} color={colors.muted} /></Pressable>
        </View>
        <Field label="Nom du client" placeholder="Ex: Jean Dupont" value={name} onChangeText={setName} icon="person-outline" />
        <Field label="Numéro de téléphone" placeholder="Ex: 77 123 45 67" value={phone} onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))} icon="call-outline" keyboardType="phone-pad" />
        <Btn title="Ajouter" icon="add" onPress={add} />
      </BottomSheet>
    </Page>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14, height: 50, marginBottom: space.lg },
  searchText: { flex: 1, marginLeft: 10, fontSize: font.body, color: colors.text, outlineStyle: 'none' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.muted2, alignSelf: 'center', marginBottom: 16 },
  action: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
