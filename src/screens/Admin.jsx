import React, { useState } from 'react';
import { View, TextInput, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T, Card, Btn, StatTile, ListRow } from '../components/ui';
import { Page } from '../components/Shell';
import { api } from '../api';

// ============================================================
//  Espace propriétaire — vue des paiements d'abonnement.
//  Permet de vérifier : qui a payé, combien, quand, et valable
//  jusqu'à quelle date. Sert à réconcilier avec ce que tu reçois
//  sur ton compte Wave. Accès protégé par une clé admin.
// ============================================================

const money = (n) => `${(n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function Admin({ onBack }) {
  const [key, setKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);

  const load = async () => {
    if (!key.trim()) { setErr('Saisissez la clé propriétaire.'); return; }
    setErr(''); setLoading(true);
    try {
      const summary = await api.admin.summary(key.trim());
      setData(summary);
      try {
        const u = await api.admin.users(key.trim());
        setUsers(u.users || []);
      } catch { setUsers([]); }
      setAuthed(true);
    } catch (e) {
      setErr(e && e.status === 403 ? 'Clé incorrecte.' : (e?.message || 'Erreur de chargement.'));
    } finally { setLoading(false); }
  };

  // Pas encore authentifié : demande de la clé.
  if (!authed) {
    return (
      <Page title="Espace propriétaire" onBack={onBack}>
        <Card>
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginBottom: space.md }}>
            Cet espace vous permet de vérifier les paiements d'abonnement. Saisissez votre clé propriétaire (ADMIN_KEY) pour y accéder.
          </T>
          <View style={s.input}>
            <Ionicons name="key-outline" size={18} color={colors.primary} style={{ marginRight: 10 }} />
            <TextInput
              value={key}
              onChangeText={setKey}
              placeholder="Clé propriétaire"
              placeholderTextColor={colors.muted2}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={s.inputText}
            />
          </View>
          {err ? <T size={font.sm} weight="600" color={colors.danger} style={{ marginTop: 8 }}>{err}</T> : null}
          <Btn title="Accéder" icon="lock-open-outline" onPress={load} loading={loading} style={{ marginTop: space.md }} />
        </Card>
      </Page>
    );
  }

  const payments = data?.payments || [];
  const totals = data?.totals || {};
  const referral = data?.referral || { totalCommission: 0, count: 0, referrers: [] };
  const clientsCount = users.filter((u) => u.role === 'client').length;
  const gerantsCount = users.filter((u) => u.role === 'gerant').length;

  return (
    <Page title="Paiements d'abonnement" onBack={onBack}>
      {/* Résumé */}
      <Card style={{ backgroundColor: colors.primarySoft }}>
        <T size={font.sm} weight="700" color={colors.primary} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Total reçu (déclaré)</T>
        <T size={font.h2} weight="900" color={colors.primary} style={{ marginTop: 6 }}>{money(totals.totalReceived)}</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4 }}>{totals.count || 0} paiement(s) enregistré(s)</T>
        {totals.byPlan && (
          <View style={{ flexDirection: 'row', marginTop: space.md }}>
            {Object.entries(totals.byPlan).map(([k, v]) => (
              <View key={k} style={s.planChip}>
                <T size={font.xs} weight="800" color={colors.primary}>{(k === 'annual' ? 'Annuel' : 'Mensuel')} · {money(v)}</T>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Commissions de parrainage à verser */}
      <Card style={{ marginTop: space.lg, backgroundColor: '#F0FBF5' }}>
        <T size={font.sm} weight="700" color={colors.success} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Commissions de parrainage à verser</T>
        <T size={font.h2} weight="900" color={colors.success} style={{ marginTop: 6 }}>{money(referral.totalCommission)}</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4 }}>{referral.count || 0} commission(s) générée(s) · {referral.referrers.length} parrain(s)</T>

        {referral.referrers.length > 0 && (
          <View style={{ marginTop: space.md }}>
            {referral.referrers.map((r) => (
              <View key={r.referrerId} style={s.refRow}>
                <View style={{ flex: 1 }}>
                  <T size={font.sm} weight="800" color={colors.text}>{r.name || '—'}</T>
                  <T size={font.xs} weight="600" color={colors.muted}>{r.phone} · {r.count} commission(s) · {r.rate} %</T>
                </View>
                <T size={font.sm} weight="900" color={colors.success}>{money(r.totalCommission)}</T>
              </View>
            ))}
          </View>
        )}
        <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 10 }}>
          Réglez ces montants aux parrains directement (via Wave). Aucun argent n'est stocké ni envoyé automatiquement.
        </T>
      </Card>

      {/* ---- Activité : entrées / sorties des utilisateurs ---- */}
      <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: space.lg, marginBottom: space.sm }}>Activité des utilisateurs</T>

      <View style={{ flexDirection: 'row', marginBottom: space.sm }}>
        <View style={{ flex: 1, marginRight: 8 }}><StatTile icon="people-outline" value={users.length} label="Utilisateurs" tone="purple" /></View>
        <View style={{ flex: 1, marginRight: 8 }}><StatTile icon="person-outline" value={clientsCount} label="Clients" tone="blue" /></View>
        <View style={{ flex: 1 }}><StatTile icon="storefront-outline" value={gerantsCount} label="Gérants" tone="orange" /></View>
      </View>

      <Card style={{ marginTop: space.sm }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 6 }}>Dernières inscriptions</T>
        {users.length === 0 ? (
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4 }}>
            Aucun utilisateur inscrit pour l'instant. Les nouvelles inscriptions apparaîtront ici dès qu'un compte est créé.
          </T>
        ) : (
          users.map((u) => {
            const st = u.subscription?.status === 'active' ? { l: 'Actif', c: colors.success, bg: colors.successBg, i: 'checkmark-circle' }
              : u.subscription?.status === 'expired' ? { l: 'Expiré', c: colors.danger, bg: colors.dangerBg, i: 'alert-circle' }
              : { l: 'Essai', c: colors.primary, bg: colors.primarySoft, i: 'sparkles' };
            return (
              <ListRow
                key={u.id}
                icon={u.role === 'gerant' ? 'storefront-outline' : 'person-outline'}
                iconColor={u.role === 'gerant' ? colors.wave : colors.primary}
                label={`${u.name} · ${u.role === 'gerant' ? 'Gérant' : 'Client'}`}
                value={`${st.l} · ${fmtDate(u.createdAt)}`}
                iconBg={st.bg}
              />
            );
          })
        )}
        <T size={font.xs} weight="500" color={colors.muted2} style={{ marginTop: 10 }}>
          Le statut indique qui peut utiliser le service : « Actif » (abonnement payé), « Essai » (gratuit, non expiré) ou « Expiré » (à renouveler). Une fois un abonnement expiré, l'utilisateur ne peut plus envoyer/traiter de demandes (sortie).
        </T>
      </Card>

      {/* Liste des paiements */}
      <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: space.lg, marginBottom: space.sm }}>Historique des paiements</T>
      {payments.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Ionicons name="receipt-outline" size={36} color={colors.muted2} />
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 8 }}>Aucun paiement enregistré pour le moment.</T>
        </Card>
      ) : (
        payments.map((p) => (
          <Card key={p.reference} style={{ marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T size={font.body} weight="800" color={colors.text}>{p.name}</T>
                <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>{p.phone} · {p.role === 'gerant' ? 'Gérant' : 'Client'}</T>
              </View>
              <T size={font.body} weight="900" color={colors.success}>{money(p.amount)}</T>
            </View>
            <View style={s.row}><T size={font.xs} weight="600" color={colors.muted}>Paié le</T><T size={font.xs} weight="700" color={colors.text}>{fmtDate(p.paidAt)}</T></View>
            <View style={s.row}><T size={font.xs} weight="600" color={colors.muted}>Valable jusqu'au</T><T size={font.xs} weight="700" color={colors.text}>{fmtDate(p.validUntil)}</T></View>
            <View style={s.row}><T size={font.xs} weight="600" color={colors.muted}>Plan</T><T size={font.xs} weight="700" color={colors.text}>{p.plan === 'annual' ? 'Annuel' : 'Mensuel'}</T></View>
            <View style={s.row}><T size={font.xs} weight="600" color={colors.muted}>Référence</T><T size={font.xs} weight="700" color={colors.text}>{p.reference}</T></View>
          </Card>
        ))
      )}

      <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginBottom: 20 }}>
        Vérifiez ces montants sur votre compte Wave pour confirmer la réception.
      </T>
    </Page>
  );
}

const s = StyleSheet.create({
  input: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 14, height: 52 },
  inputText: { flex: 1, fontSize: font.body, color: colors.text, paddingVertical: 0, outlineStyle: 'none' },
  planChip: { backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  refRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
});
