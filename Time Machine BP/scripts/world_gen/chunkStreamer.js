// =============================================================================
// world_gen/chunkStreamer.js
//
// This is the terrain engine. Instead of building one fixed-size island up
// front (which needs one giant ticking area and has a hard "how big can it
// be" ceiling), it streams terrain in a chunk at a time as players explore
// - the same technique the Overworld itself effectively uses, just driven
// by our own script instead of the engine's built-in generator.
//
// The moving parts, all running as small system.runInterval loops:
//
//   1. QUEUE SCANNER (every 10 ticks) - for every player standing in a
//      custom timeline, queues the chunks within VIEW_RADIUS_CHUNKS of
//      them that haven't been generated or queued yet.
//   2. QUEUE DRAINER (every 2 ticks) - pulls the nearest queued chunks and
//      turns them into active build jobs, capped at
//      MAX_CONCURRENT_CHUNK_JOBS so memory/complexity stays bounded.
//   3. BUDGET PROCESSOR (every tick) - works through the nearest active
//      job's columns, spending up to BLOCK_BUDGET block-placements (or
//      URGENT_BLOCK_BUDGET if a player is standing in that exact chunk
//      right now) before yielding back to the game for that tick.
//   4. FOLLOWING TICKING AREAS (every 30 ticks) - keeps a ticking area
//      centred on each player as they move, so the chunks around them
//      stay loaded long enough to be built and walked on.
//   5. FALL-THROUGH SAFETY NET (every tick) - if a player is below the
//      terrain that's SUPPOSED to be there and it isn't finished yet, nudge
//      them up and give brief fall-damage/void-damage immunity rather than
//      letting them drop through unfinished chunks.
//
// A chunk is considered "already generated" if the probe block at its
// centre (at FLOOR_Y, which is unconditionally bedrock once built) is no
// longer air. That means generation state doesn't need its own saved flag
// at all - it's read straight from the world itself, which is both simpler
// and can't drift out of sync with what's actually there.
// =============================================================================

import { world, system } from "@minecraft/server";
import {
  CHUNK_SIZE,
  VIEW_RADIUS_CHUNKS,
  FLOOR_Y,
  BLOCK_BUDGET,
  URGENT_BLOCK_BUDGET,
  MAX_CONCURRENT_CHUNK_JOBS,
  TICKING_BOUNDS,
} from "../core/config.js";
import { hash2D, mulberry32, noise2D, terrainHeight } from "../core/mathUtils.js";
import { setBlock, setBlockIfAir } from "./blockUtils.js";
import { CUSTOM_TIMELINES, getTimelineById } from "./timelines/registry.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Active chunk-build jobs. Each: { dim, timeline, cx, cz, cols, ci, rng }. */
const jobs = [];

/** cellKey -> true, for chunks confirmed generated (this session's cache;
 *  see the module comment above for why this never needs to be saved). */
const GENERATED = new Set();

/** Chunks waiting to become jobs, plus a Set mirror for fast "already
 *  queued?" checks. */
const QUEUE = [];
const queued = new Set();

function cellKey(timelineKey, cx, cz) {
  return `${timelineKey}|${cx},${cz}`;
}

// ---------------------------------------------------------------------------
// Starting a chunk
// ---------------------------------------------------------------------------

/**
 * Attempts to start generating one chunk. Returns:
 *   "started" - a new job was queued
 *   "skip"    - this chunk was already generated (probe block isn't air)
 *   "wait"    - the chunk isn't loaded yet, try again shortly
 *
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("./timelines/registry.js").timeline} timeline
 */
export function startChunk(dimension, timeline, cx, cz) {
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;

  let probe;
  try {
    probe = dimension.getBlock({ x: ox + 8, y: FLOOR_Y, z: oz + 8 });
  } catch {
    probe = undefined;
  }
  if (!probe) return "wait";
  if (!probe.isAir) return "skip";

  const rng = mulberry32(hash2D(cx * 31 + 7, cz * 17 + 3, timeline.terrain.seed));
  const cols = [];
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const x = ox + lx;
      const z = oz + lz;
      cols.push({ x, z, h: terrainHeight(x, z, { ...timeline.terrain, floorY: FLOOR_Y }) });
    }
  }
  // Build from the chunk's centre outward - purely cosmetic (so a chunk
  // "fills in" from the middle if you're watching it happen), but free.
  cols.sort(
    (a, b) =>
      Math.abs(a.x - (ox + 8)) + Math.abs(a.z - (oz + 8)) - (Math.abs(b.x - (ox + 8)) + Math.abs(b.z - (oz + 8)))
  );

  jobs.push({ dim: dimension, timeline, cx, cz, cols, ci: 0, rng });
  return "started";
}

// ---------------------------------------------------------------------------
// Column placement
// ---------------------------------------------------------------------------

/** Picks a block for one vertical step, based on how close to the surface
 *  it is. Near-surface and deep palettes are simple arrays - each timeline
 *  lists 1+ blocks and this rolls between them, so e.g. Burning Earth's
 *  surface alternates basalt/blackstone instead of being a flat colour. */
function pickTerrainBlock(terrain, rng, y, surfaceY) {
  const nearDepth = terrain.nearSurfaceDepth ?? 4;
  const list = y >= surfaceY - nearDepth ? terrain.nearSurfaceBlocks : terrain.deepBlocks;
  return list[Math.floor(rng() * list.length)];
}

/** Places one full column: a bedrock floor, layered terrain up to the
 *  noise-computed surface height, then (if this timeline has one) a flood
 *  fill up to a fixed level - lava for Burning Earth's "oceans", water for
 *  Jurassic's rivers/lakes, ice for Ice Age's frozen waterways. Returns how
 *  many blocks were placed, which feeds the per-tick budget. */
function placeColumn(job, col) {
  const dim = job.dim;
  const terrain = job.timeline.terrain;
  const surfaceY = col.h;
  let placed = 0;

  setBlock(dim, col.x, FLOOR_Y, col.z, "minecraft:bedrock");
  placed++;

  for (let y = FLOOR_Y + 1; y <= surfaceY; y++) {
    setBlock(dim, col.x, y, col.z, pickTerrainBlock(terrain, job.rng, y, surfaceY));
    placed++;
  }

  if (terrain.flood) {
    for (let y = surfaceY + 1; y <= terrain.flood.level; y++) {
      setBlock(dim, col.x, y, col.z, terrain.flood.block);
      placed++;
    }
  }

  return placed;
}

// ---------------------------------------------------------------------------
// Trees (direct block placement - no reliance on Dimension.placeFeature,
// whose vanilla feature ids vary by game version. See a timeline's
// `terrain.trees` config for what's tunable per timeline.)
// ---------------------------------------------------------------------------

function isTreeSpot(terrain, x, z) {
  const cell = terrain.trees.cell ?? 6;
  const cx = Math.floor(x / cell);
  const cz = Math.floor(z / cell);
  const h = hash2D(cx, cz, terrain.seed + 91);
  return x - cx * cell === 1 + (h % (cell - 2)) && z - cz * cell === 1 + ((h >>> 8) % (cell - 2));
}

function treeDensityAt(terrain, x, z) {
  const n = noise2D(x * 0.006, z * 0.006, terrain.seed + 4);
  const base = terrain.trees.densityBase ?? 0.05;
  const variance = terrain.trees.densityVar ?? 0.6;
  return base + n * n * variance;
}

function buildTree(dim, treeCfg, x, groundY, z, rng) {
  const minHeight = treeCfg.minHeight ?? 5;
  const maxHeight = treeCfg.maxHeight ?? 7;
  const trunkHeight = minHeight + Math.floor(rng() * (maxHeight - minHeight + 1));

  for (let i = 1; i <= trunkHeight; i++) {
    setBlock(dim, x, groundY + i, z, treeCfg.logBlock);
  }

  const topY = groundY + trunkHeight;

  for (let ly = topY - 1; ly <= topY; ly++) {
    for (let lx = -2; lx <= 2; lx++) {
      for (let lz = -2; lz <= 2; lz++) {
        if (lx === 0 && lz === 0) continue;
        if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && rng() < 0.6) continue;
        setBlockIfAir(dim, x + lx, ly, z + lz, treeCfg.leafBlock);
      }
    }
  }

  for (let ly = topY + 1; ly <= topY + 2; ly++) {
    for (let lx = -1; lx <= 1; lx++) {
      for (let lz = -1; lz <= 1; lz++) {
        if (Math.abs(lx) === 1 && Math.abs(lz) === 1 && ly === topY + 2 && rng() < 0.7) continue;
        setBlockIfAir(dim, x + lx, ly, z + lz, treeCfg.leafBlock);
      }
    }
  }
}

/** Runs once a chunk's columns are all placed - currently just scatters
 *  trees where the timeline config asks for them. Deliberately does NOT
 *  spawn any entities/mobs - that's for you to add, see the `spawning`
 *  block in each timeline config file. */
function finishChunk(job) {
  const terrain = job.timeline.terrain;
  if (!terrain.trees) return;

  for (const col of job.cols) {
    if (!isTreeSpot(terrain, col.x, col.z)) continue;
    if (job.rng() < treeDensityAt(terrain, col.x, col.z)) {
      buildTree(job.dim, terrain.trees, col.x, col.h, col.z, job.rng);
    }
  }
}

// ---------------------------------------------------------------------------
// Player/chunk bookkeeping shared by several of the loops below
// ---------------------------------------------------------------------------

/** @returns {Record<string, {cx:number, cz:number}[]>} timeline key -> the
 *  chunk coordinates of every player currently standing in that timeline. */
function playersByTimelineKey() {
  const out = {};
  for (const player of world.getAllPlayers()) {
    const timeline = getTimelineById(player.dimension.id);
    if (!timeline || timeline.isPresent) continue;
    const cx = Math.floor(player.location.x / CHUNK_SIZE);
    const cz = Math.floor(player.location.z / CHUNK_SIZE);
    (out[timeline.key] = out[timeline.key] || []).push({ cx, cz });
  }
  return out;
}

function chebyshevDistance(cx, cz, points) {
  let best = Infinity;
  for (const p of points) {
    const d = Math.max(Math.abs(cx - p.cx), Math.abs(cz - p.cz));
    if (d < best) best = d;
  }
  return best;
}

// ---------------------------------------------------------------------------
// The five always-on loops
// ---------------------------------------------------------------------------

function startQueueScanner() {
  system.runInterval(() => {
    const byTimeline = playersByTimelineKey();
    for (const timeline of CUSTOM_TIMELINES) {
      const players = byTimeline[timeline.key];
      if (!players) continue;
      for (const { cx: pcx, cz: pcz } of players) {
        for (let dx = -VIEW_RADIUS_CHUNKS; dx <= VIEW_RADIUS_CHUNKS; dx++) {
          for (let dz = -VIEW_RADIUS_CHUNKS; dz <= VIEW_RADIUS_CHUNKS; dz++) {
            const cx = pcx + dx;
            const cz = pcz + dz;
            const key = cellKey(timeline.key, cx, cz);
            if (GENERATED.has(key) || queued.has(key)) continue;
            queued.add(key);
            QUEUE.push({ timeline, cx, cz, key, distance: 0 });
          }
        }
      }
    }
  }, 10);
}

function startQueueDrainer() {
  system.runInterval(() => {
    if (QUEUE.length === 0 || jobs.length >= MAX_CONCURRENT_CHUNK_JOBS) return;

    const byTimeline = playersByTimelineKey();
    for (const cell of QUEUE) {
      const players = byTimeline[cell.timeline.key];
      cell.distance = players ? chebyshevDistance(cell.cx, cell.cz, players) : 999;
    }
    QUEUE.sort((a, b) => a.distance - b.distance);

    let attempts = 8;
    while (attempts-- > 0 && QUEUE.length && jobs.length < MAX_CONCURRENT_CHUNK_JOBS) {
      const cell = QUEUE.shift();
      queued.delete(cell.key);
      if (cell.distance >= 999) continue; // no player nearby anymore - drop it, it'll be re-queued if needed

      let dimension;
      try {
        dimension = world.getDimension(cell.timeline.id);
      } catch {
        continue; // dimension isn't registered - see main.js's registration-failure warning
      }

      const result = startChunk(dimension, cell.timeline, cell.cx, cell.cz);
      if (result === "wait") {
        queued.add(cell.key);
        QUEUE.push(cell);
        continue;
      }
      GENERATED.add(cell.key);
    }
  }, 2);
}

function startBudgetProcessor() {
  system.runInterval(() => {
    if (jobs.length === 0) return;

    const byTimeline = playersByTimelineKey();
    for (const job of jobs) {
      const players = byTimeline[job.timeline.key];
      job.distance = players ? chebyshevDistance(job.cx, job.cz, players) : 999;
    }
    jobs.sort((a, b) => a.distance - b.distance);

    let budget = jobs[0].distance === 0 ? URGENT_BLOCK_BUDGET : BLOCK_BUDGET;
    while (budget > 0 && jobs.length) {
      const job = jobs[0];
      while (budget > 0 && job.ci < job.cols.length) {
        budget -= placeColumn(job, job.cols[job.ci]);
        job.ci++;
      }
      if (job.ci >= job.cols.length) {
        finishChunk(job);
        jobs.shift();
      } else {
        break; // this tick's budget is spent - resume this same job next tick
      }
    }
  }, 1);
}

const followedChunk = new Map(); // player.id -> { timelineKey, cx, cz }

function followingAreaId(playerId) {
  return `sp_follow_${String(playerId).replace(/[^0-9-]/g, "")}`;
}

function startFollowingTickingAreas() {
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      const timeline = getTimelineById(player.dimension.id);
      if (!timeline || timeline.isPresent) continue;

      const cx = Math.floor(player.location.x / CHUNK_SIZE);
      const cz = Math.floor(player.location.z / CHUNK_SIZE);
      const previous = followedChunk.get(player.id);
      if (
        previous &&
        previous.timelineKey === timeline.key &&
        Math.abs(cx - previous.cx) < 2 &&
        Math.abs(cz - previous.cz) < 2
      ) {
        continue; // hasn't moved far enough to need a new ticking area yet
      }
      followedChunk.set(player.id, { timelineKey: timeline.key, cx, cz });

      const areaId = followingAreaId(player.id);
      const radius = (VIEW_RADIUS_CHUNKS + 1) * CHUNK_SIZE;
      const px = player.location.x;
      const pz = player.location.z;

      (async () => {
        try {
          await world.tickingAreaManager.removeTickingArea(areaId);
        } catch {
          /* no previous area for this player - fine */
        }
        try {
          await world.tickingAreaManager.createTickingArea(areaId, {
            dimension: world.getDimension(timeline.id),
            from: { x: px - radius, y: TICKING_BOUNDS.minY, z: pz - radius },
            to: { x: px + radius, y: TICKING_BOUNDS.maxY, z: pz + radius },
          });
        } catch (error) {
          console.warn(`[TimeMachine] Could not create following ticking area: ${error}`);
        }
      })();
    }
  }, 30);
}

function isChunkReady(timelineKey, cx, cz) {
  if (!GENERATED.has(cellKey(timelineKey, cx, cz))) return false;
  for (const job of jobs) {
    if (job.timeline.key === timelineKey && job.cx === cx && job.cz === cz) return false;
  }
  return true;
}

function nothingSolidUnder(dimension, x, y, z) {
  for (let dy = 1; dy <= 3; dy++) {
    let block;
    try {
      block = dimension.getBlock({ x, y: y - dy, z });
    } catch {
      return true;
    }
    if (!block) return true;
    if (!block.isAir) return false;
  }
  return true;
}

function startFallThroughSafetyNet() {
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      const timeline = getTimelineById(player.dimension.id);
      if (!timeline || timeline.isPresent) continue;

      const loc = player.location;
      const fx = Math.floor(loc.x);
      const fy = Math.floor(loc.y);
      const fz = Math.floor(loc.z);
      const groundY = terrainHeight(fx, fz, { ...timeline.terrain, floorY: FLOOR_Y });

      if (loc.y >= groundY && loc.y >= FLOOR_Y) continue; // already above ground - nothing to do

      const cx = Math.floor(loc.x / CHUNK_SIZE);
      const cz = Math.floor(loc.z / CHUNK_SIZE);
      const safeAlready =
        loc.y >= FLOOR_Y && (isChunkReady(timeline.key, cx, cz) || !nothingSolidUnder(player.dimension, fx, fy, fz));
      if (safeAlready) continue;

      try {
        player.teleport({ x: loc.x, y: groundY + 3, z: loc.z });
        player.addEffect("resistance", 60, { amplifier: 255, showParticles: false });
      } catch {
        /* best-effort safety net - a failed teleport here isn't worth surfacing to the player */
      }
    }
  }, 1);
}

/** Call once, from main.js at world load. Starts every recurring loop the
 *  streamer needs. Safe to call exactly once per world session. */
export function initChunkStreamer() {
  startQueueScanner();
  startQueueDrainer();
  startBudgetProcessor();
  startFollowingTickingAreas();
  startFallThroughSafetyNet();
}

export { isChunkReady };
