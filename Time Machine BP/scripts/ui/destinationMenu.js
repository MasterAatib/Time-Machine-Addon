// =============================================================================
// ui/destinationMenu.js
//
// The player-facing menu. Deliberately thin - it only knows how to turn
// the timeline registry into buttons and hand the selection off to
// teleport/teleportManager.js. No teleport logic, no build logic, lives
// here.
// =============================================================================

import { ActionFormData } from "@minecraft/server-ui";
import { system } from "@minecraft/server";
import { COLOR } from "../core/config.js";
import { ALL_DESTINATIONS } from "../world_gen/timelines/registry.js";
import { travelToDestination } from "../teleport/teleportManager.js";

/**
 * Shows the destination picker to a player and, once they choose, kicks
 * off travel to that destination.
 *
 * @param {import("@minecraft/server").Player} player
 */
export function showDestinationMenu(player) {
  const form = new ActionFormData()
    .title(`${COLOR.bold}${COLOR.aqua}Time Machine`)
    .body(
      `${COLOR.gray}Currently in: ${COLOR.white}${describeCurrentDimension(player)}\n\n` +
        `${COLOR.reset}Choose a destination:`
    );

  for (const destination of ALL_DESTINATIONS) {
    form.button(destination.label);
  }

  form.show(player).then((response) => {
    if (response.canceled || response.selection === undefined) return;

    const destination = ALL_DESTINATIONS[response.selection];

    // Run on the next tick via system.run so this hand-off is never
    // executing inside the UI promise's own (read-only) callback context.
    system.run(() => {
      travelToDestination(player, destination, (statusMessage) => {
        player.onScreenDisplay.setActionBar(statusMessage);
      }).catch((error) => {
        console.warn(`[TimeMachine] Travel to ${destination.id} failed: ${error}`);
        player.sendMessage(`${COLOR.red}Something went wrong stabilizing that timeline. Try again in a moment.`);
      });
    });
  });
}

function describeCurrentDimension(player) {
  const id = player.dimension.id;
  if (id === "minecraft:overworld") return "Present";
  if (id === "minecraft:nether") return "The Nether";
  if (id === "minecraft:the_end") return "The End";
  return id;
}
