// =============================================================================
// world_gen/timelines/burningEarth.js
//
// Timeline 1 - Burning Earth (sp:burning_earth)
// A scorching, volcanic ancient world. The `flood` entry below is what
// creates the "lava oceans" from the design doc: any column whose noise
// height comes out below the flood level gets filled with lava instead of
// air, so low ground becomes lava sea and only the taller ridges stay dry
// - "very few safe areas", exactly as asked for, and it falls out of the
// height noise naturally rather than needing separately-placed lava lakes.
//
// This file is pure configuration - it describes WHAT the timeline looks
// like. world_gen/chunkStreamer.js is the shared engine that actually
// places the blocks; dimensions/dimensionRegistrar.js registers the
// dimension itself.
// =============================================================================

import { NAMESPACE, COLOR } from "../../core/config.js";

export const timeline = {
  id: `${NAMESPACE}:burning_earth`,
  key: "burning_earth",
  label: `${COLOR.darkRed}Burning Earth`,
  menuDescription: "A scorching volcanic world. Lava oceans, ash, and almost no safe ground.",

  // Landing spot, in the custom dimension's own coordinate space. Height
  // is resolved live from the noise formula at teleport time - see
  // teleport/teleportManager.js - so it's never a stale/guessed Y.
  spawn: { x: 8, z: 8 },

  // Resource-pack fog definition identifier, see RP/fogs/burning_earth.fog.json.
  fogId: `${NAMESPACE}:burning_earth_fog`,

  // Ambient particle loop config, consumed by teleport/atmosphereManager.js.
  // sp:ember_particle is this addon's own particle (RP/particles/ember_particle.json).
  ambience: {
    particleId: "sp:ember_particle",
    spawnsPerTick: 1,
    verticalOffset: [2, 5],
    horizontalRadius: 10,
  },

  terrain: {
    seed: 10_001,
    baseY: 92,
    ampMin: 14,
    ampRange: 30,
    fineDetail: 10,
    freqScale: 1.2, // choppier, smaller-scale bumps than the other timelines - reads as volcanic rubble, not rolling hills

    nearSurfaceDepth: 4,
    nearSurfaceBlocks: ["minecraft:basalt", "minecraft:blackstone"],
    deepBlocks: ["minecraft:blackstone", "minecraft:deepslate"],

    // Anything below Y 86 floods with lava. baseY sits at 92, so roughly
    // half of any given area ends up under lava, with basalt/blackstone
    // ridges breaking the surface - "lava oceans... very few safe areas".
    flood: { level: 86, block: "minecraft:lava" },

    trees: null, // nothing grows here
  },

  // ---------------------------------------------------------------------
  // Spawning: intentionally left as a documented extension point only.
  // Per the design doc, only Jinns should spawn naturally here, with no
  // vanilla passive mobs. This addon does not spawn or define any entities
  // - wire your own entity + spawn rule files to this dimension id
  // (`sp:burning_earth`) once they exist.
  // ---------------------------------------------------------------------
  spawning: {
    naturalEntities: [], // e.g. later: ["sp:jinn"]
    vanillaPassiveMobsAllowed: false,
  },
};
