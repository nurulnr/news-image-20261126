// News image for Thursday 26 November 2026 — draws the day's world news as a
// single front page: a lead story, a grid of top stories, a UTC timeline,
// an "in brief" column and a markets strip. Node 22+, standard library only.
// Run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The output is fully deterministic: no clock, no randomness, no network.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [246, 243, 236];
const INK = [18, 32, 66];
const NAVY = [18, 40, 75];
const CREAM = [255, 248, 231];
const RED = [193, 39, 45];
const GOLD = [214, 158, 24];
const TEAL = [14, 124, 123];
const BLUE = [36, 90, 160];
const GREEN = [46, 125, 50];
const PURPLE = [106, 62, 150];
const ORANGE = [200, 96, 20];
const WHITE = [255, 255, 255];
const SOFT = [90, 100, 120];
const LINE = [200, 192, 176];
const CARD = [255, 255, 255];

type RGB = number[];

// ------------------------------------------------------- 5x7 bitmap font
// Each glyph is 7 rows; each row is a 5-bit number, bit 4 = leftmost pixel.
// Only capitals are stored; the renderer upper-cases everything.
const GLYPHS: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 10, 4, 4, 4, 10, 17],
  Y: [17, 10, 4, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 6, 8, 16, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4],
  '-': [0, 0, 0, 31, 0, 0, 0],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '/': [1, 1, 2, 4, 8, 16, 16],
  '%': [25, 25, 2, 4, 8, 19, 19],
  '+': [0, 4, 4, 31, 4, 4, 0],
  '&': [12, 18, 20, 8, 21, 18, 13],
  '$': [4, 15, 20, 14, 5, 30, 4],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '"': [10, 10, 10, 0, 0, 0, 0],
  '=': [0, 0, 31, 0, 31, 0, 0],
  '*': [0, 4, 21, 14, 21, 4, 0],
  '<': [2, 4, 8, 16, 8, 4, 2],
  '>': [8, 4, 2, 1, 2, 4, 8],
  _: [0, 0, 0, 0, 0, 0, 31],
  '[': [14, 8, 8, 8, 8, 8, 14],
  ']': [14, 2, 2, 2, 2, 2, 14],
  '#': [10, 10, 31, 10, 31, 10, 10],
  '@': [14, 17, 23, 21, 23, 16, 14],
  '·': [0, 0, 0, 12, 12, 0, 0],
};

// ------------------------------------------------------------- raster page
class Page {
  buf = new Uint8Array(W * H * 3);

  constructor() {
    this.fill(PAPER);
  }

  fill(c: RGB): void {
    for (let i = 0; i < W * H; i++) {
      this.buf[i * 3] = c[0];
      this.buf[i * 3 + 1] = c[1];
      this.buf[i * 3 + 2] = c[2];
    }
  }

  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }

  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
    }
  }

  // Outline rectangle, 1px border.
  frame(x: number, y: number, w: number, h: number, c: RGB): void {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }

  // Filled disc centred on (cx, cy) with radius r.
  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let yy = cy - r; yy <= cy + r; yy++) {
      const dy = yy - cy;
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      for (let xx = cx - half; xx <= cx + half; xx++) this.px(xx, yy, c);
    }
  }

  // Ring (outline circle) via parametric steps.
  ring(cx: number, cy: number, r: number, c: RGB): void {
    for (let a = 0; a < 360; a += 1) {
      const t = (a * Math.PI) / 180;
      this.px(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
    }
  }

  textWidth(s: string, scale: number): number {
    return s.toUpperCase().length * (5 * scale + 1) - 1;
  }

  // Draws upper-cased text; unknown glyphs become blank space.
  text(s: string, x: number, y: number, scale: number, c: RGB): void {
    const up = s.toUpperCase();
    const adv = 5 * scale + 1;
    for (let ci = 0; ci < up.length; ci++) {
      const g = GLYPHS[up[ci]] ?? GLYPHS[' '];
      const ox = x + ci * adv;
      for (let row = 0; row < 7; row++) {
        const bits = g[row];
        for (let col = 0; col < 5; col++) {
          if (bits & (16 >> col)) {
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                this.px(ox + col * scale + sx, y + row * scale + sy, c);
              }
            }
          }
        }
      }
    }
  }

  textCentered(s: string, y: number, scale: number, c: RGB): void {
    this.text(s, Math.floor((W - this.textWidth(s, scale)) / 2), y, scale, c);
  }
}

// ------------------------------------------------------------- PNG writer
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(p: Page): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(p.buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ story data
// Every story below was reported on Thursday 26 November 2026.
const LEAD = {
  kicker: 'LEAD STORY - WASHINGTON',
  line1: 'TRUMP PROPOSES NEW TARIFFS',
  line2: 'ON 14 TRADING PARTNERS',
  sub1: 'Up to 35% — 20% on China and the EU, 15% on Japan —',
  sub2: 'as markets reel and partners push back.',
};

const GRID: { tag: RGB; title: string }[] = [
  { tag: RED, title: 'HOUTHIS HIT SAUDI PORTS, RAS TANURA' },
  { tag: RED, title: 'KYIV HIT BY MISSILES, AIRBASE STRUCK' },
  { tag: BLUE, title: 'EU LEADERS SPLIT OVER 45BN UKRAINE LOAN' },
  { tag: ORANGE, title: 'KIM: DEPLOY TACTICAL NUKES MORE WIDELY' },
  { tag: ORANGE, title: 'CAIRO TANKER FIRE KILLS AT LEAST 31' },
  { tag: RED, title: 'ISRAELI STRIKES KILL 9 IN GAZA OVERNIGHT' },
  { tag: GOLD, title: 'NASDAQ BRIEFLY ENTERS BEAR MARKET' },
  { tag: PURPLE, title: 'FCC CLEARS SPACEX 1M SPACE DATA CENTRES' },
  { tag: TEAL, title: 'PAKISTANI ASTRONAUT REACHES TIANGONG' },
  { tag: RED, title: 'US TELLS CITIZENS TO LEAVE IRAN' },
  { tag: RED, title: 'LEAK PUTS RUSSIAN WAR DEAD NEAR 490,000' },
  { tag: BLUE, title: 'RUSSIA APPROVES RECORD MILITARY BUDGET' },
  { tag: PURPLE, title: '1PASSWORD BREACHED VIA STAFF GITHUB' },
  { tag: GOLD, title: 'BANK OF KOREA RAISES RATE TO 3.25%' },
  { tag: TEAL, title: 'SOLOMONS SIGNS AUSTRALIA SECURITY PACT' },
  { tag: BLUE, title: 'SPAIN HEADS TO SNAP ELECTION ON SUNDAY' },
  { tag: GREEN, title: 'NEARLY 2,000 MIGRANTS REACH CANARIES' },
  { tag: ORANGE, title: '13 MINERS TRAPPED IN FLOODED JAVA MINE' },
];

const TIMELINE: { time: string; text: string }[] = [
  { time: '00:28', text: 'FCC CLEARS SPACEX STARMIND PLAN' },
  { time: '05:31', text: 'TRUMP, NATO CHIEF WARN RUSSIA' },
  { time: '06:31', text: 'RUSSIAN MISSILES HIT KYIV' },
  { time: '08:00', text: 'EU LEADERS MEET ON UKRAINE LOAN' },
  { time: '09:33', text: 'SCIENTISTS DOUBT 1M SATELLITES' },
  { time: '10:27', text: 'S. AFRICA COURT BACKS PRESIDENT' },
  { time: '13:30', text: 'ECB PUBLISHES OCTOBER MINUTES' },
  { time: 'EVE', text: 'LIVERPOOL BEAT CLUB BRUGGE 3-0' },
];

const BRIEF: string[] = [
  'MERZ: RUSSIAN AIMS GO BEYOND UKRAINE',
  'EISENKOT SEALS FIRST COALITION DEAL',
  'JUDGES: DROP NETANYAHU BRIBERY CASE',
  'UK GUARDS AIRBASES AGAINST DRONE THREAT',
  'ZAMBIA BANS PROTEST ON TERM-LIMIT PUSH',
  'DRONE STRIKES KILL 19 CIVILIANS IN SUDAN',
  'JUDGE HALTS TRUMP BIRTHRIGHT ORDER',
  'ZAPORIZHZHIA PLANT RUNS ON DIESEL',
  'US CORE INFLATION 3.3%, HIGHEST SINCE 2023',
  'NVIDIA HALTS SERVER SHIPMENTS IN SE ASIA',
  'MUSK: 2 SPACEX SHARES FOR EVERY US CHILD',
  'AUSTRALIA BUSINESS INVESTMENT JUMPS 12.2%',
  'POLAND PLANS NO-FLY ZONE AT BORDER',
  "MACY'S 100TH THANKSGIVING PARADE MARCHES",
];

const MARKETS =
  'MARKETS: NIKKEI +1.4% · HANG SENG +1.6% · BRENT $94 · GOLD $3,572 · BTC $61K · US CLOSED';

// ------------------------------------------------------------ composition
function sectionLabel(p: Page, y: number, label: string): void {
  p.text(label, 8, y, 2, NAVY);
  const w = p.textWidth(label, 2);
  p.rect(8 + w + 10, y + 6, W - 16 - w - 10, 2, LINE);
}

function draw(p: Page): void {
  // Header band with a small globe mark.
  p.rect(0, 0, W, 96, NAVY);
  p.disc(64, 48, 30, GOLD);
  p.ring(64, 48, 30, NAVY);
  p.rect(34, 46, 60, 2, NAVY);
  p.rect(62, 18, 2, 60, NAVY);
  p.ring(64, 48, 18, NAVY);
  p.text('THURSDAY 26 NOVEMBER 2026', 120, 16, 4, WHITE);
  p.text('THE WORLD IN ONE IMAGE', 120, 58, 2, [180, 200, 230]);

  // Lead story panel.
  p.rect(8, 104, W - 16, 128, CREAM);
  p.frame(8, 104, W - 16, 128, LINE);
  p.rect(8, 104, 14, 128, RED);
  p.text(LEAD.kicker, 36, 116, 2, RED);
  p.text(LEAD.line1, 36, 138, 3, INK);
  p.text(LEAD.line2, 36, 164, 3, INK);
  p.text(LEAD.sub1, 36, 196, 2, SOFT);
  p.text(LEAD.sub2, 36, 214, 2, SOFT);

  // Top stories grid: 2 columns x 9 rows.
  sectionLabel(p, 244, 'TOP STORIES');
  const cardW = 496;
  const cardH = 40;
  const gap = 6;
  for (let i = 0; i < GRID.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 8 + col * (cardW + 8);
    const y = 268 + row * (cardH + gap);
    p.rect(x, y, cardW, cardH, CARD);
    p.frame(x, y, cardW, cardH, LINE);
    p.rect(x, y, 10, cardH, GRID[i].tag);
    p.text(GRID[i].title, x + 20, y + 13, 2, INK);
  }

  // UTC timeline: 2 columns x 4 rows.
  sectionLabel(p, 684, 'THE DAY IN UTC');
  for (let i = 0; i < TIMELINE.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 8 + col * (cardW + 8);
    const y = 706 + row * 30;
    p.text(TIMELINE[i].time, x, y, 2, RED);
    p.text(TIMELINE[i].text, x + 66, y, 2, INK);
  }

  // In brief: 2 columns x 7 rows.
  sectionLabel(p, 832, 'IN BRIEF');
  for (let i = 0; i < BRIEF.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 8 + col * (cardW + 8);
    const y = 856 + row * 16;
    p.text('>', x, y, 2, GOLD);
    p.text(BRIEF[i], x + 14, y, 2, INK);
  }

  // Markets strip.
  p.rect(0, 972, W, 40, NAVY);
  p.textCentered(MARKETS, 985, 2, WHITE);

  // Footer.
  p.textCentered('ALL EVENTS REPORTED THURSDAY 26 NOVEMBER 2026', 1014, 1, SOFT);
}

function main(): void {
  const p = new Page();
  draw(p);
  const png = encodePng(p);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), png);
}

main();
