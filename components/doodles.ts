import { userDoodles } from './user-doodles';
import { themedDoodles } from './user-themed-doodles';
import { miffyDoodles } from './user-miffy-doodles';
import type { Pattern } from '../services/listening-model';

const drawings = { ...userDoodles, ...themedDoodles, ...miffyDoodles };
function draw(name: keyof typeof drawings, x: number, y: number, width: number, height: number) {
  const art = drawings[name];
  // Nested SVG viewports lose their offsets, inherited opacity and clipping
  // state in Android's react-native-svg renderer. Keep one root viewport and
  // position the original paths with a normal group transform instead.
  const scale = Math.min(width / art.width, height / art.height);
  const left = x + (width - art.width * scale) / 2;
  const top = y + (height - art.height * scale) / 2;
  return `<g data-art="${name}" data-width="${width}" data-height="${height}" transform="translate(${left},${top}) scale(${scale})">${art.paths.map(part => `<path fill-opacity="${part.opacity}" d="${part.d}"/>`).join('')}</g>`;
}

// Use the supplied pencil cat, with its original linework and no white rectangle.
export const catDoodle = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><g fill="#625F55">${draw('cat', 0, 0, 180, 180)}</g></svg>`;

export function patternIcon(pattern: Pattern) {
  const art = pattern === 'miffy' ? 'miffyBunny' : pattern === 'alien' ? 'alienFace' : pattern === 'fruits' ? 'strawberry' : 'flower';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="28" viewBox="0 0 26 28"><g fill="#625F55">${draw(art, 2, 1, 22, 26)}</g></svg>`;
}

// A quiet, basic note for songs whose artwork cannot be found.
export function coverFallbackSvg(ink = '#817666', background = '#EEE9DD') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="12" fill="${background}"/><g fill="none" stroke="${ink}" stroke-opacity=".55" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M45 49V26l11 3"/><ellipse cx="39" cy="50" rx="6" ry="4" transform="rotate(-16 39 50)"/></g></svg>`;
}

function scatteredMotifs(width: number, height: number, pattern: 'alien' | 'fruits' | 'miffy', circle: boolean) {
  // A stable random seed keeps the artwork still when songs or colors change.
  let seed = (Math.imul(Math.round(width), 73856093) ^ Math.imul(Math.round(height), 19349663) ^ (pattern === 'alien' ? 8271 : pattern === 'miffy' ? 39317 : 21943)) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const motif = (art: keyof typeof drawings, x: number, y: number, size: number, rotation: number) => {
    const artWidth = size * drawings[art].width / drawings[art].height;
    return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${rotation.toFixed(1)})">${draw(art, -artWidth / 2, -size / 2, artWidth, size)}</g>`;
  };
  if (pattern === 'alien') {
    const face = random() > .5 ? 'alien' : 'alienFace';
    return [
      motif('ufo', width - 38, 70, 40, -12),
      motif(face, width - 32, height - 32, 38, 12),
      motif(face === 'alien' ? 'alienFace' : 'alien', circle ? width / 2 : 28, circle ? height / 2 : height - 28, circle ? 32 : 30, -15),
    ].join('');
  }
  if (pattern === 'miffy') {
    // Leave open space around each drawing, with a lighter compact layout.
    const placements: [keyof typeof drawings, number, number, number, number][] = circle ? [
      ['miffyBunny', width - 34, 70, 36, -7],
      ['miffyCoffee', Math.max(104, width * .55), 66, 26, 6],
      ['miffyHeart', Math.max(90, width * .36), height * .48, 14, -12],
      ['miffyStar', width * .67, height * .52, 15, 10],
      ['miffyFlower', width - 32, height * .64, 38, 8],
      ['miffyHappy', Math.max(92, width * .43), height - 33, 32, -7],
      ['miffyNotes', width * .72, height - 27, 19, -8],
    ] : [
      ['miffyBunny', width - 32, 70, 34, -7],
      ['miffyHeart', width - 24, height * .52, 14, -12],
      ['miffyFlower', width - 32, height - 65, 34, 8],
      ['miffyHappy', 28, height - 28, 30, -7],
      ['miffyNotes', width * .61, height - 24, 18, -8],
    ];
    return placements.map(([art, x, y, size, rotation]) => motif(art, x, y, size, rotation)).join('');
  }
  const artOrder: (keyof typeof drawings)[] = ['strawberry', 'pineapple', 'watermelon', 'grapes'];
  // One of each supplied drawing, with a stable shuffle for each widget size.
  for (let i = artOrder.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [artOrder[i], artOrder[j]] = [artOrder[j], artOrder[i]];
  }
  const count = artOrder.length;
  const points: { x: number; y: number }[] = [];
  const motifs: string[] = [];
  for (let i = 0; i < count + 1; i++) {
    const accent = i >= count;
    const art = accent ? 'heart' : artOrder[i];
    const size = accent ? 14 + random() * 4 : 34 + random() * 8;
    const rotation = -24 + random() * 48;
    const radians = rotation * Math.PI / 180;
    const artWidth = size * drawings[art].width / drawings[art].height;
    // Include the rotated corners when keeping a drawing clear of album art.
    const halfWidth = (Math.abs(artWidth * Math.cos(radians)) + Math.abs(size * Math.sin(radians))) / 2;
    const halfHeight = (Math.abs(artWidth * Math.sin(radians)) + Math.abs(size * Math.cos(radians))) / 2;
    const minX = (circle ? 70 : 12) + halfWidth;
    const maxX = Math.max(minX, width - 12 - halfWidth);
    const minY = 48 + halfHeight;
    const maxY = Math.max(minY, height - 12 - halfHeight);
    let point = { x: maxX, y: maxY }, bestDistance = -1;
    for (let candidate = 0; candidate < 48; candidate++) {
      const next = { x: minX + random() * (maxX - minX), y: minY + random() * (maxY - minY) };
      // The small cover occupies the upper left. The circle's whole cover
      // column stays empty so scrolling album covers never hide a drawing.
      if (!circle && next.x - halfWidth < 90 && next.y - halfHeight < 132) continue;
      const distance = points.length ? Math.min(...points.map(p => (p.x - next.x) ** 2 + (p.y - next.y) ** 2)) : 1;
      if (distance > bestDistance) { point = next; bestDistance = distance; }
    }
    points.push(point);
    motifs.push(motif(art, point.x, point.y, size, rotation));
  }
  return motifs.join('');
}

const textureCache = new Map<string, string>();
export function widgetTexture(width: number, height: number, ink: string, background: string, pattern: Pattern = 'doodles', circle = false) {
  const key = `${width}:${height}:${ink}:${background}:${pattern}:${circle}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const dots = Array.from({ length: Math.ceil(height / 12) }, (_, row) =>
    Array.from({ length: Math.ceil(width / 13) }, (_, col) => `<circle cx="${col * 13 + (row % 2 ? 6 : 2)}" cy="${row * 12 + 3}" r=".45"/>`).join('')).join('');
  let motifs: string;
  if (pattern === 'alien' || pattern === 'fruits' || pattern === 'miffy') {
    motifs = scatteredMotifs(width, height, pattern, circle);
  } else {
    motifs = `<g transform="translate(${width - 68},${height - 61}) rotate(-12)">${draw('flower', 3, -4, 54, 65)}</g>
${draw('star', 7, height - 56, 20, 20)}
<g transform="translate(${width - 60},44) rotate(14)">${draw('notes', -8, -3, 22, 24)}</g>
${draw('spiral', width / 2 - 12, height / 2 - 12, 24, 24)}
${draw('heart', -1, 59, 22, 20)}`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="24" fill="${background}"/><g fill="${ink}" opacity=".13">${dots}</g><g fill="${ink}" opacity=".14">${motifs}</g></svg>`;
  if (textureCache.size >= 24) textureCache.delete(textureCache.keys().next().value!);
  textureCache.set(key, svg);
  return svg;
}
