// =============================================================================
// world_gen/timelines/preJurassic.js
//
// Timeline 2 - Pre-Jurassic (sp:pre_jurassic)
// Earth before dinosaurs: mossy, muddy, humid primitive forest floor. No
// flood - this timeline is meant to read as calm, dry, quiet ground rather
// than open water, so unlike Burning Earth/Jurassic/Ice Age it has no
// `flood` entry at all.
// =============================================================================

import { NAMESPACE, COLOR } from "../../core/config.js";

export const timeline = {
  id: `${NAMESPACE}:pre_jurassic`,
  key: "pre_jurassic",
  label: `${COLOR.green}Pre-Jurassic`,
  menuDescription: "Earth before the dinosaurs. Moss, mud, and quiet primitive forest.",

  spawn: { x: 8, z: 8 },
  fogId: `${NAMESPACE}:pre_jurassic_fog`,

  // sp:spore_particle is this addon's own particle (RP/particles/spore_particle.json).
  ambience: {
    particleId: "sp:spore_particle",
    spawnsPerTick: 1,
    verticalOffset: [1, 3],
    horizontalRadius: 8,
  },

  terrain: {
    seed: 20_002,
    baseY: 90,
    ampMin: 4,
    ampRange: 8,
    fineDetail: 4,
    freqScale: 0.8, // broader, smoother bumps - gentle rolling ground, not dramatic hills

    nearSurfaceDepth: 3,
    nearSurfaceBlocks: ["minecraft:moss_block", "minecraft:dirt", "minecraft:mud"],
    deepBlocks: ["minecraft:stone", "minecraft:dirt"],

    flood: null, // dry forest floor, no ocean/sea for this timeline

    // Small, sparse "primitive" trees (standing in for pre-Jurassic flora -
    // there's no real block palette for that, so this uses oak as the
    // nearest vanilla equivalent). Swap logBlock/leafBlock for something
    // else entirely if you want a more distinct look later.
    trees: {
      logBlock: "minecraft:oak_log",
      leafBlock: "minecraft:oak_leaves",
      cell: 7,
      minHeight: 4,
      maxHeight: 6,
      densityBase: 0.06,
      densityVar: 0.5,
    },
  },

  // Design doc: "Primitive amphibians only. Early insects (future
  // expansion). No dinosaurs." Left as a documented extension point only -
  // this addon does not spawn or define entities.
  spawning: {
    naturalEntities: [], // e.g. later: ["sp:primitive_amphibian"]
    vanillaPassiveMobsAllowed: false,
    notes: "Design intent: primitive amphibians now, insects later. No dinosaurs in this timeline.",
  },
};
