import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Card, Pill, Btn, Chip } from '../../components/ui';
import { Page } from '../../components/Shell';
import { WavePaySheet, WavePayBox } from '../../components/WavePay';
import { Dialog, DialogButtons } from '../../components/modals';
import { useStore } from '../../store';
import SuspendedBanner from '../../components/SuspendedBanner';
import { RateDemande } from '../../components/Rating';
import ReportButton from '../../components/ReportButton';

// Pour mettre à jour le compte à rebours d'un délai toutes les secondes
function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

// Texte du temps restant pour une demande en attente
function remainingLabel(d, now) {
  const left = (d.expiresAt || 0) - now;
  if (left <= 0) return 'Délai dépassé';
  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  if (mins >= 1) return `il reste ${mins} min ${secs} s`;
  return `il reste ${secs} s`;
}

const STATUS = {
  pending: { label: 'En attente', color: colors.warn, bg: colors.warnBg, icon: 'time' },
  accepted: { label: 'À payer', color: colors.primary, bg: colors.primarySoft, icon: 'card' },
  declined: { label: 'Refusée', color: colors.danger, bg: colors.dangerBg, icon: 'close-circle' },
  unavailable: { label: 'Gérant indisponible', color: colors.warn, bg: colors.warnBg, icon: 'moon' },
  paid: { label: 'Payée', color: '#2E7BF6', bg: '#E7F0FE', icon: 'wallet' },
  completed: { label: 'Complétée', color: colors.success, bg: colors.successBg, icon: 'checkmark-circle' },
  canceled: { label: 'Annulée', color: colors.muted, bg: colors.gray, icon: 'close-circle-outline' },
};

const TYPE_ICON = { unites: 'phone-portrait-outline', minutes: 'call-outline', internet: 'wifi-outline', forfait: 'layers-outline' };
const TYPE_LABEL = { unites: 'Unités', minutes: 'Minutes', internet: 'Internet', forfait: 'Appel + Internet' };
const CREDIT_LABEL = { unites: 'vos unités', minutes: 'vos minutes', internet: 'vos données internet', forfait: 'votre rechargement Appel + Internet' };

function summarize(demandes) {
  const counts = { pending: 0, accepted: 0, declined: 0, unavailable: 0, paid: 0, completed: 0, canceled: 0 };
  let totalSpent = 0, totalServed = 0;
  (demandes || []).forEach((d) => {
    if (counts[d.status] !== undefined) counts[d.status] += 1;
    if (d.status === 'paid' || d.status === 'completed') totalSpent += d.amount || 0;
    if (d.status === 'completed') totalServed += d.amount || 0;
  });
  return { count: (demandes || []).length, counts, totalSpent, totalServed };
}

const money = (n) => `${(n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} F`;
const when = (t) => (t ? new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

// Une demande en attente est annulable une fois le délai (expiresAt) passé
function isExpired(d, now) { return d.status === 'pending' && !!d.expiresAt && now > d.expiresAt; }

// Recherche insensible à la casse et aux accents
const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function matches(d, q) {
  if (!q) return true;
  const nq = norm(q);
  const hay = [
    TYPE_LABEL[d.type] || 'Demande',
    STATUS[d.status]?.label || '',
    d.gerantName, d.benefName, d.benefPhone,
    when(d.createdAt), money(d.amount), d.id,
  ].map(norm).join(' ');
  return hay.includes(nq);
}

export default function ClientHistory() {
  const { state, markPaid, cancelDemande, paymentReply, notServedDemande, confirmServedDemande, refresh , dispatch } = useStore();
  const [notServedTarget, setNotServedTarget] = useState(null);
  const [paying, setPaying] = useState(null);
  const [canceling, setCanceling] = useState(null);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const now = useNow();
  const demandes = state.demandes || [];
  const sum = summarize(demandes);
  const purchases = sum.counts.paid + sum.counts.completed;
  const inProgress = sum.counts.pending + sum.counts.accepted;

  // L'historique est trié par famille (En attente / À payer / Traitées /
  // Refusées / Annulées) pour ne jamais mélanger les statuts.
  const GROUPS = [
    { value: 'all', label: `Toutes (${demandes.length})` },
    { value: 'pending', label: `En attente (${sum.counts.pending})` },
    { value: 'accepted', label: `À payer (${sum.counts.accepted})` },
    { value: 'treated', label: `Traitées (${sum.counts.paid + sum.counts.completed})` },
    { value: 'declined', label: `Refusées (${sum.counts.declined + sum.counts.unavailable})` },
    { value: 'canceled', label: `Annulées (${sum.counts.canceled})` },
  ];
  const inGroup = (d) => {
    if (group === 'all') return true;
    if (group === 'treated') return ['paid', 'completed'].includes(d.status);
    if (group === 'declined') return ['declined', 'unavailable'].includes(d.status);
    return d.status === group;
  };
  const filtered = demandes.filter(inGroup);
  const visible = q ? filtered.filter((d) => matches(d, q)) : filtered;

  return (
    <Page title="Historique">
      <SuspendedBanner />
      {/* Synthèse */}
      <Card style={s.sumCard}>
        <View style={s.sumTop}>
          <View>
            <T size={font.xs} weight="700" color={colors.muted}>TOTAL DÉPENSÉ</T>
            <T size={font.h1} weight="800" color={colors.primary} style={{ marginTop: 4 }}>{money(sum.totalSpent)}</T>
          </View>
          <View style={s.sumIcon}><Ionicons name="wallet-outline" size={26} color={colors.primary} /></View>
        </View>
        <View style={s.sumGrid}>
          <Tile icon="checkmark-done" tone="green" value={purchases} label="Achats" />
          <Tile icon="time" tone="orange" value={inProgress} label="En cours" />
          <Tile icon="close-circle" tone="blue" value={sum.counts.declined + sum.counts.canceled} label="Non traitées" />
        </View>
      </Card>

      {/* Filtre par statut (En attente / À payer / Traitées / Refusées / Annulées) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {GROUPS.map((g) => (
          <Chip key={g.value} label={g.label} active={group === g.value} onPress={() => setGroup(g.value)} />
        ))}
      </View>

      {/* Recherche */}
      {demandes.length > 0 && (
        <Card style={s.searchCard}>
          <View style={s.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Rechercher (type, statut, nom, téléphone, montant…)"
              placeholderTextColor={colors.muted2}
              style={s.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.muted2} />
              </Pressable>
            ) : null}
          </View>
          {q ? (
            <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 6 }}>
              {visible.length} résultat{visible.length > 1 ? 's' : ''}
            </T>
          ) : null}
        </Card>
      )}

      {/* Transactions */}
      {demandes.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Ionicons name="receipt-outline" size={40} color={colors.muted2} />
          <T size={font.body} weight="700" color={colors.muted} style={{ marginTop: 10 }}>Aucune transaction</T>
          <T size={font.sm} weight="600" color={colors.muted2} style={{ marginTop: 4, textAlign: 'center' }}>
            Vos achats et demandes apparaîtront ici.
          </T>
        </Card>
      ) : visible.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Ionicons name="search-outline" size={40} color={colors.muted2} />
          <T size={font.body} weight="700" color={colors.muted} style={{ marginTop: 10 }}>Aucun résultat</T>
          <T size={font.sm} weight="600" color={colors.muted2} style={{ marginTop: 4, textAlign: 'center' }}>
            Aucune transaction ne correspond à « {q} ».
          </T>
        </Card>
      ) : visible.map((d) => {
        const st = d.status === 'completed' && d.clientConfirmedAt
          ? { ...STATUS.completed, label: 'Terminée ✓' }
          : d.partialAt && !d.moneyReceived && d.status !== 'canceled' && d.status !== 'declined'
          ? { label: 'Montant incomplet', color: colors.warn, bg: colors.warnBg, icon: 'remove-circle' }
          : d.status === 'completed' && !d.moneyReceived
          ? { label: 'Servie · à payer', color: colors.warn, bg: colors.warnBg, icon: 'alert-circle' }
          : d.status === 'accepted' && d.notReceivedAt
            ? { label: 'Paiement non reçu', color: colors.danger, bg: colors.dangerBg, icon: 'warning' }
          : d.status === 'accepted' && d.paymentRequestedAt
            ? { label: 'Paiement demandé', color: '#2E7BF6', bg: '#E7F0FE', icon: 'card' }
            : (STATUS[d.status] || STATUS.pending);
        return (
          <Card key={d.id} style={{ marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[s.icon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={TYPE_ICON[d.type] || 'phone-portrait-outline'} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <T size={font.body} weight="800" color={colors.text}>{TYPE_LABEL[d.type] || 'Demande'}</T>
                  <T size={font.xs} weight="600" color={colors.muted2} style={{ marginLeft: 8 }}>{when(d.createdAt)}</T>
                </View>
                <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>
                  {d.gerantName || 'Gérant'} · pour {d.benefName === d.benefPhone ? d.benefPhone : d.benefName}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T size={font.body} weight="800" color={colors.text}>{money(d.amount)}</T>
                <Pill icon={st.icon} color={st.color} bg={st.bg} style={{ marginTop: 6 }}>{st.label}</Pill>
              </View>
            </View>

            {(d.status === 'pending' || d.status === 'accepted') && (
              <>
                <WavePayBox
                  amount={d.amount}
                  merchant={d.gerantWave}
                  merchantName={d.gerantName}
                />
                <Btn title="J'ai payé (Wave)" icon="checkmark" onPress={() => setPaying(d)} style={{ marginTop: space.md }} />
              </>
            )}
            {d.status === 'pending' && (
              <>
                <View style={s.timerBox}>
                  <Ionicons name={isExpired(d, now) ? 'alert-circle' : 'time'} size={16} color={isExpired(d, now) ? colors.danger : colors.muted} />
                  <T size={font.sm} weight="600" color={isExpired(d, now) ? colors.danger : colors.muted} style={{ marginLeft: 8, flex: 1 }}>
                    {isExpired(d, now) ? `Le gérant n'a pas répondu dans les 5 min. Vous pouvez annuler et choisir un autre gérant.` : `Le gérant a 5 min pour répondre — ${remainingLabel(d, now)}.`}
                  </T>
                </View>
                <Btn title="Annuler la demande" icon="close-circle" outline color={colors.danger} onPress={() => setCanceling(d)} style={{ marginTop: space.md }} />
                <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 8 }}>
                  Vous pouvez annuler tant que vous n'avez pas payé — si le gérant met trop de temps ou si vous avez déjà réglé avec quelqu'un d'autre.
                </T>
              </>
            )}
            {d.status === 'accepted' && (
              <>
                <View style={[s.timerBox, d.notReceivedAt && { backgroundColor: colors.dangerBg }, d.paymentRequestedAt && !d.notReceivedAt && { backgroundColor: '#E7F0FE' }]}>
                  <Ionicons name={d.notReceivedAt ? 'warning' : d.paymentRequestedAt ? 'card' : 'checkmark-circle'} size={16} color={d.notReceivedAt ? colors.danger : d.paymentRequestedAt ? '#2E7BF6' : colors.success} />
                  <T size={font.sm} weight={d.notReceivedAt ? '700' : '600'} color={d.notReceivedAt ? colors.danger : colors.muted} style={{ marginLeft: 8, flex: 1 }}>
                    {d.paymentRequestedAt && !d.notReceivedAt
                      ? `${d.gerantName} a bien reçu votre demande et vous demande de payer d'abord. Il vous servira dès réception du paiement.`
                      : d.notReceivedAt
                      ? `${d.gerantName} n'a PAS reçu votre paiement. Vérifiez votre transfert Wave (numéro ${d.gerantWave || 'du gérant'}, montant ${money(d.amount)}), puis appuyez à nouveau sur « J'ai payé », ou contactez-le.`
                      : `${d.gerantName} a accepté votre demande. Payez via Wave, ou annulez si vous changez d'avis.`}
                  </T>
                </View>
                <Btn title="Annuler la demande" icon="close-circle" outline color={colors.danger} onPress={() => setCanceling(d)} style={{ marginTop: space.md }} />
              </>
            )}
            {d.status === 'declined' && (
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 12, textAlign: 'center' }}>
                Le gérant a refusé. Essayez un autre gérant.
              </T>
            )}
            {d.status === 'unavailable' && (
              <View style={[s.timerBox, { backgroundColor: colors.warnBg }]}>
                <Ionicons name="moon" size={16} color={colors.warn} />
                <T size={font.sm} weight="700" color={colors.warn} style={{ marginLeft: 8, flex: 1 }}>
                  {d.gerantName} n'est pas disponible ({({ away: 'pas à la cabine', nomaterial: 'sans son matériel', later: 'pour le moment' })[d.unavailableReason] || 'pour le moment'}). Ce n'est pas un refus : renvoyez votre demande à un autre gérant en ligne.{d.paidAt ? ' Vous aviez payé : le montant doit vous être remboursé par Wave.' : ''}
                </T>
              </View>
            )}
            {/* Montant incomplet signalé par le gérant : compléter ou affirmer avoir tout payé */}
            {d.partialAt && !d.moneyReceived && ['paid', 'accepted', 'completed'].includes(d.status) && (
              <View style={[s.timerBox, { backgroundColor: colors.warnBg, flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="remove-circle" size={16} color={colors.warn} />
                  <T size={font.sm} weight="700" color={colors.warn} style={{ marginLeft: 8, flex: 1 }}>
                    {d.clientDisputedAt
                      ? `Vous avez indiqué avoir tout payé. ${d.gerantName} revérifie son Wave.`
                      : d.partialCompletedAt && d.partialCompletedAt > d.partialAt
                        ? `Complément envoyé. ${d.gerantName} vérifie son Wave.`
                        : `${d.gerantName} a reçu ${money(d.partialReceived)} au lieu de ${money(d.amount)} (frais Wave déduits ?). Complément à envoyer : ${money(d.partialMissing)}.`}
                  </T>
                </View>
                {!d.clientDisputedAt && !(d.partialCompletedAt > d.partialAt) && (
                  <>
                    <WavePayBox amount={d.partialMissing} merchant={d.gerantWave} merchantName={d.gerantName} includeFees={false} compact />
                    <View style={{ flexDirection: 'row', marginTop: 10 }}>
                      <Btn title="J'ai complété" icon="checkmark" onPress={() => paymentReply(d.id, 'completed')} style={{ flex: 1, marginRight: 6 }} />
                      <Btn title="J'ai bien tout payé" icon="hand-left-outline" outline onPress={() => paymentReply(d.id, 'full')} style={{ flex: 1 }} />
                    </View>
                  </>
                )}
              </View>
            )}
            {d.status === 'paid' && !d.partialAt && (
              <View style={s.timerBox}>
                <Ionicons name={d.moneyReceived ? 'checkmark-circle' : 'time'} size={16} color={d.moneyReceived ? colors.success : colors.muted} />
                <T size={font.sm} weight="600" color={colors.muted} style={{ marginLeft: 8, flex: 1 }}>
                  {d.moneyReceived
                    ? `${d.gerantName} a confirmé avoir reçu votre paiement et vous crédite ${CREDIT_LABEL[d.type] || 'votre numéro'}.`
                    : `Paiement signalé. ${d.gerantName} vérifie la réception sur son Wave, puis vous crédite ${CREDIT_LABEL[d.type] || 'votre numéro'}.`}
                </T>
              </View>
            )}
            {d.status === 'completed' && !d.moneyReceived && (
              <>
                {d.clientPaidDeclaredAt && !d.notReceivedAt ? (
                  <View style={[s.timerBox, { backgroundColor: '#E7F0FE' }]}>
                    <Ionicons name="hourglass" size={16} color="#2E7BF6" />
                    <T size={font.sm} weight="700" color="#2E7BF6" style={{ marginLeft: 8, flex: 1 }}>
                      Vous avez déclaré avoir payé {money(d.amount)}. {d.gerantName} vérifie sur son Wave ; la demande sera clôturée dès sa confirmation.
                    </T>
                  </View>
                ) : (
                  <>
                    <View style={[s.timerBox, { backgroundColor: d.notReceivedAt ? colors.dangerBg : colors.warnBg }]}>
                      <Ionicons name="alert-circle" size={16} color={d.notReceivedAt ? colors.danger : colors.warn} />
                      <T size={font.sm} weight="700" color={d.notReceivedAt ? colors.danger : colors.warn} style={{ marginLeft: 8, flex: 1 }}>
                        {d.notReceivedAt
                          ? `${d.gerantName} indique ne PAS avoir reçu votre paiement de ${money(d.amount)}. Ouvrez votre app Wave : si le transfert vers ${d.gerantWave || 'son numéro'} est « Réussi », appuyez sur « J'ai bien payé » ; sinon, payez maintenant.`
                          : `Vous avez été servi, mais ${d.gerantName} n'a pas encore reçu votre paiement. Merci de régler ${money(d.amount)} sur son Wave.`}
                      </T>
                    </View>
                    <WavePayBox amount={d.amount} merchant={d.gerantWave} merchantName={d.gerantName} />
                    <Btn title={d.notReceivedAt ? "J'ai bien payé — demander une revérification" : "J'ai payé (Wave)"} icon="checkmark" onPress={() => markPaid(d.id)} style={{ marginTop: 8 }} />
                    {d.gerantPhone ? (
                      <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 6 }}>
                        Désaccord persistant ? Appelez {d.gerantName} au {d.gerantPhone}.
                      </T>
                    ) : null}
                  </>
                )}
              </>
            )}
            {d.status === 'completed' && d.moneyReceived && (
              <T size={font.sm} weight="600" color={colors.success} style={{ marginTop: 12, textAlign: 'center' }}>
                Réglée : paiement reçu par {d.gerantName} et {CREDIT_LABEL[d.type] || 'votre numéro'} crédité(s). Merci !
              </T>
            )}
            {d.status === 'completed' && !d.clientConfirmedAt && (
              <>
                <T size={font.sm} weight="800" color={colors.text} style={{ marginTop: 12 }}>Avez-vous bien reçu {CREDIT_LABEL[d.type] || 'votre recharge'} ?</T>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <Btn title="Non, rien reçu ✗" icon="alert-circle-outline" outline color={colors.danger} size="sm" onPress={() => setNotServedTarget(d)} style={{ flex: 1, marginRight: 6 }} />
                  <Btn title="Oui, bien reçu ✓" icon="checkmark-circle" color={colors.success} size="sm" onPress={() => confirmServedDemande(d.id)} style={{ flex: 1 }} />
                </View>
                <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 6 }}>
                  Vérifiez votre solde (cela peut prendre quelques minutes). Le gérant sera notifié de votre réponse.
                </T>
              </>
            )}
            {d.status === 'completed' && d.clientConfirmedAt && (
              <View style={[s.timerBox, { backgroundColor: colors.successBg }]}>
                <Ionicons name="checkmark-done-circle" size={16} color={colors.success} />
                <T size={font.sm} weight="700" color={colors.success} style={{ marginLeft: 8, flex: 1 }}>
                  Vous avez confirmé la réception. Demande terminée. Merci !
                </T>
              </View>
            )}
            {d.status === 'completed' && d.clientConfirmedAt && (
              <RateDemande demande={d} onRated={(upd) => dispatch({ type: 'CLIENT_UPDATE_DEMANDE', payload: upd })} style={{ marginTop: 8 }} />
            )}
            <ReportButton role="client" demande={d} otherName={d.gerantName} onDone={refresh} style={{ marginTop: 10 }} />
            {d.notServedAt && d.status !== 'completed' && !['declined', 'canceled'].includes(d.status) && (
              <View style={[s.timerBox, { backgroundColor: colors.dangerBg }]}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <T size={font.sm} weight="700" color={colors.danger} style={{ marginLeft: 8, flex: 1 }}>
                  Vous avez signalé ne rien avoir reçu. {d.gerantName} a été notifié et doit vous servir à nouveau.
                </T>
              </View>
            )}
            {d.status === 'canceled' && (
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 12, textAlign: 'center' }}>
                Demande annulée : le gérant n'a pas traité votre demande à temps.
              </T>
            )}
          </Card>
        );
      })}

      <Dialog visible={!!notServedTarget}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Rien reçu ?</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>
          {notServedTarget ? `${notServedTarget.gerantName} a indiqué vous avoir servi (${TYPE_LABEL[notServedTarget.type] || 'demande'} ${money(notServedTarget.amount)} pour le ${notServedTarget.benefPhone}). Confirmez que vous n'avez rien reçu : il sera notifié et devra vous servir.` : ''}
        </T>
        <DialogButtons cancel="Annuler" confirm="Oui, rien reçu" onCancel={() => setNotServedTarget(null)} onConfirm={() => { if (notServedTarget) notServedDemande(notServedTarget.id); setNotServedTarget(null); }} />
      </Dialog>

      <WavePaySheet
        visible={!!paying}
        onClose={() => setPaying(null)}
        onConfirm={() => { if (paying) markPaid(paying.id); setPaying(null); }}
        title="Payer via Wave"
        amount={paying?.amount}
        merchant={paying?.gerantWave}
        merchantName={paying?.gerantName}
      />

      {/* Confirmation d'annulation */}
      <Dialog visible={!!canceling}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Annuler la demande ?</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>
          Vous pouvez annuler cette demande de {money(canceling?.amount)} tant que vous n'avez pas encore payé. Le gérant en sera informé.
        </T>
        <DialogButtons cancel="Retour" confirm="Annuler" onCancel={() => setCanceling(null)} onConfirm={() => { if (canceling) cancelDemande(canceling.id); setCanceling(null); }} />
      </Dialog>
    </Page>
  );
}

function Tile({ icon, tone, value, label }) {
  const tones = {
    green: { bg: colors.successBg, color: colors.success },
    orange: { bg: colors.warnBg, color: colors.warn },
    blue: { bg: '#E7F0FE', color: '#2E7BF6' },
  };
  const t = tones[tone] || tones.blue;
  return (
    <View style={s.tile}>
      <View style={[s.tileIcon, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={16} color={t.color} />
      </View>
      <View>
        <T size={font.h3} weight="800" color={colors.text}>{value}</T>
        <T size={font.xs} weight="600" color={colors.muted}>{label}</T>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sumCard: { marginBottom: space.lg, padding: space.lg },
  searchCard: { marginBottom: space.sm, paddingVertical: 8, paddingHorizontal: 14 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: font.input, color: colors.text, paddingVertical: 0, outlineStyle: 'none', marginLeft: 8 },
  sumTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sumIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sumGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg },
  tile: { flexDirection: 'row', alignItems: 'center' },
  tileIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  payBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E7F0FE', borderRadius: radius.md, padding: 12, marginTop: 12 },
  timerBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: 12, marginTop: 12 },
});
