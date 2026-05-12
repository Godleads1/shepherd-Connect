const QRCode  = require('qrcode');
const { Jimp, loadFont, HorizontalAlign, VerticalAlign } = require('jimp');
const fs = require('fs');

const FONT_BASE = '/home/runner/workspace/node_modules/.pnpm/@jimp+plugin-print@1.6.1/node_modules/@jimp/plugin-print/dist/fonts/open-sans';
const F16W = `${FONT_BASE}/open-sans-16-white/open-sans-16-white.fnt`;
const F32W = `${FONT_BASE}/open-sans-32-white/open-sans-32-white.fnt`;
const F32B = `${FONT_BASE}/open-sans-32-black/open-sans-32-black.fnt`;
const F64W = `${FONT_BASE}/open-sans-64-white/open-sans-64-white.fnt`;

const LOGO_PATH = '/home/runner/workspace/attached_assets/cropped_circle_image_(8)_1778245957931.png';
const OUT_PATH  = '/home/runner/workspace/shepherd-connect-qr.png';
const APP_URL   = 'https://shepherd-connect--egbuchulamchine.replit.app/';

const ROYAL_BLUE = 0x1e3a8aff;
const DARK_BLUE  = 0x172554ff;
const GOLD       = 0xf59e0bff;
const WHITE      = 0xffffffff;

const W = 800, H = 1140;
const CENTER = HorizontalAlign.CENTER;
const MIDDLE = VerticalAlign.MIDDLE;

async function run() {
  const [f16w, f32w, f32b, f64w, qrBuf, logoRaw] = await Promise.all([
    loadFont(F16W), loadFont(F32W), loadFont(F32B), loadFont(F64W),
    QRCode.toBuffer(APP_URL, {
      type: 'png', width: 460, margin: 1,
      color: { dark: '#1e3a8a', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    }),
    Jimp.read(LOGO_PATH),
  ]);
  const qrImg = await Jimp.read(qrBuf);

  // ── Canvas ────────────────────────────────────────────────────────────────
  const card = new Jimp({ width: W, height: H, color: ROYAL_BLUE });

  // Gold top stripe
  card.composite(new Jimp({ width: W, height: 10, color: GOLD }), 0, 0);

  // Dark header band
  card.composite(new Jimp({ width: W, height: 200, color: DARK_BLUE }), 0, 10);

  // RCCG logo centred in header
  const hLogo = await Jimp.read(LOGO_PATH);
  hLogo.resize({ w: 88, h: 88 });
  card.composite(hLogo, (W - 88) / 2, 22);

  // "THE REDEEMED CHRISTIAN CHURCH OF GOD" — centred
  card.print({
    font: f16w, x: 0, y: 118,
    text: { text: 'THE REDEEMED CHRISTIAN CHURCH OF GOD', alignmentX: CENTER, alignmentY: MIDDLE },
    maxWidth: W, maxHeight: 24,
  });

  // "City of David · Victoria Island, Lagos" — centred
  card.print({
    font: f16w, x: 0, y: 148,
    text: { text: 'City of David  \u00b7  Victoria Island, Lagos', alignmentX: CENTER, alignmentY: MIDDLE },
    maxWidth: W, maxHeight: 24,
  });

  // Gold divider line
  card.composite(new Jimp({ width: 320, height: 2, color: GOLD }), (W - 320) / 2, 178);

  // ── White QR card ─────────────────────────────────────────────────────────
  const QR_CARD_W = 560, QR_CARD_H = 580;
  const QR_CARD_X = (W - QR_CARD_W) / 2;
  const QR_CARD_Y = 210;
  card.composite(new Jimp({ width: QR_CARD_W, height: QR_CARD_H, color: WHITE }), QR_CARD_X, QR_CARD_Y);

  // QR code centred in white card
  qrImg.resize({ w: 460, h: 460 });
  const QR_X = (W - 460) / 2;
  const QR_Y = QR_CARD_Y + 20;
  card.composite(qrImg, QR_X, QR_Y);

  // White bg square behind logo (clears QR centre)
  const LOGO_SIZE = 112, LOGO_BG = LOGO_SIZE + 16;
  card.composite(new Jimp({ width: LOGO_BG, height: LOGO_BG, color: WHITE }), (W - LOGO_BG) / 2, QR_Y + (460 - LOGO_BG) / 2);

  // Logo centred on QR
  logoRaw.resize({ w: LOGO_SIZE, h: LOGO_SIZE });
  card.composite(logoRaw, (W - LOGO_SIZE) / 2, QR_Y + (460 - LOGO_SIZE) / 2);

  // "Scan to Access App" — centred black text inside white card
  card.print({
    font: f32b,
    x: QR_CARD_X, y: QR_CARD_Y + QR_CARD_H - 56,
    text: { text: 'Scan to Access App', alignmentX: CENTER, alignmentY: MIDDLE },
    maxWidth: QR_CARD_W, maxHeight: 48,
  });

  // Gold accent strip under white card
  card.composite(new Jimp({ width: QR_CARD_W, height: 6, color: GOLD }), QR_CARD_X, QR_CARD_Y + QR_CARD_H);

  // ── Footer ────────────────────────────────────────────────────────────────
  const FOOTER_Y = QR_CARD_Y + QR_CARD_H + 6;
  const FOOTER_H = H - FOOTER_Y - 10;
  card.composite(new Jimp({ width: W, height: FOOTER_H, color: DARK_BLUE }), 0, FOOTER_Y);

  // "Shepherd Connect"
  card.print({
    font: f64w, x: 0, y: FOOTER_Y + 24,
    text: { text: 'Shepherd Connect', alignmentX: CENTER, alignmentY: MIDDLE },
    maxWidth: W, maxHeight: 72,
  });

  // "Safe. Known. Celebrated."
  card.print({
    font: f32w, x: 0, y: FOOTER_Y + 106,
    text: { text: 'Safe.  Known.  Celebrated.', alignmentX: CENTER, alignmentY: MIDDLE },
    maxWidth: W, maxHeight: 44,
  });

  // URL hint
  card.print({
    font: f16w, x: 0, y: FOOTER_Y + 162,
    text: { text: 'shepherd-connect--egbuchulamchine.replit.app', alignmentX: CENTER, alignmentY: MIDDLE },
    maxWidth: W, maxHeight: 22,
  });

  // Gold bottom stripe
  card.composite(new Jimp({ width: W, height: 10, color: GOLD }), 0, H - 10);

  await card.write(OUT_PATH);
  const kb = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
  console.log(`Saved ${OUT_PATH}  (${kb} KB)`);
}

run().catch(e => { console.error(e); process.exit(1); });
