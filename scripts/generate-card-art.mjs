#!/usr/bin/env node
/**
 * Deterministic, self-owned studio card art for every Catalog card.
 *
 *   npm run card-art:generate            # write public/images/cards/* + manifest.json
 *   npm run card-art:generate -- --check # exit 1 if any committed art differs from a fresh render
 *
 * Artwork is ISO/IEC 7810 ID-1 (85.60 x 53.98 mm, 1.586:1) at 1012x638 px with
 * transparent rounded corners. It carries a material treatment per card family,
 * a geometric EMV chip, a generic contactless glyph, and a generic tier word —
 * never an issuer or network logo, wordmark, or scraped pixel.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { predefinedCardsData } from "../src/lib/static-catalog.ts";

export const GENERATOR_VERSION = "studio-1";
export const ART_WIDTH = 1012;
export const ART_HEIGHT = 638;
const CORNER = 38;
const OUTPUT_DIR = path.join(process.cwd(), "public", "images", "cards");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");

/** Material family per card; colors are [deep, mid, light, ink]. */
const FAMILY_BY_CARD = {
  "card:american-express-platinum-card": "platinum",
  "card:american-express-business-platinum-card": "platinum",
  "card:citi-strata-elite": "platinum",
  "card:hilton-honors-american-express-aspire-card": "platinum",
  "card:delta-skymiles-platinum-american-express-card": "platinum",
  "card:csr": "obsidian",
  "card:sapphire-reserve-business": "obsidian",
  "card:venture-x": "obsidian",
  "card:bilt-obsidian": "obsidian",
  "card:ritz-carlton": "obsidian",
  "card:delta-skymiles-reserve-american-express-card": "obsidian",
  "card:marriott-bonvoy-brilliant-american-express-card": "obsidian",
  "card:csp": "sapphire",
  "card:freedom-flex": "sapphire",
  "card:ink-business-preferred": "sapphire",
  "card:united-explorer": "sapphire",
  "card:united-quest": "sapphire",
  "card:united-business": "sapphire",
  "card:southwest-plus": "sapphire",
  "card:southwest-priority": "sapphire",
  "card:southwest-premier": "sapphire",
  "card:southwest-performance-business": "sapphire",
  "card:bilt-blue": "sapphire",
  "card:american-express-gold-card": "rose-brass",
  "card:american-express-business-gold-card": "rose-brass",
  "card:delta-skymiles-gold-american-express-card": "rose-brass",
  "card:hilton-honors-american-express-surpass-card": "rose-brass",
  "card:marriott-bonvoy-business-american-express-card": "rose-brass",
  "card:marriott-boundless": "rose-brass",
  "card:discover-it": "rose-brass",
  "card:alaska-visa": "emerald",
  "card:atmos-summit": "emerald",
  "card:atmos-ascent": "emerald",
  "card:atmos-business": "emerald",
  "card:ihg-premier": "emerald",
  "card:ihg-premier-business": "emerald",
  "card:hilton-honors-american-express-business-card": "emerald",
  "card:bilt-palladium": "titanium",
  "card:citi-strata-premier": "titanium",
  "card:hsbc-elite": "titanium",
  "card:citi-aadvantage-executive": "titanium",
  "card:citi-aadvantage-globe": "titanium",
  "card:citi-aadvantage-mileup": "titanium",
  "card:citi-aadvantage-platinum-select": "titanium",
  "card:citi-aadvantage-business": "titanium",
};

const FAMILIES = {
  platinum: { colors: ["#8d939b", "#c9ced4", "#f1f3f5", "#2b2f35"], chip: "silver", texture: "brushed", hueSpread: 6 },
  obsidian: { colors: ["#07080b", "#16181e", "#2c3039", "#d9dce2"], chip: "gold", texture: "carbon", hueSpread: 18 },
  sapphire: { colors: ["#071a3d", "#123a7a", "#3f74c4", "#eef3fb"], chip: "silver", texture: "facets", hueSpread: 22 },
  "rose-brass": { colors: ["#7a4a2c", "#c08a5b", "#ecc9a0", "#2c1a10"], chip: "gold", texture: "arcs", hueSpread: 14 },
  emerald: { colors: ["#03261d", "#0b5a43", "#3aa27f", "#e9f6f0"], chip: "gold", texture: "fluted", hueSpread: 20 },
  titanium: { colors: ["#3a3f46", "#6e757e", "#aeb5bd", "#f4f6f8"], chip: "silver", texture: "guilloche", hueSpread: 10 },
};

/** Generic English tier words only — no product marks, issuer names, or networks. */
const TIER_WORDS = [
  "Reserve", "Preferred", "Platinum", "Gold", "Elite", "Premier", "Executive", "Summit", "Ascent",
  "Performance", "Priority", "Explorer", "Quest", "Globe", "Select", "Plus", "Flex", "Obsidian",
  "Palladium", "Blue", "Cash Back", "Business",
];

function tierWords(name) {
  const words = TIER_WORDS.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(name));
  const primary = words.find((word) => word !== "Business") ?? (words.includes("Business") ? "Business" : "Rewards");
  return { primary, business: words.includes("Business") || /\bInk\b/i.test(name) };
}

function seededRandom(seedText) {
  let state = crypto.createHash("sha256").update(seedText).digest().readUInt32LE(0);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [hue * 60, saturation, lightness];
}

function shiftHue(hex, degrees) {
  const [h, s, l] = hexToHsl(hex);
  const hue = (((h + degrees) % 360) + 360) % 360;
  return `hsl(${hue.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;
}

const round = (value) => Math.round(value * 100) / 100;

function textureMarkup(texture, random, palette) {
  const [, , light, ink] = palette;
  switch (texture) {
    case "brushed": {
      const lines = [];
      for (let y = 0; y < ART_HEIGHT; y += 2) {
        const opacity = round(0.03 + random() * 0.09);
        lines.push(`<rect x="0" y="${y}" width="${ART_WIDTH}" height="1" fill="${random() > 0.5 ? "#ffffff" : "#000000"}" opacity="${opacity}"/>`);
      }
      return `<g>${lines.join("")}</g>`;
    }
    case "carbon":
      return `<defs><pattern id="weave" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="9" height="18" fill="#ffffff" opacity="0.035"/><rect x="9" width="9" height="9" fill="#ffffff" opacity="0.07"/>
        <rect x="0" y="9" width="9" height="9" fill="#000000" opacity="0.25"/></pattern></defs>
        <rect width="${ART_WIDTH}" height="${ART_HEIGHT}" fill="url(#weave)"/>`;
    case "facets": {
      const polygons = [];
      const columns = 9;
      const rows = 6;
      const point = (column, row) => [
        (column / columns) * ART_WIDTH + (column % columns ? (random() - 0.5) * 70 : 0),
        (row / rows) * ART_HEIGHT + (row % rows ? (random() - 0.5) * 60 : 0),
      ];
      const grid = Array.from({ length: rows + 1 }, (_, row) => Array.from({ length: columns + 1 }, (_, column) => point(column, row)));
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const [a, b, c, d] = [grid[row][column], grid[row][column + 1], grid[row + 1][column + 1], grid[row + 1][column]];
          for (const triangle of [[a, b, c], [a, c, d]]) {
            const opacity = round(random() * 0.14);
            polygons.push(`<polygon points="${triangle.map(([x, y]) => `${round(x)},${round(y)}`).join(" ")}" fill="${random() > 0.45 ? light : "#000814"}" opacity="${opacity}"/>`);
          }
        }
      }
      return `<g>${polygons.join("")}</g>`;
    }
    case "arcs": {
      const arcs = [];
      const cx = ART_WIDTH * (0.82 + random() * 0.1);
      const cy = ART_HEIGHT * (1.05 + random() * 0.2);
      for (let radius = 60; radius < 1300; radius += 9) {
        arcs.push(`<circle cx="${round(cx)}" cy="${round(cy)}" r="${radius}" fill="none" stroke="${radius % 27 === 6 ? "#fff6e8" : ink}" stroke-width="0.9" opacity="${round(radius % 27 === 6 ? 0.22 : 0.06)}"/>`);
      }
      return `<g>${arcs.join("")}</g>`;
    }
    case "fluted": {
      const bands = [];
      const width = 26;
      for (let x = -width; x < ART_WIDTH + width; x += width) {
        bands.push(`<rect x="${x}" y="0" width="${width}" height="${ART_HEIGHT}" fill="url(#flute)"/>`);
      }
      return `<defs><linearGradient id="flute" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#000000" stop-opacity="0.22"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0.10"/>
        <stop offset="0.7" stop-color="#ffffff" stop-opacity="0.02"/><stop offset="1" stop-color="#000000" stop-opacity="0.18"/></linearGradient></defs>
        <g opacity="0.85">${bands.join("")}</g>`;
    }
    case "guilloche": {
      const paths = [];
      const cx = ART_WIDTH * (0.7 + random() * 0.08);
      const cy = ART_HEIGHT * (0.42 + random() * 0.1);
      const petals = 9 + Math.floor(random() * 5);
      for (let ring = 0; ring < 14; ring += 1) {
        const base = 120 + ring * 22;
        const amplitude = 26 + ring * 2.5;
        const phase = ring * 0.21;
        const points = [];
        for (let step = 0; step <= 720; step += 1) {
          const angle = (step / 720) * Math.PI * 2;
          const radius = base + amplitude * Math.sin(petals * angle + phase) + 8 * Math.cos(3 * petals * angle);
          points.push(`${round(cx + radius * Math.cos(angle))},${round(cy + radius * Math.sin(angle) * 0.78)}`);
        }
        paths.push(`<polyline points="${points.join(" ")}" fill="none" stroke="${ring % 3 === 0 ? light : ink}" stroke-width="1" opacity="${ring % 3 === 0 ? 0.34 : 0.14}"/>`);
      }
      return `<g>${paths.join("")}</g>`;
    }
    default:
      throw new Error(`Unknown texture ${texture}`);
  }
}

function chipMarkup(kind) {
  const stops = kind === "gold"
    ? ["#8a6a2f", "#e3c27a", "#f7e3ae", "#b08a43"]
    : ["#7d848c", "#d7dce1", "#f6f7f8", "#9aa1a9"];
  const x = 96;
  const y = 232;
  const width = 132;
  const height = 100;
  return `<defs><linearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
      ${stops.map((color, index) => `<stop offset="${index / (stops.length - 1)}" stop-color="${color}"/>`).join("")}
    </linearGradient></defs>
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="url(#chip)"/>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="none" stroke="#000000" stroke-opacity="0.28" stroke-width="1.5"/>
      <g fill="none" stroke="#3b2f1c" stroke-opacity="0.45" stroke-width="2">
        <path d="M${x} ${y + 34} H${x + 40} M${x} ${y + 66} H${x + 40} M${x + 92} ${y + 34} H${x + width} M${x + 92} ${y + 66} H${x + width}"/>
        <rect x="${x + 40}" y="${y + 18}" width="52" height="64" rx="10"/>
        <path d="M${x + 66} ${y} V${y + 18} M${x + 66} ${y + 82} V${y + height}"/>
      </g>
    </g>`;
}

function contactlessMarkup(color) {
  const cx = 270;
  const cy = 282;
  return `<g fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" opacity="0.72">
    ${[16, 30, 44, 58].map((radius) => {
      const dx = round(radius * Math.cos(Math.PI / 4));
      const dy = round(radius * Math.sin(Math.PI / 4));
      return `<path d="M${cx + dx} ${cy - dy} A${radius} ${radius} 0 0 1 ${cx + dx} ${cy + dy}"/>`;
    }).join("")}
  </g>`;
}

export function renderCardArtSvg(card) {
  const family = FAMILY_BY_CARD[card.catalogKey];
  if (!family) throw new Error(`No card-art family for ${card.catalogKey}; add it to FAMILY_BY_CARD.`);
  const { colors, chip, texture, hueSpread } = FAMILIES[family];
  const random = seededRandom(`${GENERATOR_VERSION}:${card.catalogKey}`);
  const hue = (random() - 0.5) * hueSpread;
  const palette = colors.map((color) => shiftHue(color, hue));
  const [deep, mid, light, ink] = palette;
  const sheenAngle = round(18 + random() * 24);
  const edition = String(1 + Math.floor(random() * 99)).padStart(2, "0");
  const { primary, business } = tierWords(card.name);
  const darkInk = family === "platinum" || family === "rose-brass" || family === "titanium";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ART_WIDTH}" height="${ART_HEIGHT}" viewBox="0 0 ${ART_WIDTH} ${ART_HEIGHT}">
  <defs>
    <clipPath id="card"><rect width="${ART_WIDTH}" height="${ART_HEIGHT}" rx="${CORNER}"/></clipPath>
    <linearGradient id="base" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${deep}"/><stop offset="0.55" stop-color="${mid}"/><stop offset="1" stop-color="${light}"/>
    </linearGradient>
    <linearGradient id="sheen" gradientTransform="rotate(${sheenAngle} 0.5 0.5)">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.48" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="0.52" stop-color="#ffffff" stop-opacity="0.05"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.35" cy="0.3" r="0.95">
      <stop offset="0.55" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.32"/>
    </radialGradient>
  </defs>
  <g clip-path="url(#card)">
    <rect width="${ART_WIDTH}" height="${ART_HEIGHT}" fill="url(#base)"/>
    ${textureMarkup(texture, random, palette)}
    <rect width="${ART_WIDTH}" height="${ART_HEIGHT}" fill="url(#sheen)"/>
    <rect width="${ART_WIDTH}" height="${ART_HEIGHT}" fill="url(#vignette)"/>
    ${chipMarkup(chip)}
    ${contactlessMarkup(darkInk ? ink : "#f4f6fa")}
    <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="${darkInk ? ink : "#f4f6fa"}">
      <text x="96" y="132" font-size="34" font-weight="500" letter-spacing="10" opacity="0.92">${primary.toUpperCase()}</text>
      ${business && primary !== "Business" ? `<text x="98" y="170" font-size="17" font-weight="400" letter-spacing="7" opacity="0.6">BUSINESS</text>` : ""}
      <text x="96" y="556" font-size="18" font-weight="400" letter-spacing="6" opacity="0.55">STUDIO EDITION · NO. ${edition}</text>
    </g>
    <g transform="translate(${ART_WIDTH - 128} ${ART_HEIGHT - 132})" fill="none" stroke="${darkInk ? ink : "#f4f6fa"}" stroke-width="2.5" opacity="${darkInk ? 0.45 : 0.55}">
      <rect x="4" y="4" width="52" height="52" rx="10" transform="rotate(45 30 30)"/>
      <path d="M18 31 L27 40 L43 22" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
  <rect x="1" y="1" width="${ART_WIDTH - 2}" height="${ART_HEIGHT - 2}" rx="${CORNER - 1}" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2"/>
</svg>`;
}

const OUTPUT_FORMAT = {
  ".png": (image) => image.png({ compressionLevel: 9, adaptiveFiltering: true }),
  ".webp": (image) => image.webp({ quality: 92, alphaQuality: 100, effort: 6 }),
  ".avif": (image) => image.avif({ quality: 70, effort: 6 }),
  ".jpg": (image) => image.flatten({ background: "#f3f4f6" }).jpeg({ quality: 90, mozjpeg: true }),
};

/** Target files per card: the catalog path, plus a legacy alias when a stored path cannot carry alpha. */
export function cardArtTargets(card) {
  const slug = card.catalogKey.slice("card:".length);
  if (!card.imageUrl) throw new Error(`${card.catalogKey} has no imageUrl; set /images/cards/${slug}.png in the catalog.`);
  const extension = path.extname(card.imageUrl).toLowerCase();
  if (!OUTPUT_FORMAT[extension] || extension === ".jpg") {
    throw new Error(`${card.catalogKey} imageUrl ${card.imageUrl} must be .png, .webp, or .avif so corners stay transparent.`);
  }
  return [{ file: path.basename(card.imageUrl), role: "primary" }];
}

async function renderFile(svg, file) {
  const image = sharp(Buffer.from(svg), { density: 72 }).resize(ART_WIDTH, ART_HEIGHT);
  return OUTPUT_FORMAT[path.extname(file).toLowerCase()](image).toBuffer();
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  const check = process.argv.includes("--check");
  const legacy = JSON.parse(await fs.readFile(path.join(process.cwd(), "scripts", "card-art-legacy-aliases.json"), "utf8"));
  const images = [];
  const mismatches = [];

  for (const card of predefinedCardsData) {
    const svg = renderCardArtSvg(card);
    const targets = [
      ...cardArtTargets(card),
      ...(legacy[card.catalogKey] ?? []).map((file) => ({ file, role: "legacy-alias" })),
    ];
    for (const { file, role } of targets) {
      const buffer = await renderFile(svg, file);
      const filepath = path.join(OUTPUT_DIR, file);
      if (check) {
        const existing = await fs.readFile(filepath).catch(() => null);
        if (!existing || sha256(existing) !== sha256(buffer)) mismatches.push(file);
      } else {
        await fs.writeFile(filepath, buffer);
      }
      images.push({
        cardName: card.name,
        catalogKey: card.catalogKey,
        filename: file,
        path: `/images/cards/${file}`,
        role,
        source: "studio-generated",
        generator: GENERATOR_VERSION,
        family: FAMILY_BY_CARD[card.catalogKey],
        sourceUrl: null,
        width: ART_WIDTH,
        height: ART_HEIGHT,
        type: path.extname(file).slice(1).replace("jpg", "jpeg"),
        sizeBytes: buffer.length,
        sha256: sha256(buffer),
      });
    }
  }

  if (check) {
    if (mismatches.length > 0) {
      console.error(`Card art is stale or hand-edited: ${mismatches.join(", ")}. Run npm run card-art:generate.`);
      process.exitCode = 1;
    } else {
      console.log(`Card art matches a fresh ${GENERATOR_VERSION} render for ${images.length} files.`);
    }
    return;
  }

  images.sort((left, right) => left.filename.localeCompare(right.filename));
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify({ generator: GENERATOR_VERSION, aspectRatio: "ISO/IEC 7810 ID-1 (85.60 x 53.98 mm)", images }, null, 2)}\n`);
  console.log(`Rendered ${images.length} card-art files for ${predefinedCardsData.length} cards.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
