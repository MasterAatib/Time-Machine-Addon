// =============================================================================
// core/config.js
//
// Single source of truth for every "tunable" in the addon. Nothing in here
// talks to the Minecraft API directly - it's just data, which keeps it safe
// to import from anywhere (including from timeline files, before startup
// has registered anything).
//
// ARCHITECTURE NOTE (v2): terrain generation now STREAMS in around the
// player as they explore, chunk by chunk, instead of building one fixed
// island upfront. This is the pattern proven out in a working reference
// add-on and adopted here wholesale - see world_gen/chunkStreamer.js for
// the engine itself. The constants below (CHUNK_SIZE, VIEW_RADIUS_CHUNKS,
// BLOCK_BUDGET, etc.) are the knobs for that system.
// =============================================================================

/** Namespace used for every identifier this addon creates (dimensions,
 *  commands, fog definitions, particles, dynamic properties). Keeping one
 *  constant means a future rename is a one-line change. */
export const NAMESPACE = "sp";

/** The vanilla dimension that represents "the present". Nothing needs to
 *  be registered for this - it's just the Overworld. */
export const PRESENT_DIMENSION_ID = "minecraft:overworld";

/** Minecraft chunks are always 16x16. Not really "tunable" - named here
 *  because every world-gen file needs it and a magic number everywhere is
 *  worse than one named constant. */
export const CHUNK_SIZE = 16;

/** How many chunks out from a player's current chunk get queued for
 *  generation. Higher = terrain feels more "already there" as you walk,
 *  but more chunks competing for the block budget below. 4 chunks (64
 *  blocks) is a comfortable render-ahead distance. */
export const VIEW_RADIUS_CHUNKS = 4;

/** The lowest Y any timeline generates at - one bedrock layer sits here so
 *  digging straight down always hits something solid instead of falling
 *  into the void. Kept well below normal build height on purpose. */
export const FLOOR_Y = 40;

/** Average/target terrain surface height. Individual timelines add their
 *  own noise amplitude on top of this, so actual height varies per
 *  timeline and per column - this is just the "sea level" baseline they
 *  all measure from. */
export const BASE_Y = 90;

/** Fixed vertical bounds used for every ticking area this addon creates.
 *  Deliberately NOT read from `dimension.heightRange` - that property is
 *  documented to sometimes throw, and doing so here would silently break
 *  every ticking area (and therefore every build) with no obvious cause.
 *  A fixed range is simpler and safer for a system that generates in a
 *  narrow, known band around BASE_Y anyway. */
export const TICKING_BOUNDS = { minY: FLOOR_Y - 4, maxY: 220 };

/** How many blocks the streamer is allowed to place per tick, normally.
 *  Kept modest so a timeline that's actively streaming doesn't visibly
 *  drop the server's tick rate. */
export const BLOCK_BUDGET = 1100;

/** How many blocks the streamer is allowed to place per tick when the
 *  nearest pending chunk is the one a player is standing in RIGHT NOW
 *  (distance 0). Much higher than the normal budget, because "the ground
 *  under a player's feet isn't there yet" is the one situation worth
 *  briefly spending more tick time to fix. */
export const URGENT_BLOCK_BUDGET = 6000;

/** How many chunk-builds are allowed to be in flight at once, across all
 *  players and timelines. Caps memory/complexity rather than speed - the
 *  budget above is what actually controls how fast blocks get placed. */
export const MAX_CONCURRENT_CHUNK_JOBS = 4;

/** Dynamic property keys. Centralised so a typo doesn't create two
 *  "different" keys by accident. */
export const DYNAMIC_PROPERTY = {
  /** Stored on `player`. Remembers where in the Overworld a player was
   *  standing before they stepped into the Time Machine, so "Return to
   *  Present" can bring them back to the same spot instead of world spawn. */
  returnLocation: `${NAMESPACE}:return_location`,
};

/** Chat colour codes, kept in one place so every UI-facing script agrees on
 *  a palette. See https://learn.microsoft.com/minecraft/creator for the
 *  full formatting-code reference. */
export const COLOR = {
  red: "\u00A7c",
  darkRed: "\u00A74",
  gold: "\u00A76",
  yellow: "\u00A7e",
  green: "\u00A7a",
  aqua: "\u00A7b",
  blue: "\u00A79",
  purple: "\u00A75",
  gray: "\u00A77",
  darkGray: "\u00A78",
  white: "\u00A7f",
  bold: "\u00A7l",
  italic: "\u00A7o",
  reset: "\u00A7r",
};
