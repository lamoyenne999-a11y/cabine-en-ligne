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
  const [giftTarget, setGiftTarget] = useState(null);       // utilisateur à qui offrir du temps
  const [giftDays, setGiftDays] = useState(30);
  const [giftCustom, setGiftCustom] = useState('');
  const [giftNote, setGiftNote] = useState('');
  const [giftDone, setGiftDone] = useState('');
  const [certTarget, setCertTarget] = useState(null);       // {user, certified}
  const [pwdTarget, setPwdTarget] = useState(null);         // user dont on réinitialise le mot de passe
  const [pwdResult, setPwdResult] = useState(null);         // { name, phone, tempPassword }
  const [pwdCopied, setPwdCopied] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);   // paiement déclaré à rejeter
  const [suspendReason, setSuspendReason] = useState('other');
  const [suspendNote, setSuspendNote] = useState('');
  const [reportTarget, setReportTarget] = useState(null);   // {report, decision}
  const [annKind, setAnnKind] = useState('tip');
  const [annAudience, setAnnAudience] = useState('all');
  const [annTitle, setAnnTitle] = useState('');
  const [annText, setAnnText] = useState('');
  const [annConfirm, setAnnConfirm] = useState(false);
  const [annDone, setAnnDone] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // user
  const [blockTarget, setBlockTarget] = useState(null); // user à bloquer
  const [unblockTarget, setUnblockTarget] = useState(null); // user à débloquer
  const [resolveTarget, setResolveTarget] = useState(null); // {request, decision}

  // Liste utilisateurs : recherche + filtre + pagination (compacte).
  const [uSearch, setUSearch] = useState('');
  const [uFilter, setUFilter] = useState('all');
  const [uRole, setURole] = useState('all'); // all | client | gerant — tri Clients / Gérants
  const [uSort, setUSort] = useState('recent'); // recent | old | name | status
  const [uExpanded, setUExpanded] = useState(null); // phone de la ligne dépliée
  const [uCount, setUCount] = useState(25); // nombre affiché (pagination)
  const U_PAGE = 25;

  // Navigation interne entre les sections de l'Espace propriétaire.
  const [adminTab, setAdminTab] = useState('apercu'); // apercu | utilisateurs | activite | parrainage | paiements | systeme
  const goUsers = (role) => { setURole(role); setUFilter('all'); setUCount(U_PAGE); setAdminTab('utilisateurs'); };

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
  const pendingPayments = data?.pendingPayments || [];
  const reports = data?.reports || [];
  const openReports = reports.filter((r) => r.status === 'open');
  const announcements = data?.announcements || [];
  const audienceCounts = data?.audienceCounts || { all: 0, client: 0, gerant: 0 };
  const pendingOld = data?.pendingOld || 0;
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
    announcement_sent: { label: 'Message envoyé aux utilisateurs', icon: 'megaphone-outline', color: colors.primary, bg: colors.primarySoft },
    report_created: { label: 'Signalement', icon: 'flag-outline', color: colors.danger, bg: colors.dangerBg },
    user_suspended: { label: 'Compte suspendu', icon: 'ban-outline', color: colors.danger, bg: colors.dangerBg },
    user_reactivated: { label: 'Compte réactivé', icon: 'checkmark-circle-outline', color: colors.success, bg: colors.successBg },
    subscription_declared: { label: 'Paiement déclaré (à vérifier)', icon: 'hourglass-outline', color: colors.warn, bg: colors.warnBg },
    subscription_paid: { label: 'Abonnement confirmé', icon: 'cash-outline', color: colors.success, bg: colors.successBg },
    subscription_expired: { label: 'Abonnement expiré', icon: 'alert-circle-outline', color: colors.danger, bg: colors.dangerBg },
    user_deleted: { label: 'Compte supprimé', icon: 'trash-outline', color: colors.warn, bg: '#FDF0E0' },
    user_blocked: { label: 'Compte bloqué', icon: 'ban-outline', color: colors.danger, bg: colors.dangerBg },
    user_unblocked: { label: 'Compte débloqué', icon: 'checkmark-circle-outline', color: colors.success, bg: colors.successBg },
    unblock_request: { label: 'Demande de déblocage', icon: 'mail-unread-outline', color: colors.primary, bg: colors.primarySoft },
  };

  // Demandes de déblocage en attente + numéros bloqués (fournis par le résumé).
  const unblockRequests = data?.unblockRequests || [];
  const blockedPhones = data?.blocked || [];

  const SUB_STATUS = {
    active: { label: 'Actif', color: colors.success, bg: colors.successBg },
    trial: { label: 'Essai', color: colors.primary, bg: colors.primarySoft },
    expired: { label: 'Expiré', color: colors.danger, bg: colors.dangerBg },
  };

  // Libellé + couleur de la validité du compte, affichés DIRECTEMENT dans la
  // liste pour que le propriétaire décide en un coup d'œil : laisser continuer,
  // suspendre ou bloquer.
  const validityLabel = (u) => {
    if (u.blocked) return 'Bloqué — accès révoqué';
    const s = u.subscription || {};
    if (s.status === 'active' && s.subscribedUntil) return `Valable jusqu'au ${fmtDate(s.subscribedUntil)}`;
    if (s.status === 'trial' && s.trialEndsAt) return `Essai jusqu'au ${fmtDate(s.trialEndsAt)}`;
    if (s.status === 'expired') {
      if (s.subscribedUntil) return `Expiré le ${fmtDate(s.subscribedUntil)}`;
      if (s.trialEndsAt) return `Essai expiré le ${fmtDate(s.trialEndsAt)}`;
      return 'Expiré';
    }
    return '';
  };
  const validityColor = (u) => {
    if (u.blocked) return colors.danger;
    const st = u.subscription?.status;
    if (st === 'active') return colors.success;
    if (st === 'trial') return colors.primary;
    if (st === 'expired') return colors.danger;
    return colors.muted;
  };

  // Suspend / réactive un compte (bloque les activités sans supprimer les données).
  const doSetFrozen = async (user, frozen) => {
    setBusy(user.phone); setSuspendTarget(null);
    try {
      const out = await api.admin.setFrozen(key, user.phone, frozen, suspendReason, suspendNote);
      setUsers((prev) => prev.map((u) => u.phone === user.phone ? { ...u, frozen: !!out.frozen, frozenReason: out.frozenReason || '', frozenNote: out.frozenNote || '' } : u));
      setSuspendNote('');
    } catch (e) { setErr(e?.message || 'Erreur.'); }
    finally { setBusy(null); }
  };

  // Offre du temps gratuit (récompense / reconduction d'essai).
  const doGift = async () => {
    const user = giftTarget; if (!user) return;
    const days = giftCustom ? parseInt(giftCustom, 10) : giftDays;
    if (!(days > 0)) { setErr('Indiquez une durée valide.'); return; }
    setBusy(user.phone);
    try {
      const out = await api.admin.grantFreeTime(key, user.phone, days, giftNote.trim());
      setUsers((prev) => prev.map((u) => u.phone === user.phone ? { ...u, subscription: out.subscription, lastGift: { days, at: Date.now(), note: giftNote.trim() } } : u));
      setGiftDone(`${days} jour${days > 1 ? 's' : ''} offert${days > 1 ? 's' : ''} à ${user.name}. Il/elle a été notifié(e).`);
      setGiftTarget(null); setGiftCustom(''); setGiftNote(''); setGiftDays(30);
      setTimeout(() => setGiftDone(''), 4000);
    } catch (e) { setErr(e?.message || 'Erreur.'); }
    finally { setBusy(null); }
  };

  // Réinitialise le mot de passe (l'utilisateur l'a oublié) → mot de passe temporaire à lui transmettre.
  const doResetPassword = async (user) => {
    setBusy(user.phone); setPwdTarget(null);
    try {
      const out = await api.admin.resetPassword(key, user.phone);
      setPwdResult(out);
    } catch (e) { setErr(e?.message || 'Erreur.'); }
    finally { setBusy(null); }
  };
  const copyTempPwd = () => {
    const msg = `Cabine En Ligne — votre nouveau mot de passe temporaire : ${pwdResult?.tempPassword}. Connectez-vous avec le numéro ${pwdResult?.phone}.`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(msg).catch(() => {});
    setPwdCopied(true); setTimeout(() => setPwdCopied(false), 1800);
  };

  // Envoi d'un message (astuce / alerte / info) aux utilisateurs.
  const doAnnounce = async () => {
    setAnnConfirm(false); setBusy('announce');
    try {
      const out = await api.admin.announce(key, { kind: annKind, audience: annAudience, title: annTitle, text: annText });
      setAnnDone(`Message envoyé à ${out.announcement?.recipients || 0} utilisateur(s).`);
      setAnnTitle(''); setAnnText('');
      await reload();
      setTimeout(() => setAnnDone(''), 5000);
    } catch (e) { setErr(e?.message || 'Envoi impossible.'); }
    finally { setBusy(null); }
  };

  // Validation manuelle d'un paiement d'abonnement déclaré.
  const doConfirmPayment = async (p) => {
    setBusy(p.id);
    try { await api.admin.confirmPayment(key, p.id); await reload(); }
    catch (e) { setErr(e?.message || 'Erreur.'); }
    finally { setBusy(null); }
  };
  const doRejectPayment = async (p) => {
    setBusy(p.id); setRejectTarget(null);
    try { await api.admin.rejectPayment(key, p.id, ''); await reload(); }
    catch (e) { setErr(e?.message || 'Erreur.'); }
    finally { setBusy(null); }
  };

  // Certifie / retire la certification d'un gérant.
  const doSetCertified = async (user, certified) => {
    setBusy(user.phone); setCertTarget(null);
    try {
      const out = await api.admin.setCertified(key, user.phone, certified);
      setUsers((prev) => prev.map((u) => u.phone === user.phone ? { ...u, certified: !!out.certified } : u));
    } catch (e) { setErr(e?.message || 'Erreur.'); }
    finally { setBusy(null); }
  };

  // Recharge les données (résumé + utilisateurs) après une action.
  const reload = async () => {
    const summary = await api.admin.summary(key);
    setData(summary);
    try { const u = await api.admin.users(key); setUsers(u.users || []); } catch { setUsers([]); }
  };

  // Supprime définitivement un compte + toutes ses données.
  const doDelete = async (user) => {
    setBusy(user.phone); setDeleteTarget(null);
    try {
      // On appelle réellement le serveur : sans ça, le compte restait en base
      // et réapparaissait dans la liste au prochain chargement.
      const out = await api.admin.deleteAccount(key, user.phone);
      if (out && out.removed) {
        await reload();
      } else {
        setErr(out?.error || 'Suppression impossible (compte introuvable).');
      }
    } catch (e) { setErr(e?.message || 'Erreur de suppression.'); }
    finally { setBusy(null); }
  };

  // Bloque un numéro (liste noire) : il ne peut plus se connecter ni se réinscrire.
  const doBlock = async (user) => {
    setBusy(user.phone); setBlockTarget(null);
    try {
      const out = await api.admin.blockAccount(key, user.phone);
      if (out && out.ok) await reload();
      else setErr(out?.error || 'Blocage impossible.');
    } catch (e) { setErr(e?.message || 'Erreur de blocage.'); }
    finally { setBusy(null); }
  };

  // Débloque un numéro (le retire de la liste noire et réactive le compte).
  const doUnblock = async (user) => {
    setBusy(user.phone); setUnblockTarget(null);
    try {
      const out = await api.admin.unblockAccount(key, user.phone);
      if (out && out.ok) await reload();
      else setErr(out?.error || 'Déblocage impossible.');
    } catch (e) { setErr(e?.message || 'Erreur de déblocage.'); }
    finally { setBusy(null); }
  };

  // Décision sur une demande de déblocage : débloquer ou supprimer définitivement.
  const doResolveUnblock = async (req, decision) => {
    setBusy(req.id); setResolveTarget(null);
    try {
      const out = await api.admin.resolveUnblockRequest(key, req.id, decision);
      if (out && out.ok) await reload();
      else setErr(out?.error || 'Action impossible.');
    } catch (e) { setErr(e?.message || 'Erreur.'); }
    finally { setBusy(null); }
  };

  // Export CSV de la liste des utilisateurs (respecte recherche + filtres + tri).
  const exportCsv = () => {
    const header = ['Nom', 'Téléphone', 'Rôle', 'Statut', 'Validité', 'Bloqué', 'Suspendu'];
    const roleLabel = (r) => (r === 'gerant' ? 'Gérant' : 'Client');
    const statusLabel = (u) => (SUB_STATUS[u.subscription?.status] || SUB_STATUS.trial).label;
    const validityCsv = (u) => {
      const s = u.subscription || {};
      if (u.blocked) return 'Bloqué';
      if (s.status === 'active' && s.subscribedUntil) return `Valable jusqu'au ${fmtDate(s.subscribedUntil)}`;
      if (s.status === 'trial' && s.trialEndsAt) return `Essai jusqu'au ${fmtDate(s.trialEndsAt)}`;
      if (s.status === 'expired') return s.subscribedUntil ? `Expiré le ${fmtDate(s.subscribedUntil)}` : (s.trialEndsAt ? `Essai expiré le ${fmtDate(s.trialEndsAt)}` : 'Expiré');
      return '';
    };
    const rows = filteredUsers.map((u) => [
      u.name || '',
      u.phone || '',
      roleLabel(u.role),
      statusLabel(u),
      validityCsv(u),
      u.blocked ? 'Oui' : '',
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
    if (uRole !== 'all' && u.role !== uRole) return false;
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
    { key: 'messages', label: 'Messages', icon: 'megaphone-outline', filled: 'megaphone', badge: 0 },
    { key: 'signalements', label: 'Signalements', icon: 'flag-outline', filled: 'flag', badge: openReports.length },
    { key: 'deblocages', label: 'Déblocages', icon: 'lock-open-outline', filled: 'lock-open', badge: unblockRequests.length },
    { key: 'activite', label: 'Activité', icon: 'pulse-outline', filled: 'pulse', badge: events.length },
    { key: 'parrainage', label: 'Parrainage', icon: 'gift-outline', filled: 'gift', badge: referral.referrers.length },
    { key: 'paiements', label: 'Paiements', icon: 'cash-outline', filled: 'cash', badge: pendingPayments.length || payments.length },
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
            <Pressable style={{ flex: 1, marginRight: 8 }} onPress={() => goUsers('client')}><StatTile icon="person-outline" value={clientsCount} label="Clients ›" tone="blue" /></Pressable>
            <Pressable style={{ flex: 1 }} onPress={() => goUsers('gerant')}><StatTile icon="storefront-outline" value={gerantsCount} label="Gérants ›" tone="orange" /></Pressable>
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

          {giftDone ? (
            <View style={{ backgroundColor: colors.successBg, borderRadius: radius.md, padding: 10, marginBottom: 8 }}>
              <T size={font.sm} weight="700" color={colors.success}>🎁 {giftDone}</T>
            </View>
          ) : null}
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

          {/* Tri par profil : Tous / Clients / Gérants — gros sélecteur bien visible */}
          <View style={s.roleBar}>
            {[
              { value: 'all', label: 'Tous', count: users.length, icon: 'people' },
              { value: 'client', label: 'Clients', count: clientsCount, icon: 'person' },
              { value: 'gerant', label: 'Gérants', count: gerantsCount, icon: 'storefront' },
            ].map((r) => {
              const on = uRole === r.value;
              return (
                <Pressable key={r.value} onPress={() => { setURole(r.value); setUCount(U_PAGE); }} style={[s.roleBtn, on && s.roleBtnOn]}>
                  <Ionicons name={on ? r.icon : r.icon + '-outline'} size={18} color={on ? '#fff' : colors.primary} />
                  <T size={font.sm} weight="800" color={on ? '#fff' : colors.text} style={{ marginTop: 4 }}>{r.label}</T>
                  <T size={font.xs} weight="700" color={on ? 'rgba(255,255,255,0.85)' : colors.muted}>{r.count}</T>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <T size={font.xs} weight="700" color={colors.muted} style={{ marginRight: 8 }}>Abonnement :</T>
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
                          {u.certified ? (
                            <View style={s.certBadge}><Ionicons name="shield-checkmark" size={11} color="#fff" /><T size={font.xs} weight="800" color="#fff" style={{ marginLeft: 3 }}>Certifié</T></View>
                          ) : null}
                          {u.blocked ? (
                            <View style={s.blockedBadge}><T size={font.xs} weight="800" color="#fff">Bloqué</T></View>
                          ) : (u.frozen ? <View style={s.frozenBadge}><T size={font.xs} weight="800" color={colors.warn}>Suspendu{u.frozenReason === 'unpaid_subscription' ? ' · abonnement' : u.frozenReason === 'client_unpaid_demandes' || u.frozenReason === 'gerant_not_served' ? ' · comportement' : ''}</T></View> : null)}{u.openReports > 0 ? <View style={[s.frozenBadge, { backgroundColor: colors.dangerBg }]}><T size={font.xs} weight="800" color={colors.danger}>⚑ {u.openReports} signalement{u.openReports > 1 ? 's' : ''}</T></View> : null}
                        </View>
                        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 1 }}>
                          {u.phone} · {u.role === 'gerant' ? 'Gérant' : 'Client'}
                        </T>
                        {validityLabel(u) ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                            <Ionicons name="calendar-outline" size={12} color={validityColor(u)} />
                            <T size={font.xs} weight="700" color={validityColor(u)} style={{ marginLeft: 4 }}>{validityLabel(u)}</T>
                          </View>
                        ) : null}
                      </View>
                      <Pill icon={st.icon} color={st.color} bg={st.bg} style={{ marginLeft: 8 }}>{st.label}</Pill>
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted2} style={{ marginLeft: 6 }} />
                    </Pressable>

                    {open && (
                      <View style={s.uActions}>
                        <T size={font.xs} weight="600" color={colors.muted2} style={{ marginBottom: 10 }}>
                          {u.blocked
                            ? 'Numéro bloqué : ne peut plus se connecter ni se réinscrire.'
                            : (u.subscription?.subscribedUntil
                                ? (u.subscription.status === 'active'
                                    ? `Abonnement actif jusqu'au ${fmtDate(u.subscription.subscribedUntil)}.`
                                    : `Abonnement expiré le ${fmtDate(u.subscription.subscribedUntil)}.`)
                                : 'Aucun abonnement payé.')}
                        </T>
                        {u.lastGift ? (
                          <T size={font.xs} weight="700" color={colors.success} style={{ marginBottom: 8 }}>
                            🎁 Dernier cadeau : {u.lastGift.days} jour{u.lastGift.days > 1 ? 's' : ''} le {fmtDate(u.lastGift.at)}{u.lastGift.note ? ` — ${u.lastGift.note}` : ''}
                          </T>
                        ) : null}
                        <Btn
                          title="Mot de passe oublié → réinitialiser"
                          icon="key-outline"
                          outline
                          color={colors.primary}
                          size="sm"
                          onPress={() => setPwdTarget(u)}
                          loading={busy === u.phone}
                          style={{ marginBottom: 8 }}
                        />
                        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                          <Btn
                            title="Offrir du temps"
                            icon="gift-outline"
                            color={colors.success}
                            size="sm"
                            onPress={() => { setGiftTarget(u); setGiftDays(30); setGiftCustom(''); setGiftNote(''); }}
                            loading={busy === u.phone}
                            style={{ flex: 1, marginRight: u.role === 'gerant' ? 8 : 0 }}
                          />
                          {u.role === 'gerant' && (
                            <Btn
                              title={u.certified ? 'Retirer le badge' : 'Certifier'}
                              icon={u.certified ? 'shield-outline' : 'shield-checkmark-outline'}
                              outline={!!u.certified}
                              color={colors.primary}
                              size="sm"
                              onPress={() => setCertTarget({ user: u, certified: !u.certified })}
                              loading={busy === u.phone}
                              style={{ flex: 1 }}
                            />
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                          <Btn
                            title={u.frozen ? 'Réactiver' : 'Suspendre'}
                            icon={u.frozen ? 'checkmark-circle-outline' : 'pause-circle-outline'}
                            outline
                            color={u.frozen ? colors.success : colors.warn}
                            size="sm"
                            onPress={() => { setSuspendReason(u.role === 'gerant' ? 'gerant_not_served' : 'client_unpaid_demandes'); setSuspendNote(''); setSuspendTarget({ user: u, frozen: !u.frozen }); }}
                            loading={busy === u.phone}
                            style={{ flex: 1, marginRight: 8 }}
                          />
                          <Btn
                            title={u.blocked ? 'Débloquer' : 'Bloquer'}
                            icon={u.blocked ? 'lock-open-outline' : 'ban-outline'}
                            outline
                            color={u.blocked ? colors.success : colors.danger}
                            size="sm"
                            onPress={() => (u.blocked ? setUnblockTarget(u) : setBlockTarget(u))}
                            loading={busy === u.phone}
                            style={{ flex: 1 }}
                          />
                        </View>
                        <Btn
                          title="Supprimer"
                          icon="trash-outline"
                          outline
                          color={colors.danger}
                          size="sm"
                          onPress={() => setDeleteTarget(u)}
                          loading={busy === u.phone}
                          style={{ width: '100%' }}
                        />
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

      {/* ===== Déblocages (demandes + numéros bloqués) ===== */}
      {adminTab === 'messages' && (
        <>
          <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 4 }}>Envoyer un message</T>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginBottom: space.sm }}>
            Arrive dans la cloche de chaque destinataire (+ notification téléphone). Astuce = conseil d'utilisation, nouveauté. Alerte = important, à lire. Info = neutre. Restez court et concret ; évitez plus d'un message par semaine.
          </T>
          <Card>
            <T size={font.xs} weight="800" color={colors.muted}>TYPE</T>
            <View style={{ flexDirection: 'row', marginTop: 6, marginBottom: 12 }}>
              {[['tip', 'Astuce', 'bulb-outline'], ['alert', 'Alerte', 'megaphone-outline'], ['info', 'Info', 'information-circle-outline']].map(([v, l, ic]) => {
                const on = annKind === v;
                return (
                  <Pressable key={v} onPress={() => setAnnKind(v)} style={[s.segBtn, on && s.segBtnOn]}>
                    <Ionicons name={ic} size={14} color={on ? '#fff' : colors.primary} />
                    <T size={font.xs} weight="800" color={on ? '#fff' : colors.primary} style={{ marginLeft: 4 }}>{l}</T>
                  </Pressable>
                );
              })}
            </View>
            <T size={font.xs} weight="800" color={colors.muted}>DESTINATAIRES</T>
            <View style={{ flexDirection: 'row', marginTop: 6, marginBottom: 12 }}>
              {[['all', `Tous (${audienceCounts.all})`], ['client', `Clients (${audienceCounts.client})`], ['gerant', `Gérants (${audienceCounts.gerant})`]].map(([v, l]) => {
                const on = annAudience === v;
                return (
                  <Pressable key={v} onPress={() => setAnnAudience(v)} style={[s.segBtn, on && s.segBtnOn]}>
                    <T size={font.xs} weight="800" color={on ? '#fff' : colors.primary}>{l}</T>
                  </Pressable>
                );
              })}
            </View>
            <TextInput value={annTitle} onChangeText={setAnnTitle} placeholder="Titre court (facultatif, 60 car. max)" placeholderTextColor={colors.muted2} maxLength={60} style={s.noteInput} />
            <TextInput value={annText} onChangeText={setAnnText} placeholder="Message (10 à 400 caractères). Ex : Astuce — ajoutez 1 % au montant pour couvrir les frais Wave, le gérant reçoit ainsi le montant exact." placeholderTextColor={colors.muted2} maxLength={400} multiline style={[s.noteInput, { minHeight: 90, textAlignVertical: 'top' }]} />
            <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'right', marginTop: 4 }}>{annText.length}/400</T>
            {annDone ? <T size={font.sm} weight="800" color={colors.success} style={{ textAlign: 'center', marginTop: 6 }}>{annDone}</T> : null}
            <Btn title="Envoyer" icon="send" size="sm" disabled={annText.trim().length < 10} loading={busy === 'announce'} onPress={() => setAnnConfirm(true)} style={{ marginTop: 10 }} />
          </Card>

          <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: space.lg, marginBottom: 4 }}>Alertes automatiques</T>
          <Card>
            <T size={font.sm} weight="600" color={colors.muted}>
              L'app prévient automatiquement chaque utilisateur à J-5 et J-1 de la fin de son essai ou abonnement, puis le jour de l'expiration (une seule fois par période, vérification toutes les heures). Rien à faire de votre côté.
            </T>
            {pendingOld > 0 ? (
              <View style={[s.msgBox, { backgroundColor: colors.warnBg, marginTop: 10 }]}>
                <T size={font.sm} weight="800" color={colors.warn}>⚠ {pendingOld} paiement(s) d'abonnement attendent votre vérification depuis plus de 24 h (onglet Paiements).</T>
              </View>
            ) : null}
            <Btn title="Vérifier les alertes maintenant" icon="refresh" outline size="sm" loading={busy === 'alerts'} onPress={async () => { setBusy('alerts'); try { const o = await api.admin.runAlerts(key); setAnnDone(`${o.sent || 0} alerte(s) envoyée(s).`); setTimeout(() => setAnnDone(''), 4000); } catch (e) { setErr(e?.message || 'Erreur.'); } finally { setBusy(null); } }} style={{ marginTop: 10 }} />
          </Card>

          <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: space.lg, marginBottom: space.sm }}>Messages envoyés</T>
          {announcements.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: 18 }}><T size={font.sm} weight="600" color={colors.muted}>Aucun message envoyé pour le moment.</T></Card>
          ) : announcements.map((a) => (
            <Card key={a.id} style={{ marginBottom: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name={a.kind === 'tip' ? 'bulb-outline' : a.kind === 'alert' ? 'megaphone-outline' : 'information-circle-outline'} size={16} color={a.kind === 'alert' ? colors.danger : colors.primary} />
                <T size={font.xs} weight="800" color={colors.muted} style={{ marginLeft: 6, flex: 1 }}>{a.kind === 'tip' ? 'ASTUCE' : a.kind === 'alert' ? 'ALERTE' : 'INFO'} · {a.audience === 'all' ? 'Tous' : a.audience === 'client' ? 'Clients' : 'Gérants'} · {a.recipients} destinataire(s)</T>
                <T size={font.xs} weight="600" color={colors.muted2}>{fmtDate(a.createdAt)}</T>
              </View>
              {a.title ? <T size={font.body} weight="800" color={colors.text} style={{ marginTop: 6 }}>{a.title}</T> : null}
              <T size={font.sm} weight="600" color={colors.text} style={{ marginTop: 4 }}>{a.text}</T>
            </Card>
          ))}
        </>
      )}

      {adminTab === 'signalements' && (
        <>
          <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 4 }}>Signalements ({openReports.length} à traiter)</T>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginBottom: space.sm }}>
            Un client signale un gérant (payé sans être servi / remboursé) ; un gérant signale un client (servi sans payer). La personne signalée a été prévenue. Vérifiez (appelez les deux si besoin), puis : suspendez le fautif depuis Utilisateurs, et clôturez le signalement ici.
          </T>
          {reports.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
              <Ionicons name="flag-outline" size={32} color={colors.muted2} />
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 8 }}>Aucun signalement.</T>
            </Card>
          ) : reports.map((r) => (
            <Card key={r.id} style={[{ marginBottom: space.sm }, r.status === 'open' && { borderWidth: 1.5, borderColor: colors.danger }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="flag" size={16} color={r.status === 'open' ? colors.danger : colors.muted2} />
                <T size={font.xs} weight="800" color={r.status === 'open' ? colors.danger : colors.muted} style={{ marginLeft: 6, flex: 1 }}>
                  {r.status === 'open' ? 'À TRAITER' : r.status === 'resolved' ? 'TRAITÉ' : 'SANS SUITE'} · {fmtDate(r.createdAt)}
                </T>
                <T size={font.body} weight="900" color={colors.text}>{money(r.amount)}</T>
              </View>
              <T size={font.sm} weight="800" color={colors.text} style={{ marginTop: 8 }}>{r.reasonLabel}</T>
              <View style={s.row}><T size={font.xs} weight="600" color={colors.muted}>Signalé par</T><T size={font.xs} weight="700" color={colors.text}>{r.reporterName} · {r.reporterPhone} ({r.reporterRole === 'gerant' ? 'gérant' : 'client'})</T></View>
              <View style={s.row}><T size={font.xs} weight="600" color={colors.muted}>Personne signalée</T><T size={font.xs} weight="700" color={colors.danger}>{r.targetName} · {r.targetPhone} ({r.targetRole === 'gerant' ? 'gérant' : 'client'})</T></View>
              <View style={s.row}><T size={font.xs} weight="600" color={colors.muted}>Demande</T><T size={font.xs} weight="700" color={colors.text}>{r.demandeType} · statut {r.demandeStatus}</T></View>
              {r.message ? <View style={s.msgBox}><T size={font.sm} weight="600" color={colors.text} style={{ fontStyle: 'italic' }}>« {r.message} »</T></View> : null}
              {r.status === 'open' && (
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <Btn title="Suspendre le signalé" icon="pause-circle-outline" color={colors.warn} size="sm" onPress={() => { const u = users.find((x) => x.phone === r.targetPhone); if (u) { setSuspendReason(u.role === 'gerant' ? 'gerant_not_served' : 'client_unpaid_demandes'); setSuspendNote(''); setSuspendTarget({ user: u, frozen: true }); } else setErr('Utilisateur introuvable (peut-être supprimé).'); }} style={{ flex: 1, marginRight: 8 }} />
                  <Btn title="Clôturer" icon="checkmark" outline color={colors.success} size="sm" loading={busy === r.id} onPress={() => setReportTarget({ report: r })} style={{ flex: 1 }} />
                </View>
              )}
            </Card>
          ))}
        </>
      )}

      {adminTab === 'deblocages' && (
        <>
          <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: space.sm }}>Demandes de déblocage</T>
          {unblockRequests.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
              <Ionicons name="lock-open-outline" size={32} color={colors.muted2} />
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 8, textAlign: 'center' }}>
                Aucune demande de déblocage en attente. Quand un utilisateur bloqué demandera à revenir, sa demande apparaîtra ici.
              </T>
            </Card>
          ) : (
            unblockRequests.map((r) => (
              <Card key={r.id} style={{ marginBottom: space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={s.uIconSm}><Ionicons name="person-outline" size={16} color={colors.primary} /></View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <T size={font.body} weight="800" color={colors.text}>{r.name || '—'}</T>
                    <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2 }}>
                      {r.phone} · {r.role === 'gerant' ? 'Gérant' : 'Client'} · demande du {fmtDate(r.createdAt)}
                    </T>
                    {r.message ? (
                      <View style={s.msgBox}>
                        <T size={font.sm} weight="600" color={colors.text} style={{ fontStyle: 'italic' }}>« {r.message} »</T>
                      </View>
                    ) : null}
                    <View style={{ flexDirection: 'row', marginTop: 10 }}>
                      <Btn
                        title="Débloquer"
                        icon="lock-open-outline"
                        size="sm"
                        color={colors.success}
                        onPress={() => setResolveTarget({ request: r, decision: 'unblock' })}
                        loading={busy === r.id}
                        style={{ flex: 1, marginRight: 8 }}
                      />
                      <Btn
                        title="Supprimer définitivement"
                        icon="trash-outline"
                        size="sm"
                        outline
                        color={colors.danger}
                        onPress={() => setResolveTarget({ request: r, decision: 'delete' })}
                        loading={busy === r.id}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                </View>
              </Card>
            ))
          )}

          <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: space.lg, marginBottom: space.sm }}>Numéros bloqués</T>
          {blockedPhones.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: 18 }}>
              <T size={font.sm} weight="600" color={colors.muted}>Aucun numéro bloqué pour le moment.</T>
            </Card>
          ) : (
            blockedPhones.map((b) => (
              <Card key={b.id || b.phone} style={{ marginBottom: space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <T size={font.body} weight="800" color={colors.text}>{b.name || '—'}</T>
                    <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2 }}>{b.phone} · bloqué le {fmtDate(b.blockedAt)}</T>
                  </View>
                  <Btn title="Débloquer" icon="lock-open-outline" size="sm" outline color={colors.success} onPress={() => setUnblockTarget({ phone: b.phone, name: b.name })} loading={busy === b.phone} />
                </View>
              </Card>
            ))
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
          <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 4 }}>À vérifier ({pendingPayments.length})</T>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginBottom: space.sm }}>
            Ces utilisateurs déclarent avoir payé sur votre Wave. Vérifiez la réception (montant + numéro), puis confirmez : l'abonnement s'active et l'utilisateur est notifié.
          </T>
          {pendingPayments.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: 18, marginBottom: space.lg }}>
              <Ionicons name="checkmark-done-outline" size={30} color={colors.success} />
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 6 }}>Aucun paiement en attente.</T>
            </Card>
          ) : pendingPayments.map((p) => (
            <Card key={p.id} style={{ marginBottom: space.sm, borderWidth: 1.5, borderColor: colors.warn }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <T size={font.body} weight="800" color={colors.text}>{p.name}</T>
                  <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>{p.phone} · {p.role === 'gerant' ? 'Gérant' : 'Client'} · {p.plan === 'annual' ? 'Annuel' : 'Mensuel'}</T>
                </View>
                <T size={font.h3} weight="900" color={colors.warn}>{money(p.amount)}</T>
              </View>
              <View style={s.row}><T size={font.xs} weight="600" color={colors.muted}>Déclaré le</T><T size={font.xs} weight="700" color={colors.text}>{fmtDate(p.declaredAt)}</T></View>
              <View style={s.row}><T size={font.xs} weight="600" color={colors.muted}>Référence</T><T size={font.xs} weight="700" color={colors.text}>{p.reference}</T></View>
              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <Btn title="Argent reçu — activer" icon="checkmark" color={colors.success} size="sm" loading={busy === p.id} onPress={() => doConfirmPayment(p)} style={{ flex: 1, marginRight: 8 }} />
                <Btn title="Rien reçu" icon="close" color={colors.danger} outline size="sm" loading={busy === p.id} onPress={() => setRejectTarget(p)} style={{ flex: 1 }} />
              </View>
            </Card>
          ))}
          <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: space.sm, marginTop: space.md }}>Paiements confirmés</T>
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
      {/* Offrir du temps gratuit */}
      <Dialog visible={!!giftTarget}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>🎁 Offrir du temps gratuit</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
          à {giftTarget?.name} ({giftTarget?.phone}) · {giftTarget?.role === 'gerant' ? 'Gérant' : 'Client'}
        </T>
        <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 4, marginBottom: 12 }}>
          {giftTarget?.subscription?.status === 'active'
            ? `Abonnement actif : la date de fin sera prolongée.`
            : giftTarget?.subscription?.status === 'trial'
              ? `Essai en cours : la fin d'essai sera prolongée.`
              : `Période expirée : une nouvelle période gratuite démarre aujourd'hui.`}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[{ d: 7, l: '1 semaine' }, { d: 14, l: '2 semaines' }, { d: 30, l: '1 mois' }, { d: 60, l: '2 mois' }, { d: 90, l: '3 mois' }, { d: 180, l: '6 mois' }].map((o) => (
            <Chip key={o.d} label={o.l} active={!giftCustom && giftDays === o.d} onPress={() => { setGiftDays(o.d); setGiftCustom(''); }} selectedColor={colors.success} />
          ))}
        </View>
        <View style={[s.search, { marginTop: 10 }]}>
          <Ionicons name="calendar-outline" size={18} color={colors.muted} />
          <TextInput value={giftCustom} onChangeText={(t) => setGiftCustom(t.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="Ou nombre de jours personnalisé" placeholderTextColor={colors.muted2} keyboardType="number-pad" style={s.searchInput} />
        </View>
        <View style={[s.search, { marginTop: 8 }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.muted} />
          <TextInput value={giftNote} onChangeText={setGiftNote} placeholder="Message (optionnel) : ex. Merci d'être parmi les premiers !" placeholderTextColor={colors.muted2} style={s.searchInput} maxLength={120} />
        </View>
        <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 10 }}>
          L'utilisateur recevra une notification l'informant du cadeau.
        </T>
        <DialogButtons cancel="Annuler" confirm={`Offrir ${giftCustom ? giftCustom + ' j' : ({ 7: '1 sem.', 14: '2 sem.', 30: '1 mois', 60: '2 mois', 90: '3 mois', 180: '6 mois' }[giftDays] || giftDays + ' j')}`} onCancel={() => setGiftTarget(null)} onConfirm={doGift} />
      </Dialog>

      {/* Confirmation d'envoi de message */}
      <Dialog visible={annConfirm}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Envoyer ce message ?</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
          {annKind === 'tip' ? 'Astuce' : annKind === 'alert' ? 'Alerte' : 'Info'} → {annAudience === 'all' ? `tous les utilisateurs (${audienceCounts.all})` : annAudience === 'client' ? `les clients (${audienceCounts.client})` : `les gérants (${audienceCounts.gerant})`}. Chacun recevra une notification. Cet envoi ne peut pas être annulé.
        </T>
        <View style={[s.msgBox, { marginTop: 10 }]}>
          {annTitle ? <T size={font.sm} weight="800" color={colors.text}>{annTitle}</T> : null}
          <T size={font.sm} weight="600" color={colors.text}>{annText}</T>
        </View>
        <DialogButtons cancel="Relire" confirm="Envoyer maintenant" onCancel={() => setAnnConfirm(false)} onConfirm={doAnnounce} />
      </Dialog>

      {/* Clôture d'un signalement */}
      <Dialog visible={!!reportTarget}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Clôturer ce signalement</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 10 }}>
          « Fondé / régularisé » si le problème était réel (que vous ayez suspendu ou que la personne ait régularisé). « Sans suite » si le signalement n'était pas justifié. La personne qui a signalé sera informée.
        </T>
        <Btn title="Fondé / régularisé" icon="checkmark-done" color={colors.success} size="sm" onPress={async () => { const r = reportTarget.report; setReportTarget(null); setBusy(r.id); try { await api.admin.resolveReport(key, r.id, 'resolve'); await reload(); } catch (e) { setErr(e?.message || 'Erreur.'); } finally { setBusy(null); } }} style={{ marginBottom: 8 }} />
        <Btn title="Sans suite" icon="close" outline color={colors.muted} size="sm" onPress={async () => { const r = reportTarget.report; setReportTarget(null); setBusy(r.id); try { await api.admin.resolveReport(key, r.id, 'dismiss'); await reload(); } catch (e) { setErr(e?.message || 'Erreur.'); } finally { setBusy(null); } }} style={{ marginBottom: 8 }} />
        <Btn title="Retour" outline size="sm" onPress={() => setReportTarget(null)} />
      </Dialog>

      {/* Rejet d'un paiement déclaré */}
      <Dialog visible={!!rejectTarget}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Rien reçu de {rejectTarget?.name} ?</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>
          La déclaration de {rejectTarget?.amount} F (réf. {rejectTarget?.reference}) sera rejetée. L'utilisateur sera prévenu et invité à vérifier son transfert Wave, puis à déclarer à nouveau. Son abonnement ne change pas.
        </T>
        <DialogButtons cancel="Annuler" confirm="Rejeter" onCancel={() => setRejectTarget(null)} onConfirm={() => doRejectPayment(rejectTarget)} />
      </Dialog>

      {/* Réinitialisation du mot de passe */}
      <Dialog visible={!!pwdTarget}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Réinitialiser le mot de passe ?</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>
          Les mots de passe ne sont jamais stockés en clair : on ne peut pas retrouver l'ancien. Un nouveau mot de passe temporaire (6 chiffres) sera créé pour {pwdTarget?.name} ({pwdTarget?.phone}) ; l'ancien ne marchera plus. Vous le lui transmettrez par appel ou WhatsApp.
        </T>
        <DialogButtons cancel="Annuler" confirm="Réinitialiser" onCancel={() => setPwdTarget(null)} onConfirm={() => doResetPassword(pwdTarget)} />
      </Dialog>
      <Dialog visible={!!pwdResult}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Nouveau mot de passe</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>{pwdResult?.name} · {pwdResult?.phone}</T>
        <View style={{ alignSelf: 'center', marginVertical: 14, paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.primarySoft }}>
          <T size={32} weight="900" color={colors.primary} style={{ letterSpacing: 6 }}>{pwdResult?.tempPassword}</T>
        </View>
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginBottom: 8 }}>
          Communiquez-le à l'utilisateur. Il pourra se connecter immédiatement avec ce code.
        </T>
        <Btn title={pwdCopied ? 'Message copié ✓' : 'Copier le message à envoyer'} icon="copy-outline" outline size="sm" onPress={copyTempPwd} style={{ marginBottom: 8 }} />
        <Btn title="Fermer" onPress={() => setPwdResult(null)} />
      </Dialog>

      {/* Certification */}
      <Dialog visible={!!certTarget}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>
          {certTarget?.certified ? 'Certifier ce gérant ?' : 'Retirer la certification ?'}
        </T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>
          {certTarget?.certified
            ? `${certTarget?.user?.name} affichera le badge « Certifié » auprès des clients (gérant vérifié par vous : identité, numéro Wave, sérieux). Il sera notifié.`
            : `${certTarget?.user?.name} perdra son badge « Certifié ». Il sera notifié.`}
        </T>
        <DialogButtons cancel="Annuler" confirm={certTarget?.certified ? 'Certifier' : 'Retirer'} onCancel={() => setCertTarget(null)} onConfirm={() => doSetCertified(certTarget.user, certTarget.certified)} />
      </Dialog>

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
        {suspendTarget?.frozen && !suspendTarget?.user?.frozen ? (
          <View style={{ marginTop: 6 }}>
            <T size={font.xs} weight="800" color={colors.muted} style={{ marginBottom: 4 }}>MOTIF (sera communiqué à l'utilisateur)</T>
            {(suspendTarget?.user?.role === 'gerant'
              ? [['gerant_not_served', 'Paiement reçu sans traiter la demande ni rembourser (signalé par un client)'], ['unpaid_subscription', 'Non-paiement de l\'abonnement'], ['other', 'Autre manquement']]
              : [['client_unpaid_demandes', 'Demandes traitées non payées (signalé par un gérant)'], ['unpaid_subscription', 'Non-paiement de l\'abonnement'], ['other', 'Autre manquement']]
            ).map(([v, l]) => {
              const on = suspendReason === v;
              return (
                <Pressable key={v} onPress={() => setSuspendReason(v)} style={[s.reasonRow, on && s.reasonRowOn]}>
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? colors.primary : colors.muted2} />
                  <T size={font.sm} weight={on ? '800' : '600'} color={on ? colors.primary : colors.text} style={{ marginLeft: 8, flex: 1 }}>{l}</T>
                </Pressable>
              );
            })}
            <TextInput value={suspendNote} onChangeText={setSuspendNote} placeholder="Précision (facultatif, visible par l'utilisateur)" placeholderTextColor={colors.muted2} maxLength={200} style={s.noteInput} />
          </View>
        ) : null}
        <DialogButtons
          cancel="Retour"
          confirm={suspendTarget?.frozen && !suspendTarget?.user?.frozen ? 'Suspendre et notifier' : 'Réactiver'}
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

      {/* Confirmation : bloquer */}
      <Dialog visible={!!blockTarget}>
        <T size={font.h3} weight="800" color={colors.danger} style={{ textAlign: 'center' }}>Bloquer ce compte ?</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>
          Le numéro {blockTarget?.phone} ({blockTarget?.name}) sera ajouté à la liste noire. Cette personne ne pourra plus se connecter ni créer de compte avec ce numéro. Elle pourra faire une demande de déblocage, que vous recevrez ici.
        </T>
        <DialogButtons
          cancel="Annuler"
          confirm="Bloquer"
          onCancel={() => setBlockTarget(null)}
          onConfirm={() => doBlock(blockTarget)}
        />
      </Dialog>

      {/* Confirmation : débloquer */}
      <Dialog visible={!!unblockTarget}>
        <T size={font.h3} weight="800" color={colors.success} style={{ textAlign: 'center' }}>Débloquer ce numéro ?</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>
          Le numéro {unblockTarget?.phone} ({unblockTarget?.name || '—'}) sera retiré de la liste noire et pourra de nouveau se connecter à l'application.
        </T>
        <DialogButtons
          cancel="Annuler"
          confirm="Débloquer"
          onCancel={() => setUnblockTarget(null)}
          onConfirm={() => doUnblock(unblockTarget)}
        />
      </Dialog>

      {/* Confirmation : décision sur une demande de déblocage */}
      <Dialog visible={!!resolveTarget}>
        <T size={font.h3} weight="800" color={resolveTarget?.decision === 'delete' ? colors.danger : colors.success} style={{ textAlign: 'center' }}>
          {resolveTarget?.decision === 'delete' ? 'Supprimer définitivement ?' : 'Débloquer ce compte ?'}
        </T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>
          {resolveTarget?.decision === 'delete'
            ? `${resolveTarget?.request?.name || '—'} (${resolveTarget?.request?.phone}) sera supprimé définitivement et son numéro restera bloqué : il ne pourra plus jamais se réinscrire.`
            : `${resolveTarget?.request?.name || '—'} (${resolveTarget?.request?.phone}) sera débloqué et pourra de nouveau utiliser l'application.`}
        </T>
        <DialogButtons
          cancel="Annuler"
          confirm={resolveTarget?.decision === 'delete' ? 'Supprimer' : 'Débloquer'}
          onCancel={() => setResolveTarget(null)}
          onConfirm={() => doResolveUnblock(resolveTarget.request, resolveTarget.decision)}
        />
      </Dialog>
    </Page>
  );
}

const s = StyleSheet.create({
  input: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 14, height: 52 },
  inputText: { flex: 1, fontSize: font.input, color: colors.text, paddingVertical: 0, outlineStyle: 'none' },
  // Barre de sections
  tabBar: { marginBottom: space.md },
  certBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 6 },
  roleBar: { flexDirection: 'row', marginBottom: space.sm },
  roleBtn: { flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 10, marginHorizontal: 3, borderWidth: 1.5, borderColor: colors.border },
  roleBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabRow: { flexDirection: 'row', paddingBottom: 2 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  tabBtnOn: { backgroundColor: colors.primary },
  tabBadge: { backgroundColor: colors.primarySoft, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 6, paddingHorizontal: 4 },
  tabBadgeOn: { backgroundColor: '#fff' },
  sumIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  searchCard: { marginBottom: space.sm, paddingVertical: 8, paddingHorizontal: 14 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: font.input, color: colors.text, paddingVertical: 0, outlineStyle: 'none', marginLeft: 8 },
  uRow: { paddingVertical: 10, paddingHorizontal: 4 },
  uDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  uLine: { flexDirection: 'row', alignItems: 'center' },
  uIconSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  uActions: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.4, borderColor: colors.primary, marginRight: 6 },
  segBtnOn: { backgroundColor: colors.primary },
  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderRadius: radius.md },
  reasonRowOn: { backgroundColor: colors.primarySoft },
  noteInput: { marginTop: 6, borderWidth: 1.4, borderColor: colors.border, borderRadius: radius.md, padding: 10, fontSize: font.sm, color: colors.text, backgroundColor: colors.bg },
  frozenBadge: { backgroundColor: '#FDF0E0', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  blockedBadge: { backgroundColor: colors.danger, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  msgBox: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: 10, marginTop: 8 },
  planChip: { backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  codeChip: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  refRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
});
