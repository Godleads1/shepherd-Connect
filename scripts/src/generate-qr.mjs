import QRCode from '/home/runner/workspace/node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/index.js';
import { Jimp, HorizontalAlign, VerticalAlign } from '/home/runner/workspace/node_modules/.pnpm/jimp@1.6.0/node_modules/jimp/dist/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = '/home/runner/workspace/attached_assets/cropped_circle_image_(8)_1778245957931.png';
const OUT_PATH  = '/home/runner/workspace/shepherd-connect-qr.png';
const APP_URL   = 'https://shepherd-connect--egbuchulamchine.replit.app/';

// Card dimensions
const W = 800, H = 1020;
const ROYAL_BLUE = 0x1e3a8aff;
const GOLD       = 0xf59e0bff;
const WHITE      = 0xffffffff;
const DARK_BLUE  = 0x172554ff;

// Generate QR code as raw buffer then load into Jimp
const qrBuf = await QRCode.toBuffer(APP_URL, {
  type: 'png',
  width: 480,
  margin: 1,
  color: { dark: '#1e3a8a', light: '#ffffff' },
  errorCorrectionLevel: 'H',
});

// Load all images
const [qrImg, logoImg] = await Promise.all([
  Jimp.read(qrBuf),
  Jimp.read(LOGO_PATH),
]);

// Create card canvas (filled with royal blue)
const card = new Jimp({ width: W, height: H, color: ROYAL_BLUE });

// Gold top bar
const topBar = new Jimp({ width: W, height: 10, color: GOLD });
card.composite(topBar, 0, 0);

// White middle section for QR area
const whiteBlock = new Jimp({ width: 560, height: 560, color: WHITE });
card.composite(whiteBlock, (W - 560) / 2, 200);

// QR code centred on white block
qrImg.resize({ w: 480, h: 480 });
card.composite(qrImg, (W - 480) / 2, 240);

// Logo overlay in centre of QR (with white circle bg)
const logoSize = 108;
const logoBg = new Jimp({ width: logoSize + 8, height: logoSize + 8, color: WHITE });
const logoX = (W - logoSize - 8) / 2;
const logoY = 240 + (480 - logoSize - 8) / 2;
card.composite(logoBg, logoX, logoY);

logoImg.resize({ w: logoSize, h: logoSize });
card.composite(logoImg, (W - logoSize) / 2, 240 + (480 - logoSize) / 2);

// Gold bottom bar
const botBar = new Jimp({ width: W, height: 10, color: GOLD });
card.composite(botBar, 0, H - 10);

// Dark footer strip
const footer = new Jimp({ width: W, height: 130, color: DARK_BLUE });
card.composite(footer, 0, H - 140);

await card.write(OUT_PATH);
console.log('Saved to', OUT_PATH);
