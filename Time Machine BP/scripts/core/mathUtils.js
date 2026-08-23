// =============================================================================
// core/mathUtils.js
//
// Dependency-free noise + RNG helpers for the chunk streamer. Bedrock's
// script runtime has no access to npm packages, so this hand-rolls what
// world-gen needs: a fast integer hash, a smooth 2D value-noise built on
// top of it, a seedable RNG for per-chunk block variety, and a generic
// height-field formula every timeline plugs its own numbers into.
//
// This is adapted directly from a proven working reference implementation
// (a chunk-streaming ore-dimension add-on) rather than written from
// scratch, on the theory that "known to work" beats "theoretically fine."
// =============================================================================

/** Deterministically hashes two integers plus a seed into an unsigned
 *  32-bit integer. Everything else in this file is built on top of this
 *  one function. */
export function hash2D(x, z, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Seedable RNG (mulberry32) - given the same seed it always produces the
 *  same sequence, which is what lets a chunk rebuild (e.g. after a chunk
 *  reload) come out identical to the first time it was built. Used for
 *  "pick one of these blocks" and "should a tree go here" style rolls. */
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A single lattice-point value in [0, 1), used by noise2D below. */
function lattice(ix, iz, salt) {
  return hash2D(ix + salt * 1013, iz - salt * 977, salt) / 4294967296;
}

/** Smooth 2D value noise at a fractional (x, z), in [0, 1). `salt` acts
 *  like a second seed - pass different salts to get uncorrelated noise
 *  channels from the same (x, z). */
export function noise2D(x, z, salt) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const xf = x - x0;
  const zf = z - z0;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);

  const n00 = lattice(x0, z0, salt);
  const n10 = lattice(x0 + 1, z0, salt);
  const n01 = lattice(x0, z0 + 1, salt);
  const n11 = lattice(x0 + 1, z0 + 1, salt);

  return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
}

/**
 * Generic terrain-height formula shared by every timeline: one broad
 * "hilliness" octave that controls local amplitude, plus two finer octaves
 * layered on top. Each timeline tunes this via a handful of numbers on its
 * own config rather than writing its own height function.
 *
 * @param {number} x
 * @param {number} z
 * @param {{seed:number, baseY?:number, ampMin?:number, ampRange?:number, fineDetail?:number, freqScale?:number, floorY:number}} terrain
 */
export function terrainHeight(x, z, terrain) {
  const {
    seed,
    baseY = 90,
    ampMin = 11,
    ampRange = 26,
    fineDetail = 8,
    freqScale = 1,
    floorY = 40,
  } = terrain;

  const hills = noise2D(x * 0.004 * freqScale, z * 0.004 * freqScale, seed + 3);
  const amplitude = ampMin + hills * ampRange;
  const n1 = noise2D(x * 0.012 * freqScale, z * 0.012 * freqScale, seed + 1);
  const n2 = noise2D(x * 0.05 * freqScale, z * 0.05 * freqScale, seed + 2);

  const height = baseY + (n1 - 0.5) * 2 * amplitude + (n2 - 0.5) * fineDetail;
  return Math.max(floorY + 4, Math.round(height));
}
