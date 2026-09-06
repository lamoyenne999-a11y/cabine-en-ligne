import React, { useState } from 'react';
import { View } from 'react-native';
import { TabBar } from '../../components/Shell';
import ConnectionBadge from '../../components/ConnectionBadge';
import { colors } from '../../theme';
import ClientHome from './ClientHome';
import ClientAbonnement from './ClientAbonnement';
import ClientHistory from './ClientHistory';
import ClientGerants from './ClientGerants';
import ClientProfile from './ClientProfile';

const TABS = [
  { key: 'home', label: 'Accueil', icon: 'home-outline' },
  { key: 'abo', label: 'Abonnements', icon: 'card-outline' },
  { key: 'hist', label: 'Historique', icon: 'time-outline' },
  { key: 'gerants', label: 'Gérants', icon: 'people-outline' },
  { key: 'profil', label: 'Profil', icon: 'person-outline' },
];

export default function ClientApp({ onLogout }) {
  const [tab, setTab] = useState('home');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ position: 'absolute', top: 20, left: 14, zIndex: 30 }}>
        <ConnectionBadge />
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'home' && <ClientHome />}
        {tab === 'abo' && <ClientAbonnement />}
        {tab === 'hist' && <ClientHistory />}
        {tab === 'gerants' && <ClientGerants />}
        {tab === 'profil' && <ClientProfile onLogout={onLogout} />}
      </View>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
    </View>
  );
}
