// =============================================================================
// commands/travelCommand.js
//
// A thin custom-command wrapper around the same menu the Time Machine
// block opens. Mainly here for testing/admin convenience (you don't need
// to have built the block yet to try out travel) - the block is still the
// intended "real" way players interact with this system.
// =============================================================================

import { system, Player, CustomCommandStatus, CommandPermissionLevel } from "@minecraft/server";
import { showDestinationMenu } from "../ui/destinationMenu.js";

const COMMAND_NAME = "sp:timemachine";

/**
 * @param {import("@minecraft/server").StartupEvent} startupEvent
 */
export function registerTravelCommand(startupEvent) {
  startupEvent.customCommandRegistry.registerCommand(
    {
      name: COMMAND_NAME,
      description: "Open the Time Machine destination menu.",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const player = origin.sourceEntity;
      if (!player || !(player instanceof Player)) {
        return {
          status: CustomCommandStatus.Failure,
          message: "This command can only be used by a player.",
        };
      }

      // Custom commands run in a restricted execution context - hop out to
      // a normal tick via system.run before touching UI/world state.
      system.run(() => showDestinationMenu(player));
      return { status: CustomCommandStatus.Success };
    }
  );
}
