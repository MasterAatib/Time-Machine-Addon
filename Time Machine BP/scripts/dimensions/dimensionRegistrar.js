// =============================================================================
// dimensions/dimensionRegistrar.js
//
// Registers each timeline as a Custom Dimension. This has to happen inside
// `system.beforeEvents.startup` - the API throws if you try to register a
// dimension at any other point (see DimensionRegistry.registerCustomDimension
// in the Bedrock scripting docs). It also means this file has to be
// imported (and its `registerAllTimelineDimensions` called) BEFORE the
// startup event fires, which main.js takes care of.
//
// Every registered dimension is created with a void generator - see the
// big comment at the top of world_gen/chunkStreamer.js for what that
// means and why.
// =============================================================================

import { CUSTOM_TIMELINES } from "../world_gen/timelines/registry.js";

/**
 * @param {import("@minecraft/server").StartupEvent} startupEvent
 * @returns {{timelineId:string, error:unknown}[]} any dimensions that failed
 *   to register. Empty array = everything registered cleanly.
 */
export function registerAllTimelineDimensions(startupEvent) {
  const failures = [];

  for (const timeline of CUSTOM_TIMELINES) {
    try {
      startupEvent.dimensionRegistry.registerCustomDimension(timeline.id);
    } catch (error) {
      // CustomDimensionAlreadyRegisteredError fires on a hot-reload during
      // development, when the script re-runs `startup` but the dimension
      // is already known from the previous run - that specific case is
      // safe to ignore. Anything else usually means the Custom Dimension
      // API itself never became available (most commonly: the world's
      // "Beta APIs" experiment isn't turned on), so it's worth surfacing
      // loudly rather than just logging it.
      const message = String(error);
      if (!message.includes("AlreadyRegistered")) {
        failures.push({ timelineId: timeline.id, error });
      }
      console.warn(`[TimeMachine] Could not register dimension "${timeline.id}": ${error}`);
    }
  }

  return failures;
}
