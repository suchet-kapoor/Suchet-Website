// ─────────────────────────────────────────────────────────────────────────────
// "Write Amplification: Postgres vs MySQL" — social media GIF + PNG generator
// Pure JavaScript rasterizer (no canvas) + gifenc encoder. Inspired by Uber's
// "Why Uber Engineering Switched from Postgres to MySQL" blog post.
// Run:  node make-social-gif.mjs
// Out:  postgres-vs-mysql-write-amplification.gif / .png
// ─────────────────────────────────────────────────────────────────────────────
import pkg from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = pkg;
import fs from 'fs';
import zlib from 'zlib';

// ─── 5x7 bitmap font ─────────────────────────────────────────────────────────
const FONT = {
  A:['01110','10001','10001','11111','10001','10001','10001'],
  B:['11110','10001','10001','11110','10001','10001','11110'],
  C:['01110','10001','10000','10000','10000','10001','01110'],
  D:['11110','10001','10001','10001','10001','10001','11110'],
  E:['11111','10000','10000','11110','10000','10000','11111'],
  F:['11111','10000','10000','11110','10000','10000','10000'],
  G:['01110','10001','10000','10011','10001','10001','01110'],
  H:['10001','10001','10001','11111','10001','10001','10001'],
  I:['01110','00100','00100','00100','00100','00100','01110'],
  J:['00111','00010','00010','00010','00010','10010','01100'],
  K:['10001','10010','10100','11000','10100','10010','10001'],
  L:['10000','10000','10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10101','10001','10001','10001'],
  N:['10001','10001','11001','10101','10011','10001','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'],
  P:['11110','10001','10001','11110','10000','10000','10000'],
  Q:['01110','10001','10001','10001','10101','10010','01101'],
  R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'],
  T:['11111','00100','00100','00100','00100','00100','00100'],
  U:['10001','10001','10001','10001','10001','10001','01110'],
  V:['10001','10001','10001','10001','10001','01010','00100'],
  W:['10001','10001','10001','10101','10101','10101','01010'],
  X:['10001','10001','01010','00100','01010','10001','10001'],
  Y:['10001','10001','01010','00100','00100','00100','00100'],
  Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','11110','00001','00001','10001','01110'],
  '6':['00110','01000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00010','01100'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
  '.':['00000','00000','00000','00000','00000','00000','00100'],
  ',':['00000','00000','00000','00000','00000','00100','01000'],
  ':':['00000','00100','00100','00000','00100','00100','00000'],
  '-':['00000','00000','00000','01110','00000','00000','00000'],
  '_':['00000','00000','00000','00000','00000','00000','11111'],
  '+':['00000','00100','00100','11111','00100','00100','00000'],
  '=':['00000','01110','00000','01110','00000','00000','00000'],
  '(':['00010','00100','01000','01000','01000','00100','00010'],
  ')':['01000','00100','00010','00010','00010','00100','01000'],
  '/':['00001','00010','00010','00100','01000','01000','10000'],
  '%':['11001','11010','00010','00100','01000','01011','10011'],
  '!':['00100','00100','00100','00100','00100','00000','00100'],
  '#':['01010','01010','11111','01010','11111','01010','01010'],
  '@':['01110','10001','00001','10111','10101','10111','01110'],
  '&':['01100','10010','10100','01000','10101','10010','01101'],
  "'":['00100','00100','01000','00000','00000','00000','00000'],
  '"':['01010','01010','00000','00000','00000','00000','00000'],
  '?':['01110','10001','00001','00110','00100','00000','00100'],
  '>':['01000','00100','00010','00001','00010','00100','01000'],
  '<':['00010','00100','01000','10000','01000','00100','00010'],
};

// ─── Tiny rasterizer ─────────────────────────────────────────────────────────
class Canvas {
  constructor(S) { this.S = S; this.buf = new Uint8Array(S * S * 4); }
  px(x, y, c, a = 255) {
    const S = this.S; x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    const k = a / 255;
    this.buf[i]     = this.buf[i]   * (1 - k) + c[0] * k;
    this.buf[i + 1] = this.buf[i+1] * (1 - k) + c[1] * k;
    this.buf[i + 2] = this.buf[i+2] * (1 - k) + c[2] * k;
    this.buf[i + 3] = Math.min(255, this.buf[i + 3] + a);
  }
  fillRect(x, y, w, h, c, a = 255) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) this.px(i, j, c, a);
  }
  strokeRect(x, y, w, h, t, c, a = 255) {
    this.fillRect(x, y, w, t, c, a);
    this.fillRect(x, y + h - t, w, t, c, a);
    this.fillRect(x, y, t, h, c, a);
    this.fillRect(x + w - t, y, t, h, c, a);
  }
  line(x1, y1, x2, y2, t, c, a = 255) {
    x1 = Math.round(x1); y1 = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2);
    const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let err = dx - dy, x = x1, y = y1;
    const half = (t - 1) / 2;
    for (;;) {
      this.fillRect(x - half, y - half, t, t, c, a);
      if (x === x2 && y === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 <  dx) { err += dx; y += sy; }
    }
  }
  glowLine(x1, y1, x2, y2, t, c, a = 255) {   // cheap glow = thick translucent pass + bright core
    this.line(x1, y1, x2, y2, t + 4, c, Math.round(a * 0.25));
    this.line(x1, y1, x2, y2, t, c, a);
  }
  arrow(x1, y1, x2, y2, t, c, a = 255, glow = true) {
    if (glow) this.glowLine(x1, y1, x2, y2, t, c, a); else this.line(x1, y1, x2, y2, t, c, a);
    const ang = Math.atan2(y2 - y1, x2 - x1), hl = 9;
    for (const off of [2.5, -2.5])
      this.line(x2, y2, x2 - hl * Math.cos(ang + off), y2 - hl * Math.sin(ang + off), t, c, a);
  }
  textWidth(str, scale) { return str.length * 6 * scale - scale; }
  text(str, x, y, scale, c, { align = 'left', alpha = 255, glow = false } = {}) {
    str = str.toUpperCase();
    if (align === 'center') x -= this.textWidth(str, scale) / 2;
    if (align === 'right')  x -= this.textWidth(str, scale);
    if (glow) {
      for (const [ox, oy] of [[-1,0],[1,0],[0,-1],[0,1]])
        this.rawText(str, x + ox, y + oy, scale, c, Math.round(alpha * 0.28));
    }
    this.rawText(str, x, y, scale, c, alpha);
    return x;
  }
  rawText(str, x, y, scale, c, alpha) {
    let cx = x;
    for (const ch of str) {
      const g = FONT[ch];
      if (g) for (let r = 0; r < 7; r++)
        for (let k = 0; k < 5; k++)
          if (g[r][k] === '1') this.fillRect(cx + k * scale, y + r * scale, scale, scale, c, alpha);
      cx += 6 * scale;
    }
  }
}

// ─── Palette ─────────────────────────────────────────────────────────────────
const BG      = [11, 15, 29];
const PANEL   = [19, 26, 46];
const PANEL2  = [24, 32, 56];
const TXT     = [232, 236, 248];
const DIM     = [124, 134, 166];
const PG      = [255, 107, 94];    // Postgres red
const PG_HOT  = [255, 45, 32];
const MY      = [52, 211, 153];   // MySQL emerald
const MY_HOT  = [16, 185, 129];
const YELLOW  = [251, 191, 36];
const WHITE   = [255, 255, 255];

const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
const pulse = (f, speed = 0.55) => 0.5 + 0.5 * Math.sin(f * speed);

// ─── Frame renderer (designed in an 800x800 coordinate space, scaled by u) ───
// Phases (40 frames @100ms = 4s loop):
//   f 0-5   : idle intro          f 8     : new row version appears
//   f 9-14  : index writes fire   f 16+   : verdict punchline
//   f 35-39 : fade out to loop
const FRAMES = 40;
const PG_EVENTS = { heap: 8, pk: 9, name: 11, year: 13 };   // write milestones
const MY_EVENTS = { row: 8, year: 10, undo: 12 };

function render(f, S) {
  const u = S / 800;
  const c = new Canvas(S);
  const R = (v) => v * u;                       // rescale helper
  c.fillRect(0, 0, S, S, BG);

  // subtle dot grid
  for (let gy = 0; gy < S; gy += R(34))
    for (let gx = 0; gx < S; gx += R(34)) c.px(gx, gy, [40, 50, 80], 140);

  // ── header ──
  c.text('WRITE AMPLIFICATION', S / 2, R(38), R(4), TXT, { align: 'center', glow: true });
  c.text('ONE UPDATE - TWO VERY DIFFERENT DISK STORIES', S / 2, R(92), R(2), DIM, { align: 'center' });
  c.fillRect(S * 0.3, R(122), S * 0.4, Math.max(2, R(2)), mix(PG, MY, 0.5), 200);

  // panel geometry
  const py = R(148), ph = R(490), pw = R(364);
  const px1 = R(24), px2 = R(412);

  // shared intro strip (per panel) : the SQL
  const code = ['UPDATE USERS', 'SET BIRTH_YEAR = 770', 'WHERE ID = 4'];

  const drawPanel = (x0, accent, hot, title, subtitle, isPG) => {
    const fade = f >= 35 ? 1 - (f - 34) / 6 : 1;   // global fade-out for loop
    c.fillRect(x0, py, pw, ph, PANEL, 255 * fade);
    c.strokeRect(x0, py, pw, ph, Math.max(2, R(2)), accent, 180 * fade);
    c.fillRect(x0, py, pw, R(4), accent, 220 * fade); // top accent bar

    c.text(title, x0 + R(20), py + R(14), R(3), TXT, { alpha: 255 * fade });
    c.text('WRITES: ' + (isPG ? pgCount(f) : myCount(f)), x0 + pw - R(20), py + R(14), R(3),
      accent, { align: 'right', alpha: 255 * fade, glow: true });

    c.text(subtitle, x0 + R(20), py + R(52), R(2), DIM, { alpha: 255 * fade });

    // SQL block
    code.forEach((l, i) =>
      c.text(l, x0 + R(20), py + R(80) + i * R(17), R(2), YELLOW, { alpha: 200 * fade }));

    // ── heap / row box ──
    const heapY = py + R(170), heapH = R(62);
    const heapW = isPG ? R(324) : R(210);
    c.fillRect(x0 + R(20), heapY, heapW, heapH, PANEL2, 255 * fade);
    c.strokeRect(x0 + R(20), heapY, heapW, heapH, Math.max(2, R(2)), DIM, 140 * fade);
    c.text(isPG ? 'HEAP + NEW TUPLE' : 'PK INDEX = TABLE', x0 + R(20), heapY - R(20), R(2), DIM, { alpha: 255 * fade });

    const rowY = heapY + R(12), rowH = R(38), rowW = isPG ? R(148) : R(188);
    // old row version
    c.fillRect(x0 + R(30), rowY, rowW, rowH, [30, 38, 62], 255 * fade);
    c.strokeRect(x0 + R(30), rowY, rowW, rowH, Math.max(2, R(2)), [80, 90, 120], 200 * fade);
    if (isPG || f < MY_EVENTS.row)
      c.text('ID 4 | 780', x0 + R(30) + rowW / 2, rowY + R(12), R(2), DIM, { align: 'center', alpha: 255 * fade });

    const flash = pulse(f, 0.8);
    if (isPG) {
      // NEW immutable tuple appears (ctid I)
      if (f >= PG_EVENTS.heap) {
        const nx = x0 + R(192), nxw = R(148);
        c.fillRect(nx, rowY, nxw, rowH, mix(PANEL2, PG_HOT, 0.25 + 0.25 * flash), 255 * fade);
        c.strokeRect(nx, rowY, nxw, rowH, Math.max(2, R(2)), PG, 255 * fade);
        c.text('ID 4 | 770', nx + nxw / 2, rowY + R(12), R(2), WHITE, { align: 'center', alpha: 255 * fade });
      }
    } else {
      // in-place update: same rect, value flips with green pulse
      const t = f >= MY_EVENTS.row ? 1 : 0;
      c.strokeRect(x0 + R(30), rowY, rowW, rowH, Math.max(2, R(2)),
        t ? mix(MY, WHITE, 0.35 * flash) : [80, 90, 120], 255 * fade);
      c.text('ID 4 | ' + (t ? '770' : '780'), x0 + R(30) + rowW / 2, rowY + R(12), R(2),
        t ? WHITE : DIM, { align: 'center', alpha: 255 * fade });
      // rollback segment box (old version goes here)
      const ux = x0 + R(240), uw = R(84), uh = R(46), uy = heapY - R(52);
      c.strokeRect(ux, uy, uw, uh, Math.max(2, R(2)), MY, 120 * fade);
      c.text('ROLLBACK', ux + uw / 2, uy + R(8), R(1) + 1, DIM, { align: 'center', alpha: 255 * fade });
      c.text('SEGMENT', ux + uw / 2, uy + R(24), R(1) + 1, DIM, { align: 'center', alpha: 255 * fade });
    }

    // ── arrows from new row to indexes (drawn BEHIND index boxes) ──
    const ibY = py + R(266), ibH = R(40), ibGap = R(52);
    const srcX = x0 + (isPG ? R(260) : R(130)), srcY = heapY + heapH;
    const fired = isPG
      ? [{ f: PG_EVENTS.pk, row: 0 }, { f: PG_EVENTS.name, row: 1 }, { f: PG_EVENTS.year, row: 2 }]
      : [{ f: MY_EVENTS.year, row: 2 }];
    fired.forEach(({ f: evF, row }) => {
      if (f < evF) return;
      const age = f - evF;
      const a = age < 2 ? 255 : Math.max(70, 255 - age * 18);
      c.arrow(srcX, srcY, x0 + R(16), ibY + row * ibGap + ibH / 2,
        Math.max(2, R(2)), isPG ? PG : MY, a * fade);
    });
    if (!isPG && f >= MY_EVENTS.undo) {      // old row -> rollback segment
      c.arrow(x0 + R(205), heapY - R(4), x0 + R(238), heapY - R(29),
        Math.max(2, R(2)), MY, Math.max(70, 255 - (f - MY_EVENTS.undo) * 14) * fade);
    }

    // ── index boxes ──
    const idx = isPG
      ? [['PK INDEX', PG_EVENTS.pk], ['NAME INDEX', PG_EVENTS.name], ['YEAR INDEX', PG_EVENTS.year]]
      : [['PK (ROW DATA)', -1], ['NAME INDEX', -1], ['YEAR INDEX', MY_EVENTS.year]];
    idx.forEach(([label, evF], i) => {
      const iy = ibY + i * ibGap;
      const hit = evF >= 0 && f >= evF;
      const col = hit ? (isPG ? PG_HOT : MY) : [70, 80, 108];
      c.fillRect(x0 + R(20), iy, R(324), ibH, hit ? mix(PANEL2, col, 0.22) : PANEL2, 255 * fade);
      c.strokeRect(x0 + R(20), iy, R(324), ibH, Math.max(2, R(2)), hit ? col : [70, 80, 108],
        hit ? 255 : 160 * fade);
      c.text(label, x0 + R(32), iy + R(13), R(2), hit ? WHITE : DIM, { alpha: 255 * fade });
      if (hit) c.text('+ WRITE', x0 + R(344) - R(10), iy + R(13), R(2), col,
        { align: 'right', alpha: 255 * fade, glow: true });
    });

    // ── replication note ──
    const note = isPG ? 'WAL SHIPS EVERY PAGE WRITE' : 'BINLOG: 1 LOGICAL ROW CHANGE';
    const ny = py + ph - R(46);
    c.text(note, x0 + pw / 2, ny, R(2), isPG ? PG : MY, { align: 'center', alpha: 255 * fade, glow: true });
    if (!isPG && f >= MY_EVENTS.undo)
      c.text('+1 OLD ROW -> ROLLBACK SEG', x0 + pw / 2, ny + R(20), R(2), DIM, { align: 'center', alpha: 255 * fade });
    if (isPG)
      c.text('CTID = PHYSICAL DISK OFFSET', x0 + pw / 2, ny + R(20), R(2), DIM, { align: 'center', alpha: 255 * fade });
  };

  drawPanel(px1, PG, PG_HOT, 'POSTGRES', 'INDEX -> DISK OFFSETS', true);
  drawPanel(px2, MY, MY_HOT, 'MYSQL', 'INNODB: INDEX -> PK', false);

  // ── verdict ──
  if (f >= 16 && f < 36) {
    const va = Math.min(1, (f - 16) / 2) * (f >= 35 ? 1 - (f - 34) / 6 : 1);
    c.text('POSTGRES: EVERY INDEX RE-POINTS', S / 2, R(672), R(3), PG, { align: 'center', alpha: 255 * va, glow: true });
    c.text('MYSQL: ONLY WHAT CHANGED', S / 2, R(706), R(3), MY, { align: 'center', alpha: 255 * va, glow: true });
  }
  c.text('SOURCE: UBER ENG BLOG - POSTGRES TO MYSQL', S / 2, R(758), R(2), [90, 98, 124], { align: 'center' });

  // fade to bg for a clean loop
  if (f >= 35) c.fillRect(0, 0, S, S, BG, 255 * ((f - 34) / 6));

  return c.buf;
}

// write counters
const pgCount = (f) => 1 + [PG_EVENTS.pk, PG_EVENTS.name, PG_EVENTS.year].filter(e => f >= e).length;
const myCount = (f) => (f >= MY_EVENTS.row ? 1 : 0) + (f >= MY_EVENTS.year ? 1 : 0) +
  (f >= MY_EVENTS.undo ? 1 : 0);

// ─── GIF encode ──────────────────────────────────────────────────────────────
const S = 800;
const gif = GIFEncoder();
for (let f = 0; f < FRAMES; f++) {
  const rgba = render(f, S);
  const palette = quantize(rgba, 255);
  const index = applyPalette(rgba, palette, 'rgb565');
  gif.writeFrame(index, S, S, { palette, delay: 100, ...(f === 0 ? { repeat: 0 } : {}) });
  process.stdout.write(`\rframe ${f + 1}/${FRAMES}`);
}
gif.finish();
fs.writeFileSync('postgres-vs-mysql-write-amplification.gif', gif.bytes());
console.log('\nGIF written');

// ─── PNG poster (final verdict state, higher res) ────────────────────────────
function crc32(buf) {
  let T = crc32.T;
  if (!T) {
    T = crc32.T = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c; }
  }
  let c = ~0;
  for (const b of buf) c = T[(c ^ b) & 255] ^ (c >>> 8);
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(rgba, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const PS = 1080;
fs.writeFileSync('postgres-vs-mysql-write-amplification.png',
  encodePNG(render(20, PS), PS, PS));
console.log('PNG written');
