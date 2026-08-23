// =============================================================================
// world_gen/timelines/registry.js
//
// The one file that knows about every timeline that exists. Add a new
// timeline by writing its config file the same way as the four below, then
// adding one import + one array entry here - nothing else in the codebase
// needs to change.
// =============================================================================

import { PRESENT_DIMENSION_ID, COLOR } from "../../core/config.js";
import { timeline as burningEarth } from "./burningEarth.js";
import { timeline as preJurassic } from "./preJurassic.js";
import { timeline as jurassic } from "./jurassic.js";
import { timeline as iceAge } from "./iceAge.js";

/** Every *custom* timeline, in the order they should appear in menus.
 *  The Overworld ("Present") is intentionally not in this list - it needs
 *  no registration, no terrain build, and no fog, so it's handled as a
 *  special case wherever that distinction matters (see PRESENT_ENTRY). */
export const CUSTOM_TIMELINES = [burningEarth, preJurassic, jurassic, iceAge];

/** A timeline-shaped entry for "Present (Overworld)", so UI code can treat
 *  all 5 destinations from the design doc uniformly. */
export const PRESENT_ENTRY = {
  id: PRESENT_DIMENSION_ID,
  key: "present",
  label: `${COLOR.white}Present ${COLOR.darkGray}(Overworld)`,
  menuDescription: "Return to the modern day.",
  spawn: null, // resolved at teleport time from the player's remembered return location
  fogId: null,
  ambience: null,
  isPresent: true,
};

/** All 5 destinations from the design doc, in menu order. */
export const ALL_DESTINATIONS = [PRESENT_ENTRY, ...CUSTOM_TIMELINES];

/** Looks up a timeline (custom or Present) by its dimension id. Returns
 *  undefined if nothing matches. */
export function getTimelineById(dimensionId) {
  return ALL_DESTINATIONS.find((t) => t.id === dimensionId);
}

/** Looks up a *custom* timeline by its short key (e.g. "ice_age"). Useful
 *  for command arguments and menu-index bookkeeping. */
export function getTimelineByKey(key) {
  return CUSTOM_TIMELINES.find((t) => t.key === key);
}
