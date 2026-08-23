// =============================================================================
// teleport/teleportManager.js
//
// Everything about SAFELY getting a player from A to B lives here. This is
// the one function the UI (ui/destinationMenu.js) and the command
// (commands/travelCommand.js) call - travelToDestination() - and its
// signature hasn't changed even though how it works underneath has: it now
// hands off to world_gen/chunkStreamer.js instead of building a whole
// island upfront.
//
//   - entering a timeline: kick-starts the landing chunk immediately
//     (rather than waiting for the normal explore-driven queue), waits
//     briefly for it to finish, then teleports - with the streamer's
//     fall-through safety net as a backstop if it's not quite ready yet
//   - leaving a timeline back to Present: no world-gen needed, just
//     teleports back to wherever the player was standing when they left
// =============================================================================

import { world, system } from "@minecraft/server";
import { DYNAMIC_PROPERTY, PRESENT_DIMENSION_ID, TICKING_BOUNDS, CHUNK_SIZE, FLOOR_Y, COLOR } from "../core/config.js";
import { terrainHeight } from "../core/mathUtils.js";
import { startChunk, isChunkReady } from "../world_gen/chunkStreamer.js";

/**
 * Teleports a player to a destination timeline (or back to Present). This
 * is the single entry point every UI/command should call - don't call
 * `player.teleport()` directly for a timeline destination.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {import("../world_gen/timelines/registry.js").timeline} destination
 * @param {(message:string) => void} [onStatusMessage]
 */
export async function travelToDestination(player, destination, onStatusMessage) {
  if (player.dimension.id === destination.id) {
    player.sendMessage(`${COLOR.yellow}You're already there.`);
    return;
  }

  if (destination.isPresent) {
    await teleportToPresent(player, onStatusMessage);
    return;
  }

  // Remember where in the Overworld this player was standing, but only
  // when they're actually leaving the Overworld - stepping between two
  // custom timelines shouldn't overwrite an already-saved return spot.
  if (player.dimension.id === PRESENT_DIMENSION_ID) {
    rememberReturnLocation(player);
  }

  await enterTimeline(player, destination, onStatusMessage);
}

/**
 * Gets a player into a custom timeline: force-starts the landing chunk,
 * waits (briefly, with a hard cap) for it to be built, then teleports.
 */
async function enterTimeline(player, timeline, onStatusMessage) {
  const dimension = world.getDimension(timeline.id);
  const spawn = timeline.spawn;
  const groundY = terrainHeight(spawn.x, spawn.z, { ...timeline.terrain, floorY: FLOOR_Y });
  const landing = { x: spawn.x + 0.5, y: groundY + 3, z: spawn.z + 0.5 };

  if (onStatusMessage) onStatusMessage(`${COLOR.yellow}Stabilizing timeline...`);

  const tickingAreaId = `sp_arrival_${player.id}`;
  try {
    await world.tickingAreaManager.createTickingArea(tickingAreaId, {
      dimension,
      from: { x: spawn.x - 24, y: TICKING_BOUNDS.minY, z: spawn.z - 24 },
      to: { x: spawn.x + 24, y: TICKING_BOUNDS.maxY, z: spawn.z + 24 },
    });
  } catch (error) {
    // Not fatal - the streamer's own "following ticking area" loop will
    // pick this player up within ~1.5s of arrival either way (see
    // chunkStreamer.js), and the fall-through safety net covers the gap.
    console.warn(`[TimeMachine] Could not create arrival ticking area for ${timeline.id}: ${error}`);
  }

  const cx = Math.floor(spawn.x / CHUNK_SIZE);
  const cz = Math.floor(spawn.z / CHUNK_SIZE);
  startChunk(dimension, timeline, cx, cz); // "skip" here just means an earlier visit already built it

  await waitForChunkReady(timeline.key, cx, cz, 100 /* ticks (~5s) - a soft cap, not a hard requirement */);

  if (onStatusMessage) onStatusMessage(`${COLOR.green}Arriving...`);
  player.teleport(landing, { dimension });

  system.runTimeout(() => {
    try {
      world.tickingAreaManager.removeTickingArea(tickingAreaId);
    } catch {
      /* already gone or never created - fine either way */
    }
  }, 200);
}

/** Polls chunkStreamer's readiness check instead of blindly waiting a
 *  fixed delay - usually resolves in well under a second. If it hasn't
 *  resolved by maxTicks, this gives up and lets the caller proceed anyway;
 *  chunkStreamer's fall-through safety net is the backstop for that case. */
function waitForChunkReady(timelineKey, cx, cz, maxTicks) {
  return new Promise((resolve) => {
    let waited = 0;
    const check = () => {
      if (isChunkReady(timelineKey, cx, cz) || waited >= maxTicks) {
        resolve();
        return;
      }
      waited += 10;
      system.runTimeout(check, 10);
    };
    check();
  });
}

/** Reads back the player's saved Overworld position and sends them there,
 *  falling back to the world's default spawn if nothing was ever saved
 *  (e.g. an admin used a command to drop the player straight into a
 *  timeline without going through the Time Machine first). No world-gen
 *  needed here - the Overworld's terrain already exists. */
async function teleportToPresent(player, onStatusMessage) {
  const overworld = world.getDimension(PRESENT_DIMENSION_ID);
  const savedRaw = player.getDynamicProperty(DYNAMIC_PROPERTY.returnLocation);

  let target;
  if (typeof savedRaw === "string") {
    try {
      target = JSON.parse(savedRaw);
    } catch {
      target = undefined;
    }
  }
  if (!target) {
    target = world.getDefaultSpawnLocation();
  }

  if (onStatusMessage) onStatusMessage(`${COLOR.green}Returning...`);
  player.teleport(target, { dimension: overworld });
}

function rememberReturnLocation(player) {
  const { x, y, z } = player.location;
  player.setDynamicProperty(DYNAMIC_PROPERTY.returnLocation, JSON.stringify({ x, y, z }));
}
