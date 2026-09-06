import React, { useState } from 'react';
import { View } from 'react-native';
import { TabBar } from '../../components/Shell';
import ConnectionBadge from '../../components/ConnectionBadge';
import { colors } from '../../theme';
import GerantDashboard from './GerantDashboard';
import GerantDemandes from './GerantDemandes';
import GerantStats from './GerantStats';
import GerantHistory from './GerantHistory';
import GerantClients from './GerantClients';
import GerantProfile from './GerantProfile';

const TABS = [
  { key: 'dashboard', label: 'Tableau', icon: 'home-outline' },
  { key: 'demandes', label: 'Demandes', icon: 'notifications-outline' },
  { key: 'stats', label: 'Statist.', icon: 'stats-chart-outline' },
  { key: 'hist', label: 'Historique', icon: 'time-outline' },
  { key: 'clients', label: 'Clients', icon: 'people-outline' },
  { key: 'profil', label: 'Profil', icon: 'person-outline' },
];

export default function GerantApp({ onLogout }) {
  const [tab, setTab] = useState('dashboard');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ position: 'absolute', top: 20, left: 14, zIndex: 30 }}>
        <ConnectionBadge />
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'dashboard' && <GerantDashboard />}
        {tab === 'demandes' && <GerantDemandes />}
        {tab === 'stats' && <GerantStats />}
        {tab === 'hist' && <GerantHistory />}
        {tab === 'clients' && <GerantClients />}
        {tab === 'profil' && <GerantProfile onLogout={onLogout} onWithdraw={() => setTab('dashboard')} />}
      </View>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
    </View>
  );
}
