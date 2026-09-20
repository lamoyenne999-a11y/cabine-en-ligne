import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T } from './ui';
import { api } from '../api';

// ============================================================
//  Notes ⭐ (client → gérant)
//  - <RatingBadge rating={{avg,count}} /> : « ⭐ 4,8 (37) », rien sous 3 avis.
//  - <RateDemande demande onRated /> : 5 étoiles après « Bien reçu »,
//    une fois par demande, modifiable 24 h.
// ============================================================
const GOLD = '#F5A623';

export function RatingBadge({ rating, size = 'sm', style }) {
  if (!rating || rating.avg == null) return null;
  const fs = size === 'sm' ? font.xs : font.sm;
  return (
    <View style={[s.badge, style]}>
      <Ionicons name="star" size={fs} color={GOLD} />
      <T size={fs} weight="800" color="#8A5A00" style={{ marginLeft: 3 }}>{String(rating.avg).replace('.', ',')}</T>
      <T size={fs} weight="600" color="#8A5A00" style={{ marginLeft: 3 }}>({rating.count})</T>
    </View>
  );
}

export function RateDemande({ demande, onRated, style }) {
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const current = demande.rating || 0;
  const locked = demande.ratedAt && Date.now() - demande.ratedAt > 24 * 3600 * 1000;
  const send = async (n) => {
    if (busy || locked) return;
    setBusy(true); setErr('');
    try { const r = await api.client.rateDemande(demande.id, n); onRated && onRated(r?.demande || { ...demande, rating: n, ratedAt: demande.ratedAt || Date.now() }); }
    catch (e) { setErr(e?.message || 'Impossible d\'enregistrer la note.'); }
    finally { setBusy(false); }
  };
  const shown = hover || current;
  return (
    <View style={[s.box, style]}>
      <T size={font.xs} weight="800" color={colors.muted}>
        {current ? (locked ? 'VOTRE NOTE' : 'VOTRE NOTE (modifiable 24 h)') : `NOTEZ ${(demande.gerantName || 'CE GÉRANT').toUpperCase()}`}
      </T>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} disabled={locked || busy} onPress={() => send(n)} onHoverIn={() => setHover(n)} onHoverOut={() => setHover(0)} hitSlop={4} style={{ marginRight: 6 }}>
            <Ionicons name={n <= shown ? 'star' : 'star-outline'} size={28} color={n <= shown ? GOLD : colors.muted2} />
          </Pressable>
        ))}
      </View>
      <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 4 }}>
        {current ? ['', 'Décevant', 'Moyen', 'Correct', 'Bien', 'Excellent'][current] + ' — merci pour votre avis.' : 'Facultatif. Votre note aide les autres clients et encourage les bons gérants.'}
      </T>
      {err ? <T size={font.xs} weight="700" color={colors.danger} style={{ marginTop: 4 }}>{err}</T> : null}
    </View>
  );
}

// Badge « Client fiable » (vu par le gérant uniquement)
export function ReliableBadge({ visible, style }) {
  if (!visible) return null;
  return (
    <View style={[s.reliable, style]}>
      <Ionicons name="ribbon" size={11} color="#fff" />
      <T size={font.xs} weight="800" color="#fff" style={{ marginLeft: 3 }}>Client(e) fiable</T>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF4DC', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 6 },
  box: { backgroundColor: '#FFF9EE', borderRadius: radius.md, padding: 12 },
  reliable: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.success, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 6 },
});
