import React, { useState } from 'react';
import { View } from 'react-native';
import { TabBar } from '../../components/Shell';
import { colors } from '../../theme';
import ClientHome from './ClientHome';
import ClientHistory from './ClientHistory';
import ClientGerants from './ClientGerants';
import ClientProfile from './ClientProfile';

const TABS = [
  { key: 'home', label: 'Accueil', icon: 'home-outline' },
  { key: 'gerants', label: 'Gérants', icon: 'storefront-outline' },
  { key: 'historique', label: 'Historique', icon: 'receipt-outline' },
  { key: 'profil', label: 'Profil', icon: 'person-outline' },
];

export default function ClientApp({ onLogout }) {
  const [tab, setTab] = useState('home');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && <ClientHome />}
        {tab === 'gerants' && <ClientGerants />}
        {tab === 'historique' && <ClientHistory />}
        {tab === 'profil' && <ClientProfile onLogout={onLogout} />}
      </View>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
    </View>
  );
}
