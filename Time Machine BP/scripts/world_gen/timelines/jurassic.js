// =============================================================================
// world_gen/timelines/jurassic.js
//
// Timeline 3 - Jurassic (sp:jurassic)
// Lush, tropical, jungle-everywhere world. This is the timeline the design
// doc explicitly calls out for future dinosaur entities, so the
// `spawning` block here is a clearly-marked extension seam rather than a
// dead stub - read the comment on it before you add creatures.
// =============================================================================

import { NAMESPACE, COLOR } from "../../core/config.js";

export const timeline = {
  id: `${NAMESPACE}:jurassic`,
  key: "jurassic",
  label: `${COLOR.gold}Jurassic`,
  menuDescription: "A lush, tropical jungle world. Rivers, cliffs, and dense fern forest.",

  spawn: { x: 8, z: 8 },
  fogId: `${NAMESPACE}:jurassic_fog`,

  // sp:mist_particle is this addon's own particle (RP/particles/mist_particle.json).
  ambience: {
    particleId: "sp:mist_particle",
    spawnsPerTick: 1,
    verticalOffset: [0, 2],
    horizontalRadius: 9,
  },

  terrain: {
    seed: 30_003,
    baseY: 92,
    ampMin: 10,
    ampRange: 22, // dramatic elevation changes - reads as cliffs, not gentle hills
    fineDetail: 8,
    freqScale: 1.0,

    nearSurfaceDepth: 4,
    nearSurfaceBlocks: ["minecraft:grass_block", "minecraft:dirt"],
    deepBlocks: ["minecraft:stone", "minecraft:dirt"],

    // Anything below Y 84 floods with water - carves rivers/lakes through
    // the low ground without turning the whole timeline into one ocean
    // (baseY sits well above the flood level, so most terrain stays dry).
    flood: { level: 84, block: "minecraft:water" },

    // Dense, tall jungle canopy - taller and denser than Pre-Jurassic's
    // trees on purpose, to read as "huge trees" per the design doc.
    trees: {
      logBlock: "minecraft:jungle_log",
      leafBlock: "minecraft:jungle_leaves",
      cell: 5,
      minHeight: 7,
      maxHeight: 11,
      densityBase: 0.12,
      densityVar: 0.7,
    },
  },

  // ---------------------------------------------------------------------
  // MODULAR SPAWNING SYSTEM - intentionally left empty.
  //
  // Per the design doc, dinosaur entities will be added later and this
  // addon's job stops at "the timeline exists and has terrain". Do NOT add
  // spawn logic here directly. Instead:
  //
  //   1. Build your dinosaur entities as their own behavior-pack content
  //      (entity JSON + spawn_rules JSON), same as any vanilla mob.
  //   2. Target this timeline's dimension id (`sp:jurassic`) in your
  //      spawn_rules' `minecraft:spawns_on_surface` / biome filter, OR
  //   3. If you'd rather spawn them from script instead of spawn rules,
  //      call `dimension.spawnEntity(yourEntityId, location)` from your
  //      own system - `world.getDimension("sp:jurassic")` is all you need
  //      to reach this timeline from anywhere in your code.
  //
  // The `naturalEntities` array below is just documentation of intent; it
  // is never read by this addon's code.
  // ---------------------------------------------------------------------
  spawning: {
    naturalEntities: [], // e.g. later: ["sp:compsognathus", "sp:brachiosaurus", ...]
    vanillaPassiveMobsAllowed: false,
    notes: "Modular on purpose - dinosaur entities are a separate future project.",
  },
};
