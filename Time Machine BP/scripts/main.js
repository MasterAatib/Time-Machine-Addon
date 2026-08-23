// =============================================================================
// main.js  (behavior pack script entry point, see manifest.json)
//
// This file only ORCHESTRATES. Every actual system lives in its own module
// under scripts/ - if you're looking for what a specific piece does, this
// file just tells you where to find it:
//
//   dimensions/dimensionRegistrar.js   registers the 4 custom dimensions
//   commands/travelCommand.js          /sp:timemachine chat command - opens the menu
//   ui/destinationMenu.js              the ActionFormData picker
//   teleport/teleportManager.js        safe travel between dimensions
//   teleport/atmosphereManager.js      per-timeline fog + ambient particles
//   world_gen/chunkStreamer.js         the terrain engine (streams in as players explore)
//   world_gen/timelines/               per-timeline config: palette, noise, fog, trees
//
// There is no block in this add-on on purpose - the Time Machine menu opens
// via the /sp:timemachine command only.
// =============================================================================

import { system, world } from "@minecraft/server";
import { COLOR } from "./core/config.js";
import { registerAllTimelineDimensions } from "./dimensions/dimensionRegistrar.js";
import { registerTravelCommand } from "./commands/travelCommand.js";
import { initAtmosphereSystem } from "./teleport/atmosphereManager.js";
import { initChunkStreamer } from "./world_gen/chunkStreamer.js";
import { CUSTOM_TIMELINES } from "./world_gen/timelines/registry.js";

// Filled in during startup, read back once the world has loaded - see the
// two subscribers below for why this can't just be a local variable.
let dimensionRegistrationFailures = [];

// ---------------------------------------------------------------------------
// Startup: anything that registers a new kind of content (dimensions,
// commands) MUST happen in system.beforeEvents.startup. This runs in
// "early-execution mode" - no reading players/blocks/entities here, only
// registration calls. See each registrar file for details.
// ---------------------------------------------------------------------------
system.beforeEvents.startup.subscribe((startupEvent) => {
  dimensionRegistrationFailures = registerAllTimelineDimensions(startupEvent);
  registerTravelCommand(startupEvent);
});

// ---------------------------------------------------------------------------
// World load: safe to touch world state from here on. This is where every
// continuously-running system gets started - the chunk streamer (terrain
// generation) and the atmosphere loop (fog + ambient particles). Nothing
// is built eagerly here; the streamer only generates chunks once a player
// is actually standing in a custom timeline.
// ---------------------------------------------------------------------------
world.afterEvents.worldLoad.subscribe(() => {
  initChunkStreamer();
  initAtmosphereSystem();

  if (dimensionRegistrationFailures.length > 0) {
    // Loud and hard to miss on purpose: a failed registration here means
    // every timeline will silently fail to build later, which otherwise
    // looks like "nothing happens" with no obvious cause. This is almost
    // always the world's "Beta APIs" experiment not being turned on.
    world.sendMessage(
      `${COLOR.red}${COLOR.bold}[Time Machine] ${COLOR.reset}${COLOR.red}` +
        `${dimensionRegistrationFailures.length} of ${CUSTOM_TIMELINES.length} ` +
        `timeline dimension(s) failed to register.\n` +
        `${COLOR.yellow}Most likely fix: ${COLOR.white}enable "Beta APIs" under Settings > Experiments ` +
        `${COLOR.white}when creating/editing this world, then reload.`
    );
    console.warn(
      `[TimeMachine] Failed dimensions: ${dimensionRegistrationFailures.map((f) => f.timelineId).join(", ")}`
    );
  } else {
    world.sendMessage(
      `${COLOR.gray}[${COLOR.aqua}Time Machine${COLOR.gray}] ${COLOR.reset}` +
        `Systems online. Run ${COLOR.white}/sp:timemachine${COLOR.reset} to travel.`
    );
  }
});
