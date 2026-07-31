import { Player } from '@minecraft/server';
import { TeleportManager } from '../teleport/teleportManager.js';

/**
 * TimeMachineController - handles the interaction between the player and the Time Machine block/UI.
 * You will implement the machine's mechanics (e.g., GUI, power requirements, animations) here.
 */
export class TimeMachineController {
    /**
     * @param {TeleportManager} teleportManager 
     */
    constructor(teleportManager) {
        this.teleportManager = teleportManager;
        // Store active destinations per player (if needed)
        this.playerSelections = new Map();
    }

    /**
     * Called when a player activates the Time Machine.
     * @param {Player} player - The player using the machine.
     * @param {string} destinationId - The chosen timeline identifier.
     */
    activateTimeMachine(player, destinationId) {
        // You might add: check power, play animation, apply cooldown, etc.
        // For now, directly teleport.
        this.teleportManager.teleportPlayerToDimension(player, destinationId);
    }

    /**
     * Set a player's selected destination (e.g., from a GUI).
     */
    setPlayerDestination(player, destinationId) {
        this.playerSelections.set(player.id, destinationId);
    }

    /**
     * Get the player's selected destination.
     */
    getPlayerDestination(player) {
        return this.playerSelections.get(player.id) || null;
    }
}