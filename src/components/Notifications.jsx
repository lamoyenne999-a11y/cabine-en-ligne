import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T } from './ui';
import { BottomSheet } from './modals';

// ============================================================
//  Centre de notifications (générique : client et gérant).
//  - Cloche flottante avec badge « non lues ».
//  - Ouvre un panneau listant les événements selon le type.
//  Les données et callbacks sont fournis par l'appelant.
// ============================================================

const ICONS = {
  new_demande: 'notifications-outline',
  demande_accepted: 'checkmark-circle-outline',
  demande_declined: 'close-circle-outline',
  demande_canceled: 'close-circle-outline',
  demande_paid: 'wallet-outline',
  demande_received: 'cash-outline',
  demande_not_received: 'warning-outline',
  demande_partial: 'remove-circle-outline',
  client_completed: 'add-circle-outline',
  client_says_full: 'help-circle-outline',
  gift: 'gift-outline',
  certified: 'shield-checkmark-outline',
  uncertified: 'shield-outline',
  demande_served_unpaid: 'alert-circle-outline',
  demande_completed: 'checkmark-done-outline',
};
const COLORS = {
  new_demande: colors.primary,
  demande_accepted: colors.success,
  demande_declined: colors.danger,
  demande_canceled: colors.danger,
  demande_paid: '#2E7BF6',
  demande_received: colors.success,
  demande_not_received: colors.danger,
  demande_partial: colors.warn,
  client_completed: colors.success,
  client_says_full: colors.warn,
  gift: colors.success,
  certified: colors.primary,
  uncertified: colors.warn,
  demande_served_unpaid: colors.warn,
  demande_completed: colors.success,
};

const when = (t) => (t ? new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function NotificationCenter({ visible, onOpen, onClose, list, unread, onMarkRead, onMarkAllRead }) {
  const items = list || [];
  const count = unread || 0;

  return (
    <>
      {/* Cloche + badge */}
      <Pressable onPress={onOpen} style={s.bell}>
        <Ionicons name="notifications" size={24} color="#fff" />
        {count > 0 ? (
          <View style={s.badge}><T size={9} weight="800" color="#fff">{count > 99 ? '99+' : count}</T></View>
        ) : null}
      </Pressable>

      <BottomSheet visible={visible} onClose={onClose}>
        <View style={s.header}>
          <T size={font.h3} weight="800" color={colors.text}>Notifications</T>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {count > 0 ? (
              <Pressable onPress={onMarkAllRead}><T size={font.sm} weight="700" color={colors.primary}>Tout marquer lu</T></Pressable>
            ) : null}
            <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
              <Ionicons name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        {items.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="notifications-off-outline" size={40} color={colors.muted2} />
            <T size={font.body} weight="700" color={colors.muted} style={{ marginTop: 10 }}>Aucune notification</T>
            <T size={font.sm} weight="600" color={colors.muted2} style={{ marginTop: 4, textAlign: 'center' }}>
              Vous serez prévenu des nouvelles demandes, acceptations et paiements.
            </T>
          </View>
        ) : (
          items.map((n) => (
            <Pressable key={n.id} onPress={() => onMarkRead(n.id)} style={s.row}>
              <View style={[s.rowIcon, { backgroundColor: (COLORS[n.type] || colors.primary) + '18' }]}>
                <Ionicons name={ICONS[n.type] || 'notifications-outline'} size={20} color={COLORS[n.type] || colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T size={font.sm} weight={n.read ? '600' : '800'} color={n.read ? colors.muted : colors.text} style={{ lineHeight: 19 }}>{n.text}</T>
                <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 3 }}>{when(n.createdAt)}</T>
              </View>
              {!n.read && <View style={s.dot} />}
            </Pressable>
          ))
        )}
      </BottomSheet>
    </>
  );
}

const s = StyleSheet.create({
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  empty: { alignItems: 'center', paddingVertical: 28 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 8 },
});
