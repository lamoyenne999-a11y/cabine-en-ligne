import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { TabBar } from '../../components/Shell';
import { colors } from '../../theme';
import NotificationCenter from '../../components/Notifications';
import { useStore } from '../../store';
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
  const [showNotif, setShowNotif] = useState(false);
  const { state, loadNotifications, markNotificationRead, markAllNotificationsRead } = useStore();

  // Charge les notifications à l'ouverture
  useEffect(() => { loadNotifications(); }, []); // eslint-disable-line

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        {tab === 'demandes' && <GerantDemandes />}
        {tab === 'historique' && <GerantHistory />}
        {tab === 'profil' && <GerantProfile onLogout={onLogout} />}
      </View>

      {/* Cloche de notifications (en haut à droite) */}
      <View style={{ position: 'absolute', top: 22, right: 16, zIndex: 30 }}>
        <NotificationCenter
          visible={showNotif}
          onOpen={() => setShowNotif(true)}
          onClose={() => setShowNotif(false)}
          list={state.notifications}
          unread={state.unread}
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllNotificationsRead}
        />
      </View>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />
    </View>
  );
}
