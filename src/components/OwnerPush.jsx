import React, { useState, useEffect } from 'react';
import { View, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, font } from '../theme';
import { T, Card, Btn } from './ui';
import { pushSupported, enableNotifications, getPushState, disableNotifications } from '../push';
import { api } from '../api';

// ==================================================================
//  Notifications de l'Espace propriétaire, sur CE téléphone.
//  Même mécanisme que pour les clients/gérants (Web Push), rattaché au
//  compte réservé « propriétaire ». À activer sur chaque téléphone voulu.
// ==================================================================
export default function OwnerPush({ adminKey, compact = false }) {
  const supported = pushSupported();
  const [enabled, setEnabled] = useState(false);
  const [devices, setDevices] = useState(null);
  const [serverOn, setServerOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const st = await getPushState();
        if (alive && st.supported && st.granted && st.subscribed) setEnabled(true);
      } catch { /* silencieux */ }
      try {
        const s = await api.admin.pushState(adminKey);
        if (alive) { setDevices(s.devices); setServerOn(!!s.enabled); }
      } catch { /* silencieux */ }
    })();
    return () => { alive = false; };
  }, [adminKey]);

  const toggle = async (value) => {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      if (value) {
        const res = await enableNotifications();
        if (res && res.ok && res.subscription) {
          const out = await api.admin.pushSubscribe(adminKey, res.subscription);
          setDevices(out.devices); setEnabled(true);
          setMsg('Activé sur ce téléphone. Vous serez prévenu même app fermée ou téléphone en veille.');
        } else {
          setEnabled(false);
          setMsg((res && res.reason) || 'Impossible d’activer les notifications.');
        }
      } else {
        const res = await disableNotifications();
        if (res && res.endpoint) { const out = await api.admin.pushUnsubscribe(adminKey, res.endpoint); setDevices(out.devices); }
        setEnabled(false); setMsg('Désactivé sur ce téléphone.');
      }
    } catch (e) { setMsg(e?.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setMsg('');
    try { await api.admin.pushTest(adminKey); setMsg('Notification d’essai envoyée : elle doit apparaître sur ce téléphone dans quelques secondes.'); }
    catch (e) { setMsg(e?.message || 'Erreur.'); }
    finally { setBusy(false); }
  };

  const installedHint = Platform.OS === 'web' && typeof window !== 'undefined' && !(window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));

  return (
    <Card style={{ marginBottom: space.sm, borderWidth: enabled ? 0 : 1, borderColor: colors.primary }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={enabled ? 'notifications' : 'notifications-off-outline'} size={22} color={colors.primary} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <T size={font.body} weight="800" color={colors.text}>Notifications sur ce téléphone</T>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>
            {enabled ? 'Activées' : 'Désactivées'} · Déblocages, paiements à vérifier, signalements, inscriptions{devices != null ? ` · ${devices} appareil${devices > 1 ? 's' : ''} abonné${devices > 1 ? 's' : ''}` : ''}
          </T>
        </View>
        <Switch value={enabled} onValueChange={toggle} disabled={busy || !supported} trackColor={{ true: colors.primary, false: '#D9D4E3' }} thumbColor="#fff" />
      </View>
      {!supported ? (
        <T size={font.xs} weight="600" color={colors.danger} style={{ marginTop: 8 }}>Non disponible ici : installez l’app sur l’écran d’accueil puis ouvrez l’Espace propriétaire depuis l’app installée.</T>
      ) : installedHint && !enabled ? (
        <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 8 }}>Sur iPhone, les notifications ne fonctionnent que depuis l’app installée sur l’écran d’accueil.</T>
      ) : null}
      {!serverOn ? <T size={font.xs} weight="600" color={colors.danger} style={{ marginTop: 8 }}>Le serveur a les notifications désactivées (PUSH_ENABLED).</T> : null}
      {msg ? <T size={font.xs} weight="600" color={colors.text} style={{ marginTop: 8 }}>{msg}</T> : null}
      {enabled && !compact ? <Btn title="Envoyer une notification d’essai" icon="paper-plane-outline" outline size="sm" onPress={test} loading={busy} style={{ marginTop: 10 }} /> : null}
    </Card>
  );
}
