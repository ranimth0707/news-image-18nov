// The world's news of Wednesday 18 November 2026 in one image, drawn from scratch.
// Node 22, standard library only, no network: it rasterises a front page with a built-in
// pixel font and simple vector icons, then encodes it as a PNG. Same input, same bytes.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function set(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = Math.max(0, y); j < Math.min(H, y + h); j++) for (let i = Math.max(0, x); i < Math.min(W, x + w); i++) set(i, j, c);
}

function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++)
    for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++)
      if ((i - cx) * (i - cx) + (j - cy) * (j - cy) <= r * r) set(i, j, c);
}

function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  for (let j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++)
    for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) {
      const d = (i - cx) * (i - cx) + (j - cy) * (j - cy);
      if (d <= r * r && d >= (r - t) * (r - t)) set(i, j, c);
    }
}

function line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let k = 0; k <= n; k++) circle(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, t / 2, c);
}

function poly(pts: number[][], c: RGB): void {
  let y0 = H, y1 = 0;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const xs: number[] = [];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5))
        xs.push(a[0] + ((y + 0.5 - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) set(x, y, c);
  }
}

// 5x7 pixel font: each glyph is seven rows of five bits, top row first.
const FONT: Record<string, string> = {
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 11001 10101 10011 10001 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
  '0': '01110 10001 10011 10101 11001 10001 01110', '1': '00100 01100 00100 00100 00100 00100 01110',
  '2': '01110 10001 00001 00010 00100 01000 11111', '3': '11111 00010 00100 00010 00001 10001 01110',
  '4': '00010 00110 01010 10010 11111 00010 00010', '5': '11111 10000 11110 00001 00001 10001 01110',
  '6': '00110 01000 10000 11110 10001 10001 01110', '7': '11111 00001 00010 00100 01000 01000 01000',
  '8': '01110 10001 10001 01110 10001 10001 01110', '9': '01110 10001 10001 01111 00001 00010 01100',
  ' ': '00000 00000 00000 00000 00000 00000 00000', '.': '00000 00000 00000 00000 00000 01100 01100',
  ',': '00000 00000 00000 00000 01100 00100 01000', ':': '00000 01100 01100 00000 01100 01100 00000',
  ';': '00000 01100 01100 00000 01100 00100 01000', '-': '00000 00000 00000 11111 00000 00000 00000',
  "'": '01100 00100 01000 00000 00000 00000 00000', '$': '00100 01111 10100 01110 00101 11110 00100',
  '%': '11000 11001 00010 00100 01000 10011 00011', '+': '00000 00100 00100 11111 00100 00100 00000',
  '/': '00000 00001 00010 00100 01000 10000 00000', '!': '00100 00100 00100 00100 00100 00000 00100',
  '&': '01100 10010 10100 01000 10101 10010 01101', '(': '00010 00100 01000 01000 01000 00100 00010',
  ')': '01000 00100 00010 00010 00010 00100 01000', '*': '00000 00100 10101 01110 10101 00100 00000',
};

function text(s: string, x: number, y: number, scale: number, c: RGB): number {
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT[' '];
    const rows = g.split(' ');
    for (let r = 0; r < 7; r++)
      for (let k = 0; k < 5; k++) if (rows[r][k] === '1') rect(x + k * scale, y + r * scale, scale, scale, c);
    x += 6 * scale;
  }
  return x;
}

const textWidth = (s: string, scale: number): number => s.length * 6 * scale - scale;

function wrap(s: string, maxChars: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of s.split(' ')) {
    if (cur && (cur + ' ' + w).length > maxChars) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) out.push(cur);
  return out;
}

// Palette
const PAPER = hex('#f4efe4');
const INK = hex('#1b1b1f');
const NAVY = hex('#14213d');
const GOLD = hex('#fca311');
const WHITE = hex('#ffffff');
const GREY = hex('#6b6b70');

// Icons, each drawn in a box whose centre is (cx, cy), about 110 px across.
type Icon = (cx: number, cy: number, c: RGB) => void;

const drone: Icon = (cx, cy, c) => {
  // a strike flash behind a quadcopter drone
  poly([[cx + 10, cy - 52], [cx + 22, cy - 22], [cx + 52, cy - 34], [cx + 32, cy - 6], [cx + 54, cy + 14], [cx + 22, cy + 10], [cx + 14, cy + 40], [cx + 2, cy + 12], [cx - 26, cy + 26], [cx - 10, cy - 2], [cx - 36, cy - 22], [cx - 4, cy - 20]], GOLD);
  line(cx - 34, cy - 30, cx + 34, cy + 30, 7, c);
  line(cx - 34, cy + 30, cx + 34, cy - 30, 7, c);
  for (const [dx, dy] of [[-34, -30], [34, 30], [-34, 30], [34, -30]]) { ring(cx + dx, cy + dy, 16, 5, c); circle(cx + dx, cy + dy, 4, c); }
  rect(cx - 14, cy - 10, 28, 20, c);
};

const meeting: Icon = (cx, cy, c) => {
  // two leaders at a table, flags between them
  for (const dx of [-30, 30]) {
    circle(cx + dx, cy - 26, 13, c);
    poly([[cx + dx - 20, cy + 22], [cx + dx - 16, cy - 8], [cx + dx + 16, cy - 8], [cx + dx + 20, cy + 22]], c);
  }
  rect(cx - 54, cy + 22, 108, 10, c);
  rect(cx - 46, cy + 32, 8, 22, c);
  rect(cx + 38, cy + 32, 8, 22, c);
  rect(cx - 2, cy - 44, 3, 40, GREY);
  // Russia's tricolour on the left, China's red flag on the right
  rect(cx - 19, cy - 44, 18, 4, hex('#dddddd'));
  rect(cx - 19, cy - 40, 18, 4, hex('#0039a6'));
  rect(cx - 19, cy - 36, 18, 4, hex('#d52b1e'));
  rect(cx + 2, cy - 44, 18, 12, hex('#de2910'));
  circle(cx + 7, cy - 40, 2.5, hex('#ffde00'));
};

const quad: Icon = (cx, cy, c) => {
  // four partners linked in a square around the Indo-Pacific
  ring(cx, cy, 48, 4, GREY);
  const pts = [[-34, -34], [34, -34], [34, 34], [-34, 34]];
  for (let k = 0; k < 4; k++) line(cx + pts[k][0], cy + pts[k][1], cx + pts[(k + 1) % 4][0], cy + pts[(k + 1) % 4][1], 5, c);
  line(cx - 34, cy - 34, cx + 34, cy + 34, 3, c);
  line(cx + 34, cy - 34, cx - 34, cy + 34, 3, c);
  for (const [dx, dy] of pts) { circle(cx + dx, cy + dy, 13, c); circle(cx + dx, cy + dy, 6, GOLD); }
};

const shield: Icon = (cx, cy, c) => {
  // an air-defence shield in Ukraine's blue and yellow
  poly([[cx - 44, cy - 48], [cx + 44, cy - 48], [cx + 44, cy + 2], [cx, cy + 52], [cx - 44, cy + 2]], c);
  poly([[cx - 36, cy - 40], [cx + 36, cy - 40], [cx + 36, cy - 4], [cx - 36, cy - 4]], hex('#0057b7'));
  poly([[cx - 36, cy - 4], [cx + 36, cy - 4], [cx + 36, cy + 0], [cx, cy + 42], [cx - 36, cy + 0]], hex('#ffd700'));
  line(cx - 54, cy + 48, cx - 14, cy - 60, 4, GREY);
  poly([[cx - 14, cy - 64], [cx - 8, cy - 52], [cx - 20, cy - 54]], GREY);
};

const tent: Icon = (cx, cy, c) => {
  // a displaced family's tent in winter rain
  for (let k = 0; k < 6; k++) line(cx - 50 + k * 20, cy - 56, cx - 58 + k * 20, cy - 36, 3, hex('#4a90c2'));
  poly([[cx, cy - 26], [cx + 52, cy + 40], [cx - 52, cy + 40]], c);
  poly([[cx, cy - 4], [cx + 16, cy + 40], [cx - 16, cy + 40]], PAPER);
  rect(cx - 60, cy + 40, 120, 6, GREY);
  rect(cx - 50, cy + 50, 30, 4, hex('#4a90c2'));
  rect(cx + 14, cy + 52, 40, 4, hex('#4a90c2'));
};

const chart: Icon = (cx, cy, c) => {
  // a chip maker's revenue bars rising, a gold coin falling
  const hs = [24, 40, 62, 92];
  for (let k = 0; k < 4; k++) rect(cx - 54 + k * 22, cy + 46 - hs[k], 16, hs[k], c);
  rect(cx - 58, cy + 46, 96, 4, INK);
  line(cx - 50, cy + 4, cx + 10, cy - 46, 5, hex('#2a9d8f'));
  poly([[cx + 20, cy - 56], [cx + 14, cy - 34], [cx - 2, cy - 48]], hex('#2a9d8f'));
  circle(cx + 46, cy - 14, 16, GOLD);
  ring(cx + 46, cy - 14, 16, 3, hex('#b5790a'));
  line(cx + 46, cy + 8, cx + 46, cy + 38, 5, hex('#c1121f'));
  poly([[cx + 36, cy + 34], [cx + 56, cy + 34], [cx + 46, cy + 48]], hex('#c1121f'));
};

interface Story { tag: string; color: RGB; icon: Icon; body: string }

const STORIES: Story[] = [
  { tag: 'GULF: US-IRAN WAR', color: hex('#c1121f'), icon: drone, body: 'IRAN DRONES TARGET US BASES IN KUWAIT AND BAHRAIN; US HITS QESHM ISLAND' },
  { tag: 'APEC: SHENZHEN', color: hex('#e85d04'), icon: meeting, body: 'PUTIN MEETS XI A DAY BEFORE THREE-WAY TALKS WITH TRUMP' },
  { tag: 'QUAD: MANILA', color: hex('#1d4e89'), icon: quad, body: 'QUAD LEADERS MEET FOR FIRST TIME IN 2 YEARS; TRUMP HAILS US-PHILIPPINES TRADE DEAL' },
  { tag: 'UKRAINE', color: hex('#0057b7'), icon: shield, body: 'EUROPE JOINS US-LED PEACE TALKS; GERMANY SENDS NEW AIR DEFENCES' },
  { tag: 'WEST BANK & GAZA', color: hex('#2d6a4f'), icon: tent, body: 'UK AND AUSTRALIA SANCTION SETTLER GROUPS; WHO: GAZA FACES 4TH WAR WINTER' },
  { tag: 'MARKETS', color: hex('#6a4c93'), icon: chart, body: 'NVIDIA REVENUE DOUBLES TO $115.8BN; GOLD HITS 1-YEAR LOW AT $3,792' },
];

const TICKER = [
  'ALSO: COP31 SPLIT OVER FOSSIL-FUEL PHASE-OUT',
  'UK INFLATION 3.6% * GTA VI LAUNCHES AT MIDNIGHT',
];

// Page
rect(0, 0, W, H, PAPER);

// Masthead
rect(0, 0, W, 156, NAVY);
const title = 'THE DAY IN WORLD NEWS';
text(title, (W - textWidth(title, 4)) >> 1, 20, 4, WHITE);
const date = 'WEDNESDAY 18 NOVEMBER 2026';
text(date, (W - textWidth(date, 6)) >> 1, 70, 6, GOLD);
rect(40, 134, W - 80, 3, GOLD);

// Six story panels, two columns by three rows
const M = 14, GAP = 14, TOP = 170, PW = (W - 2 * M - GAP) >> 1, PH = 246;
STORIES.forEach((s, k) => {
  const x = M + (k % 2) * (PW + GAP);
  const y = TOP + Math.floor(k / 2) * (PH + GAP);
  rect(x, y, PW, PH, WHITE);
  rect(x, y, PW, 44, s.color);
  text(s.tag, x + 14, y + 12, 3, WHITE);
  rect(x, y + PH - 4, PW, 4, s.color);
  s.icon(x + 70, y + 44 + ((PH - 48) >> 1), s.color);
  const tx = x + 140;
  const lines = wrap(s.body, Math.floor((PW - 150) / 18));
  const lh = 30;
  let ty = y + 44 + ((PH - 48 - lines.length * lh + 9) >> 1);
  for (const l of lines) { text(l, tx, ty, 3, INK); ty += lh; }
});

// Ticker
const TY = TOP + 3 * PH + 2 * GAP + 10;
rect(0, TY, W, H - TY, NAVY);
TICKER.forEach((t, k) => text(t, (W - textWidth(t, 3)) >> 1, TY + 14 + k * 32, 3, k === 0 ? WHITE : GOLD));

// PNG encoding
const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
function crc32(b: Uint8Array): number { let c = 0xffffffff; for (const v of b) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // truecolour RGB
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', new Uint8Array(0)),
]);

writeFileSync(join(process.env.MAKEFUN_OUTPUT_DIR ?? '/output', 'entry.png'), png);
