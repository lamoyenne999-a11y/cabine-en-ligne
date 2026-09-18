import React, { useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import { TabBar } from '../../components/Shell';
import { colors } from '../../theme';
import NotificationCenter from '../../components/Notifications';
import { useStore } from '../../store';
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
  const [showNotif, setShowNotif] = useState(false);
  const { state, loadClientNotifications, markClientNotificationRead, markAllClientNotificationsRead } = useStore();

  // Charge les notifications du client à l'ouverture
  useEffect(() => { loadClientNotifications(); }, []); // eslint-disable-line

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && <ClientHome />}
        {tab === 'gerants' && <ClientGerants />}
        {tab === 'historique' && <ClientHistory />}
        {tab === 'profil' && <ClientProfile onLogout={onLogout} />}
      </View>

      {/* Cloche de notifications (en haut à droite) */}
      <View style={{ position: 'absolute', top: Platform.OS === 'web' ? 'max(22px, calc(env(safe-area-inset-top, 0px) - 2px))' : 22, right: 16, zIndex: 30 }}>
        <NotificationCenter
          visible={showNotif}
          onOpen={() => setShowNotif(true)}
          onClose={() => setShowNotif(false)}
          list={state.clientNotifications}
          unread={state.clientUnread}
          onMarkRead={markClientNotificationRead}
          onMarkAllRead={markAllClientNotificationsRead}
        />
      </View>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />
    </View>
  );
}
