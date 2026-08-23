// =============================================================================
// world_gen/timelines/iceAge.js
//
// Timeline 4 - Ice Age (sp:ice_age)
// Frozen Earth: snow, packed ice, blue ice, frozen rivers, ice mountains.
// =============================================================================

import { NAMESPACE, COLOR } from "../../core/config.js";

export const timeline = {
  id: `${NAMESPACE}:ice_age`,
  key: "ice_age",
  label: `${COLOR.aqua}Ice Age`,
  menuDescription: "Frozen Earth. Snowfall, ice mountains, and frozen rivers.",

  spawn: { x: 8, z: 8 },
  fogId: `${NAMESPACE}:ice_age_fog`,

  // sp:snowfall_particle is this addon's own particle (RP/particles/snowfall_particle.json).
  ambience: {
    particleId: "sp:snowfall_particle",
    spawnsPerTick: 1,
    verticalOffset: [4, 8],
    horizontalRadius: 10,
  },

  terrain: {
    seed: 40_004,
    baseY: 92,
    ampMin: 12,
    ampRange: 28,
    fineDetail: 10,
    freqScale: 1.3, // choppy, jagged slopes - "ice mountains" rather than smooth drifts

    nearSurfaceDepth: 4,
    // Repeating "snow" three times against one "packed_ice" is a cheap way
    // to weight the roll toward snow (~75%) while still letting bare ice
    // show through occasionally, without needing a separate weighting
    // system in the shared engine.
    nearSurfaceBlocks: ["minecraft:snow", "minecraft:snow", "minecraft:snow", "minecraft:packed_ice"],
    deepBlocks: ["minecraft:packed_ice", "minecraft:blue_ice", "minecraft:stone"],

    // Anything below Y 86 floods with blue ice - frozen rivers/lakes
    // cutting through the low ground.
    flood: { level: 86, block: "minecraft:blue_ice" },

    trees: null, // barren, frozen - nothing grows here
  },

  // Design doc: spawning framework only, real Ice Age animals added later.
  spawning: {
    naturalEntities: [], // e.g. later: ["sp:woolly_mammoth", "sp:saber_cat"]
    vanillaPassiveMobsAllowed: false,
    notes: "Framework only - Ice Age fauna is a separate future project.",
  },
};
