// @ts-check

import { clamp } from "../utils/math.js";

/**
 * @typedef {Object} TimeMapPoint
 * @property {number} time
 * @property {number} x
 * @property {number} [y]
 */

/**
 * @typedef {Object} PlaybackState
 * @property {number} x
 * @property {number} vx
 */

/**
 * @typedef {Object} InterpolatedPosition
 * @property {number} x
 * @property {number} index
 * @property {boolean} atEnd
 */

/**
 * @typedef {Object} PlaybackHelpersOptions
 * @property {() => number} getCachedViewportWidth
 * @property {() => TimeMapPoint[]} getMapData
 * @property {() => number} getTotalDuration
 */

/**
 * @typedef {Object} PlaybackHelpers
 * @property {(state: PlaybackState | null | undefined, startTime: number, targetTime: number, maxStepSec?: number) => PlaybackState} advancePlaybackStateToTime
 * @property {(currentTime: number) => number} findCurrentIndexByTime
 * @property {(currentTime: number) => InterpolatedPosition} getInterpolatedXByTime
 * @property {(currentTime: number) => number} getSmoothedTargetVelocityByTime
 */

export const PLAYBACK_SIMULATION_STEP_SEC = 1 / 120;
const VELOCITY_SAMPLE_WINDOW_SEC = 0.4;
const MAX_TARGET_VELOCITY_PX_PER_SEC = 2500;
const PHASE_KP = 2.5;
const MAX_PHASE_CORRECTION_PX_PER_SEC = 1000;
const PHASE_CORRECTION_SOFT_DISTANCE_VIEWPORTS = 0.35;

/**
 * @param {PlaybackHelpersOptions} options
 * @returns {PlaybackHelpers}
 */
export function createPlaybackHelpers({
    getCachedViewportWidth,
    getMapData,
    getTotalDuration,
}) {
    /** @param {number} currentTime */
    function findCurrentIndexByTime(currentTime) {
        const mapData = getMapData();
        if (mapData.length < 2) return 0;
        if (currentTime <= mapData[0].time) return 0;
        if (currentTime >= mapData[mapData.length - 1].time) return mapData.length - 2;

        let left = 0;
        let right = mapData.length - 2;
        while (left <= right) {
            const mid = (left + right) >> 1;
            const t1 = mapData[mid].time;
            const t2 = mapData[mid + 1].time;

            if (currentTime < t1) {
                right = mid - 1;
            } else if (currentTime >= t2) {
                left = mid + 1;
            } else {
                return mid;
            }
        }
        return clamp(left, 0, mapData.length - 2);
    }

    /**
     * @param {number} currentTime
     * @returns {InterpolatedPosition}
     */
    function getInterpolatedXByTime(currentTime) {
        const mapData = getMapData();
        if (mapData.length < 2) return { x: 0, index: 0, atEnd: false };

        const total = getTotalDuration();
        if (currentTime >= total) {
            return { x: mapData[mapData.length - 1].x, index: mapData.length - 1, atEnd: true };
        }

        const currentIndex = findCurrentIndexByTime(currentTime);
        const p1 = mapData[currentIndex];
        const p2 = mapData[currentIndex + 1];
        const duration = Math.max(1e-6, p2.time - p1.time);
        const progress = clamp((currentTime - p1.time) / duration, 0, 1);
        const x = p1.x + (p2.x - p1.x) * progress;

        return { x, index: currentIndex, atEnd: false };
    }

    /** @param {number} currentTime */
    function getSmoothedTargetVelocityByTime(currentTime) {
        const mapData = getMapData();
        if (mapData.length < 2) return 0;

        const total = getTotalDuration();
        const half = VELOCITY_SAMPLE_WINDOW_SEC / 10;
        const t1 = Math.max(0, currentTime - half);
        const t2 = Math.min(total, currentTime + half);
        const span = Math.max(1e-4, t2 - t1);
        const x1 = getInterpolatedXByTime(t1).x;
        const x2 = getInterpolatedXByTime(t2).x;
        const velocity = (x2 - x1) / span;

        return clamp(velocity, -MAX_TARGET_VELOCITY_PX_PER_SEC, MAX_TARGET_VELOCITY_PX_PER_SEC);
    }

    /**
     * @param {number} positionErrorPx
     * @param {number} viewportWidthPx
     */
    function computePhaseCorrectionVelocity(positionErrorPx, viewportWidthPx) {
        const safeError = Number.isFinite(positionErrorPx) ? positionErrorPx : 0;
        const safeViewportWidth = Number.isFinite(viewportWidthPx) && viewportWidthPx > 0
            ? viewportWidthPx
            : Math.max(600, getCachedViewportWidth() || 0);
        const rawCorrection = safeError * PHASE_KP;
        const softDistancePx = Math.max(240, safeViewportWidth * PHASE_CORRECTION_SOFT_DISTANCE_VIEWPORTS);
        const softCorrectionLimit = Math.min(
            MAX_PHASE_CORRECTION_PX_PER_SEC * 0.7,
            softDistancePx * PHASE_KP
        );

        if (Math.abs(rawCorrection) <= softCorrectionLimit) {
            return rawCorrection;
        }

        const remainingCap = Math.max(1, MAX_PHASE_CORRECTION_PX_PER_SEC - softCorrectionLimit);
        const overflow = Math.abs(rawCorrection) - softCorrectionLimit;
        const dampedCorrection = softCorrectionLimit
            + remainingCap * (1 - Math.exp(-overflow / Math.max(1, softCorrectionLimit * 1.2)));
        return Math.sign(rawCorrection) * Math.min(MAX_PHASE_CORRECTION_PX_PER_SEC, dampedCorrection);
    }

    /**
     * @param {PlaybackState | null | undefined} state
     * @param {number} currentTime
     * @param {number} frameDelta
     */
    function stepPlaybackState(state, currentTime, frameDelta) {
        if (!state) return;
        const { x: targetX } = getInterpolatedXByTime(currentTime);
        const targetVx = getSmoothedTargetVelocityByTime(currentTime);
        const phaseCorrectionVx = computePhaseCorrectionVelocity(targetX - state.x, getCachedViewportWidth());
        const desiredVx = targetVx + phaseCorrectionVx;
        const smoothFactor = 12.0;
        state.vx += (desiredVx - state.vx) * smoothFactor * frameDelta;
        state.x += state.vx * frameDelta;
    }

    /**
     * @param {PlaybackState | null | undefined} state
     * @param {number} startTime
     * @param {number} targetTime
     * @param {number} [maxStepSec=PLAYBACK_SIMULATION_STEP_SEC]
     * @returns {PlaybackState}
     */
    function advancePlaybackStateToTime(state, startTime, targetTime, maxStepSec = PLAYBACK_SIMULATION_STEP_SEC) {
        const nextState = {
            x: state && Number.isFinite(state.x) ? state.x : 0,
            vx: state && Number.isFinite(state.vx) ? state.vx : 0,
        };
        let currentTime = Number.isFinite(startTime) ? startTime : 0;
        const safeTargetTime = Number.isFinite(targetTime) ? targetTime : currentTime;
        const safeMaxStepSec = Number.isFinite(maxStepSec) && maxStepSec > 0
            ? maxStepSec
            : PLAYBACK_SIMULATION_STEP_SEC;

        if (safeTargetTime <= currentTime) return nextState;

        while (currentTime + safeMaxStepSec < safeTargetTime) {
            currentTime += safeMaxStepSec;
            stepPlaybackState(nextState, currentTime, safeMaxStepSec);
        }

        const rest = safeTargetTime - currentTime;
        if (rest > 1e-8) {
            stepPlaybackState(nextState, safeTargetTime, rest);
        }

        return nextState;
    }

    return {
        advancePlaybackStateToTime,
        findCurrentIndexByTime,
        getInterpolatedXByTime,
        getSmoothedTargetVelocityByTime,
    };
}
