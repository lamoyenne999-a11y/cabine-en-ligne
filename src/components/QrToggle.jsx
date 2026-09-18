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

// Enregistrer l'image (web uniquement) : PNG net, prêt à imprimer / envoyer.
async function savePng(value, title, subtitle) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  try {
    const { d, n } = buildPath(value);
    const scale = 12; const quiet = 4;
    const side = (n + quiet * 2) * scale;
    const pad = 48; const footer = 150;
    const canvas = document.createElement('canvas');
    canvas.width = side + pad * 2; canvas.height = side + pad * 2 + footer;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1A1033';
    const p = new Path2D(d);
    ctx.save(); ctx.translate(pad + quiet * scale, pad + quiet * scale); ctx.scale(scale, scale); ctx.fill(p); ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7B1FA2'; ctx.font = 'bold 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(title || 'Cabine En Ligne', canvas.width / 2, side + pad * 2 + 40, canvas.width - 40);
    ctx.fillStyle = '#5A556B'; ctx.font = '600 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(subtitle || 'Scannez pour me retrouver sur Cabine En Ligne', canvas.width / 2, side + pad * 2 + 86, canvas.width - 40);
    ctx.fillStyle = '#8B87A0'; ctx.font = '600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText('cabineenligne.com', canvas.width / 2, side + pad * 2 + 124);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return false;
    const file = new File([blob], 'cabine-en-ligne-qr.png', { type: 'image/png' });
    // Sur téléphone : feuille de partage (Enregistrer l'image, WhatsApp, Imprimer…)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: title || 'Mon QR code Cabine En Ligne' }); return true; } catch (e) { if (e && e.name === 'AbortError') return true; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'cabine-en-ligne-qr.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return true;
  } catch (e) { return false; }
}

export default function QrToggle({ value, title, subtitle, hint }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!value) return null;
  const onSave = async () => { const ok = await savePng(value, title, subtitle); if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); } };
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
                {saved ? 'Image prête' : "Enregistrer / partager l'image"}
              </T>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
