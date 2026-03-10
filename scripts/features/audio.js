// @ts-check

import { debugLog } from "../utils/debug.js";
import { clamp } from "../utils/math.js";

/**
 * @typedef {Object} TimeMapPoint
 * @property {number} time
 * @property {number} x
 * @property {number} [y]
 */

/**
 * @typedef {Object} RenderQueueItem
 * @property {string} type
 * @property {string} [originalD]
 * @property {string} [text]
 * @property {number} absMinX
 * @property {number} absMaxX
 */

/**
 * @typedef {ReturnType<typeof import("../core/dom.js").getDomRefs>} DomRefs
 */

/**
 * @typedef {Object} AudioFeatureOptions
 * @property {HTMLAudioElement} audioPlayer
 * @property {DomRefs} dom
 * @property {() => number | null} getGlobalAudioOnsetSec
 * @property {() => number} getGlobalSystemInternalX
 * @property {() => TimeMapPoint[]} getMapData
 * @property {() => RenderQueueItem[]} getRenderQueue
 * @property {(signature: string) => boolean} identifyNotehead
 * @property {(timeSec: number) => void} seekToTime
 * @property {(offsetSec: number) => void} setAudioOffsetSec
 * @property {(file: File | null) => void} setGlobalAudioFile
 * @property {(onsetSec: number | null) => void} setGlobalAudioOnsetSec
 * @property {(loaded: boolean) => void} setIsAudioLoaded
 */

/**
 * @typedef {Object} AudioFeature
 * @property {(event: Event) => Promise<void>} handleAudioInputChange
 * @property {() => Promise<void>} tryAlignAudioAndScore
 */

/**
 * @param {AudioFeatureOptions} options
 * @returns {AudioFeature}
 */
export function createAudioFeature({
    audioPlayer,
    dom,
    getGlobalAudioOnsetSec,
    getGlobalSystemInternalX,
    getMapData,
    getRenderQueue,
    identifyNotehead,
    seekToTime,
    setAudioOffsetSec,
    setGlobalAudioFile,
    setGlobalAudioOnsetSec,
    setIsAudioLoaded,
}) {
    /** @returns {number} */
    function getFirstNoteTime() {
        const renderQueue = getRenderQueue();
        const mapData = getMapData();
        if (!renderQueue || renderQueue.length === 0) return 0;

        let firstNoteX = Infinity;

        for (let i = 0; i < renderQueue.length; i++) {
            const item = renderQueue[i];
            let sig = "";

            if (item.type === "path" && item.originalD) {
                sig = item.originalD.replace(/[^a-zA-Z]/g, "").toUpperCase();
            } else if (item.type === "text") {
                sig = (item.text || "").trim();
            }

            if (sig && identifyNotehead(sig)) {
                const centerX = item.absMinX + (item.absMaxX - item.absMinX) / 2;
                if (centerX > getGlobalSystemInternalX() && centerX < firstNoteX) {
                    firstNoteX = centerX;
                }
            }
        }

        if (firstNoteX === Infinity || !mapData || mapData.length < 2) return 0;

        for (let i = 0; i < mapData.length - 1; i++) {
            const p1 = mapData[i];
            const p2 = mapData[i + 1];
            if (firstNoteX >= p1.x && firstNoteX <= p2.x) {
                const progress = (firstNoteX - p1.x) / (p2.x - p1.x);
                const scoreStartTime = p1.time + progress * (p2.time - p1.time);
                debugLog(`🎼 [乐谱分析] 检测到首个音符位于: ${scoreStartTime.toFixed(3)}s`);
                return scoreStartTime;
            }
        }
        return 0;
    }

    /** @returns {Promise<void>} */
    async function tryAlignAudioAndScore() {
        const globalAudioOnsetSec = getGlobalAudioOnsetSec();
        const renderQueue = getRenderQueue();
        const mapData = getMapData();
        if (globalAudioOnsetSec === null || !renderQueue?.length || !mapData || mapData.length < 2) return;

        try {
            const firstNoteTime = getFirstNoteTime();
            let autoOffset = globalAudioOnsetSec - firstNoteTime;
            autoOffset = clamp(parseFloat(autoOffset.toFixed(2)), -5, 5);

            setAudioOffsetSec(autoOffset);
            if (dom.audioOffsetSlider) dom.audioOffsetSlider.value = String(autoOffset);
            if (dom.audioOffsetVal) {
                dom.audioOffsetVal.innerText = `${autoOffset > 0 ? "+" : ""}${autoOffset.toFixed(2)}`;
            }

            seekToTime(firstNoteTime);
            debugLog(`⏱️ [智能同步] 成功！乐谱首音：${firstNoteTime.toFixed(3)}s, 音频首音：${globalAudioOnsetSec.toFixed(3)}s, 偏移：${autoOffset}s`);
        } catch (error) {
            console.error("⚠️ 自动对齐失败:", error);
        }
    }

    /**
     * @param {File} file
     * @returns {Promise<number>}
     */
    async function detectFirstAudioOnset(file) {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) {
            throw new Error("AudioContext is not supported in this browser.");
        }

        const audioContext = new AudioContextCtor();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const frameSize = 1024;
        const threshold = 0.02;

        for (let i = 0; i < channelData.length; i += frameSize) {
            let sum = 0;
            for (let j = 0; j < frameSize && (i + j) < channelData.length; j++) {
                sum += channelData[i + j] * channelData[i + j];
            }
            const rms = Math.sqrt(sum / frameSize);

            if (rms > threshold) {
                const onsetTime = i / sampleRate;
                debugLog(`🔊 [音频分析] 检测到第一个有效波形: ${onsetTime.toFixed(3)}s`);
                return onsetTime;
            }
        }
        return 0;
    }

    /**
     * @param {Event} event
     * @returns {Promise<void>}
     */
    async function handleAudioInputChange(event) {
        const input = /** @type {HTMLInputElement | null} */ (event.currentTarget ?? event.target);
        const file = input?.files?.[0];
        if (!file) return;

        setGlobalAudioFile(file);

        const url = URL.createObjectURL(file);
        audioPlayer.src = url;
        audioPlayer.volume = 1;
        audioPlayer.load();
        setIsAudioLoaded(true);

        try {
            const onset = await detectFirstAudioOnset(file);
            setGlobalAudioOnsetSec(onset);
            debugLog(`🔊 [音频分析] 独立检测完成，起音: ${onset.toFixed(3)}s`);
            await tryAlignAudioAndScore();
        } catch (error) {
            console.error("⚠️ 音频起音检测失败:", error);
        }
    }

    return {
        handleAudioInputChange,
        tryAlignAudioAndScore,
    };
}
