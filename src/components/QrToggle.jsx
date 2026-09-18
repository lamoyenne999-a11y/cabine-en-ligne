import React, { useMemo, useState } from 'react';
import { View, Pressable, Platform } from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import qrcode from 'qrcode-generator';
import { colors, radius, font } from '../theme';
import { T } from './ui';

// ---------------------------------------------------------------
//  QR code du lien de profil — replié par défaut, un bouton l'affiche
//  ou le masque. Généré localement (aucun service externe, rien stocké).
//  Le client scanne avec l'appareil photo de son téléphone : le lien
//  s'ouvre et le gérant (ou le parrain) est ajouté automatiquement.
// ---------------------------------------------------------------

function buildPath(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
  }
  return { d, n };
}

export function QrImage({ value, size = 200 }) {
  const { d, n } = useMemo(() => buildPath(value), [value]);
  const quiet = 2; // marge blanche (modules) exigée par les lecteurs
  const vb = n + quiet * 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} shapeRendering="crispEdges">
      <Rect x="0" y="0" width={vb} height={vb} fill="#FFFFFF" />
      <Path d={d} fill="#1A1033" transform={`translate(${quiet} ${quiet})`} />
    </Svg>
  );
}

// ---------------------------------------------------------------
//  Image « autocollant » (modèle C — Vitrine cabine), web uniquement.
//  1200 × 1700 px (≈ 10 × 14 cm à 300 dpi), prête à imprimer / partager.
// ---------------------------------------------------------------
const C = { primary: '#7B1FA2', soft: '#F3E7F7', text: '#241B35', muted: '#8B87A0', white: '#FFFFFF', light: '#E1C8F0', pale: '#EBDCF5' };
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fitText(ctx, txt, weight, size, maxW, min = 22) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${FONT}`; if (ctx.measureText(txt).width <= maxW) break; s -= 2; } while (s > min);
  return s;
}
function centered(ctx, txt, y, weight, size, color, W, maxW) {
  fitText(ctx, txt, weight, size, maxW || W - 120); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(txt, W / 2, y);
}
function loadImg(src) {
  return new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}

async function drawSticker(value, { name, role, phone }) {
  const W = 1200, H = 1700;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const logo = await loadImg('/icons/logo-256.png');

  // Fond + carte blanche
  ctx.fillStyle = C.soft; ctx.fillRect(0, 0, W, H);
  rr(ctx, 60, 60, W - 120, H - 120, 70); ctx.fillStyle = C.white; ctx.fill();
  // Bandeau violet (coins hauts arrondis)
  ctx.save(); rr(ctx, 60, 60, W - 120, H - 120, 70); ctx.clip();
  ctx.fillStyle = C.primary; ctx.fillRect(60, 60, W - 120, 500); ctx.restore();

  // Rôle, nom, numéro
  centered(ctx, (role || '').toUpperCase(), 150, '700', 30, C.light, W);
  centered(ctx, name || 'Cabine En Ligne', 250, '800', 78, C.white, W, 980);
  const fmtPhone = (ph) => String(ph || '').replace(/\D/g, '').replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  if (phone) centered(ctx, fmtPhone(phone), 310, '600', 40, C.pale, W);

  // Logo rond à cheval sur le bandeau
  const LS = 200, lx = (W - LS) / 2, ly = 380;
  ctx.save(); ctx.shadowColor = 'rgba(40,10,60,0.25)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.beginPath(); ctx.arc(lx + LS / 2, ly + LS / 2, LS / 2, 0, Math.PI * 2); ctx.fillStyle = C.white; ctx.fill(); ctx.restore();
  if (logo) { const s = LS * 0.78; ctx.drawImage(logo, lx + (LS - s) / 2, ly + (LS - s) / 2, s, s); }

  // Accroche
  const isGerant = /g[ée]rant/i.test(role || '');
  centered(ctx, isGerant ? 'Rechargez chez moi sans vous déplacer' : 'Rejoignez-moi sur Cabine En Ligne', 650, '700', 40, C.text, W, 1000);
  centered(ctx, isGerant ? 'Unités · Minutes · Internet — paiement Wave' : 'Recharge mobile à distance · Unités · Minutes · Internet', 700, '600', 30, C.muted, W);

  // Cadre QR
  const FR = 700, fx = (W - FR) / 2, fy = 740;
  rr(ctx, fx, fy, FR, FR, 36); ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = C.primary; ctx.stroke();
  // Coins « viseur » (hors zone de silence du QR)
  ctx.strokeStyle = C.primary; ctx.lineWidth = 10; ctx.lineCap = 'round';
  const L = 60, o = 30;
  [[fx - o, fy - o, 1, 1], [fx + FR + o, fy - o, -1, 1], [fx - o, fy + FR + o, 1, -1], [fx + FR + o, fy + FR + o, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); ctx.stroke();
  });
  // QR (niveau H pour supporter le logo au centre)
  const qr = qrcode(0, 'H'); qr.addData(value); qr.make();
  const n = qr.getModuleCount(), QS = 600, cell = QS / n, qx = (W - QS) / 2, qy = fy + 50;
  ctx.fillStyle = '#1A1033';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(qx + c * cell, qy + r * cell, Math.ceil(cell), Math.ceil(cell));
  // Médaillon logo au centre du QR
  const BS = Math.round(QS * 0.22), bx = (W - BS) / 2, by = qy + (QS - BS) / 2;
  rr(ctx, bx, by, BS, BS, BS / 5); ctx.fillStyle = C.white; ctx.fill();
  if (logo) { const s = BS * 0.8; ctx.drawImage(logo, bx + (BS - s) / 2, by + (BS - s) / 2, s, s); }

  // Étapes + site
  centered(ctx, isGerant ? '1. Scannez   2. Ajoutez-moi   3. Commandez, payez par Wave' : '1. Scannez   2. Créez votre compte   3. Rechargez à distance', 1520, '700', 28, C.primary, W, 1040);
  rr(ctx, W / 2 - 260, 1550, 520, 60, 30); ctx.fillStyle = C.primary; ctx.fill();
  centered(ctx, 'cabineenligne.com', 1591, '700', 30, C.white, W);
  return canvas;
}

async function savePng(value, meta) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  try {
    const canvas = await drawSticker(value, meta || {});
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return false;
    const fname = `cabine-en-ligne-${(meta && meta.name ? meta.name : 'qr').replace(/[^\w\-]+/g, '_').slice(0, 40)}.png`;
    const file = new File([blob], fname, { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Mon QR code Cabine En Ligne' }); return true; } catch (e) { if (e && e.name === 'AbortError') return true; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return true;
  } catch (e) { return false; }
}

export default function QrToggle({ value, title, role, phone, hint }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!value) return null;
  const onSave = async () => { const ok = await savePng(value, { name: title, role, phone }); if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); } };
  return (
    <View style={{ marginTop: 10 }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        style={({ pressed }) => [{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
          paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill,
          backgroundColor: open ? colors.primary : colors.primarySoft,
        }, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="qr-code-outline" size={16} color={open ? '#fff' : colors.primary} />
        <T size={font.xs} weight="800" color={open ? '#fff' : colors.primary} style={{ marginLeft: 6 }}>
          {open ? 'Masquer le QR code' : 'Afficher le QR code'}
        </T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={open ? '#fff' : colors.primary} style={{ marginLeft: 6 }} />
      </Pressable>

      {open && (
        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <View style={{ padding: 10, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
            <QrImage value={value} size={188} />
          </View>
          {title ? <T size={font.sm} weight="800" color={colors.text} style={{ marginTop: 8 }}>{title}</T> : null}
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 4, textAlign: 'center', paddingHorizontal: 8 }}>
            {hint || "À scanner avec l'appareil photo du téléphone : le lien s'ouvre directement."}
          </T>
          {Platform.OS === 'web' && (
            <Pressable onPress={onSave} style={({ pressed }) => [{
              flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: 9, paddingHorizontal: 16,
              borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.primary,
            }, pressed && { opacity: 0.8 }]}>
              <Ionicons name={saved ? 'checkmark' : 'download-outline'} size={16} color={colors.primary} />
              <T size={font.xs} weight="800" color={colors.primary} style={{ marginLeft: 6 }}>
                {saved ? 'Autocollant prêt ✓' : "Enregistrer l'autocollant"}
              </T>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
