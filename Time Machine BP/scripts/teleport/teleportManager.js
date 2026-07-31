import { world, system, Player, DimensionLocation } from '@minecraft/server';
import { DimensionManager } from '../dimensions/dimensionManager.js';

/**
 * TeleportManager - responsible for moving players between dimensions.
 * Uses the DimensionManager to get dimension objects and finds safe coordinates.
 */
export class TeleportManager {
    /**
     * @param {DimensionManager} dimensionManager 
     */
    constructor(dimensionManager) {
        this.dimensionManager = dimensionManager;
        // Spawn positions per dimension (x, y, z). In a full implementation, these could be
        // read from a JSON config or dynamically generated.
        this.spawnPositions = new Map([
            ['sp:burning_earth', { x: 0, y: 70, z: 0 }],
            ['sp:pre_jurassic', { x: 0, y: 70, z: 0 }],
            ['sp:jurassic', { x: 0, y: 70, z: 0 }],
            ['sp:ice_age', { x: 0, y: 70, z: 0 }],
            ['minecraft:overworld', { x: 0, y: 70, z: 0 }]
        ]);
    }

    /**
     * Teleport a player to a specified dimension.
     * @param {Player} player - The player to teleport.
     * @param {string} dimensionId - The target dimension identifier.
     * @param {object} [targetLocation] - Optional {x, y, z} to override spawn.
     */
    teleportPlayerToDimension(player, dimensionId, targetLocation = null) {
        if (!this.dimensionManager.isValidDimension(dimensionId)) {
            player.sendMessage(`§cUnknown destination: ${dimensionId}`);
            return;
        }

        const dimension = this.dimensionManager.getDimension(dimensionId);
        const spawn = targetLocation || this.spawnPositions.get(dimensionId);

        // Ensure we have a safe location (check if block is air/breathable, else adjust)
        const safeLocation = this.findSafeLocation(dimension, spawn.x, spawn.y, spawn.z);
        if (!safeLocation) {
            player.sendMessage(`§cCould not find a safe location in ${dimensionId}.`);
            return;
        }

        // Teleport the player
        player.teleport(safeLocation, { dimension: dimension });

        // Optional: apply entry effects (e.g., play sound, give particles)
        this.applyEntryEffects(player, dimensionId);

        player.sendMessage(`§aTraveled to ${this.dimensionManager.dimensions.get(dimensionId)}!`);
    }

    /**
     * Find a safe standing location (solid block below, air above).
     * This is a simple implementation; can be expanded to search around the target.
     */
    findSafeLocation(dimension, x, y, z) {
        // Check if the block at (x, y, z) is air and the block below is solid.
        const blockBelow = dimension.getBlock({ x, y: y - 1, z });
        const blockAt = dimension.getBlock({ x, y, z });
        const blockAbove = dimension.getBlock({ x, y: y + 1, z });
        if (blockBelow && blockBelow.isSolid && blockAt && blockAt.isAir && blockAbove && blockAbove.isAir) {
            return { x, y, z };
        }
        // Otherwise, try to find a safe spot in a small radius.
        for (let dy = -5; dy <= 5; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
                for (let dz = -3; dz <= 3; dz++) {
                    const checkX = x + dx;
                    const checkY = y + dy;
                    const checkZ = z + dz;
                    const below = dimension.getBlock({ x: checkX, y: checkY - 1, z: checkZ });
                    const at = dimension.getBlock({ x: checkX, y: checkY, z: checkZ });
                    const above = dimension.getBlock({ x: checkX, y: checkY + 1, z: checkZ });
                    if (below && below.isSolid && at && at.isAir && above && above.isAir) {
                        return { x: checkX, y: checkY, z: checkZ };
                    }
                }
            }
        }
        return null; // No safe location found
    }

    /**
     * Apply visual/audio effects when entering a dimension.
     */
    applyEntryEffects(player, dimensionId) {
        // Example: play a sound and spawn particles
        player.playSound('random.teleport');
        // You can add dimension-specific effects here.
    }
}