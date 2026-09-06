import React, { useState } from 'react';
import { View } from 'react-native';
import { TabBar } from '../../components/Shell';
import { colors } from '../../theme';
import GerantDemandes from './GerantDemandes';
import GerantHistory from './GerantHistory';
import GerantProfile from './GerantProfile';

const TABS = [
  { key: 'demandes', label: 'Demandes', icon: 'notifications-outline' },
  { key: 'historique', label: 'Historique', icon: 'receipt-outline' },
  { key: 'profil', label: 'Profil', icon: 'person-outline' },
];

export default function GerantApp({ onLogout }) {
  const [tab, setTab] = useState('demandes');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        {tab === 'demandes' && <GerantDemandes />}
        {tab === 'historique' && <GerantHistory />}
        {tab === 'profil' && <GerantProfile onLogout={onLogout} />}
      </View>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
    </View>
  );
}
