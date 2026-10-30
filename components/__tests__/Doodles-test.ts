import { widgetTexture } from '../doodles';
import { themedDoodles } from '../user-themed-doodles';
import { miffyDoodles } from '../user-miffy-doodles';

const drawings = { ...themedDoodles, ...miffyDoodles };
const count = (svg: string, name: keyof typeof drawings) => svg.split(drawings[name].paths[0].d).length - 1;
const placements = (svg: string) => Array.from(svg.matchAll(/<g transform="translate\(([-\d.]+),([-\d.]+)\) rotate\(([-\d.]+)\)"><g data-art="[^"]+" data-width="([^"]+)" data-height="([^"]+)"/g), match => {
  const [, x, y, angle, width, height] = match.map(Number);
  const radians = angle * Math.PI / 180;
  const halfWidth = (Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians))) / 2;
  const halfHeight = (Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))) / 2;
  return { x, y, left: x - halfWidth, right: x + halfWidth, top: y - halfHeight, bottom: y + halfHeight };
});

test.each([184, 316])('the %s-wide Alien widget has one face and one UFO', width => {
  const svg = widgetTexture(width, 238, '#34452F', '#EAF2D6', 'alien', width > 184);
  expect(count(svg, 'alien') + count(svg, 'alienFace')).toBe(1);
  expect(count(svg, 'ufo')).toBe(1);
  for (const drawing of svg.matchAll(/data-height="([^"]+)"/g)) {
    expect(Number(drawing[1])).toBeLessThanOrEqual(42);
  }
});

test.each([[150, 210, false], [184, 238, false], [316, 340, false], [280, 230, true], [316, 238, true], [400, 340, true]] as const)('the %s-by-%s Fruits widget keeps every fruit clear of covers (circle: %s)', (width, height, circle) => {
  const svg = widgetTexture(width, height, '#56333D', '#FBE6E4', 'fruits', circle);
  for (const fruit of ['strawberry', 'pineapple', 'watermelon', 'grapes'] as const) {
    expect(count(svg, fruit)).toBe(1);
  }
  for (const drawing of svg.matchAll(/data-height="([^"]+)"/g)) {
    expect(Number(drawing[1])).toBeLessThanOrEqual(42);
  }
  const motifs = placements(svg);
  expect(motifs).toHaveLength(5);
  for (const bounds of motifs) {
    // Cover bounds include space for the larger web cover and native text scaling.
    if (circle) expect(bounds.left).toBeGreaterThan(62);
    else expect(bounds.right < 16 || bounds.left > 82 || bounds.bottom < 48 || bounds.top > 128).toBe(true);
    expect(bounds.left).toBeGreaterThan(0);
    expect(bounds.right).toBeLessThan(width);
    expect(bounds.top).toBeGreaterThan(0);
    expect(bounds.bottom).toBeLessThan(height);
  }
});

test.each(['doodles', 'alien', 'fruits', 'miffy'] as const)('%s uses one SVG viewport so Android keeps every drawing positioned and translucent', pattern => {
  const svg = widgetTexture(184, 238, '#422E32', '#F7E9E6', pattern);
  expect(svg.match(/<svg\b/g)).toHaveLength(1);
  expect(svg.match(/data-art=/g)?.length).toBeGreaterThanOrEqual(3);
  expect(svg).toContain('opacity=".14"');
});

test('Alien placement follows the widget layout even when both cards have the same width', () => {
  const small = placements(widgetTexture(316, 238, '#34452F', '#EAF2D6', 'alien', false));
  const circle = placements(widgetTexture(316, 238, '#34452F', '#EAF2D6', 'alien', true));
  for (const motifs of [small, circle]) {
    expect(motifs).toHaveLength(3);
    expect(motifs[0].x).toBeGreaterThan(316 * .75);
    expect(motifs[0].y).toBeLessThan(238 / 2);
    expect(motifs[1].x).toBeGreaterThan(316 * .75);
    expect(motifs[1].y).toBeGreaterThan(238 * .75);
  }
  expect(small[2].x).toBeLessThan(316 / 4);
  expect(small[2].y).toBeGreaterThan(238 * .75);
  expect(circle[2].x).toBeCloseTo(316 / 2);
  expect(circle[2].y).toBeCloseTo(238 / 2);
});

test.each([[150, 210, false], [184, 238, false], [316, 340, false], [280, 230, true], [316, 238, true]] as const)('the %s-by-%s Miffy widget keeps drawings spaced, visible and unique (circle: %s)', (width, height, circle) => {
  const svg = widgetTexture(width, height, '#51432B', '#FFF2C5', 'miffy', circle);
  for (const drawing of Object.keys(miffyDoodles) as (keyof typeof miffyDoodles)[]) {
    if (circle) expect(count(svg, drawing)).toBe(1);
    else expect(count(svg, drawing)).toBeLessThanOrEqual(1);
  }
  const motifs = placements(svg);
  expect(motifs).toHaveLength(circle ? 7 : 5);
  for (const bounds of motifs) {
    if (circle) expect(bounds.left).toBeGreaterThan(62);
    else expect(bounds.right < 16 || bounds.left > 82 || bounds.bottom < 48 || bounds.top > 128).toBe(true);
    expect(bounds.left).toBeGreaterThan(0);
    expect(bounds.right).toBeLessThan(width);
    expect(bounds.top).toBeGreaterThan(0);
    expect(bounds.bottom).toBeLessThan(height);
  }
  for (let i = 0; i < motifs.length; i++) for (let j = i + 1; j < motifs.length; j++) {
    const a = motifs[i], b = motifs[j];
    expect(a.right + 4 < b.left || b.right + 4 < a.left || a.bottom + 4 < b.top || b.bottom + 4 < a.top).toBe(true);
  }
});
