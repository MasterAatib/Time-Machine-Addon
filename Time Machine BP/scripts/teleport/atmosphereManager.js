// =============================================================================
// teleport/atmosphereManager.js
//
// Custom Dimensions currently have no per-dimension sky-colour or weather
// control exposed to add-ons (see the note in world_gen/chunkStreamer.js
// for the equivalent world-gen limitation). What Bedrock DOES expose is
// the `/fog` push/pop system, which layers a camera-distance fog onto a
// specific player regardless of which dimension they're in - so that's
// what stands in for "atmosphere" here, backed by the fog definitions in
// RP/fogs/*.fog.json.
//
// Ambient particles (embers, spores, mist, snow) are the other half of
// "atmosphere" - a light interval loop spawns each timeline's particle
// near every player currently standing in it.
// =============================================================================

import { world, system } from "@minecraft/server";
import { getTimelineById } from "../world_gen/timelines/registry.js";

/** The identifier we push/pop fog under. Using our own constant string
 *  (rather than, say, the dimension id) means switching timelines cleanly
 *  replaces the previous fog instead of stacking multiple layers. */
const FOG_USER_ID = "sp_timeline_fog";

/** How often (in ticks) the ambience loop spawns particles. 4 ticks = 5
 *  times per second, which reads as continuous without spamming the
 *  particle system. */
const AMBIENCE_INTERVAL_TICKS = 4;

export function initAtmosphereSystem() {
  // Fog follows the player the moment they change dimension...
  world.afterEvents.playerDimensionChange.subscribe((event) => {
    applyFogForDimension(event.player, event.toDimension.id);
  });

  // ...and also gets (re)applied on spawn/respawn, which covers a player
  // reconnecting while already standing in a custom timeline.
  world.afterEvents.playerSpawn.subscribe((event) => {
    applyFogForDimension(event.player, event.player.dimension.id);
  });

  // Ambient particles: a light recurring sweep over online players.
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      const timeline = getTimelineById(player.dimension.id);
      if (timeline && timeline.ambience) {
        spawnAmbienceNear(player, timeline.ambience);
      }
    }
  }, AMBIENCE_INTERVAL_TICKS);
}

/** Clears any timeline fog the player currently has, then applies the
 *  destination timeline's fog (if it has one - the Overworld doesn't). */
function applyFogForDimension(player, dimensionId) {
  safeRunCommand(player, `fog @s remove ${FOG_USER_ID}`);

  const timeline = getTimelineById(dimensionId);
  if (timeline && timeline.fogId) {
    safeRunCommand(player, `fog @s push ${timeline.fogId} ${FOG_USER_ID}`);
  }
}

function spawnAmbienceNear(player, ambience) {
  const [minOffset, maxOffset] = ambience.verticalOffset;

  for (let i = 0; i < ambience.spawnsPerTick; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * ambience.horizontalRadius;
    const location = {
      x: player.location.x + Math.cos(angle) * distance,
      y: player.location.y + minOffset + Math.random() * (maxOffset - minOffset),
      z: player.location.z + Math.sin(angle) * distance,
    };

    try {
      player.dimension.spawnParticle(ambience.particleId, location);
    } catch {
      // A particle failing to spawn (e.g. the player's chunk unloaded
      // between the loop starting and this call) is purely cosmetic -
      // never worth interrupting the loop over.
    }
  }
}

function safeRunCommand(player, command) {
  try {
    player.runCommand(command);
  } catch {
    // Fog commands can fail harmlessly (e.g. mid-teleport); atmosphere is
    // cosmetic and should never surface an error to the player.
  }
}
