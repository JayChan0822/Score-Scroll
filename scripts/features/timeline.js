// @ts-check

import { debugLog } from "../utils/debug.js";

/**
 * @typedef {ReturnType<typeof import("../core/dom.js").getDomRefs>} DomRefs
 */

/**
 * @typedef {Object} SvgTag
 * @property {number} x
 * @property {number} tick
 * @property {number} [y]
 */

/**
 * @typedef {Object} TempoEvent
 * @property {number} ticks
 * @property {number} bpm
 * @property {number} time
 */

import { decodeTimeSignatureText } from "./time-signature-decoder.js";

/**
 * @typedef {Object} TimeSignaturePoint
 * @property {number} x
 * @property {number} num
 * @property {number} den
 */

/**
 * @typedef {Object} TimeMapPoint
 * @property {number} time
 * @property {number} x
 * @property {number} [y]
 */

/**
 * @typedef {Object} RenderQueueItem
 * @property {string} [symbolType]
 * @property {string} [type]
 * @property {number} absMinX
 * @property {number} centerY
 * @property {string} [text]
 * @property {string} [timeSigToken]
 */

/**
 * @typedef {Object} TimeSignatureGroup
 * @property {number} x
 * @property {RenderQueueItem[]} items
 */

/**
 * @typedef {Object} TimelineFeatureOptions
 * @property {DomRefs} dom
 * @property {(message: string) => void} alertMessage
 * @property {() => number} getCurrentBpm
 * @property {() => number} getGlobalMidiPpq
 * @property {() => TempoEvent[]} getGlobalMidiTempos
 * @property {() => boolean} getIsMidiLoaded
 * @property {() => SvgTag[]} getSvgTags
 * @property {() => number} getTotalDuration
 * @property {(mapData: TimeMapPoint[]) => void} setMapData
 * @property {(durationSec: number) => void} setMidiDurationSec
 * @property {(firstX: number) => void} resetPlaybackTimelineState
 * @property {() => void} setButtonTextByState
 * @property {() => void} syncTransforms
 * @property {(() => void | Promise<void>) | undefined} tryAlignAudioAndScore
 * @property {(currentTime?: number) => void} updateProgressUI
 */

/**
 * @typedef {Object} TimelineFeature
 * @property {(queue: RenderQueueItem[]) => TimeSignaturePoint[]} extractTimeSignatures
 * @property {(timeSigs: TimeSignaturePoint[]) => TimeSignaturePoint[]} ensureTimeSignatures
 * @property {() => void} recalculateMidiTempoMap
 * @property {() => void} generateManualTempoMap
 * @property {(tagTimes: number[]) => void} fuseDataWithTempoMap
 */

/**
 * @param {TimelineFeatureOptions} options
 * @returns {TimelineFeature}
 */
export function createTimelineFeature({
    dom,
    alertMessage,
    getCurrentBpm,
    getGlobalMidiPpq,
    getGlobalMidiTempos,
    getIsMidiLoaded,
    getSvgTags,
    getTotalDuration,
    setMapData,
    setMidiDurationSec,
    resetPlaybackTimelineState,
    setButtonTextByState,
    syncTransforms,
    tryAlignAudioAndScore,
    updateProgressUI,
}) {
    /**
     * @param {TimeSignaturePoint | null | undefined} timeSig
     * @returns {boolean}
     */
    function isValidTimeSignaturePoint(timeSig) {
        return Boolean(
            timeSig &&
            Number.isFinite(timeSig.x) &&
            Number.isFinite(timeSig.num) &&
            Number.isFinite(timeSig.den) &&
            timeSig.num > 0 &&
            timeSig.den > 0
        );
    }

    /**
     * @param {TimeSignaturePoint[]} timeSigs
     * @returns {TimeSignaturePoint[]}
     */
    function ensureTimeSignatures(timeSigs) {
        const validTimeSigs = (Array.isArray(timeSigs) ? timeSigs : []).filter(isValidTimeSignaturePoint);
        return validTimeSigs.length > 0 ? validTimeSigs : [{ x: -Infinity, num: 4, den: 4 }];
    }

    /**
     * @param {number[]} tagTimes
     * @param {SvgTag[]} svgTags
     * @returns {TimeMapPoint[]}
     */
    function buildMapData(tagTimes, svgTags) {
        const nextMapData = [];

        for (let i = 0; i < svgTags.length; i++) {
            nextMapData.push({
                time: tagTimes[i],
                x: svgTags[i].x,
                y: svgTags[i].y,
            });
        }

        return nextMapData;
    }

    /**
     * @param {TimeMapPoint[]} nextMapData
     * @returns {void}
     */
    function resetTimelinePlaybackState(nextMapData) {
        const firstX = nextMapData.length > 0 ? nextMapData[0].x : 0;
        resetPlaybackTimelineState(firstX);
    }

    /**
     * @param {RenderQueueItem[]} queue
     * @returns {TimeSignaturePoint[]}
     */
    function extractTimeSignatures(queue) {
        const tsItems = queue.filter((item) => item.symbolType === "TimeSig");
        /** @type {TimeSignatureGroup[]} */
        const groups = [];

        tsItems.forEach((item) => {
            let found = groups.find((group) => Math.abs(group.x - item.absMinX) < 30);
            if (!found) {
                found = { x: item.absMinX, items: [] };
                groups.push(found);
            }
            found.items.push(item);
        });

        /** @type {TimeSignaturePoint[]} */
        const timeSigs = [];

        groups.forEach((group) => {
            group.items.sort((a, b) => a.centerY - b.centerY);
            const tokens = group.items.map((item) => {
                if (typeof item.timeSigToken === "string" && item.timeSigToken.trim()) {
                    return item.timeSigToken.trim();
                }

                if (item.type === "text") {
                    return decodeTimeSignatureText((item.text || "").trim())?.token || "";
                }

                return "";
            }).filter(Boolean);
            if (tokens.length === 0) return;

            let num = 4;
            let den = 4;
            const joined = tokens.join("");

            const isCommonTime = joined === "COMMON" || tokens.includes("COMMON");
            const isCutTime = joined === "CUT" || tokens.includes("CUT");

            if (isCommonTime) {
                timeSigs.push({ x: group.x, num: 4, den: 4 });
                return;
            }
            if (isCutTime) {
                timeSigs.push({ x: group.x, num: 2, den: 2 });
                return;
            }

            /** @type {number[]} */
            const parsedNumbers = [];
            tokens.forEach((token) => {
                if (/^\d+$/.test(token)) {
                    parsedNumbers.push(parseInt(token, 10));
                }
            });

            if (parsedNumbers.length >= 2) {
                num = parsedNumbers[0];
                den = parsedNumbers[1];
            } else if (parsedNumbers.length === 1) {
                num = parsedNumbers[0];
                den = 4;
            } else {
                return;
            }

            if (num <= 0 || den <= 0) return;
            timeSigs.push({ x: group.x, num, den });
        });

        timeSigs.sort((a, b) => a.x - b.x);
        return timeSigs;
    }

    /** @returns {void} */
    function recalculateMidiTempoMap() {
        if (!getIsMidiLoaded()) return;

        const svgTags = getSvgTags();
        const globalMidiTempos = getGlobalMidiTempos();
        if (globalMidiTempos.length === 0) return;

        const globalMidiPpq = getGlobalMidiPpq();
        const tagTimes = [];

        for (let i = 0; i < svgTags.length; i++) {
            const targetTick = svgTags[i].tick;

            let activeTempo = globalMidiTempos[0];
            for (let j = globalMidiTempos.length - 1; j >= 0; j--) {
                if (targetTick >= globalMidiTempos[j].ticks) {
                    activeTempo = globalMidiTempos[j];
                    break;
                }
            }

            const ticksSinceTempo = targetTick - activeTempo.ticks;
            const beatsSinceTempo = ticksSinceTempo / globalMidiPpq;
            const secondsSinceTempo = beatsSinceTempo * (60 / activeTempo.bpm);
            const absoluteTime = activeTempo.time + secondsSinceTempo;

            tagTimes.push(absoluteTime);
        }

        fuseDataWithTempoMap(tagTimes);
    }

    /** @returns {void} */
    function generateManualTempoMap() {
        const svgTags = getSvgTags();
        if (svgTags.length === 0) return;

        const secondsPerQuarter = 60 / getCurrentBpm();
        const secondsPerTick = secondsPerQuarter / getGlobalMidiPpq();
        const tagTimes = svgTags.map((tag) => tag.tick * secondsPerTick);

        setMidiDurationSec(tagTimes[tagTimes.length - 1] || 0);
        fuseDataWithTempoMap(tagTimes);
    }

    /**
     * @param {number[]} tagTimes
     * @returns {void}
     */
    function fuseDataWithTempoMap(tagTimes) {
        const svgTags = getSvgTags();
        if (svgTags.length === 0) {
            alertMessage("未解析到乐谱坐标，请检查 SVG！");
            return;
        }

        const nextMapData = buildMapData(tagTimes, svgTags);
        setMapData(nextMapData);
        resetTimelinePlaybackState(nextMapData);
        syncTransforms();
        updateProgressUI(0);

        debugLog("✅ 全局变速曲线融合完毕！最终驱动数据：", nextMapData);

        if (dom.playBtn) {
            dom.playBtn.disabled = false;
        }
        setButtonTextByState();

        if (dom.exportEndInput) {
            dom.exportEndInput.value = getTotalDuration().toFixed(2);
        }

        if (typeof tryAlignAudioAndScore === "function") {
            void tryAlignAudioAndScore();
        }
    }

    return {
        ensureTimeSignatures,
        extractTimeSignatures,
        fuseDataWithTempoMap,
        generateManualTempoMap,
        recalculateMidiTempoMap,
    };
}
