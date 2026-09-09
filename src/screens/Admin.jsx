import React, { useState } from 'react';
import { View, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T, Card, Btn, StatTile, ListRow, Pill, Chip } from '../components/ui';
import { Page } from '../components/Shell';
import { Dialog, DialogButtons } from '../components/modals';
import { api } from '../api';

// ============================================================
//  Espace propriétaire — vue des paiements d'abonnement.
//  Permet de vérifier : qui a payé, combien, quand, et valable
//  jusqu'à quelle date. Sert à réconcilier avec ce que tu reçois
//  sur ton compte Wave. Accès protégé par une clé admin.
//  Organisé en onglets pour éviter de longues pages à scroller :
//  Aperçu / Utilisateurs / Activité / Parrainage / Paiements / Système.
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
  const [busy, setBusy] = useState(null); // phone de l'utilisateur en cours d'action
  const [suspendTarget, setSuspendTarget] = useState(null); // {user, frozen}
  const [deleteTarget, setDeleteTarget] = useState(null); // user

  // Liste utilisateurs : recherche + filtre + pagination (compacte).
  const [uSearch, setUSearch] = useState('');
  const [uFilter, setUFilter] = useState('all');
  const [uSort, setUSort] = useState('recent'); // recent | old | name | status
  const [uExpanded, setUExpanded] = useState(null); // phone de la ligne dépliée
  const [uCount, setUCount] = useState(25); // nombre affiché (pagination)
  const U_PAGE = 25;

  // Navigation interne entre les sections de l'Espace propriétaire.
  const [adminTab, setAdminTab] = useState('apercu'); // apercu | utilisateurs | activite | parrainage | paiements | systeme

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
  const referralCodes = data?.referralCodes || { registeredWithCode: 0, registeredWithoutCode: 0, uniqueCodesUsed: 0, byCode: [] };
  const events = data?.events || [];
  const eventCounters = data?.eventCounters || {};
  const expired = data?.expired || [];
  const dbStats = data?.dbStats || {};
  const dbCounts = dbStats.counts || {};
  const dbSizeMo = dbStats.sizeBytes ? (dbStats.sizeBytes / 1024 / 1024) : 0;
  const clientsCount = users.filter((u) => u.role === 'client').length;
  const gerantsCount = users.filter((u) => u.role === 'gerant').length;

  const EVENT_META = {
    user_registered: { label: 'Nouvel utilisateur', icon: 'person-add-outline', color: colors.primary, bg: colors.primarySoft },
    subscription_paid: { label: 'Abonnement payé', icon: 'cash-outline', color: colors.success, bg: colors.successBg },
    subscription_expired: { label: 'Abonnement expiré', icon: 'alert-circle-outline', color: colors.danger, bg: colors.dangerBg },
    user_deleted: { label: 'Compte supprimé', icon: 'trash-outline', color: colors.warn, bg: '#FDF0E0' },
  };

  const SUB_STATUS = {
    active: { label: 'Actif', color: colors.success, bg: colors.successBg },
    trial: { label: 'Essai', color: colors.primary, bg: colors.primarySoft },
    expired: { label: 'Expiré', color: colors.danger, bg: colors.dangerBg },
  };

  // Suspend / réactive un compte (bloque les activités sans supprimer les données).
  const doSetFrozen = async (user, frozen) => {
    setBusy(user.phone); setSuspendTarget(null);
    try {
      const out = await api.admin.setFrozen(key, user.phone, frozen);
      setUsers((prev) => prev.map((u) => u.phone === user.phone ? { ...u, frozen: !!out.frozen } : u));
    } catch (e) { setErr(e?.message || 'Erreur.'); }
    finally { setBusy(null); }
  };

  // Supprime définitivement un compte + toutes ses données.
  const doDelete = async (user) => {
    setBusy(user.phone); setDeleteTarget(null);
    try {
      setUsers((prev) => prev.filter((u) => u.phone !== user.phone));
      const summary = await api.admin.summary(key);
      setData(summary);
    } catch (e) { setErr(e?.message || 'Erreur.'); }
    finally { setBusy(null); }
  };

  // Export CSV de la liste des utilisateurs (respecte recherche + filtres + tri).
  const exportCsv = () => {
    const header = ['Nom', 'Téléphone', 'Rôle', 'Statut', 'Abonnement jusqu\'au', 'Suspendu'];
    const roleLabel = (r) => (r === 'gerant' ? 'Gérant' : 'Client');
    const statusLabel = (u) => (SUB_STATUS[u.subscription?.status] || SUB_STATUS.trial).label;
    const rows = filteredUsers.map((u) => [
      u.name || '',
      u.phone || '',
      roleLabel(u.role),
      statusLabel(u),
      u.subscription?.subscribedUntil ? fmtDate(u.subscription.subscribedUntil) : '',
      u.frozen ? 'Oui' : '',
    ]);
    const escape = (v) => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(escape).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filtre la liste utilisateurs (recherche insensible aux accents/casse + statut).
  const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const filteredUsers = users.filter((u) => {
    if (uSearch && !norm(`${u.name} ${u.phone}`).includes(norm(uSearch))) return false;
    const st = u.subscription?.status;
    if (uFilter === 'active') return st === 'active';
    if (uFilter === 'trial') return st === 'trial';
    if (uFilter === 'expired') return st === 'expired';
    if (uFilter === 'suspended') return !!u.frozen;
    return true;
  }).slice().sort((a, b) => {
    // Tri : par inscription (récent/ancien), par nom, ou par statut.
    if (uSort === 'name') return norm(a.name).localeCompare(norm(b.name));
    const rank = { active: 0, trial: 1, expired: 2 };
    if (uSort === 'status') return (rank[a.subscription?.status] ?? 3) - (rank[b.subscription?.status] ?? 3);
    // recent | old : par createdAt
    if (uSort === 'old') return (a.createdAt || 0) - (b.createdAt || 0);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  const shownUsers = filteredUsers.slice(0, uCount);
  const FILTERS = [
    { value: 'all', label: 'Tous' },
    { value: 'active', label: 'Actifs' },
    { value: 'trial', label: 'Essais' },
    { value: 'expired', label: 'Expirés' },
    { value: 'suspended', label: 'Suspendus' },
  ];
  const SORTS = [
    { value: 'recent', label: 'Récent d\'abord' },
    { value: 'old', label: 'Ancien d\'abord' },
    { value: 'name', label: 'Nom (A→Z)' },
    { value: 'status', label: 'Statut' },
  ];

  // Sections de l'Espace propriétaire (navigation interne).
  const ADMIN_TABS = [
    { key: 'apercu', label: 'Aperçu', icon: 'grid-outline', filled: 'grid' },
    { key: 'utilisateurs', label: 'Utilisateurs', icon: 'people-outline', filled: 'people', badge: users.length },
    { key: 'activite', label: 'Activité', icon: 'pulse-outline', filled: 'pulse', badge: events.length },
    { key: 'parrainage', label: 'Parrainage', icon: 'gift-outline', filled: 'gift', badge: referral.referrers.length },
    { key: 'paiements', label: 'Paiements', icon: 'cash-outline', filled: 'cash', badge: payments.length },
    { key: 'systeme', label: 'Système', icon: 'server-outline', filled: 'server' },
  ];

  return (
    <Page title="Espace propriétaire" onBack={onBack}>
      {/* Barre de sections (onglets) */}
      <View style={s.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {ADMIN_TABS.map((t) => {
            const on = t.key === adminTab;
            return (
              <Pressable key={t.key} onPress={() => setAdminTab(t.key)} style={[s.tabBtn, on && s.tabBtnOn]}>
                <Ionicons name={on ? t.filled : t.icon} size={15} color={on ? colors.white : colors.muted} />
                <T size={font.sm} weight={on ? '800' : '700'} color={on ? colors.white : colors.muted} style={{ marginLeft: 6 }}>{t.label}</T>
                {t.badge != null ? (
                  <View style={[s.tabBadge, on && s.tabBadgeOn]}>
                    <T size={11} weight="800" color={on ? colors.primary : colors.white}>{t.badge}</T>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ===== Aperçu ===== */}
      {adminTab === 'apercu' && (
        <>
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

          <View style={{ flexDirection: 'row', marginTop: space.lg, marginBottom: space.sm }}>
            <View style={{ flex: 1, marginRight: 8 }}><StatTile icon="people-outline" value={users.length} label="Utilisateurs" tone="purple" /></View>
            <View style={{ flex: 1, marginRight: 8 }}><StatTile icon="person-outline" value={clientsCount} label="Clients" tone="blue" /></View>
            <View style={{ flex: 1 }}><StatTile icon="storefront-outline" value={gerantsCount} label="Gérants" tone="orange" /></View>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: space.sm }}>
            <View style={{ flex: 1, marginRight: 8 }}><StatTile icon="person-add-outline" value={eventCounters.user_registered || 0} label="Inscriptions" tone="green" /></View>
            <View style={{ flex: 1, marginRight: 8 }}><StatTile icon="cash-outline" value={eventCounters.subscription_paid || 0} label="Paiements" tone="green" /></View>
            <View style={{ flex: 1, marginRight: 8 }}><StatTile icon="alert-circle-outline" value={eventCounters.subscription_expired || 0} label="Expirés" tone="orange" /></View>
            <View style={{ flex: 1 }}><StatTile icon="trash-outline" value={eventCounters.user_deleted || 0} label="Supprimés" tone="orange" /></View>
          </View>
          <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginBottom: 4 }}>
            Entrées = Inscriptions · Paiements. Sorties = Expirés · Supprimés.
          </T>
        </>
      )}

      {/* ===== Utilisateurs ===== */}
      {adminTab === 'utilisateurs' && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
            <View style={{ flex: 1 }}>
              <T size={font.h3} weight="800" color={colors.text}>Utilisateurs</T>
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2 }}>
                {users.length} compte(s) · {clientsCount} client(s) · {gerantsCount} gérant(s)
              </T>
            </View>
            {users.length > 0 && (
              <Btn title="Exporter" icon="download-outline" outline color={colors.primary} size="sm" onPress={exportCsv} />
            )}
          </View>

          <Card style={s.searchCard}>
            <View style={s.search}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                value={uSearch}
                onChangeText={(t) => { setUSearch(t); setUCount(U_PAGE); }}
                placeholder="Rechercher un nom ou un numéro"
                placeholderTextColor={colors.muted2}
                style={s.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {uSearch ? (
                <Pressable onPress={() => { setUSearch(''); setUCount(U_PAGE); }} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.muted2} />
                </Pressable>
              ) : null}
            </View>
          </Card>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
            {FILTERS.map((f) => (
              <Chip key={f.value} label={f.label} active={uFilter === f.value} onPress={() => { setUFilter(f.value); setUCount(U_PAGE); }} />
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <T size={font.xs} weight="700" color={colors.muted} style={{ marginRight: 8 }}>Tri :</T>
            {SORTS.map((s) => (
              <Chip key={s.value} label={s.label} active={uSort === s.value} onPress={() => { setUSort(s.value); setUCount(U_PAGE); }} />
            ))}
          </View>

          {uExpanded && (
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }} onPress={() => setUExpanded(null)}>
              <Ionicons name="chevron-up-circle-outline" size={16} color={colors.primary} />
              <T size={font.sm} weight="800" color={colors.primary} style={{ marginLeft: 6 }}>Tout replier</T>
            </Pressable>
          )}

          {filteredUsers.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
              <Ionicons name="people-outline" size={34} color={colors.muted2} />
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 8, textAlign: 'center' }}>
                {users.length === 0 ? 'Aucun utilisateur pour le moment.' : 'Aucun utilisateur ne correspond à cette recherche ou ce filtre.'}
              </T>
            </Card>
          ) : (
            <Card style={{ paddingVertical: 4 }}>
              {shownUsers.map((u, idx) => {
                const st = SUB_STATUS[u.subscription?.status] || SUB_STATUS.trial;
                const open = uExpanded === u.phone;
                return (
                  <View key={u.id} style={[s.uRow, idx > 0 && s.uDivider]}>
                    <Pressable style={s.uLine} onPress={() => setUExpanded(open ? null : u.phone)}>
                      <View style={s.uIconSm}>
                        <Ionicons name={u.role === 'gerant' ? 'storefront-outline' : 'person-outline'} size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                          <T size={font.body} weight="800" color={colors.text} numberOfLines={1}>{u.name || '—'}</T>
                          {u.frozen ? <View style={s.frozenBadge}><T size={font.xs} weight="800" color={colors.warn}>Suspendu</T></View> : null}
                        </View>
                        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 1 }}>
                          {u.phone} · {u.role === 'gerant' ? 'Gérant' : 'Client'}
                        </T>
                      </View>
                      <Pill icon={st.icon} color={st.color} bg={st.bg} style={{ marginLeft: 8 }}>{st.label}</Pill>
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted2} style={{ marginLeft: 6 }} />
                    </Pressable>

                    {open && (
                      <View style={s.uActions}>
                        <T size={font.xs} weight="600" color={colors.muted2} style={{ marginBottom: 10 }}>
                          {u.subscription?.subscribedUntil
                            ? (u.subscription.status === 'active'
                                ? `Abonnement actif jusqu'au ${fmtDate(u.subscription.subscribedUntil)}.`
                                : `Abonnement expiré le ${fmtDate(u.subscription.subscribedUntil)}.`)
                            : 'Aucun abonnement payé.'}
                        </T>
                        <View style={{ flexDirection: 'row' }}>
                          <Btn
                            title={u.frozen ? 'Réactiver' : 'Suspendre'}
                            icon={u.frozen ? 'checkmark-circle-outline' : 'pause-circle-outline'}
                            outline
                            color={u.frozen ? colors.success : colors.warn}
                            size="sm"
                            onPress={() => setSuspendTarget({ user: u, frozen: !u.frozen })}
                            loading={busy === u.phone}
                            style={{ flex: 1, marginRight: 8 }}
                          />
                          <Btn
                            title="Supprimer"
                            icon="trash-outline"
                            outline
                            color={colors.danger}
                            size="sm"
                            onPress={() => setDeleteTarget(u)}
                            loading={busy === u.phone}
                            style={{ flex: 1 }}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
              {uCount < filteredUsers.length && (
                <Pressable style={{ alignItems: 'center', paddingVertical: 12 }} onPress={() => setUCount((c) => c + U_PAGE)}>
                  <T size={font.sm} weight="800" color={colors.primary}>Charger plus ({filteredUsers.length - uCount} restant{filteredUsers.length - uCount > 1 ? 's' : ''})</T>
                </Pressable>
              )}
            </Card>
          )}
        </>
      )}

      {/* ===== Activité ===== */}
      {adminTab === 'activite' && (
        <>
          <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: space.sm }}>Journal d'activité</T>
          <Card>
            {events.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Ionicons name="time-outline" size={30} color={colors.muted2} />
                <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 8, textAlign: 'center' }}>
                  Aucune activité pour l'instant. Les inscriptions, paiements, expirations et suppressions apparaîtront ici.
                </T>
              </View>
            ) : (
              events.map((e) => {
                const m = EVENT_META[e.type] || { label: e.type, icon: 'ellipse-outline', color: colors.muted, bg: colors.gray };
                return (
                  <ListRow
                    key={e.id}
                    icon={m.icon}
                    iconColor={m.color}
                    iconBg={m.bg}
                    label={`${e.name || '—'}${e.phone ? ' · ' + e.phone : ''}${e.role ? ' · ' + (e.role === 'gerant' ? 'Gérant' : 'Client') : ''}`}
                    value={`${m.label} · ${fmtDate(e.createdAt)}${e.amount ? ' · ' + money(e.amount) : ''}`}
                  />
                );
              })
            )}
          </Card>

          <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: space.lg, marginBottom: space.sm }}>Abonnements expirés</T>
          <Card>
            {expired.length === 0 ? (
              <T size={font.sm} weight="600" color={colors.muted}>Aucun abonnement expiré en ce moment.</T>
            ) : (
              expired.map((u) => (
                <ListRow
                  key={u.id}
                  icon="alert-circle-outline"
                  iconColor={colors.danger}
                  iconBg={colors.dangerBg}
                  label={`${u.name} · ${u.phone} · ${u.role === 'gerant' ? 'Gérant' : 'Client'}`}
                  value={`Expiré depuis le ${fmtDate(u.subscribedUntil)}`}
                />
              ))
            )}
            <T size={font.xs} weight="500" color={colors.muted2} style={{ marginTop: 10 }}>
              Un abonnement expiré bloque l'utilisateur : un client ne peut plus envoyer de demande, un gérant ne peut plus en traiter. C'est une « sortie » à surveiller.
            </T>
          </Card>
        </>
      )}

      {/* ===== Parrainage ===== */}
      {adminTab === 'parrainage' && (
        <>
          <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: space.sm }}>Codes de parrainage</T>
          <Card>
            <View style={{ flexDirection: 'row', marginBottom: space.sm }}>
              <View style={s.codeChip}><T size={font.xs} weight="800" color={colors.primary}>{referralCodes.registeredWithCode || 0} inscrit(s) avec un code</T></View>
              <View style={s.codeChip}><T size={font.xs} weight="800" color={colors.muted}>{referralCodes.uniqueCodesUsed || 0} code(s) utilisés</T></View>
            </View>
            {referralCodes.byCode.length === 0 ? (
              <T size={font.sm} weight="600" color={colors.muted}>Aucun code de parrainage utilisé pour l'instant.</T>
            ) : referralCodes.byCode.map((c) => (
              <View key={c.code} style={s.refRow}>
                <View style={{ flex: 1 }}>
                  <T size={font.sm} weight="800" color={colors.text}>{c.code || '(parrain sans code)'}</T>
                  <T size={font.xs} weight="600" color={colors.muted}>{c.referrerName || ''} · {c.referrerPhone || ''}</T>
                </View>
                <T size={font.sm} weight="900" color={colors.primary}>{c.count} utilisateur(s)</T>
              </View>
            ))}
          </Card>

          <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: space.lg, marginBottom: space.sm }}>Commissions à verser</T>
          <Card style={{ backgroundColor: '#F0FBF5' }}>
            <T size={font.h2} weight="900" color={colors.success}>{money(referral.totalCommission)}</T>
            <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2 }}>{referral.count || 0} commission(s) · {referral.referrers.length} parrain(s)</T>
            {referral.referrers.map((r) => (
              <View key={r.referrerId} style={s.refRow}>
                <View style={{ flex: 1 }}>
                  <T size={font.sm} weight="800" color={colors.text}>{r.name || '—'}</T>
                  <T size={font.xs} weight="600" color={colors.muted}>{r.phone} · {r.count} · {r.rate} %</T>
                </View>
                <T size={font.sm} weight="900" color={colors.success}>{money(r.totalCommission)}</T>
              </View>
            ))}
            <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 10 }}>
              Réglez ces montants aux parrains directement (via Wave). Aucun argent n'est stocké ni envoyé automatiquement.
            </T>
          </Card>
        </>
      )}

      {/* ===== Paiements ===== */}
      {adminTab === 'paiements' && (
        <>
          <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: space.sm }}>Historique des paiements</T>
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
          <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 12, marginBottom: 4 }}>
            Vérifiez ces montants sur votre compte Wave pour confirmer la réception.
          </T>
        </>
      )}

      {/* ===== Système ===== */}
      {adminTab === 'systeme' && (
        <>
          <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: space.sm }}>Base de données</T>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <T size={font.xs} weight="700" color={colors.muted}>TOTAL LIGNES</T>
                <T size={font.h1} weight="800" color={colors.primary} style={{ marginTop: 4 }}>{(dbStats.totalRecords || 0).toLocaleString('fr-FR')}</T>
              </View>
              <View style={s.sumIcon}>
                <Ionicons name="server-outline" size={26} color={colors.primary} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', marginTop: space.lg }}>
              <View style={{ flex: 1, marginRight: 8 }}><StatTile icon="people-outline" value={dbCounts.users || 0} label="Users" tone="purple" /></View>
              <View style={{ flex: 1, marginRight: 8 }}><StatTile icon="swap-vertical-outline" value={dbCounts.demandes || 0} label="Demandes" tone="blue" /></View>
              <View style={{ flex: 1, marginRight: 8 }}><StatTile icon="time-outline" value={dbCounts.events || 0} label="Événements" tone="orange" /></View>
              <View style={{ flex: 1 }}><StatTile icon="cash-outline" value={dbCounts.subscriptions || 0} label="Paiements" tone="green" /></View>
            </View>
            <View style={{ flexDirection: 'row', marginTop: space.sm }}>
              <View style={{ flex: 1, marginRight: 8 }}><StatTile icon="link-outline" value={dbCounts.referrals || 0} label="Parrainages" tone="blue" /></View>
              <View style={{ flex: 1, marginRight: 8 }}><StatTile icon="notifications-outline" value={dbCounts.notifications || 0} label="Notifs" tone="orange" /></View>
              <View style={{ flex: 1, marginRight: 8 }}><StatTile icon="ribbon-outline" value={dbCounts.gerants || 0} label="Contacts" tone="purple" /></View>
              <View style={{ flex: 1 }}><StatTile icon="server-outline" value={dbSizeMo ? dbSizeMo.toFixed(1) : 0} label="Taille (Mo)" tone="green" /></View>
            </View>
            <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 12 }}>
              Charge de la base : chaque action réécrit toutes les données. Au-delà de ~5 000 utilisateurs, un passage en tables PostgreSQL sera nécessaire pour garder la fluidité.
            </T>
          </Card>
        </>
      )}

      {/* Confirmation : suspendre / réactiver */}
      <Dialog visible={!!suspendTarget}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>
          {suspendTarget?.frozen && !suspendTarget?.user?.frozen ? 'Suspendre ce compte ?' : 'Réactiver ce compte ?'}
        </T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>
          {suspendTarget?.frozen && !suspendTarget?.user?.frozen
            ? (suspendTarget?.user?.role === 'gerant'
                ? `Ce gérant ne recevra PAS de nouvelles demandes et ne sera plus proposé aux clients tant que vous ne l'aurez pas réactivé.`
                : `${suspendTarget?.user?.name} (${suspendTarget?.user?.phone}) ne pourra plus envoyer de demandes. Vous pourrez le réactiver ensuite.`)
            : (suspendTarget?.user?.role === 'gerant'
                ? `Ce gérant retrouvera le droit de recevoir et traiter des demandes, et réapparaîtra dans le choix des clients.`
                : `${suspendTarget?.user?.name} (${suspendTarget?.user?.phone}) retrouvera le droit d'envoyer des demandes.`)}
        </T>
        <DialogButtons
          cancel="Retour"
          confirm={suspendTarget?.frozen && !suspendTarget?.user?.frozen ? 'Suspendre' : 'Réactiver'}
          onCancel={() => setSuspendTarget(null)}
          onConfirm={() => doSetFrozen(suspendTarget.user, suspendTarget.frozen)}
        />
      </Dialog>

      {/* Confirmation : suppression définitive */}
      <Dialog visible={!!deleteTarget}>
        <T size={font.h3} weight="800" color={colors.danger} style={{ textAlign: 'center' }}>Supprimer définitivement ?</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>
          Le compte de {deleteTarget?.name} ({deleteTarget?.phone}) et TOUTES ses données (demandes, notifications, abonnements, parrainages) seront effacées. Cette action est irréversible.
        </T>
        <DialogButtons
          cancel="Annuler"
          confirm="Supprimer"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => doDelete(deleteTarget)}
        />
      </Dialog>
    </Page>
  );
}

const s = StyleSheet.create({
  input: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 14, height: 52 },
  inputText: { flex: 1, fontSize: font.body, color: colors.text, paddingVertical: 0, outlineStyle: 'none' },
  // Barre de sections
  tabBar: { marginBottom: space.md },
  tabRow: { flexDirection: 'row', paddingBottom: 2 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  tabBtnOn: { backgroundColor: colors.primary },
  tabBadge: { backgroundColor: colors.primarySoft, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 6, paddingHorizontal: 4 },
  tabBadgeOn: { backgroundColor: '#fff' },
  sumIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  searchCard: { marginBottom: space.sm, paddingVertical: 8, paddingHorizontal: 14 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: font.body, color: colors.text, paddingVertical: 0, outlineStyle: 'none', marginLeft: 8 },
  uRow: { paddingVertical: 10, paddingHorizontal: 4 },
  uDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  uLine: { flexDirection: 'row', alignItems: 'center' },
  uIconSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  uActions: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  frozenBadge: { backgroundColor: '#FDF0E0', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  planChip: { backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  codeChip: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  refRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
});
