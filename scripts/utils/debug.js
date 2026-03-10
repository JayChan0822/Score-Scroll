// @ts-check

export const DEBUG_LOGS_ENABLED = false;

/**
 * @param {...unknown} args
 * @returns {void}
 */
export function debugLog(...args) {
    if (!DEBUG_LOGS_ENABLED) return;
    console.log(...args);
}
