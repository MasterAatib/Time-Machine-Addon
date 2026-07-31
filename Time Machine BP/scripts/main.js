import { world, system, Player } from '@minecraft/server';
import { DimensionManager } from './dimensions/dimensionManager.js';
import { TeleportManager } from './teleport/teleportManager.js';
import { TimeMachineController } from './timeMachine/timeMachineController.js';

// Initialise managers
const dimensionManager = new DimensionManager();
const teleportManager = new TeleportManager(dimensionManager);
const timeMachineController = new TimeMachineController(teleportManager);

// Example: Listen for a custom event triggered by the Time Machine block
world.afterEvents.itemUse.subscribe((event) => {
    // Placeholder: if the item is a 'Time Machine Controller' item, open UI
    // For now, we simulate a teleport command via chat for testing.
});

// Register a chat command for testing: /timemachine <destination>
world.beforeEvents.chatSend.subscribe((event) => {
    const message = event.message;
    if (message.startsWith('/timemachine ')) {
        event.cancel = true;
        const args = message.split(' ');
        if (args.length < 2) return;
        const destId = args[1];
        const player = event.sender;
        // Use TeleportManager to transport the player
        teleportManager.teleportPlayerToDimension(player, destId);
    }
});

system.runInterval(() => {
    // Optional: periodic tasks (e.g., apply environmental effects)
}, 20); // every second