// =============================================================================
// world_gen/blockUtils.js
//
// Tiny, dependency-free helpers around BlockPermutation.resolve() and
// Dimension.getBlock(). Every block placement in this add-on goes through
// here so a bad/unloaded coordinate is a silent no-op instead of an
// uncaught exception that could stall a chunk build mid-way.
// =============================================================================

import { BlockPermutation } from "@minecraft/server";

const permutationCache = new Map();

/** Resolves (and caches) a BlockPermutation for a block id. Returns null
 *  if the id doesn't exist rather than throwing, so a typo'd block id in a
 *  timeline config fails soft (that column just skips a layer) instead of
 *  crashing the whole chunk build. */
function resolvePermutation(blockId) {
  if (permutationCache.has(blockId)) return permutationCache.get(blockId);
  let permutation = null;
  try {
    permutation = BlockPermutation.resolve(blockId);
  } catch {
    /* unknown block id - cached as null below, so this only ever logs once */
    console.warn(`[TimeMachine] Unknown block id "${blockId}" - check your timeline config.`);
  }
  permutationCache.set(blockId, permutation);
  return permutation;
}

/** Sets a block at (x, y, z), silently doing nothing if the block id is
 *  invalid or the coordinate isn't currently loaded/gettable. */
export function setBlock(dimension, x, y, z, blockId) {
  const permutation = resolvePermutation(blockId);
  if (!permutation) return;
  try {
    const block = dimension.getBlock({ x, y, z });
    if (block) block.setPermutation(permutation);
  } catch {
    /* unloaded chunk mid-build - safe to skip, the chunk will be re-tried later */
  }
}

/** Same as setBlock, but only places if the target is currently air - used
 *  for leaves, so a tree scattered near another tree doesn't overwrite an
 *  already-placed trunk. */
export function setBlockIfAir(dimension, x, y, z, blockId) {
  try {
    const block = dimension.getBlock({ x, y, z });
    if (block && block.isAir) {
      const permutation = resolvePermutation(blockId);
      if (permutation) block.setPermutation(permutation);
    }
  } catch {
    /* unloaded chunk mid-build - safe to skip */
  }
}
