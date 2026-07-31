import { world } from '@minecraft/server';

/**
 * DimensionManager - centralises dimension references and validation.
 * All custom dimensions are listed here; new timelines can be added easily.
 */
export class DimensionManager {
    constructor() {
        // Map of dimension identifiers to friendly names
        this.dimensions = new Map([
            ['sp:burning_earth', 'Burning Earth'],
            ['sp:pre_jurassic', 'Pre-Jurassic'],
            ['sp:jurassic', 'Jurassic'],
            ['sp:ice_age', 'Ice Age'],
            ['minecraft:overworld', 'Present (Overworld)']
        ]);
        // Cache dimension objects
        this.dimensionCache = new Map();
    }

    /**
     * Get a dimension object by its identifier.
     * @param {string} dimensionId - e.g., 'sp:burning_earth'
     * @returns {Dimension} - The dimension instance.
     */
    getDimension(dimensionId) {
        if (!this.dimensions.has(dimensionId)) {
            throw new Error(`Unknown dimension: ${dimensionId}`);
        }
        if (!this.dimensionCache.has(dimensionId)) {
            const dim = world.getDimension(dimensionId);
            this.dimensionCache.set(dimensionId, dim);
        }
        return this.dimensionCache.get(dimensionId);
    }

    /**
     * Check if a dimension ID is valid.
     */
    isValidDimension(dimensionId) {
        return this.dimensions.has(dimensionId);
    }

    /**
     * Get a list of all available dimension identifiers.
     */
    getAvailableDimensions() {
        return Array.from(this.dimensions.keys());
    }
}