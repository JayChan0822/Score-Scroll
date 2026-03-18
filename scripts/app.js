import {
    PRIVATE_USE_GLYPH_REGEX,
    TIME_SIGNATURE_GLYPH_REGEX,
} from "./core/constants.js";
import { getDomRefs } from "./core/dom.js?v=20260313-preview-focus-mode-1";
import { createInitialState } from "./core/state.js?v=20260313-sticky-lock-light-export-1";
import { MusicFontRegistry } from "./data/music-font-registry.js";
import { createAudioFeature } from "./features/audio.js";
import { computeSharedExportDimensions, createExportVideoFeature } from "./features/export-video.js?v=20260313-equal-height-preview-1";
import { parseMidiData } from "./features/midi.js";
import {
    buildScoreAnalysisProfile,
    getScoreElementFontInfo,
    hasSemanticCandidates,
    isSibeliusSymbolFontFamily,
    SCORE_SOURCE_DORICO,
    SCORE_SOURCE_MUSESCORE,
    SCORE_SOURCE_SIBELIUS,
    SCORE_SOURCE_UNKNOWN,
} from "./features/score-analysis-profile.js";
import {
    createPlaybackHelpers,
    PLAYBACK_SIMULATION_STEP_SEC,
} from "./features/playback.js?v=20260311-playback-tail-2";
import {
    buildTrustedBarlineAnchors,
    classifyAccidentalGroups,
} from "./features/symbol-graph.mjs";
import { createSvgAnalysisFeature } from "./features/svg-analysis.js?v=20260317-natural-key-clear-1";
import {
    calculateStickySystemDelta,
    getStickyBlockDisplayWidth,
} from "./features/sticky-layout.mjs?v=20260317-natural-key-clear-1";
import {
    clearInjectedSvgLocalFontFaces,
    registerImportedSvgTextFonts,
} from "./features/svg-text-fonts.js";
import {
    decodeTimeSignaturePath,
    decodeTimeSignatureText,
    getInheritedSvgFontFamily,
    resolveMusicFontFamilyForPathSignature,
    simplifySvgPathSignature,
} from "./features/time-signature-decoder.js?v=20260317-glyph-font-fallback-1";
import { createTimelineFeature } from "./features/timeline.js";
import { bindUiEvents } from "./features/ui-events.js?v=20260313-sticky-lock-light-export-1";
import { debugLog } from "./utils/debug.js";
import { formatSeconds } from "./utils/format.js";
import { clamp } from "./utils/math.js";

const DESKTOP_LAYOUT_BREAKPOINT_PX = 900;
const PLAYBACK_TAIL_BUFFER_SEC = 2;
const PREVIEW_FOCUS_MODE_CLASS = "preview-focus-mode";
const DORICO_MID_CLEF_STICKY_SCALE = 1.5;
const MUSESCORE_MID_CLEF_STICKY_SCALE = 1.3;
const SIBELIUS_SOURCE_REGEX = /\b(?:Opus(?:\s+Special)?\s+Std|Opus\s+Text\s+Std|Helsinki|Inkpen2)\b/i;
const controlStackEl = document.querySelector(".control-stack");
const stageWrapEl = document.querySelector(".stage-wrap");
const workspaceScaleFrame = document.querySelector(".workspace-scale-frame");
const workspaceLayout = document.querySelector(".workspace-layout");

const initialState = createInitialState();

let {
    animationFrameId,
    audioOffsetSec,
    audioPlayer,
    audioWaiting,
    cachedViewportWidth,
    cancelVideoExport,
    currentBpm,
    defaultBgColor,
    defaultNoteColor,
    elapsedBeforePause,
    enableFlyin,
    globalAudioFile,
    globalAudioOnsetSec,
    globalMidiPpq,
    globalMidiTempos,
    globalScoreHeight,
    globalSystemBarlineScreenX,
    globalSystemInternalX,
    globalTimeSigs,
    globalZoom,
    isAudioLoaded,
    isExportingVideoMode,
    isFinished,
    isMidiLoaded,
    isPlaying,
    lastHighlightedIndex,
    lastRenderClock,
    lastUiUpdateTime,
    mapData,
    midiDurationSec,
    playbackSimTime,
    playlineRatio,
    renderQueue,
    scanGlowRange,
    showHighlights,
    showPlayline,
    showScanGlow,
    startTime,
    currentScoreSourceType,
    stickyLockRatio,
    stickyMinX,
    svgTags,
} = initialState;

const {
    audioInput,
    audioOffsetSlider,
    audioOffsetVal,
    bgColorPicker,
    bpmSlider,
    bpmVal,
    canvas: initialCanvas,
    cancelExportBtn,
    delaySlider,
    delayVal,
    distSlider,
    distVal,
    durationDisplay,
    exportFpsSelect,
    exportEndInput,
    exportModal,
    exportModalTitle,
    exportProgressBar,
    exportProgressText,
    exportPngBtn,
    exportRatioSelect,
    exportResSelect,
    exportStartInput,
    exportVideoBtn,
    glowRangeSlider,
    glowRangeVal,
    noteColorPicker,
    playBtn,
    playlineRatioSlider,
    playlineRatioVal,
    scoreSourceType,
    stickyLockRatioSlider,
    stickyLockRatioVal,
    progressSlider,
    sandbox,
    scatterSlider,
    scatterVal,
    tempoSourceHint,
    themeDarkBtn,
    themeLightBtn,
    timeDisplay,
    toggleCursorBtn,
    toggleFlyinBtn,
    toggleHighlightBtn,
    toggleScanGlowBtn,
    viewportEl,
    viewportFullscreenBtn,
    zoomInBtn,
    zoomOutBtn,
    zoomSliderContainer,
    zoomValDisplay,
} = getDomRefs(document);

let canvas = initialCanvas;
let ctx = canvas ? canvas.getContext("2d") : null;
const dom = {
    audioInput,
    audioOffsetSlider,
    audioOffsetVal,
    bgColorPicker,
    bpmSlider,
    bpmVal,
    cancelExportBtn,
    canvas,
    delaySlider,
    delayVal,
    distSlider,
    distVal,
    durationDisplay,
    exportFpsSelect,
    exportEndInput,
    exportModal,
    exportModalTitle,
    exportProgressBar,
    exportProgressText,
    exportPngBtn,
    exportRatioSelect,
    exportResSelect,
    exportStartInput,
    exportVideoBtn,
    glowRangeSlider,
    glowRangeVal,
    noteColorPicker,
    playBtn,
    playlineRatioSlider,
    playlineRatioVal,
    scoreSourceType,
    stickyLockRatioSlider,
    stickyLockRatioVal,
    progressSlider,
    sandbox,
    scatterSlider,
    scatterVal,
    tempoSourceHint,
    themeDarkBtn,
    themeLightBtn,
    timeDisplay,
    toggleCursorBtn,
    toggleFlyinBtn,
    toggleHighlightBtn,
    toggleScanGlowBtn,
    viewportEl,
    viewportFullscreenBtn,
    zoomInBtn,
    zoomOutBtn,
    zoomSliderContainer,
    zoomValDisplay,
};

const playbackHelpers = createPlaybackHelpers({
    getCachedViewportWidth: () => cachedViewportWidth,
    getMapData: () => mapData,
    getTotalDuration,
});

const {
    advancePlaybackStateToTime,
    findCurrentIndexByTime,
    getPlaybackGainByTime,
    getInterpolatedXByTime,
    getSmoothedTargetVelocityByTime,
} = playbackHelpers;

const audioFeature = createAudioFeature({
    audioPlayer,
    dom,
    getGlobalAudioOnsetSec: () => globalAudioOnsetSec,
    getGlobalSystemInternalX: () => globalSystemInternalX,
    getMapData: () => mapData,
    getRenderQueue: () => renderQueue,
    identifyNotehead,
    seekToTime,
    setAudioOffsetSec: (value) => {
        audioOffsetSec = value;
    },
    setGlobalAudioFile: (file) => {
        globalAudioFile = file;
    },
    setGlobalAudioOnsetSec: (value) => {
        globalAudioOnsetSec = value;
    },
    setIsAudioLoaded: (value) => {
        isAudioLoaded = value;
    },
});

const timelineFeature = createTimelineFeature({
    alertMessage: (message) => {
        alert(message);
    },
    dom,
    getCurrentBpm: () => currentBpm,
    getGlobalMidiPpq: () => globalMidiPpq,
    getGlobalMidiTempos: () => globalMidiTempos,
    getIsMidiLoaded: () => isMidiLoaded,
    getSvgTags: () => svgTags,
    getTotalDuration,
    resetPlaybackTimelineState: (firstX) => {
        isPlaying = false;
        cancelAnimationFrame(animationFrameId);
        elapsedBeforePause = 0;
        lastRenderClock = 0;
        isFinished = false;
        lastHighlightedIndex = -1;
        smoothX = firstX;
        smoothVx = 0;
        playbackSimTime = 0;
    },
    setButtonTextByState,
    setMapData: (value) => {
        mapData = value;
    },
    setMidiDurationSec: (value) => {
        midiDurationSec = value;
    },
    syncTransforms,
    tryAlignAudioAndScore: () => audioFeature.tryAlignAudioAndScore(),
    updateProgressUI,
});

const svgAnalysisFeature = createSvgAnalysisFeature({
    getFallbackSystemInternalX: () => globalSystemInternalX,
    getMathFlyinParams,
    identifyClefOrBrace,
    identifyAccidental,
});

const exportFeature = createExportVideoFeature({
    dom,
    getAudioOffsetSec: () => audioOffsetSec,
    getCachedViewportWidth: () => cachedViewportWidth,
    getCanvas: () => canvas,
    getCancelVideoExport: () => cancelVideoExport,
    getCtx: () => ctx,
    getGlobalAudioFile: () => globalAudioFile,
    getGlobalScoreHeight: () => globalScoreHeight,
    getGlobalZoom: () => globalZoom,
    getPlaybackGainByTime,
    getInterpolatedXByTime,
    getIsPlaying: () => isPlaying,
    getSmoothState: () => ({ playbackSimTime, smoothVx, smoothX }),
    getSmoothedTargetVelocityByTime,
    getTotalDuration,
    renderCanvas,
    resizeCanvas,
    setCachedViewportWidth: (value) => {
        cachedViewportWidth = value;
    },
    setCanvas: (value) => {
        canvas = value;
        dom.canvas = value;
    },
    setCancelVideoExport: (value) => {
        cancelVideoExport = value;
    },
    setCtx: (value) => {
        ctx = value;
    },
    setGlobalZoom: (value) => {
        globalZoom = value;
    },
    setIsExportingVideoMode: (value) => {
        isExportingVideoMode = value;
    },
    setSmoothState: ({ playbackSimTime: simTime, smoothVx: nextVx, smoothX: nextX }) => {
        playbackSimTime = simTime;
        smoothVx = nextVx;
        smoothX = nextX;
    },
});

function updateZoomUI() {
    zoomValDisplay.innerText = Math.round(globalZoom * 100) + '%';
    zoomSliderContainer.value = globalZoom;
}

function setGlobalZoom(val) {
    globalZoom = clamp(val, 0.2, 3);
    updateZoomUI();

    // 🌟 修复：必须调用 resizeCanvas！这样画布才会根据新的容器大小重新定中心点
    resizeCanvas();

    if (typeof renderCanvas === 'function') {
        renderCanvas(smoothX);
    }
}

function isPreviewFocusMode() {
    return document.body.classList.contains(PREVIEW_FOCUS_MODE_CLASS);
}

function syncPreviewFocusButtonState() {
    if (!viewportFullscreenBtn) return;

    const isFocusMode = isPreviewFocusMode();
    const nextLabel = isFocusMode ? "退出预览聚焦模式" : "进入预览聚焦模式";

    viewportFullscreenBtn.dataset.mode = isFocusMode ? "exit" : "enter";
    viewportFullscreenBtn.setAttribute("aria-label", nextLabel);
    viewportFullscreenBtn.setAttribute("aria-pressed", String(isFocusMode));
    viewportFullscreenBtn.title = nextLabel;
}

function schedulePreviewFocusLayoutSync() {
    syncViewportSizingMode();
    resizeCanvas();
    requestAnimationFrame(() => {
        syncViewportSizingMode();
        resizeCanvas();
    });
}

function togglePreviewFocusMode() {
    document.body.classList.toggle(PREVIEW_FOCUS_MODE_CLASS);
    syncPreviewFocusButtonState();
    schedulePreviewFocusLayoutSync();
}

function fitScoreToViewportHeight() {
    if (!viewportEl || !currentRawSvgContent || isExportingVideoMode) return;
    if (!Number.isFinite(globalScoreHeight) || globalScoreHeight <= 0) return;

    const viewportHeight = viewportEl.clientHeight;
    if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return;

    const fitZoom = viewportHeight / globalScoreHeight;
    globalZoom = clamp(fitZoom, 0.2, 3);
    updateZoomUI();
    resizeCanvas();

    if (typeof renderCanvas === 'function') {
        renderCanvas(smoothX);
    }
}

function syncViewportSizingMode(ratio = exportRatioSelect ? exportRatioSelect.value : "auto") {
    if (!viewportEl) return;

    viewportEl.style.width = "100%";
    viewportEl.style.maxHeight = "none";
    viewportEl.style.margin = "0 auto";

    if (isPreviewFocusMode()) {
        viewportEl.style.aspectRatio = "auto";
        viewportEl.style.height = "100%";
        viewportEl.style.maxWidth = "none";
        return;
    }

    if (window.innerWidth > DESKTOP_LAYOUT_BREAKPOINT_PX) {
        viewportEl.style.aspectRatio = "auto";
        viewportEl.style.height = "100%";
        return;
    }

    if (ratio === "auto") {
        viewportEl.style.aspectRatio = "auto";
        viewportEl.style.height = "clamp(400px, 60vh, 800px)";
        return;
    }

    const parts = ratio.split(":");
    const wRatio = parseInt(parts[0], 10);
    const hRatio = parseInt(parts[1], 10);

    viewportEl.style.aspectRatio = `${wRatio} / ${hRatio}`;
    viewportEl.style.height = "auto";
}

function getSelectedExportBaseResolution() {
    const parsed = parseInt(exportResSelect?.value || "1920", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1920;
}

function syncDesktopPreviewFrame() {
    if (window.innerWidth <= DESKTOP_LAYOUT_BREAKPOINT_PX) return false;
    if (!viewportEl || !currentRawSvgContent || isExportingVideoMode || !controlStackEl) return false;
    if (!Number.isFinite(globalScoreHeight) || globalScoreHeight <= 0) return false;

    const controlHeight = controlStackEl.offsetHeight || controlStackEl.getBoundingClientRect().height;
    if (!Number.isFinite(controlHeight) || controlHeight <= 0) return false;

    viewportEl.style.height = `${Math.round(controlHeight)}px`;

    const stageAvailableWidth =
        stageWrapEl?.clientWidth ||
        stageWrapEl?.getBoundingClientRect().width ||
        viewportEl.parentElement?.clientWidth ||
        viewportEl.getBoundingClientRect().width ||
        cachedViewportWidth ||
        0;
    if (!Number.isFinite(stageAvailableWidth) || stageAvailableWidth <= 0) return false;

    const selectedRatio = exportRatioSelect?.value || "auto";
    let desiredPreviewWidth = stageAvailableWidth;

    if (selectedRatio === "auto") {
        const dimensions = computeSharedExportDimensions({
            aspectRatio: selectedRatio,
            baseRes: getSelectedExportBaseResolution(),
            globalScoreHeight,
            globalZoom,
            viewportWidth: stageAvailableWidth,
        });
        if (Number.isFinite(dimensions.targetWidth) && Number.isFinite(dimensions.targetHeight) && dimensions.targetHeight > 0) {
            desiredPreviewWidth = Math.round(controlHeight * (dimensions.targetWidth / dimensions.targetHeight));
        }
    } else {
        const [wRatio, hRatio] = selectedRatio.split(":").map((value) => parseFloat(value));
        if (Number.isFinite(wRatio) && Number.isFinite(hRatio) && wRatio > 0 && hRatio > 0) {
            desiredPreviewWidth = Math.round(controlHeight * (wRatio / hRatio));
        }
    }

    let clampedPreviewWidth;
    if (selectedRatio === "auto") {
        // Auto 模式：依然受限于浏览器可用宽度，防止溢出
        clampedPreviewWidth = Math.max(320, Math.min(stageAvailableWidth, desiredPreviewWidth));
        viewportEl.style.maxWidth = "100%";
    } else {
        // 非 Auto 模式（如 16:9）：严格保持计算出的准确宽度，即使浏览器变窄也不再被挤压改变
        clampedPreviewWidth = Math.max(320, desiredPreviewWidth);
        viewportEl.style.maxWidth = "none";
    }

    viewportEl.style.width = `${clampedPreviewWidth}px`;
    viewportEl.style.margin = "0 auto";
    return true;
}

function syncMobileExportPreviewHeight() {
    if (window.innerWidth > DESKTOP_LAYOUT_BREAKPOINT_PX) return false;
    if (!viewportEl || !currentRawSvgContent || isExportingVideoMode) return false;
    if (!Number.isFinite(globalScoreHeight) || globalScoreHeight <= 0) return false;

    const viewportWidth = viewportEl.clientWidth || cachedViewportWidth || viewportEl.getBoundingClientRect().width || 1920;
    if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return false;

    const { targetHeight } = computeSharedExportDimensions({
        aspectRatio: exportRatioSelect?.value || "auto",
        baseRes: getSelectedExportBaseResolution(),
        globalScoreHeight,
        globalZoom,
        viewportWidth,
    });

    if (!Number.isFinite(targetHeight) || targetHeight <= 0) return false;

    viewportEl.style.height = `${targetHeight}px`;
    viewportEl.style.width = "100%";
    viewportEl.style.maxWidth = "100%";
    viewportEl.style.margin = "0 auto";
    return true;
}

function syncWorkspaceScaleFrameMetrics() {
    if (!workspaceScaleFrame || !workspaceLayout) return;

    if (isPreviewFocusMode()) {
        workspaceScaleFrame.style.height = "";
        return;
    }

    if (window.innerWidth <= DESKTOP_LAYOUT_BREAKPOINT_PX) {
        workspaceScaleFrame.style.height = "";
        return;
    }

    const scaleValue = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--workspace-scale")) || 1;
    workspaceScaleFrame.style.height = `${workspaceLayout.offsetHeight * scaleValue}px`;
}

zoomSliderContainer.addEventListener('input', (e) => {
    setGlobalZoom(parseFloat(e.target.value));
});

zoomOutBtn.addEventListener('click', () => {
    setGlobalZoom(globalZoom - 0.1);
});

zoomInBtn.addEventListener('click', () => {
    setGlobalZoom(globalZoom + 0.1);
});

if (viewportFullscreenBtn) {
    syncPreviewFocusButtonState();
    viewportFullscreenBtn.addEventListener("click", () => {
        togglePreviewFocusMode();
    });
}

// 🌟 音乐字体特征注册表 (Music Font Registry)
let activeSignatureMap = { clefs: {}, accidentals: {}, noteheads: {} };
let allKnownClefMap = {};
let allKnownAccidentalMap = {};
let allKnownNoteheadMap = {};
let currentRawSvgContent = null; // 用于切换字体时热重载 SVG
let svgProcessingGeneration = 0;
let currentMappedSvgRoot = null;
let currentSvgIsMuseScore = false;
let currentAnalysisProfile = buildScoreAnalysisProfile({
    sourceType: SCORE_SOURCE_UNKNOWN,
    selectedMusicFont: document.getElementById('musicFontSelect')?.value || 'Bravura',
    svgRoot: null,
});
let stickyTransitionFrameId = 0;
let stickyTransitionRenderX = 0;

function syncScoreSourceTypeUi({ showPlaceholder = false } = {}) {
    const displayText = showPlaceholder ? "-" : currentScoreSourceType;
    if (scoreSourceType) {
        scoreSourceType.textContent = displayText;
    }
    if (document.body) {
        document.body.dataset.scoreSourceType = showPlaceholder ? "" : currentScoreSourceType;
    }
}

function resetScoreSourceTypeUi() {
    currentScoreSourceType = SCORE_SOURCE_UNKNOWN;
    currentSvgIsMuseScore = false;
    currentAnalysisProfile = buildScoreAnalysisProfile({
        sourceType: SCORE_SOURCE_UNKNOWN,
        selectedMusicFont: document.getElementById('musicFontSelect')?.value || 'Bravura',
        svgRoot: null,
    });
    syncScoreSourceTypeUi({ showPlaceholder: true });
}

function cancelStickyTransitionFrame() {
    if (!stickyTransitionFrameId) return;
    cancelAnimationFrame(stickyTransitionFrameId);
    stickyTransitionFrameId = 0;
}

function scheduleStickyTransitionFrame(currentX) {
    stickyTransitionRenderX = currentX;
    if (stickyTransitionFrameId || isPlaying || isExportingVideoMode) return;

    stickyTransitionFrameId = requestAnimationFrame(() => {
        stickyTransitionFrameId = 0;
        if (isPlaying || isExportingVideoMode || typeof renderCanvas !== 'function') return;
        renderCanvas(stickyTransitionRenderX);
    });
}

function compileKnownClefSignatures() {
    allKnownClefMap = {};
    Object.values(MusicFontRegistry).forEach((fontData) => {
        if (!fontData?.clefs) return;
        for (const [symbolName, signatures] of Object.entries(fontData.clefs)) {
            signatures.forEach(sig => {
                if (!(sig in allKnownClefMap)) {
                    allKnownClefMap[sig] = symbolName;
                }
            });
        }
    });
}

function compileKnownAccidentalSignatures() {
    allKnownAccidentalMap = {};
    Object.values(MusicFontRegistry).forEach((fontData) => {
        if (!fontData?.accidentals) return;
        for (const [symbolName, signatures] of Object.entries(fontData.accidentals)) {
            signatures.forEach(sig => {
                if (!(sig in allKnownAccidentalMap)) {
                    allKnownAccidentalMap[sig] = symbolName;
                }
            });
        }
    });
}

function compileKnownNoteheadSignatures() {
    allKnownNoteheadMap = {};
    Object.values(MusicFontRegistry).forEach((fontData) => {
        if (!fontData?.noteheads) return;
        for (const [symbolName, signatures] of Object.entries(fontData.noteheads)) {
            signatures.forEach(sig => {
                if (!(sig in allKnownNoteheadMap)) {
                    allKnownNoteheadMap[sig] = symbolName;
                }
            });
        }
    });
}

// 🌟 初始化并编译特征库为 O(1) 查找表
function compileFontSignatures(fontName) {
    const fontData = MusicFontRegistry[fontName] || MusicFontRegistry['Bravura'];
    activeSignatureMap = { clefs: {}, accidentals: {}, noteheads: {} };

    // 遍历三大类别，构建 { "特征字符串": "符号名称" } 的扁平字典
    ['clefs', 'accidentals', 'noteheads'].forEach(category => {
        if (!fontData[category]) return;
        for (const [symbolName, signatures] of Object.entries(fontData[category])) {
            signatures.forEach(sig => {
                activeSignatureMap[category][sig] = symbolName;
            });
        }
    });
    debugLog(`🔤 音乐字体引擎已切换至: [${fontName}]，特征字典已编译！`);
}

// 默认加载 Default 字典
compileKnownClefSignatures();
compileKnownAccidentalSignatures();
compileKnownNoteheadSignatures();
compileFontSignatures('Bravura');

// 🌟 辅助：生成基于 UI 滑块的随机飞入参数
function getMathFlyinParams() {
    const distPercent = parseInt(document.getElementById('distSlider').value, 10);
    const scatterPercent = parseInt(document.getElementById('scatterSlider').value, 10);
    const delayPercent = parseInt(document.getElementById('delaySlider').value, 10);

    // 将 0-100% 映射回真实的物理阈值
    const maxDist = distPercent * 8;      // 100% = 800px
    const maxScatter = scatterPercent * 4; // 100% = 400px
    const maxDelay = delayPercent * 15;    // 100% = 1500ms

    return {
        randX: (Math.random() * maxDist + 50),
        randY: (Math.random() * maxScatter - maxScatter / 2),
        delayDist: Math.random() * (maxDelay * 0.4)
    };
}

let globalStickyLanes = {};
let globalStickySharedGroups = {};

// 🌟 全局缓存：用于存储原生的五线谱绝对位置，以便在遮罩层重新绘制桥梁
window.globalAbsoluteStaffLineYs = [];
window.globalAbsoluteBridgeLineYs = [];
window.globalAbsoluteBridgeStartX = Infinity;
window.globalAbsoluteSystemInternalX = Infinity;
window.hasPhysicalStartBarline = false;

function renderCanvas(currentX, options = {}) {
    if (!ctx || !canvas) return;
    if (isPlaying || isExportingVideoMode) cancelStickyTransitionFrame();
    if (typeof window.__lastRenderX === 'undefined') window.__lastRenderX = currentX;
    const isXJump = Math.abs(currentX - window.__lastRenderX) > 200;
    window.__lastRenderX = currentX;
    const { transparentBackground = false } = options;

    const noteColor = noteColorPicker ? noteColorPicker.value : defaultNoteColor;
    const solidBgColor = bgColorPicker ? bgColorPicker.value : defaultBgColor;
    const bgColor = transparentBackground ? 'rgba(0, 0, 0, 0)' : solidBgColor;
    const activeMidClefStickyScale = currentSvgIsMuseScore ? MUSESCORE_MID_CLEF_STICKY_SCALE : DORICO_MID_CLEF_STICKY_SCALE;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparentBackground) {
        ctx.fillStyle = solidBgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 🌟 1. 核心数学重构：动态计算播放线在屏幕上的 X 像素坐标
    const playlineScreenX = cachedViewportWidth * playlineRatio;
    const stickyLockScreenX = cachedViewportWidth * stickyLockRatio;
    // 计算播放线左右两侧的物理世界距离
    const worldDistanceLeft = playlineScreenX / globalZoom;
    const worldDistanceRight = (cachedViewportWidth - playlineScreenX) / globalZoom;
    const stickyLockOffset = stickyLockScreenX / globalZoom;

    const logicalHeight = isExportingVideoMode ? canvas.height : viewportEl.clientHeight;
    const centerY = logicalHeight / 2;
    const scoreCenterY = window.globalScoreTrueCenterY || (globalScoreHeight / 2);

    // 可视范围边界重构
    const leftEdge = currentX - worldDistanceLeft - (100 / globalZoom);
    const rightEdge = currentX + worldDistanceRight + (100 / globalZoom);

    // 🌟 吸附锚点：独立控制“距离左侧多远开始吸顶”
    const maxStickySmoothX_initial = worldDistanceLeft + stickyMinX - stickyLockOffset;

    const activeIdx = {}; const activeWidth = {}; const laneOffsets = {};
    const sharedActiveIdx = {};

    const systemBaseWidths = { clef: 0, key: 0 };
    for (const laneId in globalStickyLanes) {
        const bw = globalStickyLanes[laneId].baseWidths;
        if (bw && bw.clef > systemBaseWidths.clef) systemBaseWidths.clef = bw.clef;
        if (bw && bw.key > systemBaseWidths.key) systemBaseWidths.key = bw.key;
    }

    const systemActiveWidths = { clef: 0, key: 0 };

    let maxStickyRightScreenX = 0; let shouldShowMask = false;

    for (const groupId in globalStickySharedGroups) {
        sharedActiveIdx[groupId] = -1;
        const blocks = globalStickySharedGroups[groupId]?.blocks || [];
        for (let index = 0; index < blocks.length; index++) {
            const block = blocks[index];
            const lockDistance = Number.isFinite(block?.lockDistance) ? block.lockDistance : 0;
            const layerMaxX = maxStickySmoothX_initial + lockDistance;
            if (currentX >= layerMaxX) {
                sharedActiveIdx[groupId] = index;
            }
        }
    }

    for (const laneId in globalStickyLanes) {
        activeIdx[laneId] = { inst: -1, reh: -1, clef: -1, key: -1, time: -1, bar: -1, brace: -1 };
        activeWidth[laneId] = { inst: 0, reh: 0, clef: 0, key: 0, time: 0, bar: 0, brace: 0 };
        laneOffsets[laneId] = { clef: 0, key: 0 };
        const { typeBlocks, baseWidths } = globalStickyLanes[laneId];

        ['inst', 'reh', 'clef', 'key', 'time', 'bar', 'brace'].forEach(type => {
            if (!typeBlocks[type]) return;
            typeBlocks[type].forEach((block, index) => {
                const blockDisplayWidth = Number.isFinite(block.stickyWidth)
                    ? block.stickyWidth
                    : getStickyBlockDisplayWidth({
                        type,
                        blockWidth: block.width,
                        clearsKeySignature: block.clearsKeySignature === true,
                    });
                const lockDistance = Number.isFinite(block.lockDistance)
                    ? block.lockDistance
                    : Math.max(0, block.minX - typeBlocks[type][0].minX);
                const layerMaxX = maxStickySmoothX_initial + lockDistance;
                if (currentX >= layerMaxX) {
                    if (index > activeIdx[laneId][type]) {
                        activeIdx[laneId][type] = index;
                        activeWidth[laneId][type] = (type === 'clef' && index > 0)
                            ? blockDisplayWidth * activeMidClefStickyScale
                            : blockDisplayWidth;
                    }
                }
            });
        });

        ['clef', 'key'].forEach(type => {
            const currentW = activeIdx[laneId][type] >= 0 ? activeWidth[laneId][type] : (baseWidths[type] || 0);
            if (currentW > systemActiveWidths[type]) systemActiveWidths[type] = currentW;
        });
    }

    const calcSystemDelta = (type) => {
        const b = systemBaseWidths[type] || 0;
        const currentW = systemActiveWidths[type] || 0;
        return calculateStickySystemDelta({
            type,
            baseWidth: b,
            currentWidth: currentW,
        });
    };

    const sysDeltaClef = calcSystemDelta('clef');
    const sysDeltaKey = calcSystemDelta('key');

    for (const laneId in globalStickyLanes) {
        laneOffsets[laneId].clef = sysDeltaClef;
        laneOffsets[laneId].key = sysDeltaKey;
    }

    const normalDrawList = []; const stickyDrawList = [];
    let stickyNeedsFollowupFrame = false;

    for (let i = 0; i < renderQueue.length; i++) {
        const item = renderQueue[i];
        let isPinned = false; let pinShiftX = 0; let targetOpacity = 1; let targetExtraX = 0; let targetScale = 1;

        if (item.isSticky) {
            const sharedStickyGroupId = item.sharedStickyGroupId || null;
            const itemLockDistance = sharedStickyGroupId && Number.isFinite(item.sharedLockDistance)
                ? item.sharedLockDistance
                : item.lockDistance;
            const itemBlockIndex = sharedStickyGroupId && Number.isFinite(item.sharedBlockIndex)
                ? item.sharedBlockIndex
                : item.blockIndex;
            const layerMaxX = maxStickySmoothX_initial + itemLockDistance;
            const currentActive = sharedStickyGroupId
                ? (sharedActiveIdx[sharedStickyGroupId] ?? -1)
                : activeIdx[item.laneId][item.stickyType];
            if (itemBlockIndex < currentActive) targetOpacity = 0;
            if (item.stickyType === 'key') targetExtraX = laneOffsets[item.laneId].clef;
            else if (item.stickyType === 'time') targetExtraX = laneOffsets[item.laneId].clef + laneOffsets[item.laneId].key;

            if (currentX >= layerMaxX) { isPinned = true; pinShiftX = currentX - layerMaxX; if (item.isMidClef) targetScale = activeMidClefStickyScale; }
            if (itemBlockIndex === currentActive) {
                if (layerMaxX - currentX < 300) shouldShowMask = true;
                const worldRightX = item.absMaxX + pinShiftX + targetExtraX + (item.absMaxX - item.blockMinX) * (targetScale - 1);
                const screenRightX = (worldRightX - currentX) * globalZoom + playlineScreenX;
                if (screenRightX > maxStickyRightScreenX) maxStickyRightScreenX = screenRightX;
            }
        }

        if (item.currentOpacity === undefined) item.currentOpacity = targetOpacity;
        if (item.currentExtraX === undefined) item.currentExtraX = targetExtraX;
        if (item.currentScale === undefined) item.currentScale = targetScale;

        const stickyTransitionPending = item.isSticky && (
            Math.abs(item.currentOpacity - targetOpacity) > 0.001
            || Math.abs(item.currentExtraX - targetExtraX) > 0.01
            || Math.abs(item.currentScale - targetScale) > 0.001
        );
        const shouldAnimateStickyTransition = item.isSticky && (
            isPlaying
            || isExportingVideoMode
            || stickyTransitionPending
        );

        if (isXJump) {
            item.currentOpacity = targetOpacity;
            item.currentExtraX = targetExtraX;
            item.currentScale = targetScale;
        } else if (shouldAnimateStickyTransition) {
            item.currentOpacity += (targetOpacity - item.currentOpacity) * 0.15;
            item.currentExtraX += (targetExtraX - item.currentExtraX) * 0.20;
            item.currentScale += (targetScale - item.currentScale) * 0.15;
        } else {
            item.currentOpacity = targetOpacity;
            item.currentExtraX = targetExtraX;
            item.currentScale = targetScale;
        }

        if (
            item.isSticky
            && !isPlaying
            && !isExportingVideoMode
            && (
                Math.abs(item.currentOpacity - targetOpacity) > 0.01
                || Math.abs(item.currentExtraX - targetExtraX) > 0.05
                || Math.abs(item.currentScale - targetScale) > 0.01
            )
        ) {
            stickyNeedsFollowupFrame = true;
        }

        if (item.currentOpacity <= 0.01 && targetOpacity === 0) continue;
        if (!isPinned && (item.absMaxX < leftEdge || item.absMinX > rightEdge)) continue;

        const isPureBg = item.fillRole === 'bg' && (item.strokeRole === 'none' || item.strokeRole === 'bg');
        let drawColor = isPureBg ? bgColor : noteColor;

        if (showHighlights && item.symbolType) {
            if (['Clef', 'Brace', 'TimeSig', 'KeySig', 'Barline', 'InstName', 'RehearsalMark', 'TrueBarline'].includes(item.symbolType)) {
                drawColor = '#ff2a5f';
            }
        }

        let alpha = 1; let flyOffsetX = 0; let flyOffsetY = 0;
        if (enableFlyin && !isPinned && !isPureBg && item.absMaxX > currentX) {
            // 🌟 飞入边缘重构：从右侧可视区域外飞入
            const revealEdge = currentX + worldDistanceRight - (50 / globalZoom);
            if (item.absMinX > revealEdge - 400) {
                const distanceInside = revealEdge - item.absMinX - (item.delayDist || 0);
                if (distanceInside > 0) {
                    let progress = Math.min(1, distanceInside / 150);
                    alpha = progress; const easeOut = 1 - Math.pow(1 - progress, 3);
                    flyOffsetX = item.randX * (1 - easeOut); flyOffsetY = item.randY * (1 - easeOut);
                } else continue;
            }
        }

        const appliedExtraX = isPinned ? item.currentExtraX : 0;
        const midClefScaleProgress = item.isMidClef && activeMidClefStickyScale > 1
            ? Math.max(0, (item.currentScale - 1) / (activeMidClefStickyScale - 1))
            : 0;
        const drawCmd = {
            item, drawColor, isPureBg,
            alpha: alpha * item.currentOpacity,
            tx: flyOffsetX + pinShiftX + appliedExtraX,
            ty: flyOffsetY + ((item.midClefOffsetY || 0) * midClefScaleProgress),
            scale: item.currentScale
        };

        if (item.isSticky) stickyDrawList.push(drawCmd); else normalDrawList.push(drawCmd);
    }

    const executeDrawList = (list) => {
        for (let i = 0; i < list.length; i++) {
            const { item, drawColor, isPureBg, alpha, tx, ty, scale } = list[i];
            ctx.fillStyle = drawColor;
            ctx.strokeStyle = drawColor;

            const elementCenterX = item.centerX || (item.absMinX + item.absMaxX) / 2;
            const distanceToPlayhead = Math.abs(elementCenterX - currentX);

            if (showScanGlow && distanceToPlayhead <= scanGlowRange && !isPureBg) {
                const rawIntensity = Math.max(0, 1 - (distanceToPlayhead / scanGlowRange));
                const smoothIntensity = rawIntensity * rawIntensity * (3 - 2 * rawIntensity);
                ctx.shadowBlur = 18 * smoothIntensity;
                ctx.shadowColor = drawColor;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.globalAlpha = alpha;
            ctx.save();
            ctx.translate(tx, ty);

            if (scale !== 1) {
                ctx.translate(item.blockMinX, item.blockCenterY);
                ctx.scale(scale, scale); ctx.translate(-item.blockMinX, -item.blockCenterY);
            }

            ctx.transform(item.matrix.a, item.matrix.b, item.matrix.c, item.matrix.d, item.matrix.e, item.matrix.f);

            const getDrawColor = (role) => role === 'bg' ? bgColor : drawColor;
            const strokeWidth = item.strokeWidth || 1;

            if (item.type === 'line') {
                if (item.strokeRole !== 'none') {
                    ctx.strokeStyle = getDrawColor(item.strokeRole); ctx.lineWidth = item.lineWidth || strokeWidth;
                    ctx.beginPath(); ctx.moveTo(item.localX1, item.localY1); ctx.lineTo(item.localX2, item.localY2); ctx.stroke();
                }
            } else if (item.type === 'path') {
                if (item.fillRole !== 'none') { ctx.fillStyle = getDrawColor(item.fillRole); ctx.fill(item.path2D); }
                if (item.strokeRole !== 'none') { ctx.strokeStyle = getDrawColor(item.strokeRole); ctx.lineWidth = strokeWidth; ctx.stroke(item.path2D); }
            } else if (item.type === 'rect') {
                if (item.fillRole !== 'none') { ctx.fillStyle = getDrawColor(item.fillRole); ctx.fillRect(item.localX, item.localY, item.width, item.height); }
                if (item.strokeRole !== 'none') { ctx.strokeStyle = getDrawColor(item.strokeRole); ctx.lineWidth = strokeWidth; ctx.strokeRect(item.localX, item.localY, item.width, item.height); }
            } else if (item.type === 'ellipse') {
                ctx.beginPath();
                ctx.ellipse(item.localCX, item.localCY, item.radiusX, item.radiusY, 0, 0, Math.PI * 2);
                if (item.fillRole !== 'none') { ctx.fillStyle = getDrawColor(item.fillRole); ctx.fill(); }
                if (item.strokeRole !== 'none') { ctx.strokeStyle = getDrawColor(item.strokeRole); ctx.lineWidth = strokeWidth; ctx.stroke(); }
            } else if (item.type === 'text') {
                ctx.fillStyle = getDrawColor(item.fillRole || 'fg'); ctx.font = item.font; ctx.textBaseline = 'alphabetic'; ctx.fillText(item.text, item.x, item.y);
            }

            ctx.restore();
        }
    };

    // 🌟 镜头居中锚点：修改为动态的 playlineScreenX
    ctx.save();
    ctx.translate(playlineScreenX, centerY);
    ctx.scale(globalZoom, globalZoom);
    ctx.translate(-currentX, -scoreCenterY);
    executeDrawList(normalDrawList);
    ctx.restore();

    if (typeof window.__maskOpacity === 'undefined') window.__maskOpacity = 0;
    if (typeof window.__maskWidth === 'undefined') window.__maskWidth = 0;
    const targetMaskOpacity = (maxStickyRightScreenX > 0 && shouldShowMask) ? 1 : 0;
    let targetMaskWidth = targetMaskOpacity === 1 ? Math.ceil((maxStickyRightScreenX + 48) / 10) * 10 : 0;

    if (typeof isPlaying !== 'undefined' && isPlaying) {
        window.__maskOpacity += (targetMaskOpacity - window.__maskOpacity) * 0.15;
        if (targetMaskWidth > 0) window.__maskWidth = targetMaskWidth;
    } else {
        window.__maskOpacity = targetMaskOpacity; if (targetMaskWidth > 0) window.__maskWidth = targetMaskWidth;
    }

    if (window.__maskOpacity > 0.01 && window.__maskWidth > 0) {
        ctx.save(); ctx.shadowBlur = 0; ctx.globalAlpha = window.__maskOpacity;
        const maskW = window.__maskWidth; const fadeW = 40; const fadeStart = Math.max(0, maskW - fadeW);

        if (transparentBackground) {
            const clearGradient = ctx.createLinearGradient(0, 0, maskW, 0);
            clearGradient.addColorStop(0, 'rgba(0,0,0,1)');
            if (fadeStart > 0) clearGradient.addColorStop(fadeStart / maskW, 'rgba(0,0,0,1)');
            clearGradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = clearGradient;
            ctx.fillRect(0, 0, maskW, canvas.height);
            ctx.globalCompositeOperation = 'source-over';
        } else {
            const bgGradient = ctx.createLinearGradient(0, 0, maskW, 0);
            let r = 0, g = 0, b = 0;
            if (solidBgColor.startsWith('#') && solidBgColor.length === 7) { r = parseInt(solidBgColor.slice(1,3), 16); g = parseInt(solidBgColor.slice(3,5), 16); b = parseInt(solidBgColor.slice(5,7), 16); }
            bgGradient.addColorStop(0, `rgba(${r},${g},${b},1)`); if (fadeStart > 0) bgGradient.addColorStop(fadeStart / maskW, `rgba(${r},${g},${b},1)`); bgGradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, maskW, canvas.height);
        }

        const bridgeLines = (window.globalAbsoluteBridgeLineYs && window.globalAbsoluteBridgeLineYs.length > 0)
            ? window.globalAbsoluteBridgeLineYs
            : window.globalAbsoluteStaffLineYs;

        if (bridgeLines && bridgeLines.length > 0) {
            ctx.save();
            // 🌟 五线谱桥梁连接线起点：遮罩始终从左侧边界开始
            const worldMaskLeft = currentX - worldDistanceLeft;
            const worldMaskRight = worldMaskLeft + (maskW / globalZoom);

            const lineGradient = ctx.createLinearGradient(worldMaskLeft, 0, worldMaskRight, 0);
            let nr = 255, ng = 255, nb = 255;
            if (noteColor.startsWith('#') && noteColor.length === 7) { nr = parseInt(noteColor.slice(1,3), 16); ng = parseInt(noteColor.slice(3,5), 16); nb = parseInt(noteColor.slice(5,7), 16); }
            lineGradient.addColorStop(0, `rgba(${nr},${ng},${nb},1)`); if (fadeStart > 0) lineGradient.addColorStop(fadeStart / maskW, `rgba(${nr},${ng},${nb},1)`); lineGradient.addColorStop(1, `rgba(${nr},${ng},${nb},0)`);

            ctx.translate(playlineScreenX, centerY);
            ctx.scale(globalZoom, globalZoom);
            ctx.translate(-currentX, -scoreCenterY);
            let maskPinShiftX = currentX > maxStickySmoothX_initial ? currentX - maxStickySmoothX_initial : 0;
            const bridgeAnchorX = Number.isFinite(window.globalAbsoluteBridgeStartX)
                ? window.globalAbsoluteBridgeStartX
                : window.globalAbsoluteSystemInternalX;
            const bridgeStartX = bridgeAnchorX + maskPinShiftX;

            if (worldMaskRight > bridgeStartX) {
                bridgeLines.forEach(line => {
                    ctx.beginPath();
                    ctx.moveTo(bridgeStartX, line.y);
                    ctx.lineTo(worldMaskRight, line.y);
                    ctx.strokeStyle = lineGradient;
                    ctx.lineWidth = line.width || bridgeLines[0].width || 1;
                    ctx.stroke();
                });
            }
            ctx.restore();
        }
        ctx.restore();
    }

    ctx.save();
    ctx.translate(playlineScreenX, centerY);
    ctx.scale(globalZoom, globalZoom);
    ctx.translate(-currentX, -scoreCenterY);
    executeDrawList(stickyDrawList);
    ctx.restore();

    if (!isPlaying && !isExportingVideoMode) {
        if (stickyNeedsFollowupFrame) scheduleStickyTransitionFrame(currentX);
        else cancelStickyTransitionFrame();
    }

    if (typeof showPlayline !== 'undefined' && showPlayline) {
        ctx.globalAlpha = 1; ctx.save(); ctx.beginPath();
        // 🌟 实体播放线重构：画在你滑块选择的位置
        ctx.moveTo(playlineScreenX, 0); ctx.lineTo(playlineScreenX, canvas.height);
        ctx.lineWidth = 2; ctx.strokeStyle = noteColor; ctx.shadowBlur = 15; ctx.shadowColor = noteColor; ctx.stroke(); ctx.restore();
    }
}

function syncViewportHeight() {
    if (isPreviewFocusMode()) {
        return;
    }

    if (syncDesktopPreviewFrame()) {
        return;
    }
    syncMobileExportPreviewHeight();
}

function resizeCanvas() {
    if (!canvas || !viewportEl || isExportingVideoMode) return;
    syncViewportHeight();
    syncWorkspaceScaleFrameMetrics();
    // 使用布局尺寸，避免祖先 transform 缩放后再次把 canvas 写小一遍。
    const layoutWidth = viewportEl.clientWidth || viewportEl.getBoundingClientRect().width;
    const layoutHeight = viewportEl.clientHeight || viewportEl.getBoundingClientRect().height;
    // 获取设备的物理像素与独立像素比例 (DPR)
    const dpr = window.devicePixelRatio || 1;

    // 设置 Canvas 内部实际渲染分辨率 (放大)
    canvas.width = layoutWidth * dpr;
    canvas.height = layoutHeight * dpr;

    // 设置 Canvas 在屏幕上显示的 CSS 尺寸 (缩回原大小)
    canvas.style.width = `${layoutWidth}px`;
    canvas.style.height = `${layoutHeight}px`;

    // 归一化坐标系
    ctx.scale(dpr, dpr);

    // 更新全局缓存宽度
    cachedViewportWidth = layoutWidth;

    // 🌟 核心修复：Canvas 尺寸一旦改变就会被系统强制清空，所以我们立刻补画当前帧
    if (typeof renderCanvas === 'function') {
        renderCanvas(smoothX);
    }
}

function syncTransforms() {
    if (typeof renderCanvas === 'function') renderCanvas(smoothX);
}

bpmSlider.addEventListener('input', () => {
    currentBpm = parseInt(bpmSlider.value);
    bpmVal.innerText = currentBpm;

    // 👇 恢复成最简单的提示，不再计算废弃的 Tag 毫秒数
    tempoSourceHint.innerText = `MODE: MANUAL BPM`;

    if (!isMidiLoaded && svgTags.length > 0) {
        timelineFeature.generateManualTempoMap();
    }
});

// 👇 修改：保存全局变量以便日后重新计算
document.getElementById('midiInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        let midi;
        try {
            midi = parseMidiData(e.target.result);
        } catch (error) {
            console.error('❌ MIDI 解析失败：', error);
            alert(`MIDI 解析失败：${error.message || error}`);
            return;
        }

        midiDurationSec = Number.isFinite(midi.duration) ? midi.duration : 0;

        globalMidiPpq = Number(midi.header && midi.header.ppq) || 480;
        globalMidiTempos = Array.isArray(midi.header && midi.header.tempos) ? [...midi.header.tempos] : [];
        globalMidiTempos.sort((a, b) => a.ticks - b.ticks);

        if (globalMidiTempos.length === 0) {
            globalMidiTempos.push({ ticks: 0, bpm: 120, time: 0 });
        }

        debugLog(`🎵 解析到全局变速事件：共 ${globalMidiTempos.length} 处速度变化`);

        isMidiLoaded = true;
        bpmSlider.disabled = true;
        bpmSlider.style.opacity = "0.3";
        tempoSourceHint.innerText = "MODE: MIDI AUTO-TEMPO";
        tempoSourceHint.style.color = "#00ffcc";

        if (!rebuildScoreTimingFromSvgRoot()) {
            debugLog("⏳ MIDI 已就绪，等待 SVG 乐谱导入后进行时空映射...");
        }
    };
    reader.readAsArrayBuffer(file);
});

function updateLiveTheme() {
    const bgHex = bgColorPicker ? bgColorPicker.value : defaultBgColor;
    const noteHex = noteColorPicker ? noteColorPicker.value : defaultNoteColor;

    // 仅修改 CSS 变量用于周边 UI
    document.documentElement.style.setProperty('--viewport-bg', bgHex);
    document.documentElement.style.setProperty('--note-color', noteHex);

    // 如果在暂停状态下，立刻重绘画布以预览新颜色
    if (!isPlaying && typeof renderCanvas === 'function') {
        renderCanvas(smoothX);
    }
    saveLocalSettings();
}

themeDarkBtn.addEventListener('click', () => {
    if (bgColorPicker) bgColorPicker.value = '#000000'; // 👈 改为 '#000000'
    if (noteColorPicker) noteColorPicker.value = '#ffffff';
    defaultBgColor = '#000000'; // 👈 改为 '#000000'
    defaultNoteColor = '#ffffff';
    updateLiveTheme();
});

themeLightBtn.addEventListener('click', () => {
    if (bgColorPicker) bgColorPicker.value = '#f5f5f7';
    if (noteColorPicker) noteColorPicker.value = '#111111';
    defaultBgColor = '#f5f5f7';
    defaultNoteColor = '#111111';
    updateLiveTheme();
});

/**
 * 1. 谱号与大括号识别器 (已接入字体框架)
 */
function identifyClefOrBrace(sig, originalD) {
    let result = activeSignatureMap.clefs[sig] || allKnownClefMap[sig] || null;

    // 🎯 核心碰撞处理：打击乐谱号 vs 震音记号
    if (result === 'Percussion Clef (打击乐谱号)' && originalD) {
        // 如果是手写字体包含了贝塞尔曲线 (C)，那它绝对不是纯几何直线的震音记号，直接放行！
        if (!sig.includes('C')) {
            const matches = originalD.match(/([+-]?\d*\.?\d+)/g);
            // 至少需要 8 个数字（4个坐标点）来计算第一个图形的包围盒
            if (matches && matches.length >= 8) {
                const xs = [parseFloat(matches[0]), parseFloat(matches[2]), parseFloat(matches[4]), parseFloat(matches[6])];
                const ys = [parseFloat(matches[1]), parseFloat(matches[3]), parseFloat(matches[5]), parseFloat(matches[7])];

                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);

                const width = maxX - minX;
                const height = maxY - minY;

                // 💡 震音记号：有一定宽度（倾斜导致的），且不会像谱号那么瘦高
                // 💡 这条防线只拦明显扁平的 slash，避免把 Maestro 这类偏矮的真打击乐谱号误杀。
                if (width > 0.5 && height < width * 3.5) {
                    return null; // 它是震音记号，踢出谱号阵营！
                }
            }
        }
    }
    return result;
}

/**
 * 2. 变音记号识别器 (已接入字体框架)
 */
function identifyAccidental(sig) {
    return activeSignatureMap.accidentals[sig] || allKnownAccidentalMap[sig] || null;
}

/**
 * 3. 音符头识别器 (已接入字体框架)
 */
function identifyNotehead(sig) {
    return activeSignatureMap.noteheads[sig] || null;
}

function identifyAnyKnownNotehead(sig) {
    return identifyNotehead(sig) || allKnownNoteheadMap[sig] || null;
}

function shouldCollectPathNoteheadCandidate(el, sig) {
    if (currentAnalysisProfile.sourceType === SCORE_SOURCE_SIBELIUS) return false;
    if (currentAnalysisProfile.sourceType === SCORE_SOURCE_DORICO) {
        return Boolean(activeSignatureMap.noteheads[sig]);
    }
    if (currentAnalysisProfile.sourceType === SCORE_SOURCE_MUSESCORE) {
        if (hasSemanticCandidates(currentAnalysisProfile, 'noteheads')) {
            return hasSvgClass(el, 'Note');
        }
    }
    return Boolean(identifyAnyKnownNotehead(sig));
}

function shouldCollectTextNoteheadCandidate(el, sig) {
    if (currentAnalysisProfile.sourceType === SCORE_SOURCE_DORICO) {
        const { normalizedFontFamily } = getScoreElementFontInfo(el);
        return Boolean(normalizedFontFamily && normalizedFontFamily === currentAnalysisProfile.selectedMusicFont && identifyNotehead(sig));
    }
    if (currentAnalysisProfile.sourceType === SCORE_SOURCE_SIBELIUS) {
        const { rawFontFamily } = getScoreElementFontInfo(el);
        return Boolean(isSibeliusSymbolFontFamily(rawFontFamily) && identifyAnyKnownNotehead(sig));
    }
    if (currentAnalysisProfile.sourceType === SCORE_SOURCE_MUSESCORE) {
        return false;
    }
    return Boolean(identifyAnyKnownNotehead(sig));
}

function getSvgClassTokens(el) {
    if (!el) return [];
    const classAttr = typeof el.getAttribute === 'function' ? (el.getAttribute('class') || '') : '';
    return classAttr.split(/\s+/).filter(Boolean);
}

function hasSvgClass(el, token) {
    return getSvgClassTokens(el).includes(token);
}

function isRehearsalMarkText(content) {
    return /^[A-Z]{1,2}$/.test((content || "").trim());
}

function getRectIntersectionMetrics(a, b) {
    if (!a || !b) return { width: 0, height: 0, area: 0 };

    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.right, b.right);
    const bottom = Math.min(a.bottom, b.bottom);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);

    return { width, height, area: width * height };
}

function getRectArea(rect) {
    if (!rect) return 0;
    return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function getRectCenter(rect) {
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };
}

function isPotentialRehearsalEnclosure(textRect, shapeRect) {
    if (!textRect || !shapeRect) return false;
    if (!(shapeRect.width > 0) || !(shapeRect.height > 0)) return false;
    if (shapeRect.width > textRect.width * 6 || shapeRect.height > textRect.height * 6) return false;

    const aspectRatio = shapeRect.width / shapeRect.height;
    if (!(aspectRatio >= 0.65 && aspectRatio <= 2.75)) return false;

    const overflowToleranceX = Math.max(1.2, Math.min(4, textRect.width * 0.18));
    const overflowToleranceY = Math.max(1.2, Math.min(4, textRect.height * 0.18));
    const leftOverflow = Math.max(0, shapeRect.left - textRect.left);
    const rightOverflow = Math.max(0, textRect.right - shapeRect.right);
    const topOverflow = Math.max(0, shapeRect.top - textRect.top);
    const bottomOverflow = Math.max(0, textRect.bottom - shapeRect.bottom);

    if (
        leftOverflow > overflowToleranceX
        || rightOverflow > overflowToleranceX
        || topOverflow > overflowToleranceY
        || bottomOverflow > overflowToleranceY
    ) {
        return false;
    }

    const textCenter = getRectCenter(textRect);
    const shapeCenter = getRectCenter(shapeRect);
    const centerToleranceX = Math.max(2.5, shapeRect.width * 0.22);
    const centerToleranceY = Math.max(2.5, shapeRect.height * 0.22);

    return (
        Math.abs(textCenter.x - shapeCenter.x) <= centerToleranceX
        && Math.abs(textCenter.y - shapeCenter.y) <= centerToleranceY
    );
}

function belongsToSameRehearsalEnclosureGroup(anchorRect, shapeRect) {
    if (!anchorRect || !shapeRect) return false;
    if (!(shapeRect.width > 0) || !(shapeRect.height > 0)) return false;

    const anchorArea = getRectArea(anchorRect);
    const shapeArea = getRectArea(shapeRect);
    if (!(anchorArea > 0) || !(shapeArea > 0)) return false;

    const overlap = getRectIntersectionMetrics(anchorRect, shapeRect);
    const overlapRatio = overlap.area / Math.min(anchorArea, shapeArea);
    if (overlapRatio < 0.82) return false;

    const anchorCenter = getRectCenter(anchorRect);
    const shapeCenter = getRectCenter(shapeRect);
    const centerToleranceX = Math.max(2.5, anchorRect.width * 0.18);
    const centerToleranceY = Math.max(2.5, anchorRect.height * 0.18);
    if (
        Math.abs(anchorCenter.x - shapeCenter.x) > centerToleranceX
        || Math.abs(anchorCenter.y - shapeCenter.y) > centerToleranceY
    ) {
        return false;
    }

    return (
        Math.abs(shapeRect.width - anchorRect.width) <= Math.max(2.5, anchorRect.width * 0.2)
        && Math.abs(shapeRect.height - anchorRect.height) <= Math.max(2.5, anchorRect.height * 0.2)
    );
}

function isMuseScoreSvg(svgRoot) {
    return detectScoreSourceType(svgRoot) === SCORE_SOURCE_MUSESCORE;
}

function detectScoreSourceType(svgRoot, svgText = "") {
    if (!svgRoot) return SCORE_SOURCE_UNKNOWN;

    const descText = (svgRoot.querySelector('desc')?.textContent || '').trim();
    if (/Generated by MuseScore/i.test(descText)) return SCORE_SOURCE_MUSESCORE;

    if (svgRoot.querySelector(
        'path[class~="Clef"], path[class~="KeySig"], path[class~="TimeSig"], path[class~="Bracket"], polyline[class~="BarLine"], line[class~="BarLine"]'
    )) {
        return SCORE_SOURCE_MUSESCORE;
    }

    if (/\bDorico\b/i.test(descText)) return SCORE_SOURCE_DORICO;

    if (SIBELIUS_SOURCE_REGEX.test(svgText)) return SCORE_SOURCE_SIBELIUS;

    if (svgRoot.querySelector(
        '[font-family*="Opus Std"], [font-family*="Opus Special Std"], [font-family*="Opus Text Std"], [font-family*="Helsinki"], [font-family*="Inkpen2"]'
    )) {
        return SCORE_SOURCE_SIBELIUS;
    }

    return SCORE_SOURCE_UNKNOWN;
}

/**
 * 核心调度函数 (入口)
 * 抹除坐标干扰，提取拓扑指令序列，并分发给各子识别器
 */
function identifyMusicalSymbol(d) {
    if (!d) return null;
    const sig = d.replace(/[^a-zA-Z]/g, '').toUpperCase();
    // 传入 d
    return identifyClefOrBrace(sig, d) ||
        identifyAccidental(sig)  ||
        identifyNotehead(sig);
}

function autoDetectMusicFont(svgText) {
    // 动态获取你注册表里所有的字体名称 (Bravura, Petaluma, Leland等)
    const availableFonts = Object.keys(MusicFontRegistry);
    let maxCount = 0;
    let detectedFont = null;

    availableFonts.forEach(font => {
        // 使用不区分大小写的正则去全文匹配字体名称，并统计出现次数
        const regex = new RegExp(font, 'gi');
        const matches = svgText.match(regex);
        const count = matches ? matches.length : 0;

        if (count > maxCount) {
            maxCount = count;
            detectedFont = font;
        }
    });

    if (detectedFont) {
        debugLog(`🤖 [智能嗅探] 发现目标字体: ${detectedFont} (出现 ${maxCount} 次)`);

        const selectEl = document.getElementById('musicFontSelect');
        // 如果当前下拉菜单不是检测到的字体，自动帮用户切换并重新编译字典
        if (selectEl.value !== detectedFont) {
            selectEl.value = detectedFont;
            compileFontSignatures(detectedFont);
            debugLog(`🔤 引擎已自动挂载 [${detectedFont}] 特征字典！`);
        }
    } else {
        debugLog('⚠️ [智能嗅探] 未在 SVG 中明确找到已注册的音乐字体，将保持当前选择。');
    }
}

// 提取出的公共方法：处理 SVG 文本
async function processSvgContent(svgContent) {
    const processingGeneration = ++svgProcessingGeneration;
    currentMappedSvgRoot = null;
    resetScoreSourceTypeUi();
    const sandbox = document.getElementById('svg-sandbox');
    sandbox.innerHTML = svgContent;

    const newSvgRoot = sandbox.querySelector('svg');
    if (!newSvgRoot) return;
    currentScoreSourceType = detectScoreSourceType(newSvgRoot, svgContent);
    currentSvgIsMuseScore = currentScoreSourceType === SCORE_SOURCE_MUSESCORE;
    currentAnalysisProfile = buildScoreAnalysisProfile({
        sourceType: currentScoreSourceType,
        selectedMusicFont: document.getElementById('musicFontSelect')?.value || 'Bravura',
        svgRoot: newSvgRoot,
    });
    syncScoreSourceTypeUi();

    // 清理旧样式
    document.querySelectorAll('.svg-extracted-style').forEach(el => el.remove());
    clearInjectedSvgLocalFontFaces(document);

    const styles = newSvgRoot.querySelectorAll('style');
    styles.forEach(style => {
        const newStyle = document.createElement('style');
        newStyle.textContent = style.textContent;
        newStyle.className = 'svg-extracted-style';
        document.head.appendChild(newStyle);
    });

    await registerImportedSvgTextFonts(newSvgRoot, { documentRef: document, debugLog });
    await document.fonts.ready;

    if (processingGeneration !== svgProcessingGeneration) return;

    svgAnalysisFeature.preprocessSvgColors(newSvgRoot);

    const originalQuerySelector = document.querySelector.bind(document);
    document.querySelector = function(selector) {
        if (selector === '#score-container svg') return newSvgRoot;
        return originalQuerySelector(selector);
    };

    // 执行所有雷达扫描
    if (typeof identifyAndHighlightClefs === 'function') identifyAndHighlightClefs();
    if (typeof identifyAndHighlightInitialBarlines === 'function') identifyAndHighlightInitialBarlines();
    if (typeof identifyAndHighlightGeometricBrackets === 'function') identifyAndHighlightGeometricBrackets();
    if (typeof identifyAndHighlightRehearsalMarks === 'function') identifyAndHighlightRehearsalMarks();
    if (typeof identifyAndHighlightInstrumentNames === 'function') identifyAndHighlightInstrumentNames();
    if (typeof identifyAndHighlightKeySignatures === 'function') identifyAndHighlightKeySignatures();
    if (typeof identifyAndHighlightTimeSignatures === 'function') identifyAndHighlightTimeSignatures();
    if (typeof identifyAndHighlightAccidentals === 'function') identifyAndHighlightAccidentals();

    document.querySelector = originalQuerySelector;

    const svgAnalysis = svgAnalysisFeature.buildRenderQueue(newSvgRoot);
    renderQueue = svgAnalysis.renderQueue;
    stickyMinX = svgAnalysis.stickyMinX;
    globalStickyLanes = svgAnalysis.globalStickyLanes;
    globalStickySharedGroups = svgAnalysis.globalStickySharedGroups || {};
    window.globalAbsoluteStaffLineYs = svgAnalysis.globalAbsoluteStaffLineYs;
    window.globalAbsoluteBridgeLineYs = svgAnalysis.globalAbsoluteBridgeLineYs;
    window.globalAbsoluteBridgeStartX = svgAnalysis.globalAbsoluteBridgeStartX;
    window.globalAbsoluteSystemInternalX = svgAnalysis.globalAbsoluteSystemInternalX;
    currentMappedSvgRoot = newSvgRoot;
    rebuildScoreTimingFromSvgRoot(newSvgRoot);

    const svgRect = newSvgRoot.getBoundingClientRect();

    // 👇 🌟 核心修复：严密过滤计算乐谱“真实视觉中心”
    let contentMinY = Infinity;
    let contentMaxY = -Infinity;

    // 1. 获取五线谱最顶和最底的界线
    if (window.globalAbsoluteStaffLineYs && window.globalAbsoluteStaffLineYs.length > 0) {
        window.globalAbsoluteStaffLineYs.forEach(line => {
            if (line.y < contentMinY) contentMinY = line.y;
            if (line.y > contentMaxY) contentMaxY = line.y;
        });
    }

    // 2. 扫描所有音符/符号的中心点（防止极高/极低的音符被裁切）
    renderQueue.forEach(item => {
        if (item.fillRole === 'bg') return; // 忽略全屏背景框
        if (typeof item.centerY === 'number' && !isNaN(item.centerY)) {
            // 排除一些因解析错误的极端游离坐标
            if (item.centerY > -5000 && item.centerY < 5000) {
                if (item.centerY < contentMinY) contentMinY = item.centerY;
                if (item.centerY > contentMaxY) contentMaxY = item.centerY;
            }
        }
    });

    // 3. 计算真正的物理高和视觉重心
    if (contentMinY !== Infinity && contentMaxY !== -Infinity) {
        globalScoreHeight = (contentMaxY - contentMinY) + 160; // 额外留出 160px 的上下呼吸空间
        window.globalScoreTrueCenterY = (contentMinY + contentMaxY) / 2;
    } else {
        // 兜底方案
        globalScoreHeight = svgRect.height;
        window.globalScoreTrueCenterY = globalScoreHeight / 2;
    }
    sandbox.innerHTML = ''; // 销毁沙盒

    fitScoreToViewportHeight();
}

function queueSvgContentProcessing(svgContent) {
    void processSvgContent(svgContent).catch((error) => {
        console.error(error);
        resetScoreSourceTypeUi();
        debugLog(`⚠️ [SVG导入] 处理失败: ${error?.message || error}`);
    });
}

// 改造你的文件上传监听器
document.getElementById('svgInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        currentRawSvgContent = e.target.result; // 保存原文用于热重载
        autoDetectMusicFont(currentRawSvgContent);
        queueSvgContentProcessing(currentRawSvgContent);
    };
    reader.readAsText(file);
});

// 🌟 监听下拉菜单：切换字体时自动重编译字典，并热重载当前 SVG
document.getElementById('musicFontSelect').addEventListener('change', (e) => {
    const fontName = e.target.value;
    compileFontSignatures(fontName);
    saveLocalSettings();

    // 如果舞台上已经有乐谱，一键重新扫描
    if (currentRawSvgContent) {
        debugLog("🔄 检测到字体库变更，正在热重载并重新扫描当前乐谱...");
        queueSvgContentProcessing(currentRawSvgContent);
    }
});

syncScoreSourceTypeUi({ showPlaceholder: true });

function buildTimeSignatureStaffBandsFromLineYs(lineYs) {
    if (!Array.isArray(lineYs) || lineYs.length === 0) return [];

    const sorted = lineYs
        .filter(y => Number.isFinite(y))
        .sort((a, b) => a - b);
    if (sorted.length === 0) return [];

    // 1. 去重合并重合线
    const deduped = [];
    sorted.forEach(y => {
        const lastBandY = deduped[deduped.length - 1];
        // 容差缩小至 0.5，防误伤
        if (lastBandY === undefined || Math.abs(y - lastBandY) > 0.5) {
            deduped.push(y);
            return;
        }
        deduped[deduped.length - 1] = (lastBandY + y) / 2;
    });

    // 🌟 2. 动态计算全局线间距 (Scale-Invariant 核心)
    let globalStaffSpace = 10;
    if (deduped.length >= 2) {
        const allGaps = [];
        for (let i = 0; i < deduped.length - 1; i++) {
            allGaps.push(deduped[i + 1] - deduped[i]);
        }
        allGaps.sort((a, b) => a - b);
        // 提取最密集的间距作为基准线距 (取 20% 分位数)
        globalStaffSpace = allGaps[Math.floor(allGaps.length * 0.2)] || 10;
        if (globalStaffSpace < 0.5) globalStaffSpace = 10; // 防除零兜底
    }

    // 🌟 3. 动态自适应聚类 (抛弃死板的 25px)
    // 门槛设为 2.5 倍动态线距，完美切分紧凑的大谱表和管弦乐组！
    const staves = [];
    let currentStaff = [deduped[0]];
    const CLUSTER_MAX_GAP = globalStaffSpace * 2.5;

    for (let i = 1; i < deduped.length; i++) {
        const y = deduped[i];
        const prevY = currentStaff[currentStaff.length - 1];
        if (y - prevY <= CLUSTER_MAX_GAP) {
            currentStaff.push(y);
        } else {
            staves.push(currentStaff);
            currentStaff = [y];
        }
    }
    if (currentStaff.length > 0) staves.push(currentStaff);

    // 4. 构建基础信息 (移除错误的硬钳制)
    const stavesBase = staves.map(lines => {
        const top = lines[0];
        const bottom = lines[lines.length - 1];
        let staffSpace = globalStaffSpace;

        if (lines.length > 1) {
            const gaps = [];
            for (let j = 0; j < lines.length - 1; j++) {
                gaps.push(lines[j + 1] - lines[j]);
            }
            gaps.sort((a, b) => a - b);
            staffSpace = gaps[Math.floor(gaps.length / 2)] || globalStaffSpace;
            // ⚠️ 注意：这里去掉了原来 Math.max(2, staffSpace) 的钳制，彻底释放缩放自由度
        }
        return { top, bottom, lines, staffSpace };
    });

    // 5. 中垂线绝对分割法 (Voronoi Partitioning)
    const staffBands = [];
    for (let i = 0; i < stavesBase.length; i++) {
        const curr = stavesBase[i];
        const prev = stavesBase[i - 1];
        const next = stavesBase[i + 1];

        const absoluteTop = prev
            ? (prev.bottom + curr.top) / 2
            : curr.top - curr.staffSpace * 6;

        const absoluteBottom = next
            ? (curr.bottom + next.top) / 2
            : curr.bottom + curr.staffSpace * 6;

        staffBands.push({
            top: curr.top,
            bottom: curr.bottom,
            lineYs: curr.lines.slice(),
            lineCount: curr.lines.length,
            staffSpace: curr.staffSpace,
            paddedTop: absoluteTop,
            paddedBottom: absoluteBottom,
            staffKind: 'standard',
        });
    }

    return staffBands;
}

const PERCUSSION_INSTRUMENT_REGEX = /\b(?:timpani|triangle|cymbal|drum|mark tree|tambourine|tam(?:-| )?tam|glockenspiel|xylophone|marimba|vibraphone|wood ?block|claves|cabasa|guiro|shaker|cowbell|conga|bongo|tom(?:-tom)?|bell tree|chimes|sleigh bells|suspended)\b/i;
const TAB_LETTER_REGEX = /^(?:TAB|T|A|B)$/i;

function isPositiveIntegerTimeSignatureToken(token) {
    return /^[1-9]\d*$/.test(token || '');
}

function getHighlightedClefIdentity(el) {
    if (!el) return null;

    if (el.tagName?.toLowerCase() === 'path') {
        const d = el.getAttribute('d');
        if (!d) return null;
        return identifyClefOrBrace(simplifySvgPathSignature(d), d);
    }

    const text = (el.textContent || '').trim();
    if (!text) return null;
    return identifyClefOrBrace(text, null) || identifyClefOrBrace(text.replace(/\s+/g, ''), null) || null;
}

function classifyTimeSignatureStaffBands(svgRoot, staffBands) {
    if (!svgRoot || !Array.isArray(staffBands) || staffBands.length === 0) return staffBands;

    const systemStartX = Number.isFinite(globalSystemBarlineScreenX) && globalSystemBarlineScreenX > 0
        ? globalSystemBarlineScreenX
        : (Number.isFinite(globalSystemInternalX) ? projectSvgInternalXToScreenX(svgRoot, globalSystemInternalX) : 0);

    const clefMarkers = Array.from(svgRoot.querySelectorAll('.highlight-clef')).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
            identity: getHighlightedClefIdentity(el),
            centerY: (rect.top + rect.bottom) / 2,
        };
    }).filter((item) => item.identity && Number.isFinite(item.centerY));

    const instNameMarkers = Array.from(svgRoot.querySelectorAll('.highlight-instname')).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
            text: (el.textContent || '').trim(),
            centerY: (rect.top + rect.bottom) / 2,
        };
    }).filter((item) => item.text && Number.isFinite(item.centerY));

    const digitTexts = Array.from(svgRoot.querySelectorAll('text, tspan')).map((el) => {
        const text = (el.textContent || '').trim();
        if (!/^\d+$/.test(text)) return null;
        const rect = el.getBoundingClientRect();
        return {
            left: rect.left,
            centerY: (rect.top + rect.bottom) / 2,
        };
    }).filter(Boolean);

    const tabLetters = Array.from(svgRoot.querySelectorAll('text, tspan')).map((el) => {
        const text = (el.textContent || '').trim();
        if (!TAB_LETTER_REGEX.test(text)) return null;
        const rect = el.getBoundingClientRect();
        return {
            left: rect.left,
            centerY: (rect.top + rect.bottom) / 2,
        };
    }).filter(Boolean);

    return staffBands.map((band) => {
        const lineCount = Array.isArray(band.lineYs) ? band.lineYs.length : 0;
        const bandTop = band.paddedTop;
        const bandBottom = band.paddedBottom;

        const bandClefs = clefMarkers.filter((item) => item.centerY >= bandTop && item.centerY <= bandBottom);
        const bandLabels = instNameMarkers.filter((item) => item.centerY >= bandTop && item.centerY <= bandBottom);
        const bandDigits = digitTexts.filter((item) => item.centerY >= bandTop && item.centerY <= bandBottom && item.left >= systemStartX - 10);
        const bandTabLetters = tabLetters.filter((item) => item.centerY >= bandTop && item.centerY <= bandBottom && item.left <= systemStartX + 60);

        const hasTabClef = bandClefs.some((item) => item.identity === 'Tab Clef (TAB谱号)');
        const hasPercussionClef = bandClefs.some((item) => item.identity === 'Percussion Clef (打击乐谱号)');
        const hasPercussionLabel = bandLabels.some((item) => PERCUSSION_INSTRUMENT_REGEX.test(item.text));
        const looksLikeTablature = lineCount === 6 && (hasTabClef || bandDigits.length >= 3 || bandTabLetters.length >= 2);

        let staffKind = 'standard';
        if (looksLikeTablature) {
            staffKind = 'tablature';
        } else if (hasPercussionClef || hasPercussionLabel) {
            staffKind = 'percussion';
        }

        return {
            ...band,
            lineCount,
            staffKind,
        };
    });
}

function isEligibleTimeSignatureStaffBand(band) {
    if (!band || !Array.isArray(band.lineYs) || band.lineYs.length === 0) return false;
    return ['standard', 'percussion', 'tablature'].includes(band.staffKind || 'standard');
}

function identifyAndHighlightClefs() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;

    let foundCount = 0;
    const mainClefElements = []; // 🌟 用来记录被识别出的主谱号实体
    const useMuseScoreSemanticClasses = isMuseScoreSvg(svgRoot);
    const hasMuseScoreSemanticClefs = hasSemanticCandidates(currentAnalysisProfile, 'clefs');

    if (useMuseScoreSemanticClasses) {
        svgRoot.querySelectorAll('path').forEach(path => {
            if (hasSvgClass(path, 'Clef')) {
                if (!path.classList.contains('highlight-clef')) {
                    path.classList.add('highlight-clef');
                    foundCount++;
                }
                mainClefElements.push(path);
            }
        });
    }

    // --- 1. 常规 Path 谱号扫描 ---
    svgRoot.querySelectorAll('path').forEach(path => {
        if (path.classList.contains('highlight-clef') || path.classList.contains('highlight-brace')) return;
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_MUSESCORE && hasMuseScoreSemanticClefs) return;
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_SIBELIUS) return;
        const d = path.getAttribute('d');
        if (!d) return;
        const sig = d.replace(/[^a-zA-Z]/g, '').toUpperCase();
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_DORICO && !activeSignatureMap.clefs[sig]) return;
        const symbolType = identifyClefOrBrace(sig, d);
        if (symbolType) {
            if (symbolType.includes('Brace')) {
                path.classList.add('highlight-brace');
            } else {
                path.classList.add('highlight-clef');
                mainClefElements.push(path); // 记录主谱号
            }
            foundCount++;
        }
    });

    // --- 2. 文本 Text 谱号扫描 (兼容 Sibelius) ---
    svgRoot.querySelectorAll('text, tspan').forEach(textEl => {
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_MUSESCORE && hasMuseScoreSemanticClefs) return;
        const char = (textEl.textContent || '').trim();
        if (!char) return;
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_DORICO) {
            const { normalizedFontFamily } = getScoreElementFontInfo(textEl);
            if (!normalizedFontFamily || normalizedFontFamily !== currentAnalysisProfile.selectedMusicFont) return;
        }
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_SIBELIUS) {
            const { rawFontFamily } = getScoreElementFontInfo(textEl);
            if (!isSibeliusSymbolFontFamily(rawFontFamily)) return;
        }
        const symbolType = identifyClefOrBrace(char, null);
        if (symbolType) {
            if (symbolType.includes('Brace')) {
                textEl.classList.add('highlight-brace');
            } else {
                textEl.classList.add('highlight-clef');
                mainClefElements.push(textEl); // 记录主谱号
            }
            foundCount++;
        }
    });

    // --- 3. 🌟 新增：八度修饰符“空间收养”逻辑 ---
    // 找出所有内容为 8 或 15，且还没有被归类的闲散文本
    const modifierTexts = Array.from(svgRoot.querySelectorAll('text, tspan')).filter(el => {
        const char = (el.textContent || '').trim();
        // 👇 核心修复：把 Sibelius 的乱码 '' 也加入修饰符白名单
        return (char === '' || char === '') &&
            !el.classList.contains('highlight-clef') &&
            !el.classList.contains('highlight-timesig');
    });

    let adoptedCount = 0;
    modifierTexts.forEach(modEl => {
        const modRect = modEl.getBoundingClientRect();

        // 拿着这个 8，去所有的主谱号里“相亲”
        const isNearClef = mainClefElements.some(clefEl => {
            const clefRect = clefEl.getBoundingClientRect();

            // 计算两者的几何中心差值
            const dx = Math.abs((modRect.left + modRect.right)/2 - (clefRect.left + clefRect.right)/2);
            const dy = Math.abs((modRect.top + modRect.bottom)/2 - (clefRect.top + clefRect.bottom)/2);

            // 认亲条件：X 轴几乎对齐 (偏差 < 25px)，Y 轴在附近 (偏差 < 90px，兼容高低八度)
            return dx < 25 && dy < 90;
        });

        if (isNearClef) {
            modEl.classList.add('highlight-clef'); // 强行拉入谱号阵营
            adoptedCount++;
        }
    });

    debugLog(`✅ 谱号扫描完毕：主谱号 ${foundCount} 个，绑定游离八度修饰符 ${adoptedCount} 个。`);
}

// 🌟 辅助函数：将 SVG 内部绝对坐标转换为浏览器屏幕物理坐标
function projectSvgInternalXToScreenX(svgRoot, internalX) {
    if (!svgRoot) return internalX;
    try {
        // 创建一个原生的 SVG 坐标点
        let pt = svgRoot.createSVGPoint();
        pt.x = internalX;
        pt.y = 0;

        // 获取 SVG 元素到屏幕的转换矩阵
        let ctm = svgRoot.getScreenCTM();
        if (ctm) {
            // 通过矩阵运算，求出真实的屏幕像素 X 坐标
            return pt.matrixTransform(ctm).x;
        }
    } catch (e) {
        console.warn("坐标矩阵转换失败，使用兜底计算", e);
    }

    // 兜底方案：SVG 容器的屏幕左边缘 + 内部偏移
    let rect = svgRoot.getBoundingClientRect();
    return rect.left + internalX;
}

function projectScreenXToSvgInternalX(svgRoot, screenX) {
    if (!svgRoot) return screenX;
    try {
        let pt = svgRoot.createSVGPoint();
        pt.x = screenX;
        pt.y = 0;

        let ctm = svgRoot.getScreenCTM();
        if (ctm) {
            return pt.matrixTransform(ctm.inverse()).x;
        }
    } catch (e) {
        console.warn("屏幕坐标反投影失败，使用兜底计算", e);
    }

    let rect = svgRoot.getBoundingClientRect();
    return screenX - rect.left;
}

function identifyAndHighlightInitialBarlines() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;
    globalSystemBarlineScreenX = 0;
    window.hasPhysicalStartBarline = false;

    const lines = svgRoot.querySelectorAll('polyline, line');
    let horizontalSegments = [];
    let verticalLines = [];

    lines.forEach(line => {
        let x1, y1, x2, y2;
        if (line.tagName === 'line') {
            x1 = Number(line.getAttribute('x1'));
            y1 = Number(line.getAttribute('y1'));
            x2 = Number(line.getAttribute('x2'));
            y2 = Number(line.getAttribute('y2'));
        } else {
            const pointsStr = line.getAttribute('points');
            if (!pointsStr) return;
            const coords = pointsStr.trim().split(/\s+|,/).filter(n => n !== '').map(Number);
            if (coords.length < 4) return;
            x1 = coords[0]; y1 = coords[1];
            x2 = coords[coords.length - 2]; y2 = coords[coords.length - 1];
        }

        if (![x1, y1, x2, y2].every(Number.isFinite)) return;

        const lineRect = line.getBoundingClientRect();
        const ctm = line.getCTM();
        const matrix = ctm
            ? { a: ctm.a, b: ctm.b, c: ctm.c, d: ctm.d, e: ctm.e, f: ctm.f }
            : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        const absX1 = matrix.a * x1 + matrix.c * y1 + matrix.e;
        const absY1 = matrix.b * x1 + matrix.d * y1 + matrix.f;
        const absX2 = matrix.a * x2 + matrix.c * y2 + matrix.e;
        const absY2 = matrix.b * x2 + matrix.d * y2 + matrix.f;
        if (Math.abs(y1 - y2) < 1) {
            horizontalSegments.push({
                leftX: Math.min(absX1, absX2),
                rightX: Math.max(absX1, absX2),
                screenLeftX: Math.min(lineRect.left, lineRect.right),
                screenRightX: Math.max(lineRect.left, lineRect.right),
                screenY: (lineRect.top + lineRect.bottom) / 2,
                screenLength: Math.abs(lineRect.right - lineRect.left),
            });
        } else if (Math.abs(x1 - x2) < 1) {
            const screenX = (lineRect.left + lineRect.right) / 2;
            verticalLines.push({
                element: line,
                x: (absX1 + absX2) / 2,
                screenX,
                height: Math.abs(lineRect.bottom - lineRect.top),
            });
        }
    });

    if (horizontalSegments.length === 0) return;

    const maxHorizontalLength = Math.max(...horizontalSegments.map(seg => seg.screenLength));
    const dominantStaffLines = horizontalSegments.filter(seg =>
        seg.screenLength >= Math.max(24, maxHorizontalLength * 0.6)
    );
    const staffLines = dominantStaffLines.length > 0 ? dominantStaffLines : horizontalSegments;
    const absoluteLeftEdge = Math.min(...staffLines.map(seg => seg.leftX));
    const absoluteLeftEdgeScreenX = Math.min(...staffLines.map(seg => seg.screenLeftX));
    const sortedStaffScreenYs = staffLines
        .map((seg) => seg.screenY)
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);
    const positiveScreenDiffs = [];
    for (let i = 0; i < sortedStaffScreenYs.length - 1; i++) {
        const delta = sortedStaffScreenYs[i + 1] - sortedStaffScreenYs[i];
        if (delta > 0.5) positiveScreenDiffs.push(delta);
    }
    const screenStaffSpace = positiveScreenDiffs.length > 0
        ? positiveScreenDiffs.sort((a, b) => a - b)[Math.floor(positiveScreenDiffs.length / 2)]
        : 10;
    const openingClusterGap = Math.max(4, screenStaffSpace * 1.5);
    const openingAnchorThreshold = Math.max(10, screenStaffSpace * 4);
    const openingLeftAllowance = Math.max(2, screenStaffSpace * 0.75);
    const openingClefAllowance = Math.max(2, screenStaffSpace * 0.5);

    let leftmostOpeningClefScreenX = Infinity;
    svgRoot.querySelectorAll('.highlight-clef').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (!(rect.width > 0 || rect.height > 0)) return;
        if (Number.isFinite(rect.left) && rect.left < leftmostOpeningClefScreenX) {
            leftmostOpeningClefScreenX = rect.left;
        }
    });
    const openingClefScreenX = Number.isFinite(leftmostOpeningClefScreenX)
        ? leftmostOpeningClefScreenX
        : null;

    // 🌟 2. 过滤有效垂直线（剔除短促的符干，保留高度 >= 8 的潜在小节线）
    let validVerticals = verticalLines.filter(vLine => vLine.height >= 8);

    let trueBarlineX = null;
    let trueBarlineScreenX = null;
    let foundCount = 0;

    const openingCandidateVerticals = validVerticals.filter(vLine =>
        vLine.screenX >= absoluteLeftEdgeScreenX - openingLeftAllowance
    );

    if (openingCandidateVerticals.length > 0) {
        let absoluteLeftmostVScreenX = Math.min(...openingCandidateVerticals.map(v => v.screenX));
        let startCluster = openingCandidateVerticals.filter(vLine => vLine.screenX <= absoluteLeftmostVScreenX + openingClusterGap);

        // 🌟 3. 核心判定：只有靠近 staff left edge 的最左竖线簇，才可能是真实起手线。
        const clusterLeftmostScreenX = Math.min(...startCluster.map((vLine) => vLine.screenX));
        const clusterSitsBeforeOpeningClef = (
            openingClefScreenX === null
            || clusterLeftmostScreenX <= openingClefScreenX + openingClefAllowance
        );
        if (absoluteLeftmostVScreenX - absoluteLeftEdgeScreenX <= openingAnchorThreshold && clusterSitsBeforeOpeningClef) {
            let rightmostLine = startCluster.reduce((prev, current) => (
                current.screenX > prev.screenX || (Math.abs(current.screenX - prev.screenX) < 0.5 && current.x > prev.x)
            ) ? current : prev);
            const alignedStartCluster = startCluster.filter((vLine) => Math.abs(vLine.screenX - rightmostLine.screenX) < 1);
            if (alignedStartCluster.length > 0) {
                startCluster = alignedStartCluster;
            }
            trueBarlineX = rightmostLine.x;
            trueBarlineScreenX = rightmostLine.screenX;
            window.hasPhysicalStartBarline = true;

            startCluster.forEach(vLine => {
                vLine.element.classList.add('highlight-barline');
                foundCount++;
            });
        }
    }

    if (trueBarlineX !== null) {
        globalSystemInternalX = trueBarlineX;
    } else {
        globalSystemInternalX = absoluteLeftEdge;
    }

    globalSystemBarlineScreenX = trueBarlineScreenX !== null
        ? trueBarlineScreenX
        : absoluteLeftEdgeScreenX;

    debugLog(`✅ 开头小节线扫描完毕，共点亮 ${foundCount} 根！起点 X 已纠正为：${globalSystemInternalX} | 物理起手线：${window.hasPhysicalStartBarline}`);
}

function identifyAndHighlightGeometricBrackets() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;
    if (!(globalSystemInternalX > 0)) return;

    if (isMuseScoreSvg(svgRoot)) {
        const semanticBracketPaths = Array.from(svgRoot.querySelectorAll('path')).filter((el) =>
            hasSvgClass(el, 'Bracket') || hasSvgClass(el, 'Brace')
        );

        if (semanticBracketPaths.length > 0) {
            semanticBracketPaths.forEach((el) => {
                if (!el.classList.contains('highlight-brace')) {
                    el.classList.add('highlight-brace');
                }
            });
            debugLog(`✅ MuseScore 语义括号扫描完毕，共点亮 ${semanticBracketPaths.length} 个 Path。`);
            return;
        }
    }

    const elements = Array.from(svgRoot.querySelectorAll('polyline, line'));
    const segments = [];

    elements.forEach((el) => {
        let x1, y1, x2, y2;

        if (el.tagName.toLowerCase() === 'line') {
            x1 = Number(el.getAttribute('x1'));
            y1 = Number(el.getAttribute('y1'));
            x2 = Number(el.getAttribute('x2'));
            y2 = Number(el.getAttribute('y2'));
        } else {
            const pointsStr = el.getAttribute('points');
            if (!pointsStr) return;
            const coords = pointsStr.trim().split(/\s+|,/).filter(n => n !== '').map(Number);
            if (coords.length < 4) return;
            x1 = coords[0];
            y1 = coords[1];
            x2 = coords[coords.length - 2];
            y2 = coords[coords.length - 1];
        }

        if (![x1, y1, x2, y2].every(Number.isFinite)) return;

        const ctm = el.getCTM();
        const matrix = ctm
            ? { a: ctm.a, b: ctm.b, c: ctm.c, d: ctm.d, e: ctm.e, f: ctm.f }
            : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        const absX1 = matrix.a * x1 + matrix.c * y1 + matrix.e;
        const absY1 = matrix.b * x1 + matrix.d * y1 + matrix.f;
        const absX2 = matrix.a * x2 + matrix.c * y2 + matrix.e;
        const absY2 = matrix.b * x2 + matrix.d * y2 + matrix.f;
        const dx = Math.abs(absX1 - absX2);
        const dy = Math.abs(absY1 - absY2);
        const leftX = Math.min(absX1, absX2);
        const rightX = Math.max(absX1, absX2);
        const topY = Math.min(absY1, absY2);
        const bottomY = Math.max(absY1, absY2);

        if (dx <= 1.5 && dy > 1) {
            segments.push({
                element: el,
                kind: 'vertical',
                x: (absX1 + absX2) / 2,
                leftX,
                rightX,
                topY,
                bottomY,
                length: dy
            });
        } else if (dy <= 1.5 && dx > 1) {
            segments.push({
                element: el,
                kind: 'horizontal',
                y: (absY1 + absY2) / 2,
                leftX,
                rightX,
                topY,
                bottomY,
                length: dx
            });
        }
    });

    if (segments.length === 0) return;

    const horizontalYs = segments
        .filter(seg => seg.kind === 'horizontal' && seg.length > 8)
        .map(seg => seg.y);

    let staffSpace = 10;
    if (horizontalYs.length >= 2) {
        horizontalYs.sort((a, b) => a - b);
        const diffs = [];
        for (let i = 0; i < horizontalYs.length - 1; i++) {
            const delta = horizontalYs[i + 1] - horizontalYs[i];
            if (delta > 1) diffs.push(delta);
        }
        if (diffs.length > 0) {
            diffs.sort((a, b) => a - b);
            staffSpace = diffs[Math.floor(diffs.length / 2)] || 10;
        }
    }

    const connectionTolerance = Math.max(2, staffSpace * 0.35);
    const verticalClusterGap = Math.max(4, staffSpace * 1.1);
    const verticalMinHeight = Math.max(1, staffSpace * 0.4);
    const leftSearchMinX = globalSystemInternalX - Math.max(100, staffSpace * 8);
    const leftSearchMaxX = globalSystemInternalX + Math.max(40, staffSpace * 6);
    const bracketBandWidth = Math.max(12, staffSpace * 3.5);
    const bracketGapFromBarline = Math.max(1.5, staffSpace * 0.25);

    const independentBracketVerticals = segments.filter(seg =>
        seg.kind === 'vertical' &&
        seg.length >= verticalMinHeight &&
        seg.rightX < globalSystemInternalX - bracketGapFromBarline &&
        seg.leftX >= globalSystemInternalX - bracketBandWidth &&
        seg.rightX <= leftSearchMaxX
    ).sort((a, b) => a.x - b.x || a.topY - b.topY);

    if (independentBracketVerticals.length > 0) {
        const independentMinY = Math.min(...independentBracketVerticals.map(seg => seg.topY));
        const independentMaxY = Math.max(...independentBracketVerticals.map(seg => seg.bottomY));
        const bracketAnchorXs = [
            ...independentBracketVerticals.map(vertical => vertical.x),
            globalSystemInternalX,
        ];
        const independentConnectedHorizontals = segments.filter(seg => {
            if (seg.kind !== 'horizontal') return false;
            if (seg.length > bracketBandWidth + connectionTolerance) return false;
            if (seg.y < independentMinY - connectionTolerance || seg.y > independentMaxY + connectionTolerance) return false;

            const touchedAnchors = bracketAnchorXs.filter((anchorX, index) =>
                bracketAnchorXs.findIndex(candidate => Math.abs(candidate - anchorX) <= 0.01) === index &&
                (
                    Math.abs(seg.leftX - anchorX) <= connectionTolerance ||
                    Math.abs(seg.rightX - anchorX) <= connectionTolerance
                )
            );

            return touchedAnchors.length >= 2;
        });

        const independentElements = [
            ...independentBracketVerticals.map(vertical => vertical.element),
            ...independentConnectedHorizontals.map(horizontal => horizontal.element),
        ].filter((el, index, allElements) => allElements.indexOf(el) === index);

        independentElements.forEach((el) => {
            if (!el.classList.contains('highlight-brace')) {
                el.classList.add('highlight-brace');
            }
        });

        if (independentElements.length > 0) {
            debugLog(`✅ 几何方括号扫描完毕，共点亮 ${independentBracketVerticals.length} 根独立括号线。`);
        }
        return;
    }

    const verticals = segments.filter(seg =>
        seg.kind === 'vertical' &&
        seg.length >= verticalMinHeight &&
        seg.leftX >= leftSearchMinX &&
        seg.rightX <= leftSearchMaxX &&
        seg.element.classList.contains('highlight-barline')
    ).sort((a, b) => a.x - b.x);

    const horizontals = segments.filter(seg =>
        seg.kind === 'horizontal' &&
        seg.leftX >= leftSearchMinX - connectionTolerance &&
        seg.rightX <= leftSearchMaxX + connectionTolerance
    );

    if (verticals.length === 0 || horizontals.length === 0) return;

    const verticalClusters = [];
    verticals.forEach((vertical) => {
        const lastCluster = verticalClusters[verticalClusters.length - 1];
        if (lastCluster && (vertical.x - lastCluster.maxX) <= verticalClusterGap) {
            lastCluster.verticals.push(vertical);
            if (vertical.x < lastCluster.minX) lastCluster.minX = vertical.x;
            if (vertical.x > lastCluster.maxX) lastCluster.maxX = vertical.x;
            if (vertical.topY < lastCluster.minY) lastCluster.minY = vertical.topY;
            if (vertical.bottomY > lastCluster.maxY) lastCluster.maxY = vertical.bottomY;
            if (vertical.length > lastCluster.maxHeight) lastCluster.maxHeight = vertical.length;
        } else {
            verticalClusters.push({
                verticals: [vertical],
                minX: vertical.x,
                maxX: vertical.x,
                minY: vertical.topY,
                maxY: vertical.bottomY,
                maxHeight: vertical.length
            });
        }
    });

    let foundCount = 0;
    verticalClusters.forEach((cluster) => {
        const dynamicHorizontalMaxLength = Math.max(
            12,
            (cluster.maxX - cluster.minX) + (staffSpace * 2.5),
            cluster.maxHeight * 0.25
        );

        const connectedHorizontals = horizontals.filter(horizontal => {
            if (horizontal.length > dynamicHorizontalMaxLength) return false;
            if (horizontal.y < cluster.minY - connectionTolerance || horizontal.y > cluster.maxY + connectionTolerance) return false;

            return cluster.verticals.some(vertical =>
                Math.abs(horizontal.leftX - vertical.x) <= connectionTolerance ||
                Math.abs(horizontal.rightX - vertical.x) <= connectionTolerance
            );
        });

        if (cluster.verticals.length === 1 && connectedHorizontals.length < 2) return;
        if (cluster.verticals.length > 1 && connectedHorizontals.length === 0) return;

        const clusterElements = [
            ...cluster.verticals.map(vertical => vertical.element),
            ...connectedHorizontals.map(horizontal => horizontal.element)
        ].filter((el, index, allElements) => allElements.indexOf(el) === index);

        clusterElements.forEach((el) => {
            if (!el.classList.contains('highlight-brace')) {
                el.classList.add('highlight-brace');
            }
        });
        foundCount++;
    });

    if (foundCount > 0) {
        debugLog(`✅ 几何方括号扫描完毕，共点亮 ${foundCount} 组。`);
    }
}

function identifyAndHighlightInstrumentNames() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;
    if (!(globalSystemBarlineScreenX > 0)) return;

    const useMuseScoreSemanticClasses = isMuseScoreSvg(svgRoot);
    const candidateElements = new Set(svgRoot.querySelectorAll('text'));
    if (useMuseScoreSemanticClasses) {
        svgRoot.querySelectorAll('.InstrumentName').forEach((el) => candidateElements.add(el));
    }
    let foundCount = 0;

    candidateElements.forEach(el => {
        if (el.classList.contains('highlight-rehearsalmark')) return;
        const isMuseScoreSemanticInstrumentName = useMuseScoreSemanticClasses && el.classList.contains('InstrumentName');

        if (!isMuseScoreSemanticInstrumentName) {
            const content = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (!content) return;
            if (content.includes('@')) return;
            if (PRIVATE_USE_GLYPH_REGEX.test(content)) return;
            if (TIME_SIGNATURE_GLYPH_REGEX.test(content)) return;
        }

        const textRect = el.getBoundingClientRect();
        if (!(textRect.width > 0)) return;

        if (textRect.right < globalSystemBarlineScreenX - 2) {
            el.classList.add('highlight-instname');
            foundCount++;
        }
    });

    debugLog(`✅ 乐器名扫描完毕，共标记 ${foundCount} 个左侧文本。`);
}

function identifyAndHighlightRehearsalMarks() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;

    const enclosureCandidates = Array.from(svgRoot.querySelectorAll('rect, path, circle, ellipse'))
        .filter((el) => (
            !el.classList.contains('highlight-clef')
            && !el.classList.contains('highlight-brace')
            && !el.classList.contains('highlight-timesig')
            && !el.classList.contains('highlight-keysig')
            && !el.classList.contains('highlight-barline')
            && !el.classList.contains('highlight-instname')
        ));

    let foundCount = 0;

    Array.from(svgRoot.querySelectorAll('text')).forEach((textEl) => {
        if (textEl.classList.contains('highlight-instname') || textEl.classList.contains('highlight-timesig')) return;
        const content = (textEl.textContent || '').replace(/\s+/g, '').trim();
        if (!isRehearsalMarkText(content)) return;

        const textRect = textEl.getBoundingClientRect();
        if (!(textRect.width > 0) || !(textRect.height > 0)) return;

        const matchingEnclosure = enclosureCandidates
            .map((shapeEl) => {
                const shapeRect = shapeEl.getBoundingClientRect();
                if (!isPotentialRehearsalEnclosure(textRect, shapeRect)) return null;

                return {
                    area: shapeRect.width * shapeRect.height,
                    el: shapeEl,
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.area - b.area)[0] || null;

        if (!matchingEnclosure) return;

        textEl.classList.add('highlight-rehearsalmark');
        const anchorRect = matchingEnclosure.el.getBoundingClientRect();
        enclosureCandidates.forEach((shapeEl) => {
            const shapeRect = shapeEl.getBoundingClientRect();
            if (belongsToSameRehearsalEnclosureGroup(anchorRect, shapeRect)) {
                shapeEl.classList.add('highlight-rehearsalmark');
            }
        });
        foundCount++;
    });

    if (foundCount > 0) {
        debugLog(`✅ 排演号扫描完毕，共点亮 ${foundCount} 组。`);
    }
}

function isTimeSignatureTextRectInsideStaffBands(textRect, staffBands, isGiant = false) {
    if (!textRect || !Array.isArray(staffBands) || staffBands.length === 0) return false;

    const eligibleBands = staffBands.filter(isEligibleTimeSignatureStaffBand);
    if (eligibleBands.length === 0) return false;

    // 🌟 核心修复 1：如果是跨行大拍号，放宽判定条件！
    // 只要它的上下边界没有跑出整个“大谱表系统”的范围就算数，允许它的中心点悬空在两行谱子中间
    if (isGiant) {
        const globalTop = Math.min(...eligibleBands.map(b => b.paddedTop));
        const globalBottom = Math.max(...eligibleBands.map(b => b.paddedBottom));
        return textRect.bottom >= globalTop && textRect.top <= globalBottom;
    }

    // 正常的普通小拍号，依然严格要求中心点必须落在单行五线谱内部
    const centerY = (textRect.top + textRect.bottom) / 2;
    return eligibleBands.some(band => centerY >= band.paddedTop && centerY <= band.paddedBottom);
}

function hasStackedTimeSignaturePartner(candidate, candidates) {
    if (!candidate?.rect || !Array.isArray(candidates)) return false;

    const { rect } = candidate;
    const referencePoint = getTimeSignatureCandidateReferencePoint(candidate);
    if (!referencePoint) return false;

    return candidates.some(other => {
        if (other === candidate || !other?.rect) return false;
        if (!other.requiresStackPartner) return false;
        const otherReferencePoint = getTimeSignatureCandidateReferencePoint(other);
        if (!otherReferencePoint) return false;

        const dx = Math.abs(referencePoint.x - otherReferencePoint.x);
        const dy = Math.abs(referencePoint.y - otherReferencePoint.y);
        const { maxAlignedXGap, minStackGap, maxStackGap } = getTimeSignaturePairThresholds(candidate, other);

        return dx <= maxAlignedXGap && dy >= minStackGap && dy <= maxStackGap;
    });
}

function getTimeSignaturePairThresholds(candidate, other) {
    const rect = candidate?.rect || { width: 0, height: 0 };
    const otherRect = other?.rect || { width: 0, height: 0 };
    const candidateTag = candidate?.el?.tagName?.toLowerCase?.() || '';
    const otherTag = other?.el?.tagName?.toLowerCase?.() || '';
    const useCompressedTextStackThresholds = currentAnalysisProfile.sourceType === SCORE_SOURCE_SIBELIUS
        && candidateTag !== 'path'
        && otherTag !== 'path';

    return {
        maxAlignedXGap: Math.max(8, Math.min(rect.width, otherRect.width) * 0.6),
        minStackGap: useCompressedTextStackThresholds
            ? Math.max(6, Math.min(rect.height, otherRect.height) * 0.12)
            : Math.max(8, Math.min(rect.height, otherRect.height) * 0.75),
        maxStackGap: useCompressedTextStackThresholds
            ? Math.max(40, Math.max(rect.height, otherRect.height) * 2)
            : Math.max(32, Math.max(rect.height, otherRect.height) * 3.5),
    };
}

function getTimeSignatureStaffBandIndex(rect, staffBands) {
    if (!rect || !Array.isArray(staffBands) || staffBands.length === 0) return -1;

    const centerY = (rect.top + rect.bottom) / 2;
    return staffBands.findIndex((band) => (
        isEligibleTimeSignatureStaffBand(band) &&
        centerY >= band.paddedTop &&
        centerY <= band.paddedBottom
    ));
}

function getOverlappingTimeSignatureStaffBandIndices(rect, staffBands) {
    if (!rect || !Array.isArray(staffBands) || staffBands.length === 0) return [];

    return staffBands.reduce((indices, band, index) => {
        if (
            isEligibleTimeSignatureStaffBand(band)
            && rect.bottom >= band.paddedTop
            && rect.top <= band.paddedBottom
        ) {
            indices.push(index);
        }
        return indices;
    }, []);
}

function getSvgTextScreenAnchor(el) {
    if (!el || typeof el.getScreenCTM !== 'function') return null;

    const svgRoot = el.ownerSVGElement;
    if (!svgRoot || typeof svgRoot.createSVGPoint !== 'function') return null;

    const rawX = Number(el.getAttribute('x'));
    const rawY = Number(el.getAttribute('y'));
    const x = Number.isFinite(rawX) ? rawX : 0;
    const y = Number.isFinite(rawY) ? rawY : 0;
    const ctm = el.getScreenCTM();
    if (!ctm) return null;

    try {
        const point = svgRoot.createSVGPoint();
        point.x = x;
        point.y = y;
        return point.matrixTransform(ctm);
    } catch (error) {
        return null;
    }
}

function getTimeSignatureCandidateReferencePoint(candidate) {
    if (candidate?.referencePoint && Number.isFinite(candidate.referencePoint.x) && Number.isFinite(candidate.referencePoint.y)) {
        return candidate.referencePoint;
    }
    if (candidate?.rect) {
        return {
            x: candidate.rect.left + candidate.rect.width / 2,
            y: candidate.rect.top + candidate.rect.height / 2,
        };
    }
    return null;
}

function getTimeSignatureAnchorInfo(rect, anchorCandidates, svgRoot, staffKind = 'standard') {
    if (!rect || !svgRoot) return null;

    const minDx = staffKind === 'tablature' ? -10 : -30;
    const maxDx = staffKind === 'tablature' ? 90 : 200;

    let bestAnchor = null;
    (Array.isArray(anchorCandidates) ? anchorCandidates : []).forEach((anchorCandidate) => {
        const anchorX = Number.isFinite(anchorCandidate?.x)
            ? anchorCandidate.x
            : (Number.isFinite(anchorCandidate) ? anchorCandidate : NaN);
        if (!Number.isFinite(anchorX)) return;

        const dx = rect.left - anchorX;
        if (dx < minDx || dx > maxDx) return;
        if (!bestAnchor || Math.abs(dx) < Math.abs(bestAnchor.dx)) {
            bestAnchor = {
                anchorX,
                dx,
                source: anchorCandidate?.kind || 'barline',
            };
        }
    });

    if (bestAnchor) return bestAnchor;

    if (typeof globalSystemInternalX === 'undefined') return null;

    const staffStartX = projectSvgInternalXToScreenX(svgRoot, globalSystemInternalX);
    const dxToStart = rect.left - staffStartX;
    const maxStartDx = staffKind === 'tablature' ? 90 : 250;

    if (dxToStart >= -10 && dxToStart <= maxStartDx) {
        return { anchorX: staffStartX, dx: dxToStart, source: 'system-start' };
    }

    return null;
}

function getStackedTimeSignaturePartner(candidate, candidates) {
    if (!candidate?.rect || !Array.isArray(candidates)) return null;

    const { rect } = candidate;
    const referencePoint = getTimeSignatureCandidateReferencePoint(candidate);
    if (!referencePoint) return null;
    let bestPartner = null;
    let bestScore = Infinity;

    candidates.forEach((other) => {
        if (other === candidate || !other?.rect) return;
        if (!other.requiresStackPartner) return;
        if (candidate.bandIndex !== undefined && other.bandIndex !== undefined && candidate.bandIndex !== other.bandIndex) return;
        const otherReferencePoint = getTimeSignatureCandidateReferencePoint(other);
        if (!otherReferencePoint) return;

        const dx = Math.abs(referencePoint.x - otherReferencePoint.x);
        const dy = Math.abs(referencePoint.y - otherReferencePoint.y);
        const { maxAlignedXGap, minStackGap, maxStackGap } = getTimeSignaturePairThresholds(candidate, other);

        if (!(dx <= maxAlignedXGap && dy >= minStackGap && dy <= maxStackGap)) return;

        const score = dx + dy;
        if (score < bestScore) {
            bestScore = score;
            bestPartner = other;
        }
    });

    return bestPartner;
}

function getValidStackedTimeSignaturePair(candidate, candidates) {
    const partner = getStackedTimeSignaturePartner(candidate, candidates);
    if (!partner) return null;

    const topCandidate = candidate.rect.top <= partner.rect.top ? candidate : partner;
    const bottomCandidate = topCandidate === candidate ? partner : candidate;
    const numerator = topCandidate.decodedToken || '';
    const denominator = bottomCandidate.decodedToken || '';

    if (!isPositiveIntegerTimeSignatureToken(numerator)) return null;
    if (!isPositiveIntegerTimeSignatureToken(denominator)) return null;

    return {
        topCandidate,
        bottomCandidate,
        numerator,
        denominator,
        left: Math.min(topCandidate.rect.left, bottomCandidate.rect.left),
    };
}

function getStackedTimeSignaturePairRect(pair) {
    if (!pair?.topCandidate?.rect || !pair?.bottomCandidate?.rect) return null;

    const topRect = pair.topCandidate.rect;
    const bottomRect = pair.bottomCandidate.rect;
    return {
        left: Math.min(topRect.left, bottomRect.left),
        right: Math.max(topRect.right, bottomRect.right),
        top: Math.min(topRect.top, bottomRect.top),
        bottom: Math.max(topRect.bottom, bottomRect.bottom),
        width: Math.max(topRect.right, bottomRect.right) - Math.min(topRect.left, bottomRect.left),
        height: Math.max(topRect.bottom, bottomRect.bottom) - Math.min(topRect.top, bottomRect.top),
    };
}

function getEarliestTabMeterLeft(candidate, candidates) {
    if (!candidate?.anchorInfo) return Infinity;

    const pairLefts = candidates.map((other) => {
        if (other.bandIndex !== candidate.bandIndex) return null;
        if (other.staffKind !== 'tablature') return null;
        if (!other.anchorInfo) return null;
        if (Math.abs(other.anchorInfo.anchorX - candidate.anchorInfo.anchorX) > 2) return null;
        const pair = getValidStackedTimeSignaturePair(other, candidates);
        return pair ? pair.left : null;
    }).filter((value) => Number.isFinite(value));

    if (pairLefts.length === 0) return Infinity;
    return Math.min(...pairLefts);
}

function collectFragmentedFourCandidates(svgRoot, staffBands, fallbackFontFamily = '') {
    if (!svgRoot) {
        return { horizontalCandidates: [], verticalCandidates: [] };
    }

    const horizontalCandidates = Array.from(svgRoot.querySelectorAll('path')).map((el) => {
        if (
            el.classList.contains('highlight-clef') ||
            el.classList.contains('highlight-brace') ||
            el.classList.contains('highlight-keysig') ||
            el.classList.contains('highlight-timesig')
        ) {
            return null;
        }

        const d = el.getAttribute('d');
        if (!d) return null;
        if (simplifySvgPathSignature(d) !== 'MLLLL') return null;

        const fontFamily = getInheritedSvgFontFamily(el, fallbackFontFamily);
        if (!/maestro/i.test(fontFamily)) return null;

        const rect = el.getBoundingClientRect();
        if (!(rect.width > 0 && rect.height > 0)) return null;
        if (rect.width > 8 || rect.height > 4) return null;

        const bandIndex = getTimeSignatureStaffBandIndex(rect, staffBands);
        if (bandIndex === -1) return null;

        return {
            el,
            rect,
            bandIndex,
        };
    }).filter(Boolean);

    const verticalCandidates = Array.from(svgRoot.querySelectorAll('line, polyline')).map((el) => {
        if (
            el.classList.contains('highlight-clef') ||
            el.classList.contains('highlight-brace') ||
            el.classList.contains('highlight-barline') ||
            el.classList.contains('highlight-keysig') ||
            el.classList.contains('highlight-timesig')
        ) {
            return null;
        }

        const geometry = extractSimpleLineGeometry(el);
        if (!geometry?.isVertical) return null;

        const bandIndex = getTimeSignatureStaffBandIndex(geometry.rect, staffBands);
        if (bandIndex === -1) return null;

        return {
            el,
            rect: geometry.rect,
            left: geometry.left,
            height: geometry.height,
            bandIndex,
        };
    }).filter(Boolean);

    return { horizontalCandidates, verticalCandidates };
}

function highlightFragmentedFourFours({
    svgRoot,
    staffBands,
    fallbackFontFamily = '',
    anchorX,
    minOffsetX = 40,
    maxOffsetX = 135,
    targetBandIndex = null,
    minimumUniqueBandCount = 3,
    minimumVerticalClusterItems = 2,
    selectedClusterCount = 2,
    precomputedHorizontalCandidates = null,
    precomputedVerticalCandidates = null,
}) {
    if (!svgRoot || !Number.isFinite(anchorX)) return 0;

    const windowMinX = anchorX + minOffsetX;
    const windowMaxX = anchorX + maxOffsetX;
    const targetBand = Number.isInteger(targetBandIndex) ? staffBands[targetBandIndex] : null;
    const targetBandHeight = targetBand ? Math.max(1, targetBand.bottom - targetBand.top) : null;
    const minimumVerticalHeight = targetBand
        ? Math.max(12, targetBandHeight * 0.4)
        : 40;
    const maximumVerticalHeight = targetBand
        ? Math.max(40, targetBandHeight * 2.6)
        : 140;

    const horizontalSource = Array.isArray(precomputedHorizontalCandidates)
        ? precomputedHorizontalCandidates
        : collectFragmentedFourCandidates(svgRoot, staffBands, fallbackFontFamily).horizontalCandidates;
    const horizontalCandidates = horizontalSource.filter((item) => (
        item.rect.left >= windowMinX
        && item.rect.left <= windowMaxX
        && (!targetBand || item.bandIndex === targetBandIndex)
    ));

    if (horizontalCandidates.length < selectedClusterCount) return 0;

    const horizontalClusters = clusterSortedXs(horizontalCandidates.map((item) => item.rect.left), 12)
        .map((cluster) => {
            const items = horizontalCandidates.filter((item) => (
                item.rect.left >= cluster.minX - 1 && item.rect.left <= cluster.maxX + 1
            ));
            const uniqueBands = new Set(items.map((item) => item.bandIndex));
            const hasDuplicateBandMembers = items.some((item, index) => (
                items.findIndex((other) => other.bandIndex === item.bandIndex) !== index
            ));
            return {
                ...cluster,
                items,
                uniqueBandCount: uniqueBands.size,
                hasDuplicateBandMembers,
            };
        })
        .filter((cluster) => (
            cluster.uniqueBandCount >= minimumUniqueBandCount
            && !cluster.hasDuplicateBandMembers
        ))
        .sort((a, b) => a.centerX - b.centerX)
        .slice(0, selectedClusterCount);

    if (horizontalClusters.length < selectedClusterCount) return 0;

    const verticalSource = Array.isArray(precomputedVerticalCandidates)
        ? precomputedVerticalCandidates
        : collectFragmentedFourCandidates(svgRoot, staffBands, fallbackFontFamily).verticalCandidates;
    const verticalCandidates = verticalSource.filter((item) => (
        item.left >= windowMinX - 35
        && item.left <= windowMaxX - 5
        && item.height >= minimumVerticalHeight
        && item.height <= maximumVerticalHeight
        && (!targetBand || item.bandIndex === targetBandIndex)
    ));

    if (verticalCandidates.length === 0) return 0;

    const verticalClusters = clusterSortedXs(verticalCandidates.map((item) => item.left), 4)
        .map((cluster) => ({
            ...cluster,
            items: verticalCandidates.filter((item) => item.left >= cluster.minX - 1 && item.left <= cluster.maxX + 1),
        }))
        .filter((cluster) => cluster.items.length >= minimumVerticalClusterItems)
        .sort((a, b) => a.centerX - b.centerX);

    if (verticalClusters.length === 0) return 0;

    let highlightedCount = 0;
    const anchorXAttr = Number.isFinite(anchorX) ? String(anchorX) : '';
    horizontalClusters.forEach((horizontalCluster) => {
        const pairedVertical = verticalClusters.find((verticalCluster) => {
            const dx = horizontalCluster.centerX - verticalCluster.centerX;
            return dx >= 10 && dx <= 32;
        });

        if (!pairedVertical) return;

        horizontalCluster.items.forEach(({ el }) => {
            const wasHighlighted = el.classList.contains('highlight-timesig');
            if (!el.classList.contains('highlight-timesig')) {
                el.classList.add('highlight-timesig');
            }
            if (!el.getAttribute('data-time-sig-token')) {
                el.setAttribute('data-time-sig-token', '4');
            }
            if (anchorXAttr) {
                el.setAttribute('data-time-sig-anchor-x', anchorXAttr);
            }
            if (!wasHighlighted) highlightedCount++;
        });

        pairedVertical.items.forEach(({ el }) => {
            const wasHighlighted = el.classList.contains('highlight-timesig');
            if (!el.classList.contains('highlight-timesig')) {
                el.classList.add('highlight-timesig');
            }
            if (!el.getAttribute('data-time-sig-token')) {
                el.setAttribute('data-time-sig-token', '4');
            }
            if (anchorXAttr) {
                el.setAttribute('data-time-sig-anchor-x', anchorXAttr);
            }
            if (!wasHighlighted) highlightedCount++;
        });
    });

    return highlightedCount;
}

function identifyAndHighlightGeometricOpeningFours(svgRoot, staffBands, fallbackFontFamily = '') {
    if (!svgRoot || !(globalSystemBarlineScreenX > 0)) return 0;

    return highlightFragmentedFourFours({
        svgRoot,
        staffBands,
        fallbackFontFamily,
        anchorX: globalSystemBarlineScreenX,
        minOffsetX: 40,
        maxOffsetX: 135,
        minimumUniqueBandCount: 3,
        minimumVerticalClusterItems: 2,
        selectedClusterCount: 2,
    });
}

function identifyAndHighlightLateFragmentedFours(svgRoot, staffBands, fallbackFontFamily = '') {
    if (!svgRoot || !Array.isArray(staffBands) || staffBands.length === 0) return 0;

    const eligibleBands = staffBands
        .map((band, index) => ({ ...band, index }))
        .filter((band) => isEligibleTimeSignatureStaffBand(band));
    if (eligibleBands.length === 0) return 0;

    const staffSpaceValues = eligibleBands
        .map((band) => band.staffSpace)
        .filter((value) => Number.isFinite(value) && value > 0);
    const normalizedStaffSpace = staffSpaceValues.length > 0
        ? staffSpaceValues[Math.floor(staffSpaceValues.length / 2)]
        : 10;

    const trustedAnchors = buildTrustedBarlineAnchors({
        systemStartX: globalSystemBarlineScreenX,
        staffSystems: buildStaffSystemsFromBands(eligibleBands),
        candidateClusters: collectBarlineCandidateClusters(svgRoot, normalizedStaffSpace),
        staffSpace: normalizedStaffSpace,
    }).filter((anchor) => (
        anchor.kind === 'barline'
        && (!Number.isFinite(globalSystemBarlineScreenX) || anchor.x > globalSystemBarlineScreenX + 80)
    ));

    if (trustedAnchors.length === 0) return 0;

    const fragmentedCandidates = collectFragmentedFourCandidates(svgRoot, staffBands, fallbackFontFamily);
    let highlightedCount = 0;
    trustedAnchors.forEach((anchor) => {
        eligibleBands.forEach((band) => {
            highlightedCount += highlightFragmentedFourFours({
                svgRoot,
                staffBands,
                fallbackFontFamily,
                anchorX: anchor.x,
                minOffsetX: 18,
                maxOffsetX: 170,
                targetBandIndex: band.index,
                minimumUniqueBandCount: 1,
                minimumVerticalClusterItems: 1,
                selectedClusterCount: 2,
                precomputedHorizontalCandidates: fragmentedCandidates.horizontalCandidates,
                precomputedVerticalCandidates: fragmentedCandidates.verticalCandidates,
            });
        });
    });

    return highlightedCount;
}

function countOpeningTimeSignatureHighlights(svgRoot) {
    if (!svgRoot || !(globalSystemBarlineScreenX > 0)) return 0;

    const openingMinX = globalSystemBarlineScreenX - 10;
    // Keep this window tight so later early-measure meters do not suppress geometric opening recovery.
    const openingMaxX = globalSystemBarlineScreenX + 100;

    return Array.from(svgRoot.querySelectorAll('.highlight-timesig')).filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.left >= openingMinX && rect.left <= openingMaxX;
    }).length;
}

const GIANT_TIME_SIGNATURE_HEIGHT_PX = 80;

function isVisuallyGiantTimeSignature(rect, decoded, staffBands = []) {
    if (Boolean(decoded?.isGiant)) return true;
    if (Boolean(rect && rect.height > GIANT_TIME_SIGNATURE_HEIGHT_PX)) return true;

    const overlappingBandIndices = getOverlappingTimeSignatureStaffBandIndices(rect, staffBands);
    if (overlappingBandIndices.length <= 1) return false;

    const overlappingBands = overlappingBandIndices
        .map((index) => staffBands[index])
        .filter(Boolean);
    const minimumCrossStaffHeight = overlappingBands.length > 0
        ? Math.max(24, Math.max(...overlappingBands.map((band) => band.staffSpace || 0)) * 3.5)
        : 24;

    return rect.height >= minimumCrossStaffHeight;
}

// 🌟 拍号雷达扫描器 (终极防御版：防孤立数字、防谱外、防远离小节线)
function identifyAndHighlightTimeSignatures() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;
    const useMuseScoreSemanticClasses = isMuseScoreSvg(svgRoot);
    const fallbackFontFamily = document.getElementById('musicFontSelect')?.value || '';
    const hasMuseScoreSemanticTimeSigs = hasSemanticCandidates(currentAnalysisProfile, 'timeSignatures');

    const horizontalSegments = [];

    // --- 1. 收集五线谱和垂直小节线坐标 ---
    svgRoot.querySelectorAll('polyline, line').forEach(el => {
        let x1, y1, x2, y2;
        if (el.tagName === 'line') {
            x1 = Number(el.getAttribute('x1')); y1 = Number(el.getAttribute('y1'));
            x2 = Number(el.getAttribute('x2')); y2 = Number(el.getAttribute('y2'));
        } else {
            const pointsStr = el.getAttribute('points');
            if (!pointsStr) return;
            const coords = pointsStr.trim().split(/\s+|,/).filter(n => n !== '').map(Number);
            if (coords.length < 4) return;
            x1 = coords[0]; y1 = coords[1];
            x2 = coords[coords.length - 2]; y2 = coords[coords.length - 1];
        }

        if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return;

        const lineRect = el.getBoundingClientRect();

        if (Math.abs(y1 - y2) <= 1.5) {
            horizontalSegments.push({
                centerY: (lineRect.top + lineRect.bottom) / 2,
                length: Math.abs(x1 - x2),
            });
        }
    });

    const maxHorizontalLength = horizontalSegments.length > 0
        ? Math.max(...horizontalSegments.map((segment) => segment.length))
        : 0;
    const dominantStaffLines = horizontalSegments.filter((segment) => (
        segment.length >= Math.max(24, maxHorizontalLength * 0.6)
    ));
    const staffLineYs = (dominantStaffLines.length > 0 ? dominantStaffLines : horizontalSegments)
        .map((segment) => segment.centerY);

    const staffBands = classifyTimeSignatureStaffBands(
        svgRoot,
        buildTimeSignatureStaffBandsFromLineYs(staffLineYs),
    );
    const eligibleStaffBands = staffBands.filter(isEligibleTimeSignatureStaffBand);
    const staffSpaceValues = eligibleStaffBands
        .map((band) => band.staffSpace)
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => a - b);
    const normalizedStaffSpace = staffSpaceValues.length > 0
        ? staffSpaceValues[Math.floor(staffSpaceValues.length / 2)]
        : 10;
    const trustedTimeSignatureAnchors = buildTrustedBarlineAnchors({
        systemStartX: globalSystemBarlineScreenX,
        staffSystems: buildStaffSystemsFromBands(eligibleStaffBands),
        candidateClusters: collectBarlineCandidateClusters(svgRoot, normalizedStaffSpace),
        staffSpace: normalizedStaffSpace,
    });
    const textElements = Array.from(svgRoot.querySelectorAll('text, tspan'));

    // 🌟 第一步：收集所有可能成为拍号的候选人
    const candidates = [];
    textElements.forEach(el => {
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_MUSESCORE && hasMuseScoreSemanticTimeSigs) return;
        // 👇 🛡️ 新增防御 1：如果是已经被识别为乐器名、谱号修饰符的文本，直接踢出！
        if (el.classList.contains('highlight-instname') || el.classList.contains('highlight-clef')) return;

        const content = (el.textContent || '').trim();
        if (!content) return;
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_DORICO) {
            const { normalizedFontFamily } = getScoreElementFontInfo(el);
            if (!normalizedFontFamily || normalizedFontFamily !== currentAnalysisProfile.selectedMusicFont) return;
        }
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_SIBELIUS) {
            const { rawFontFamily } = getScoreElementFontInfo(el);
            if (!isSibeliusSymbolFontFamily(rawFontFamily)) return;
        }
        const decoded = decodeTimeSignatureText(content);
        if (!decoded) return;

        // 👇 🛡️ 新增防御 2：拍号绝对不可能出现在物理小节线的最左侧（边距外）！
        const rect = el.getBoundingClientRect();
        if (globalSystemBarlineScreenX > 0 && rect.right < globalSystemBarlineScreenX - 5) {
            return; // 如果这个数字完全在小节线左边，它绝对是声部编号，杀掉！
        }
        const isGiantTimeSig = isVisuallyGiantTimeSignature(rect, decoded, staffBands);

        candidates.push({
            el,
            content,
            decodedToken: decoded.token,
            requiresStackPartner: decoded.kind === 'number' && !isGiantTimeSig,
            isGiantTimeSig,
            rect,
            referencePoint: getSvgTextScreenAnchor(el),
        });
    });

    if (useMuseScoreSemanticClasses) {
        svgRoot.querySelectorAll('path').forEach((el) => {
            if (!hasSvgClass(el, 'TimeSig')) return;

            const d = el.getAttribute('d');
            if (!d) return;

            const signature = simplifySvgPathSignature(d);
            if (!signature) return;

            const explicitFontFamily = getInheritedSvgFontFamily(el);
            const decoded = decodeTimeSignaturePath(signature, explicitFontFamily, {
                preferredFontFamily: fallbackFontFamily,
            });

            const rect = el.getBoundingClientRect();
            if (!(rect.width > 0 && rect.height > 0)) return;

            if (globalSystemBarlineScreenX > 0 && rect.right < globalSystemBarlineScreenX - 5) {
                return;
            }

            candidates.push({
                el,
                content: '',
                decodedToken: decoded?.token || '',
                requiresStackPartner: decoded?.kind === 'number' && !isVisuallyGiantTimeSignature(rect, decoded, staffBands),
                isGiantTimeSig: isVisuallyGiantTimeSignature(rect, decoded, staffBands),
                isMuseScoreSemantic: true,
                rect,
                referencePoint: null,
            });
        });
    } else {
        svgRoot.querySelectorAll('path').forEach((el) => {
            if (currentAnalysisProfile.sourceType === SCORE_SOURCE_SIBELIUS) return;
            if (
                el.classList.contains('highlight-clef') ||
                el.classList.contains('highlight-brace') ||
                el.classList.contains('highlight-keysig') ||
                el.classList.contains('highlight-timesig')
            ) {
                return;
            }

            const d = el.getAttribute('d');
            if (!d) return;

            const signature = simplifySvgPathSignature(d);
            if (!signature) return;

            const explicitFontFamily = getInheritedSvgFontFamily(el);
            if (currentAnalysisProfile.sourceType === SCORE_SOURCE_DORICO) {
                const resolvedFontFamily = resolveMusicFontFamilyForPathSignature({
                    signature,
                    category: 'timeSignatures',
                    explicitFontFamily,
                    preferredFontFamily: fallbackFontFamily,
                });
                if (resolvedFontFamily !== currentAnalysisProfile.selectedMusicFont) return;
            }
            const decoded = decodeTimeSignaturePath(signature, explicitFontFamily, {
                preferredFontFamily: fallbackFontFamily,
            });
            if (!decoded) return;

            const rect = el.getBoundingClientRect();
            if (!(rect.width > 0 && rect.height > 0)) return;

            if (globalSystemBarlineScreenX > 0 && rect.right < globalSystemBarlineScreenX - 5) {
                return;
            }
            const isGiantTimeSig = isVisuallyGiantTimeSignature(rect, decoded, staffBands);

            candidates.push({
                el,
                content: '',
                decodedToken: decoded.token,
                requiresStackPartner: decoded.kind === 'number' && !isGiantTimeSig,
                isGiantTimeSig,
                rect,
                referencePoint: null,
            });
        });
    }

    let foundCount = 0;
    let rejectedOutsideStaffCount = 0;
    let rejectedFarFromBarlineCount = 0;
    let rejectedSolitaryCount = 0; // 🌟 新增：记录被杀掉的孤立伪装者

    candidates.forEach((candidate) => {
        candidate.stackedPair = candidate.requiresStackPartner
            ? getValidStackedTimeSignaturePair(candidate, candidates)
            : null;
        const effectiveRect = candidate.stackedPair
            ? getStackedTimeSignaturePairRect(candidate.stackedPair)
            : candidate.rect;
        candidate.effectiveRect = effectiveRect;
        const overlappingBandIndices = candidate.stackedPair && effectiveRect
            ? getOverlappingTimeSignatureStaffBandIndices(effectiveRect, staffBands)
            : [];
        const bandIndex = overlappingBandIndices.length > 0
            ? overlappingBandIndices[0]
            : getTimeSignatureStaffBandIndex(effectiveRect, staffBands);
        candidate.bandIndex = bandIndex;
        candidate.staffKind = bandIndex === -1 ? null : (staffBands[bandIndex]?.staffKind || 'standard');
        candidate.anchorInfo = bandIndex === -1
            ? null
            : getTimeSignatureAnchorInfo(effectiveRect, trustedTimeSignatureAnchors, svgRoot, candidate.staffKind || 'standard');
    });

    // 🌟 第二步：对候选人进行严格的交叉审查
    candidates.forEach(candidate => {
        const { el, requiresStackPartner, isGiantTimeSig, rect, decodedToken, bandIndex, staffKind, anchorInfo, effectiveRect, stackedPair } = candidate;
        const targetRect = effectiveRect || rect;
        const isGiantText = isGiantTimeSig || targetRect.height > GIANT_TIME_SIGNATURE_HEIGHT_PX;
        const isInsideStaffBands = stackedPair
            ? getOverlappingTimeSignatureStaffBandIndices(targetRect, staffBands).length > 0
            : isTimeSignatureTextRectInsideStaffBands(targetRect, staffBands, isGiantText);

        // 🛡️ 校验一：垂直 Y 轴必须在合法谱表内
        if (bandIndex === -1 || (staffBands.length > 0 && !isInsideStaffBands)) {
            rejectedOutsideStaffCount++;
            return;
        }

        // 🛡️ 校验二：水平 X 轴必须靠近小节线 OR 靠近五线谱起点
        if (!anchorInfo) {
            rejectedFarFromBarlineCount++;
            return;
        }

        // 🛡️ 核心修复：常规数字拍号必须组成合法的分子/分母组合
        if (requiresStackPartner) {
            const pair = stackedPair || getValidStackedTimeSignaturePair(candidate, candidates);
            if (!pair) {
                rejectedSolitaryCount++;
                return;
            }

            if (staffKind === 'tablature') {
                const systemStartX = projectSvgInternalXToScreenX(svgRoot, globalSystemInternalX);
                if (Math.abs(anchorInfo.anchorX - systemStartX) > 12) {
                    rejectedFarFromBarlineCount++;
                    return;
                }
                const earliestPairLeft = getEarliestTabMeterLeft(candidate, candidates);
                if (Number.isFinite(earliestPairLeft) && pair.left > earliestPairLeft + 8) {
                    rejectedFarFromBarlineCount++;
                    return;
                }
            }
        }

        el.classList.add('highlight-timesig');
        if (decodedToken) {
            el.setAttribute('data-time-sig-token', decodedToken);
        }
        if (isGiantTimeSig) {
            el.setAttribute('data-time-sig-giant', '1');
        }
        if (Number.isFinite(anchorInfo?.anchorX)) {
            el.setAttribute('data-time-sig-anchor-x', String(anchorInfo.anchorX));
        }
        foundCount++;
    });

    const openingHighlightCount = countOpeningTimeSignatureHighlights(svgRoot);
    if (foundCount === 0 || openingHighlightCount === 0) {
        foundCount += identifyAndHighlightGeometricOpeningFours(svgRoot, staffBands, fallbackFontFamily);
    }
    foundCount += identifyAndHighlightLateFragmentedFours(svgRoot, staffBands, fallbackFontFamily);

    debugLog(`✅ 拍号扫描：点亮 ${foundCount} 个 | 排除孤立数字 ${rejectedSolitaryCount} 个 | 排除谱外 ${rejectedOutsideStaffCount} 个 | 远离小节线 ${rejectedFarFromBarlineCount} 个。`);
}

function extractSimpleLineGeometry(el) {
    if (!el) return null;

    let x1;
    let y1;
    let x2;
    let y2;

    if (el.tagName === 'line') {
        x1 = Number(el.getAttribute('x1'));
        y1 = Number(el.getAttribute('y1'));
        x2 = Number(el.getAttribute('x2'));
        y2 = Number(el.getAttribute('y2'));
    } else {
        const pointsStr = el.getAttribute('points');
        if (!pointsStr) return null;
        const coords = pointsStr.trim().split(/\s+|,/).filter(n => n !== '').map(Number);
        if (coords.length < 4) return null;
        x1 = coords[0];
        y1 = coords[1];
        x2 = coords[coords.length - 2];
        y2 = coords[coords.length - 1];
    }

    if (![x1, y1, x2, y2].every(Number.isFinite)) return null;

    const rect = el.getBoundingClientRect();
    return {
        element: el,
        rect,
        isHorizontal: Math.abs(y1 - y2) <= 1.5,
        isVertical: Math.abs(x1 - x2) <= 1.5,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        centerY: rect.top + rect.height / 2,
    };
}

function clusterSortedXs(xs, mergeGap) {
    const sorted = (Array.isArray(xs) ? xs : [])
        .filter(value => Number.isFinite(value))
        .sort((a, b) => a - b);
    if (sorted.length === 0) return [];

    const clusters = [{ minX: sorted[0], maxX: sorted[0], centerX: sorted[0], count: 1 }];
    for (let i = 1; i < sorted.length; i++) {
        const x = sorted[i];
        const last = clusters[clusters.length - 1];
        if (x - last.maxX <= mergeGap) {
            last.maxX = x;
            last.count += 1;
            last.centerX = (last.minX + last.maxX) / 2;
        } else {
            clusters.push({ minX: x, maxX: x, centerX: x, count: 1 });
        }
    }
    return clusters;
}

function identifyGeometricNaturalClusters(svgRoot, staffSpace) {
    if (!svgRoot) return [];

    const normalizedStaffSpace = Math.max(1, Number.isFinite(staffSpace) ? staffSpace : 10);
    const horizontalMaxWidth = Math.max(12, normalizedStaffSpace * 3.2);
    const verticalMaxHeight = Math.max(12, normalizedStaffSpace * 4.2);
    const verticalMinHeight = Math.max(8, normalizedStaffSpace * 2.2);
    const clusterGap = Math.max(3, normalizedStaffSpace * 0.9);
    const naturalMaxWidth = Math.max(12, normalizedStaffSpace * 2.5);
    const naturalMinHeight = Math.max(10, normalizedStaffSpace * 2.6);
    const naturalMaxHeight = Math.max(18, normalizedStaffSpace * 5.2);

    const segments = Array.from(svgRoot.querySelectorAll('line, polyline'))
        .map(extractSimpleLineGeometry)
        .filter(segment => {
            if (!segment) return false;
            if (segment.element.classList.contains('highlight-barline') || segment.element.classList.contains('highlight-brace')) return false;
            if (segment.isHorizontal) return segment.width <= horizontalMaxWidth;
            if (segment.isVertical) return segment.height >= verticalMinHeight && segment.height <= verticalMaxHeight;
            return false;
        });

    /** @type {Array<{segments: ReturnType<typeof extractSimpleLineGeometry>[], left: number, right: number, top: number, bottom: number}>} */
    const clusters = [];
    segments.forEach(segment => {
        let targetCluster = null;
        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i];
            const overlapsX = segment.left <= cluster.right + clusterGap && segment.right >= cluster.left - clusterGap;
            const overlapsY = segment.top <= cluster.bottom + clusterGap && segment.bottom >= cluster.top - clusterGap;
            if (overlapsX && overlapsY) {
                targetCluster = cluster;
                break;
            }
        }

        if (!targetCluster) {
            targetCluster = {
                segments: [],
                left: segment.left,
                right: segment.right,
                top: segment.top,
                bottom: segment.bottom,
            };
            clusters.push(targetCluster);
        }

        targetCluster.segments.push(segment);
        targetCluster.left = Math.min(targetCluster.left, segment.left);
        targetCluster.right = Math.max(targetCluster.right, segment.right);
        targetCluster.top = Math.min(targetCluster.top, segment.top);
        targetCluster.bottom = Math.max(targetCluster.bottom, segment.bottom);
    });

    return clusters
        .map((cluster, index) => {
            const verticals = cluster.segments.filter(segment => segment.isVertical);
            const horizontals = cluster.segments.filter(segment => segment.isHorizontal);
            const width = cluster.right - cluster.left;
            const height = cluster.bottom - cluster.top;
            if (verticals.length < 2 || horizontals.length < 2) return null;
            if (width > naturalMaxWidth) return null;
            if (height < naturalMinHeight || height > naturalMaxHeight) return null;

            return {
                id: `geom-natural-${index}`,
                elements: cluster.segments.map(segment => segment.element),
                left: cluster.left,
                right: cluster.right,
                centerY: (cluster.top + cluster.bottom) / 2,
            };
        })
        .filter(Boolean);
}

function collectKeySignatureCandidates(svgRoot) {
    const horizontalSegments = Array.from(svgRoot.querySelectorAll('polyline, line'))
        .map(extractSimpleLineGeometry)
        .filter((geometry) => geometry && geometry.isHorizontal && geometry.width > 24);
    const maxHorizontalWidth = horizontalSegments.length > 0
        ? Math.max(...horizontalSegments.map((segment) => segment.width))
        : 0;
    const dominantHorizontalSegments = horizontalSegments.filter((segment) => (
        segment.width >= Math.max(24, maxHorizontalWidth * 0.6)
    ));
    const candidateStaffLines = dominantHorizontalSegments.length > 0
        ? dominantHorizontalSegments
        : horizontalSegments;
    const horizontalYs = candidateStaffLines.map((segment) => (segment.top + segment.bottom) / 2);

    let staffSpace = 10;
    if (horizontalYs.length >= 2) {
        horizontalYs.sort((a, b) => a - b);
        const diffs = [];
        for (let i = 0; i < horizontalYs.length - 1; i++) {
            const delta = horizontalYs[i + 1] - horizontalYs[i];
            if (delta > 1) diffs.push(delta);
        }
        if (diffs.length > 0) {
            diffs.sort((a, b) => a - b);
            staffSpace = diffs[Math.floor(diffs.length / 2)] || 10;
        }
    }

    return {
        horizontalYs,
        staffSpace,
        geometricNaturalClusters: identifyGeometricNaturalClusters(svgRoot, staffSpace),
    };
}

function identifyAndHighlightKeySignatures() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;
    const useMuseScoreSemanticClasses = isMuseScoreSvg(svgRoot);
    const hasMuseScoreSemanticKeySigs = hasSemanticCandidates(currentAnalysisProfile, 'keySignatures');
    const { geometricNaturalClusters } = collectKeySignatureCandidates(svgRoot);

    let count = 0;

    if (useMuseScoreSemanticClasses) {
        svgRoot.querySelectorAll('path').forEach((path) => {
            if (!hasSvgClass(path, 'KeySig')) return;

            const rect = path.getBoundingClientRect();
            if (globalSystemBarlineScreenX > 0 && rect.right < globalSystemBarlineScreenX - 5) {
                return;
            }

            if (!path.classList.contains('highlight-keysig')) {
                path.classList.add('highlight-keysig');
                count++;
            }
        });
    }

    // --- 1. Path 变音记号扫描 ---
    svgRoot.querySelectorAll('path').forEach(path => {
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_MUSESCORE && hasMuseScoreSemanticKeySigs) return;
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_SIBELIUS) return;
        if (path.classList.contains('highlight-keysig')) return;
        const d = path.getAttribute('d');
        if (!d) return;
        const sig = d.replace(/[^a-zA-Z]/g, '').toUpperCase();
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_DORICO && !activeSignatureMap.accidentals[sig]) return;
        if (!identifyAccidental(sig)) return;

        // 🛡️ 新增防御 1：剔除位于起始小节线左侧（乐器名区域）的升降号 Path
        const rect = path.getBoundingClientRect();
        if (globalSystemBarlineScreenX > 0 && rect.right < globalSystemBarlineScreenX - 5) {
            return; // 直接踢出
        }

        path.classList.add('highlight-keysig');
        count++;
    });

    // --- 2. Text 变音记号扫描 ---
    svgRoot.querySelectorAll('text, tspan').forEach(textEl => {
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_MUSESCORE && hasMuseScoreSemanticKeySigs) return;
        const char = (textEl.textContent || '').trim();
        if (!char) return;
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_DORICO) {
            const { normalizedFontFamily } = getScoreElementFontInfo(textEl);
            if (!normalizedFontFamily || normalizedFontFamily !== currentAnalysisProfile.selectedMusicFont) return;
        }
        if (currentAnalysisProfile.sourceType === SCORE_SOURCE_SIBELIUS) {
            const { rawFontFamily } = getScoreElementFontInfo(textEl);
            if (!isSibeliusSymbolFontFamily(rawFontFamily)) return;
        }
        if (!identifyAccidental(char)) return; // 查字典

        // 🛡️ 新增防御 2：剔除越界的 Text 变音记号，或者已经被标记为乐器名的文本
        const rect = textEl.getBoundingClientRect();
        if (globalSystemBarlineScreenX > 0 && rect.right < globalSystemBarlineScreenX - 5) {
            return;
        }
        if (textEl.classList.contains('highlight-instname')) {
            return;
        }

        textEl.classList.add('highlight-keysig');
        count++;
    });

    geometricNaturalClusters.forEach((cluster) => {
        cluster.elements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (globalSystemBarlineScreenX > 0 && rect.right < globalSystemBarlineScreenX - 5) {
                return;
            }
            el.setAttribute('data-accidental-cluster-id', cluster.id);
            if (!el.classList.contains('highlight-keysig')) {
                el.classList.add('highlight-keysig');
                count++;
            }
        });
    });

    debugLog(`📡 变音记号初筛完成，共标记 ${count} 个候选。`);
}

function identifyAndHighlightAccidentals() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;

    const { horizontalYs, staffSpace } = collectKeySignatureCandidates(svgRoot);
    const staffBands = buildTimeSignatureStaffBandsFromLineYs(horizontalYs);
    const staffSystems = buildStaffSystemsFromBands(staffBands);
    const trustedAnchors = buildTrustedBarlineAnchors({
        systemStartX: globalSystemBarlineScreenX,
        staffSystems,
        candidateClusters: collectBarlineCandidateClusters(svgRoot, staffSpace),
        staffSpace,
    });
    const noteheads = [];

    svgRoot.querySelectorAll('path').forEach(path => {
        const d = path.getAttribute('d');
        if (!d) return;
        const sig = d.replace(/[^a-zA-Z]/g, '').toUpperCase();
        if (!shouldCollectPathNoteheadCandidate(path, sig)) return;
        const rect = path.getBoundingClientRect();
        noteheads.push({
            signature: sig,
            left: rect.left,
            right: rect.right,
            centerY: rect.top + rect.height / 2,
            bandIndex: resolveStaffBandIndex(staffBands, rect.top + rect.height / 2),
        });
    });

    svgRoot.querySelectorAll('text, tspan').forEach(textEl => {
        const char = (textEl.textContent || '').trim();
        if (!char) return;
        if (!shouldCollectTextNoteheadCandidate(textEl, char)) return;
        const rect = textEl.getBoundingClientRect();
        noteheads.push({
            signature: char,
            left: rect.left,
            right: rect.right,
            centerY: rect.top + rect.height / 2,
            bandIndex: resolveStaffBandIndex(staffBands, rect.top + rect.height / 2),
        });
    });

    const timeSignatureGlyphs = [];
    svgRoot.querySelectorAll('.highlight-timesig').forEach(el => {
        const rect = el.getBoundingClientRect();
        timeSignatureGlyphs.push({
            left: rect.left,
            right: rect.right,
            centerY: rect.top + rect.height / 2,
            bandIndex: resolveStaffBandIndex(staffBands, rect.top + rect.height / 2),
        });
    });

    const groupedCandidates = new Map();
    svgRoot.querySelectorAll('.highlight-keysig').forEach((el, index) => {
        const clusterId = el.getAttribute('data-accidental-cluster-id') || `candidate-${index}`;
        const rect = el.getBoundingClientRect();
        const existing = groupedCandidates.get(clusterId);
        if (existing) {
            existing.elements.push(el);
            existing.left = Math.min(existing.left, rect.left);
            existing.right = Math.max(existing.right, rect.right);
            existing.top = Math.min(existing.top, rect.top);
            existing.bottom = Math.max(existing.bottom, rect.bottom);
            return;
        }

        groupedCandidates.set(clusterId, {
            id: clusterId,
            elements: [el],
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
        });
    });

    const accidentalCandidates = Array.from(groupedCandidates.values()).map((candidate) => ({
        ...candidate,
        element: candidate.elements[0],
        centerY: (candidate.top + candidate.bottom) / 2,
        bandIndex: resolveStaffBandIndex(staffBands, (candidate.top + candidate.bottom) / 2),
    }));

    const graphCandidates = accidentalCandidates.filter((candidate) => candidate.bandIndex !== -1);
    const classification = classifyAccidentalGroups({
        accidentalGroups: graphCandidates,
        noteheads: noteheads.filter((item) => item.bandIndex !== -1),
        timeSignatureGlyphs,
        trustedAnchors,
        staffSpace,
    });
    const keySignatureIds = new Set(classification.keySignatureIds);
    const accidentalIds = new Set(classification.accidentalIds);

    function isLikelyMaestroNaturalSlideMarker(candidate) {
        if (!candidate || !Array.isArray(candidate.elements) || candidate.elements.length !== 1) return false;

        const [primaryElement] = candidate.elements;
        if (!(primaryElement instanceof SVGPathElement)) return false;

        const signature = simplifySvgPathSignature(primaryElement.getAttribute('d') || '');
        if (signature !== 'MLLLLMLLLLLLLL') return false;

        const fontFamily = getInheritedSvgFontFamily(primaryElement, '');
        if (!/maestro/i.test(fontFamily)) return false;

        const sameBandNotes = noteheads.filter((notehead) => (
            notehead.bandIndex === candidate.bandIndex
            && Number.isFinite(notehead.left)
            && Number.isFinite(notehead.right)
            && Number.isFinite(notehead.centerY)
        ));

        const rightNeighbor = sameBandNotes
            .filter((notehead) => (
                notehead.signature === 'MCCCCMCCCCCC'
                && notehead.left >= candidate.right - 0.5
                && notehead.left <= candidate.right + 2
                && Math.abs(notehead.centerY - candidate.centerY) <= 0.5
            ))
            .sort((a, b) => (a.left - candidate.right) - (b.left - candidate.right))[0];
        if (!rightNeighbor) return false;

        const leftNeighbor = sameBandNotes
            .filter((notehead) => (
                notehead.right <= candidate.left
                && candidate.left - notehead.right >= 6
                && candidate.left - notehead.right <= 24
                && Math.abs(notehead.centerY - candidate.centerY) <= 4
            ))
            .sort((a, b) => (candidate.left - a.right) - (candidate.left - b.right))[0];

        return Boolean(leftNeighbor);
    }

    accidentalCandidates.forEach((candidate) => {
        const shouldBecomeAccidental = accidentalIds.has(candidate.id);
        const shouldStayKeySignature = keySignatureIds.has(candidate.id);

        if (!shouldBecomeAccidental && !shouldStayKeySignature) return;

        if (shouldBecomeAccidental && isLikelyMaestroNaturalSlideMarker(candidate)) {
            candidate.elements.forEach((el) => {
                el.classList.remove('highlight-keysig');
                el.classList.remove('highlight-accidental');
                el.removeAttribute('data-accidental-cluster-id');
            });
            return;
        }

        candidate.elements.forEach((el) => {
            if (shouldBecomeAccidental) {
                el.classList.remove('highlight-keysig');
                el.classList.add('highlight-accidental');
                return;
            }

            el.classList.remove('highlight-accidental');
            el.classList.add('highlight-keysig');
        });
    });

    const { finalKeySignatureCount, finalAccidentalCount } = getFinalAccidentalDisplayCounts(svgRoot);
    debugLog(`🎯 变音记号识别完成：最终调号 ${finalKeySignatureCount} 个，最终临时记号 ${finalAccidentalCount} 个，可信锚点 ${trustedAnchors.length} 个。`);
}

function getFinalAccidentalDisplayCounts(svgRoot) {
    if (!svgRoot) {
        return {
            finalKeySignatureCount: 0,
            finalAccidentalCount: 0
        };
    }

    return {
        finalKeySignatureCount: svgRoot.querySelectorAll('.highlight-keysig').length,
        finalAccidentalCount: svgRoot.querySelectorAll('.highlight-accidental').length
    };
}

function resolveStaffBandIndex(staffBands, centerY) {
    const bands = Array.isArray(staffBands) ? staffBands : [];
    for (let i = 0; i < bands.length; i++) {
        const band = bands[i];
        const top = Number.isFinite(band.paddedTop) ? band.paddedTop : band.top;
        const bottom = Number.isFinite(band.paddedBottom) ? band.paddedBottom : band.bottom;
        if (!Number.isFinite(top) || !Number.isFinite(bottom)) continue;
        if (centerY >= top && centerY <= bottom) return i;
    }
    return -1;
}

function buildStaffSystemsFromBands(staffBands) {
    const bands = (Array.isArray(staffBands) ? staffBands : [])
        .filter((band) => Number.isFinite(band?.top) && Number.isFinite(band?.bottom) && band.bottom > band.top)
        .sort((a, b) => a.top - b.top);
    if (bands.length === 0) return [];

    const systems = [{ top: bands[0].top, bottom: bands[0].bottom }];
    for (let i = 1; i < bands.length; i++) {
        const previousBand = bands[i - 1];
        const currentBand = bands[i];
        const gap = currentBand.top - previousBand.bottom;
        const systemBreakThreshold = Math.max(
            24,
            (previousBand.staffSpace || 0) * 10,
            (currentBand.staffSpace || 0) * 10
        );

        if (gap > systemBreakThreshold) {
            systems.push({ top: currentBand.top, bottom: currentBand.bottom });
            continue;
        }

        systems[systems.length - 1].bottom = currentBand.bottom;
    }

    return systems;
}

function collectBarlineCandidateClusters(svgRoot, staffSpace) {
    if (!svgRoot) return [];

    const mergeGap = Math.max(2, staffSpace * 0.75);
    const verticalSegments = Array.from(svgRoot.querySelectorAll('polyline, line'))
        .map(extractSimpleLineGeometry)
        .filter((geometry) => (
            geometry
            && geometry.isVertical
            && geometry.height >= 8
            && !geometry.element.classList.contains('highlight-brace')
            && !geometry.element.hasAttribute('data-accidental-cluster-id')
        ));

    if (verticalSegments.length === 0) return [];

    const clusteredXs = clusterSortedXs(
        verticalSegments.map((segment) => (segment.left + segment.right) / 2),
        mergeGap
    );

    return clusteredXs.map((cluster) => {
        const memberSegments = verticalSegments.filter((segment) => {
            const centerX = (segment.left + segment.right) / 2;
            return centerX >= cluster.minX - 0.5 && centerX <= cluster.maxX + 0.5;
        });
        if (memberSegments.length === 0) return null;

        return {
            x: cluster.centerX,
            minTop: Math.min(...memberSegments.map((segment) => segment.top)),
            maxBottom: Math.max(...memberSegments.map((segment) => segment.bottom)),
            lineCount: memberSegments.length,
            maxLineHeight: Math.max(...memberSegments.map((segment) => segment.height)),
        };
    }).filter(Boolean);
}

function identifyProtectedKeySignatureCandidates(accidentals, noteheads, timeSignatureGlyphs, barlineClusters, staffBands, staffSpace, systemStartScreenX) {
    const protectedIds = new Set();
    const normalizedStaffSpace = Math.max(1, Number.isFinite(staffSpace) ? staffSpace : 10);
    const openingAnchorMax = Math.max(48, normalizedStaffSpace * 8);
    const openingGapMax = Math.max(4, normalizedStaffSpace * 3);
    const openingWindowPadding = Math.max(2, normalizedStaffSpace * 0.75);
    const noteClearanceMin = Math.max(3, normalizedStaffSpace * 0.9);
    const startX = Number.isFinite(systemStartScreenX) ? systemStartScreenX : -Infinity;

    const normalizedAccidentals = (Array.isArray(accidentals) ? accidentals : [])
        .map(item => ({
            ...item,
            bandIndex: resolveStaffBandIndex(staffBands, item.centerY)
        }))
        .filter(item => item.bandIndex !== -1)
        .sort((a, b) => (a.left - b.left) || (a.centerY - b.centerY));

    const normalizedNoteheads = (Array.isArray(noteheads) ? noteheads : [])
        .map(item => ({
            ...item,
            bandIndex: resolveStaffBandIndex(staffBands, item.centerY)
        }))
        .filter(item => item.bandIndex !== -1);

    const normalizedTimeSignatures = (Array.isArray(timeSignatureGlyphs) ? timeSignatureGlyphs : [])
        .map(item => ({
            ...item,
            bandIndex: resolveStaffBandIndex(staffBands, item.centerY)
        }))
        .filter(item => item.bandIndex !== -1);

    const anchors = [];
    if (Number.isFinite(startX)) {
        anchors.push({ x: startX, kind: 'system-start', count: 1 });
    }
    (Array.isArray(barlineClusters) ? barlineClusters : []).forEach((cluster) => {
        if (!cluster || !Number.isFinite(cluster.centerX)) return;
        anchors.push({ x: cluster.centerX, kind: 'barline', count: cluster.count || 1 });
    });
    anchors.sort((a, b) => a.x - b.x);

    const bandCount = Array.isArray(staffBands) ? staffBands.length : 0;
    for (let bandIndex = 0; bandIndex < bandCount; bandIndex++) {
        const bandAccidentals = normalizedAccidentals.filter(item => item.bandIndex === bandIndex);
        if (bandAccidentals.length === 0) continue;

        const bandNotes = normalizedNoteheads.filter(item => item.bandIndex === bandIndex);
        const bandTimeSignatures = normalizedTimeSignatures.filter(item => item.bandIndex === bandIndex);
        for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex++) {
            const anchor = anchors[anchorIndex];
            if (anchor.kind === 'barline' && anchor.count < 2) continue;

            const notesToRight = bandNotes.filter(item => item.left >= anchor.x - openingWindowPadding);
            const timeSignaturesToRight = bandTimeSignatures.filter(item => item.left >= anchor.x - openingWindowPadding);
            const nextAnchorX = anchors[anchorIndex + 1]?.x ?? Infinity;
            const firstRightBoundary = Math.min(
                nextAnchorX - openingWindowPadding,
                ...notesToRight.map(item => item.left),
                ...timeSignaturesToRight.map(item => item.left)
            );

            const leadingAccidentals = bandAccidentals.filter(item => (
                item.left >= anchor.x - openingWindowPadding
                && item.right <= firstRightBoundary + openingWindowPadding
            ));

            if (leadingAccidentals.length === 0) continue;

            const firstCandidate = leadingAccidentals[0];
            if (firstCandidate.left > anchor.x + openingAnchorMax) {
                continue;
            }

            const firstNoteToRight = notesToRight.length > 0
                ? Math.min(...notesToRight.map(item => item.left))
                : Infinity;
            const firstTimeSigToRight = timeSignaturesToRight.length > 0
                ? Math.min(...timeSignaturesToRight.map(item => item.left))
                : Infinity;
            const lastCandidate = leadingAccidentals[leadingAccidentals.length - 1];
            const gapToFirstNote = firstNoteToRight - lastCandidate.right;
            const noteIsNearestRightBoundary = firstNoteToRight < firstTimeSigToRight;

            if (noteIsNearestRightBoundary && gapToFirstNote < noteClearanceMin) {
                continue;
            }

            protectedIds.add(firstCandidate.id);
            let previousCandidate = firstCandidate;
            for (let i = 1; i < leadingAccidentals.length; i++) {
                const candidate = leadingAccidentals[i];
                const gap = Math.max(0, candidate.left - previousCandidate.right);
                if (gap > openingGapMax) break;
                protectedIds.add(candidate.id);
                previousCandidate = candidate;
            }
        }
    }

    return protectedIds;
}

function propagateAccidentalContagion(accidentals, noteheads, staffBands, staffSpace) {
    const normalizedStaffSpace = Math.max(1, Number.isFinite(staffSpace) ? staffSpace : 10);
    const bands = Array.isArray(staffBands) ? staffBands : [];
    const seedDxMin = -normalizedStaffSpace * 0.6;
    const seedDxMax = normalizedStaffSpace * 2.6;
    const seedDyMax = normalizedStaffSpace * 1.2;
    const spreadGapMax = Math.max(2, normalizedStaffSpace * 1.15);
    const spreadDyMax = Math.max(2, normalizedStaffSpace * 1.35);

    const normalizedAccidentals = (Array.isArray(accidentals) ? accidentals : []).map((item, index) => ({
        ...item,
        _id: item.id || `acc-${index}`,
        bandIndex: resolveStaffBandIndex(bands, item.centerY)
    }));

    const normalizedNotes = (Array.isArray(noteheads) ? noteheads : []).map((item, index) => ({
        ...item,
        _id: item.id || `note-${index}`,
        bandIndex: resolveStaffBandIndex(bands, item.centerY)
    }));

    const canShareBand = (a, b) => {
        if (a.bandIndex !== -1 && b.bandIndex !== -1) return a.bandIndex === b.bandIndex;
        return Math.abs(a.centerY - b.centerY) <= spreadDyMax;
    };

    const horizontalGapBetween = (a, b) => {
        if (b.left >= a.right) return b.left - a.right;
        if (a.left >= b.right) return a.left - b.right;
        return 0;
    };

    const infectedIds = new Set();
    const queue = [];

    normalizedAccidentals.forEach(accidental => {
        const hasSeedNote = normalizedNotes.some(note => {
            if (!canShareBand(accidental, note)) return false;
            const dx = note.left - accidental.right;
            const dy = Math.abs(note.centerY - accidental.centerY);
            return dx >= seedDxMin && dx <= seedDxMax && dy <= seedDyMax;
        });

        if (!hasSeedNote) return;
        infectedIds.add(accidental._id);
        queue.push(accidental);
    });

    while (queue.length > 0) {
        const current = queue.shift();
        normalizedAccidentals.forEach(candidate => {
            if (infectedIds.has(candidate._id)) return;
            if (!canShareBand(current, candidate)) return;
            const gap = horizontalGapBetween(current, candidate);
            const dy = Math.abs(current.centerY - candidate.centerY);
            if (gap > spreadGapMax || dy > spreadDyMax) return;
            infectedIds.add(candidate._id);
            queue.push(candidate);
        });
    }

    return infectedIds;
}

function identifySingleLineNoteAdjacentAccidentals(accidentals, noteheads, staffBands, staffSpace) {
    const normalizedStaffSpace = Math.max(1, Number.isFinite(staffSpace) ? staffSpace : 10);
    const bands = Array.isArray(staffBands) ? staffBands : [];
    const noteDxMin = -normalizedStaffSpace * 0.8;
    const noteDxMax = Math.max(40, normalizedStaffSpace * 6.5);
    const noteDyMax = Math.max(16, normalizedStaffSpace * 3.2);
    const clusterGapMax = Math.max(10, normalizedStaffSpace * 1.8);
    const clusterDyMax = Math.max(10, normalizedStaffSpace * 1.8);

    const normalizedAccidentals = (Array.isArray(accidentals) ? accidentals : []).map((item, index) => ({
        ...item,
        _id: item.id || `acc-single-${index}`,
        bandIndex: resolveStaffBandIndex(bands, item.centerY)
    }));

    const normalizedNotes = (Array.isArray(noteheads) ? noteheads : []).map((item, index) => ({
        ...item,
        _id: item.id || `note-single-${index}`,
        bandIndex: resolveStaffBandIndex(bands, item.centerY)
    }));

    const canShareBand = (a, b) => {
        if (a.bandIndex !== -1 && b.bandIndex !== -1) return a.bandIndex === b.bandIndex;
        return Math.abs(a.centerY - b.centerY) <= noteDyMax;
    };

    const horizontalGapBetween = (a, b) => {
        if (b.left >= a.right) return b.left - a.right;
        if (a.left >= b.right) return a.left - b.right;
        return 0;
    };

    const adjacentIds = new Set();
    const queue = [];
    normalizedAccidentals.forEach(accidental => {
        const hasNearbyNote = normalizedNotes.some(note => {
            if (!canShareBand(accidental, note)) return false;
            const dx = note.left - accidental.right;
            const dy = Math.abs(note.centerY - accidental.centerY);
            return dx >= noteDxMin && dx <= noteDxMax && dy <= noteDyMax;
        });

        if (!hasNearbyNote) return;
        adjacentIds.add(accidental._id);
        queue.push(accidental);
    });

    while (queue.length > 0) {
        const current = queue.shift();
        normalizedAccidentals.forEach((candidate) => {
            if (adjacentIds.has(candidate._id)) return;
            if (!canShareBand(current, candidate)) return;
            const gap = horizontalGapBetween(current, candidate);
            const dy = Math.abs(current.centerY - candidate.centerY);
            if (gap > clusterGapMax || dy > clusterDyMax) return;
            adjacentIds.add(candidate._id);
            queue.push(candidate);
        });
    }

    return adjacentIds;
}

// 🌟 1. 终极网格划分：加入防伪基准线与双线缝合的 Tick 映射
function initScoreMapping(svgRoot) {
    if (!svgRoot) return;
    svgTags = [];
    const absoluteSystemStartX = Number.isFinite(window.globalAbsoluteSystemInternalX)
        ? window.globalAbsoluteSystemInternalX
        : globalSystemInternalX;

    // --- A. 预扫描：收集所有音符头 (Noteheads) 的物理领域 ---
    const noteheadZones = [];
    svgRoot.querySelectorAll('path, text, tspan').forEach(el => {
        let sig = "";
        if (el.tagName.toLowerCase() === 'path') {
            const d = el.getAttribute('d');
            if (d) sig = d.replace(/[^a-zA-Z]/g, '').toUpperCase();
        } else {
            sig = (el.textContent || '').trim();
        }

        // 如果是音符头
        const isAllowedNotehead = el.tagName.toLowerCase() === 'path'
            ? shouldCollectPathNoteheadCandidate(el, sig)
            : shouldCollectTextNoteheadCandidate(el, sig);
        if (isAllowedNotehead) {
            try {
                const box = el.getBBox();
                const ctm = el.getCTM();
                if (ctm) {
                    // 转换到绝对坐标空间
                    const absTop = ctm.b * box.x + ctm.d * box.y + ctm.f;
                    const absBottom = ctm.b * (box.x + box.width) + ctm.d * (box.y + box.height) + ctm.f;
                    const absLeft = ctm.a * box.x + ctm.c * box.y + ctm.e;
                    const absRight = ctm.a * (box.x + box.width) + ctm.c * (box.y + box.height) + ctm.e;

                    noteheadZones.push({
                        top: Math.min(absTop, absBottom),
                        bottom: Math.max(absTop, absBottom),
                        left: Math.min(absLeft, absRight),
                        right: Math.max(absLeft, absRight),
                        centerX: (absLeft + absRight) / 2,
                        centerY: (absTop + absBottom) / 2
                    });
                }
            } catch (e) {}
        }
    });

    // --- B. Legacy @ manual-tag mapping is disabled ---
    /*
    // 向后兼容：手动 @ 标记 (已停用，保留旧逻辑供参考)
    const manualTags = [];
    svgRoot.querySelectorAll('text, tspan').forEach(el => {
        if (el.textContent.includes('@')) {
            let box = { x: 0, y: 0 };
            try { box = el.getBBox(); } catch (e) {}
            let ctm = el.getCTM();
            let matrix = ctm ? { a: ctm.a, b: ctm.b, c: ctm.c, d: ctm.d, e: ctm.e, f: ctm.f } : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
            manualTags.push({
                x: matrix.a * box.x + matrix.c * box.y + matrix.e,
                y: matrix.b * box.x + matrix.d * box.y + matrix.f
            });
        }
    });

    if (manualTags.length > 0) {
        manualTags.sort((a, b) => a.x - b.x).forEach((tag, index) => {
            svgTags.push({ x: tag.x, tick: index * globalMidiPpq });
        });
        return;
    }
    */

    // --- C. 筛选垂直线，并应用“符干护卫” ---
    const barlineCandidates = [];
    svgRoot.querySelectorAll('line, polyline, rect, path').forEach(el => {
        let isVertical = false;
        let x = 0, yTop = 0, yBottom = 0, height = 0;
        try {
            let box = el.getBBox();
            if (box.width <= 3.5 && box.height >= 2) {
                isVertical = true;
                x = box.x + box.width / 2;
                yTop = box.y;
                yBottom = box.y + box.height;
                height = box.height;
            }
        } catch(e) {}

        if (isVertical) {
            let ctm = el.getCTM();
            let matrix = ctm ? { a: ctm.a, b: ctm.b, c: ctm.c, d: ctm.d, e: ctm.e, f: ctm.f } : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
            let absX = matrix.a * x + matrix.c * (yTop + height/2) + matrix.e;
            let absYTop = matrix.b * x + matrix.d * yTop + matrix.f;
            let absYBottom = matrix.b * x + matrix.d * yBottom + matrix.f;
            const realTop = Math.min(absYTop, absYBottom);
            const realBottom = Math.max(absYTop, absYBottom);

            // 🛡️ 核心：符干过滤逻辑
            // 如果这根垂直线与任何音符头的水平位置重叠，且垂直方向上相连，它就是符干
            const isStem = noteheadZones.some(note => {
                const horizontalMatch = absX >= (note.left - 2) && absX <= (note.right + 2);
                const verticalMatch = realTop <= (note.bottom + 2) && realBottom >= (note.top - 2);
                return horizontalMatch && verticalMatch;
            });

            if (!isStem) {
                barlineCandidates.push({
                    x: absX,
                    top: realTop,
                    bottom: realBottom,
                    height: Math.abs(absYBottom - absYTop),
                    el: el
                });
            }
        }
    });

    barlineCandidates.sort((a, b) => a.x - b.x);
    let clusters = [];
    barlineCandidates.forEach(line => {
        let lastCluster = clusters[clusters.length - 1];
        // X 轴容差保持在 1.5px 左右，确保同一条虚线碎片被分到一组
        if (lastCluster && Math.abs(line.x - lastCluster.x) <= 1.5) {
            lastCluster.lines.push(line);
            // 🌟 关键：更新这组碎片的总包围盒
            lastCluster.minTop = Math.min(lastCluster.minTop, line.top);
            lastCluster.maxBottom = Math.max(lastCluster.maxBottom, line.bottom);
            lastCluster.maxLineHeight = Math.max(lastCluster.maxLineHeight, line.height);
        } else {
            clusters.push({
                x: line.x,
                lines: [line],
                minTop: line.top,
                maxBottom: line.bottom,
                maxLineHeight: line.height
            });
        }
    });

    const isStaffBoundaryAligned = (cluster, staff) => {
        const tolerance = 0.5; // 允许的误差范围
        const topError = Math.abs(cluster.minTop - staff.top);
        const bottomError = Math.abs(cluster.maxBottom - staff.bottom);
        return topError <= tolerance && bottomError <= tolerance;
    };

    // 🌟 提取五线谱的绝对【上下边界】字典
    let staves = [];
    let typicalStaffHeight = 40;
    if (window.globalAbsoluteStaffLineYs && window.globalAbsoluteStaffLineYs.length >= 5) {
        typicalStaffHeight = Math.abs(window.globalAbsoluteStaffLineYs[4].y - window.globalAbsoluteStaffLineYs[0].y);
        let currentStaff = [window.globalAbsoluteStaffLineYs[0]];
        for (let i = 1; i < window.globalAbsoluteStaffLineYs.length; i++) {
            let line = window.globalAbsoluteStaffLineYs[i];
            let prevLine = currentStaff[currentStaff.length - 1];
            if (Math.abs(line.y - prevLine.y) < typicalStaffHeight * 0.5) {
                currentStaff.push(line);
            } else {
                staves.push({ top: currentStaff[0].y, bottom: currentStaff[currentStaff.length - 1].y });
                currentStaff = [line];
            }
        }
        if (currentStaff.length > 0) staves.push({ top: currentStaff[0].y, bottom: currentStaff[currentStaff.length - 1].y });
    }

    let trueBarlineXs = [];
    const fragmentedCoverageTolerance = Math.max(2.5, Math.min(6, typicalStaffHeight * 0.275));

    const matchSegmentToStaffRange = (segment) => {
        if (!segment || staves.length === 0) return null;

        let bestMatch = null;
        for (let startIndex = 0; startIndex < staves.length; startIndex++) {
            const topError = Math.abs(segment.top - staves[startIndex].top);
            if (topError > fragmentedCoverageTolerance) continue;

            for (let endIndex = startIndex; endIndex < staves.length; endIndex++) {
                const bottomError = Math.abs(segment.bottom - staves[endIndex].bottom);
                if (bottomError > fragmentedCoverageTolerance) continue;

                const coveredStaffCount = endIndex - startIndex + 1;
                const score = topError + bottomError;
                if (
                    !bestMatch
                    || coveredStaffCount > bestMatch.coveredStaffCount
                    || (coveredStaffCount === bestMatch.coveredStaffCount && score < bestMatch.score)
                ) {
                    bestMatch = {
                        startIndex,
                        endIndex,
                        coveredStaffCount,
                        score,
                    };
                }
            }
        }

        return bestMatch;
    };

    const hasFragmentedStaffCoverage = (cluster) => {
        if (!cluster || !Array.isArray(cluster.lines) || cluster.lines.length === 0 || staves.length === 0) return false;

        const coveredStaffIndices = new Set();
        let matchedSegmentCount = 0;

        cluster.lines.forEach((line) => {
            const rangeMatch = matchSegmentToStaffRange(line);
            if (!rangeMatch) return;

            matchedSegmentCount++;
            for (let index = rangeMatch.startIndex; index <= rangeMatch.endIndex; index++) {
                coveredStaffIndices.add(index);
            }
        });

        if (staves.length <= 1) {
            return coveredStaffIndices.size === 1 && matchedSegmentCount >= 1;
        }

        return coveredStaffIndices.size >= 2 && matchedSegmentCount >= 2;
    };

    clusters.forEach(cluster => {
        // 基础过滤：排除乐谱最左侧之前的杂讯
        if (absoluteSystemStartX > 0 && cluster.x < absoluteSystemStartX - 5) return;

        let isTrueBarline = false;
        const tolerance = 2.5; // 允许 2.5 像素内的误差

        // 🌟 增强版端点校验逻辑
        const checkAlignment = () => {
            if (staves.length === 0) return cluster.maxLineHeight >= typicalStaffHeight * 0.9;

            // 场景 A：跨越整个系统的长线（大谱表之间的连接线）
            const systemTop = staves[0].top;
            const systemBottom = staves[staves.length - 1].bottom;
            if (Math.abs(cluster.minTop - systemTop) <= tolerance &&
                Math.abs(cluster.maxBottom - systemBottom) <= tolerance) {
                return true;
            }

            // 场景 B：单行谱表内的小节线（包括虚线）
            if (staves.some(staff => {
                return Math.abs(cluster.minTop - staff.top) <= tolerance &&
                    Math.abs(cluster.maxBottom - staff.bottom) <= tolerance;
            })) {
                return true;
            }

            // 场景 C：同一 x 上的多段碎片，共同覆盖多个相邻谱表范围
            return hasFragmentedStaffCoverage(cluster);
        };

        // 判定：如果是起手线，或者通过了严苛的端点对齐校验
        if (absoluteSystemStartX > 0 && Math.abs(cluster.x - absoluteSystemStartX) <= 5) {
            isTrueBarline = true;
        } else {
            isTrueBarline = checkAlignment();
        }

        // 🌟 额外过滤：如果该聚类中只有极少数碎片（例如 1-2 个极短碎片），
        // 且总高度不足典型谱表的一半，可能是符干，直接剔除。
        if (isTrueBarline && cluster.lines.length < 3 && (cluster.maxBottom - cluster.minTop) < typicalStaffHeight * 0.8) {
            isTrueBarline = false;
        }

        if (isTrueBarline) {
            trueBarlineXs.push(cluster.x);
            cluster.lines.forEach(line => {
                let domIdx = parseInt(line.el.dataset.domIndex);
                let rqItem = renderQueue.find(item => item.domIndex === domIdx);
                if (rqItem) rqItem.symbolType = 'TrueBarline';
            });
        }
    });

    // 🛡️ 第四道防线：空间缝合术（专杀双小节线、反复记号）
    trueBarlineXs.sort((a, b) => a - b);
    const physicalBarlines = [];
    trueBarlineXs.forEach(x => {
        if (physicalBarlines.length === 0) {
            physicalBarlines.push(x);
        } else {
            let lastX = physicalBarlines[physicalBarlines.length - 1];
            if (x - lastX > 25) {
                physicalBarlines.push(x);
            } else {
                // 双线/反复记号合并，取最右侧坐标
                physicalBarlines[physicalBarlines.length - 1] = x;
            }
        }
    });


    const barCount = physicalBarlines.length;

// 🌟 寻找渲染队列中被标记为 TrueBarline 的第一个元素
    const firstTrueBarline = renderQueue.find(item => item.symbolType === 'TrueBarline');

// 🌟 修改：不再依赖 globalSystemInternalX 的绝对值，
// 只要 physicalBarlines 的第一个坐标离乐谱的最左侧足够近，就认定它是开头线
    const hasStartBarline = physicalBarlines.length > 0 &&
        (physicalBarlines[0] <= (stickyMinX + 100)); // 100px 容差足以覆盖谱号宽度

    let mCount = 0;
    if (barCount > 0) {
        // 强制修正：如果第一条线的位置离系统物理左端点极近，必须减1
        mCount = hasStartBarline ? (barCount - 1) : barCount;
    }

    let uniqueBarlines = [...physicalBarlines];
    if (!hasStartBarline && absoluteSystemStartX > 0) {
        // 虚拟线只进映射数组，不参与上面的 barCount 统计
        uniqueBarlines.unshift(absoluteSystemStartX);
    }

    document.getElementById('barlineCount').innerText = barCount;
    document.getElementById('measureCount').innerText = mCount;

    // 补齐弱起小节
    if (uniqueBarlines.length > 0 && absoluteSystemStartX > 0 && uniqueBarlines[0] - absoluteSystemStartX > 60) {
        uniqueBarlines.unshift(absoluteSystemStartX);
    }

    if (uniqueBarlines.length < 2) return;

    // --- 3. 提取拍号 ---
    globalTimeSigs = timelineFeature.ensureTimeSignatures(
        timelineFeature.extractTimeSignatures(renderQueue)
    );
    const timeSigs = globalTimeSigs;

    const timeSigUI = document.getElementById('timeSigDisplay');
    if (timeSigUI) {
        // 找出一个合法的拍号（排除掉为了防崩溃而塞入的兜底值）
        const mainSig = timeSigs.find(ts => ts.x !== -Infinity) || timeSigs[0];
        timeSigUI.innerText = `${mainSig.num}/${mainSig.den}`;

        // 如果它走了兜底逻辑（即没识别到拍号），给它上个警告色
        if (timeSigs.length === 1 && timeSigs[0].x === -Infinity) {
            timeSigUI.style.color = "#ff2a5f"; // 红色警告
        } else {
            timeSigUI.style.color = "#ffffff"; // 正常白色
        }
    }

    // --- 4. 核心：计算真实 Tick 并分配锚点 ---
    let currentGlobalTick = 0;
    const interpolationResolutionTicks = globalMidiPpq / 4;

    for (let i = 0; i < uniqueBarlines.length - 1; i++) {
        const startX = uniqueBarlines[i];
        const endX = uniqueBarlines[i + 1];
        const width = endX - startX;

        if (width < 10) continue;

        let activeSig = timeSigs[0];
        for (let j = timeSigs.length - 1; j >= 0; j--) {
            if (timeSigs[j].x <= startX + 60) {
                activeSig = timeSigs[j];
                break;
            }
        }

        const safeSig = (
            Number.isFinite(activeSig?.num) &&
            Number.isFinite(activeSig?.den) &&
            activeSig.num > 0 &&
            activeSig.den > 0
        ) ? activeSig : { num: 4, den: 4 };

        const quarterNotesPerBar = safeSig.num * (4 / safeSig.den);
        const measureTotalTicks = quarterNotesPerBar * globalMidiPpq;
        const slices = Math.max(1, Math.round(measureTotalTicks / interpolationResolutionTicks));

        for (let j = 0; j < slices; j++) {
            svgTags.push({
                x: startX + (width / slices) * j,
                tick: currentGlobalTick + (measureTotalTicks / slices) * j
            });
        }
        currentGlobalTick += measureTotalTicks;
    }

    if (uniqueBarlines.length > 0) {
        svgTags.push({ x: uniqueBarlines[uniqueBarlines.length - 1], tick: currentGlobalTick });
    }

    debugLog(`📊 统计：物理小节线 ${barCount} 条 | 小节数 ${mCount} | 起始模式：${hasStartBarline ? '物理线' : '虚拟补齐'}`);

    debugLog(`🎯 完美映射：生成 ${svgTags.length} 个锚点，总长度为 ${currentGlobalTick} Ticks。`);
}

function rebuildScoreTimingFromSvgRoot(svgRoot = null) {
    let resolvedSvgRoot = svgRoot;
    const sandboxEl = document.getElementById('svg-sandbox');
    let temporarilyMountedInSandbox = false;

    if (!resolvedSvgRoot) {
        const liveSandboxSvg = document.querySelector('#svg-sandbox svg');
        if (liveSandboxSvg) {
            resolvedSvgRoot = liveSandboxSvg;
        } else if (sandboxEl && currentRawSvgContent) {
            sandboxEl.innerHTML = currentRawSvgContent;
            resolvedSvgRoot = sandboxEl.querySelector('svg');
            temporarilyMountedInSandbox = Boolean(resolvedSvgRoot);
        } else {
            resolvedSvgRoot = currentMappedSvgRoot;
        }
    }

    if (!resolvedSvgRoot) return false;

    try {
        initScoreMapping(resolvedSvgRoot);
    } finally {
        if (temporarilyMountedInSandbox && sandboxEl) {
            sandboxEl.innerHTML = '';
        }
    }

    if (!svgTags || svgTags.length === 0) {
        smoothX = 0;
        updateProgressUI(0);
        return false;
    }

    if (isMidiLoaded) {
        timelineFeature.recalculateMidiTempoMap();
    } else {
        timelineFeature.generateManualTempoMap();
    }

    return true;
}

let smoothX = 0;
let smoothVx = 0;
const MAX_ACCEL_PX_PER_SEC2 = 3000; // 🚀 核心：大幅提升加速度。允许它快速加速追赶，而不是慢吞吞地导致脱节
const ENTRANCE_OPACITY_DURATION_SEC = 0.6;
const ENTRANCE_TRANSLATE_DURATION_SEC = 0.8;

function getTotalDuration() {
    if (mapData.length < 2) return 0;
    return mapData[mapData.length - 1].time + PLAYBACK_TAIL_BUFFER_SEC;
}

function syncAudioPlaybackGain(currentTime = elapsedBeforePause) {
    if (!isAudioLoaded) return;
    audioPlayer.volume = getPlaybackGainByTime(currentTime);
}

function updateProgressUI(currentTime = 0) {
    const total = getTotalDuration();
    const safeTotal = Math.max(total, 0.01);
    const clamped = clamp(currentTime, 0, total);

    // 🌟 性能核心：UI 节流，如果距离上次更新不到 250ms（且不是归零等特殊操作），直接跳过！
    const now = performance.now();
    if (now - lastUiUpdateTime < 250 && currentTime !== 0 && currentTime !== total) {
        return;
    }
    lastUiUpdateTime = now;

    progressSlider.max = String(safeTotal);
    progressSlider.value = String(clamped);
    progressSlider.disabled = total <= 0;

    timeDisplay.innerText = `${formatSeconds(clamped)} s`;
    durationDisplay.innerText = `/ ${formatSeconds(total)} s`;

    // 👇 新增：如果是 MIDI 模式，实时查表并更新界面的 BPM 显示
    if (isMidiLoaded && globalMidiTempos && globalMidiTempos.length > 0) {
        let activeBpm = globalMidiTempos[0].bpm;
        // 倒序遍历，找到第一个时间早于或等于当前时间的变速事件
        for (let i = globalMidiTempos.length - 1; i >= 0; i--) {
            if (clamped >= globalMidiTempos[i].time) {
                activeBpm = globalMidiTempos[i].bpm;
                break;
            }
        }

        // 四舍五入取整显示
        const roundedBpm = Math.round(activeBpm);

        // 只在数值发生真正变化时才操作 DOM，榨干性能
        if (bpmVal.innerText != roundedBpm) {
            bpmVal.innerText = roundedBpm;
            bpmSlider.value = roundedBpm;
        }
    }

    if (typeof globalTimeSigs !== 'undefined' && globalTimeSigs.length > 0) {
        let activeSig = globalTimeSigs[0]; // 默认兜底取第一组拍号

        // 倒序遍历，找到物理 X 轴位置早于“播放线所在位置”的最新一个拍号
        // (+60 是为了给一点视奏预读的容差，当线快碰到新拍号时提前切换)
        for (let i = globalTimeSigs.length - 1; i >= 0; i--) {
            if (globalTimeSigs[i].x <= smoothX) {
                activeSig = globalTimeSigs[i];
                break;
            }
        }

        const sigStr = `${activeSig.num}/${activeSig.den}`;

        // 🛡️ 性能防抖：只有当拍号真正发生变化时，才执行耗时的 DOM 操作
        if (window._lastDisplayedTimeSig !== sigStr) {
            const timeSigUI = document.getElementById('timeSigDisplay');
            if (timeSigUI) {
                timeSigUI.innerText = sigStr;
                // 如果走的是 -Infinity 假数据兜底，字体标红警告
                if (activeSig.x === -Infinity && globalTimeSigs.length === 1) {
                    timeSigUI.style.color = "#ff2a5f";
                } else {
                    timeSigUI.style.color = "#ffffff";
                }
            }
            window._lastDisplayedTimeSig = sigStr;
        }
    }
}


function applyOverlayVisibility() {

    toggleCursorBtn.innerText = showPlayline ? "Hide Line" : "Show Line";
    if (toggleHighlightBtn) {
        toggleHighlightBtn.innerText = showHighlights ? "Hide Glow" : "Show Glow";
    }
    if (toggleScanGlowBtn) {
        toggleScanGlowBtn.innerText = showScanGlow ? "Hide Scan" : "Show Scan";
    }

    const toggleFlyinBtn = document.getElementById('toggleFlyinBtn');
    if (toggleFlyinBtn) {
        toggleFlyinBtn.innerText = enableFlyin ? "Hide Fly-in" : "Show Fly-in";
    }
}

function setButtonTextByState() {
    const playBtn = document.getElementById('playBtn');
    if (isPlaying) {
        playBtn.innerText = "⏸ PAUSE";
        return;
    }

    const total = getTotalDuration();
    if (isFinished || (total > 0 && elapsedBeforePause >= total - 1e-4)) {
        playBtn.innerText = "▶ REPLAY";
    } else if (elapsedBeforePause > 0.001) {
        playBtn.innerText = "▶ RESUME";
    } else {
        playBtn.innerText = "▶ PLAY";
    }
}

// 🌟 终极纯净版：拖动进度条
function seekToTime(targetTime) {
    if (mapData.length < 2) return;

    const total = getTotalDuration();
    const clamped = clamp(targetTime, 0, total);
    const { x, index, atEnd } = getInterpolatedXByTime(clamped);

    smoothX = x;
    smoothVx = getSmoothedTargetVelocityByTime(clamped);
    syncTransforms();

    lastHighlightedIndex = index;
    elapsedBeforePause = clamped;
    playbackSimTime = clamped;
    updateProgressUI(clamped);

    if (isAudioLoaded) {
        let targetAudioTime = clamped + audioOffsetSec;
        if (targetAudioTime >= 0) {
            if (audioPlayer.readyState > 0 && targetAudioTime <= audioPlayer.duration) {
                audioPlayer.currentTime = targetAudioTime;
            }
            audioWaiting = false;
            if (isPlaying && audioPlayer.paused) {
                audioPlayer.play().catch(() => {});
            }
        } else {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            if (isPlaying) audioWaiting = true;
        }
    }
    syncAudioPlaybackGain(clamped);

    if (isPlaying) {
        startTime = performance.now() / 1000 - clamped;
        lastRenderClock = performance.now() / 1000;
    }

    isFinished = atEnd;
    setButtonTextByState();
}

// 🌟 终极纯净版：启动播放
function startPlayback() {
    if (isPlaying || mapData.length < 2) return;
    cancelStickyTransitionFrame();
    isPlaying = true;
    isFinished = false;
    startTime = performance.now() / 1000 - elapsedBeforePause;
    lastRenderClock = performance.now() / 1000;
    smoothVx = getSmoothedTargetVelocityByTime(elapsedBeforePause);
    playbackSimTime = elapsedBeforePause;
    setButtonTextByState();
    syncAudioPlaybackGain(elapsedBeforePause);
    if (isAudioLoaded) {
        let targetAudioTime = elapsedBeforePause + audioOffsetSec;
        if (targetAudioTime >= 0) {
            if (audioPlayer.readyState > 0 && targetAudioTime <= audioPlayer.duration) {
                audioPlayer.currentTime = targetAudioTime;
            }
            audioPlayer.play().catch(e => console.warn("音频播放被拦截:", e));
            audioWaiting = false;
        } else {
            audioPlayer.currentTime = 0;
            audioWaiting = true;
        }
    }
    renderFrame();
}

// 🌟 终极纯净版：每帧渲染引擎
function renderFrame() {
    if (!isPlaying) return;

    const nowSec = performance.now() / 1000;
    if (lastRenderClock === 0) lastRenderClock = nowSec;
    lastRenderClock = nowSec;

    const currentTime = nowSec - startTime;
    updateProgressUI(currentTime);
    syncAudioPlaybackGain(currentTime);

    if (isAudioLoaded && audioWaiting) {
        if (currentTime + audioOffsetSec >= 0) {
            audioPlayer.currentTime = 0;
            audioPlayer.play().catch(() => {});
            audioWaiting = false;
        }
    }

    const total = getTotalDuration();
    if (currentTime >= total) {
        const finalPoint = getInterpolatedXByTime(total);
        smoothX = finalPoint.x;
        syncTransforms();

        lastHighlightedIndex = finalPoint.index;
        isPlaying = false;
        isFinished = true;
        elapsedBeforePause = total;
        lastRenderClock = 0;
        smoothVx = 0;
        playbackSimTime = elapsedBeforePause;
        cancelAnimationFrame(animationFrameId);
        updateProgressUI(elapsedBeforePause);
        setButtonTextByState();
        if (isAudioLoaded) {
            syncAudioPlaybackGain(total);
            audioPlayer.pause();
        }
        return;
    }

    const currentIndex = getInterpolatedXByTime(currentTime).index;
    const playbackState = advancePlaybackStateToTime(
        { x: smoothX, vx: smoothVx },
        playbackSimTime,
        currentTime,
        PLAYBACK_SIMULATION_STEP_SEC
    );
    smoothX = playbackState.x;
    smoothVx = playbackState.vx;
    playbackSimTime = currentTime;
    syncTransforms();

    if (lastHighlightedIndex !== currentIndex) {
        lastHighlightedIndex = currentIndex;
    }

    animationFrameId = requestAnimationFrame(renderFrame);
}

// 🌟 终极纯净版：播放按钮点击事件
document.getElementById('playBtn').addEventListener('click', () => {
    if (isPlaying) {
        isPlaying = false;
        cancelAnimationFrame(animationFrameId);
        elapsedBeforePause = (performance.now() / 1000) - startTime;
        lastRenderClock = 0;
        smoothVx = 0;
        playbackSimTime = elapsedBeforePause;
        updateProgressUI(elapsedBeforePause);
        setButtonTextByState();
        if (isAudioLoaded) audioPlayer.pause();
    } else {
        if (isFinished) {
            isFinished = false;
            elapsedBeforePause = 0;
            lastRenderClock = 0;
            smoothX = mapData.length > 0 ? mapData[0].x : 0;
            smoothVx = 0;
            playbackSimTime = 0;
            lastHighlightedIndex = -1;
            syncTransforms();
            updateProgressUI(0);
            syncAudioPlaybackGain(0);
        }
        startPlayback();
        setButtonTextByState();
    }
});

// 🌟 净化版：重绘滑块监听器
const redrawCanvas = () => { if (!isPlaying && typeof renderCanvas === 'function') renderCanvas(smoothX); };

function updateFlyinParams() {
    const distPercent = parseInt(dom.distSlider.value, 10);
    const scatterPercent = parseInt(dom.scatterSlider.value, 10);
    const delayPercent = parseInt(dom.delaySlider.value, 10);

    dom.distVal.innerText = distPercent;
    dom.scatterVal.innerText = scatterPercent;
    dom.delayVal.innerText = delayPercent;

    const maxDist = distPercent * 8;
    const maxScatter = scatterPercent * 4;
    const maxDelay = delayPercent * 15;

    for (let i = 0; i < renderQueue.length; i++) {
        renderQueue[i].randX = (Math.random() * maxDist + 50);
        renderQueue[i].randY = (Math.random() * maxScatter - maxScatter / 2);
        renderQueue[i].delayDist = Math.random() * (maxDelay * 0.4);
    }
    saveLocalSettings(); // 👈
    redrawCanvas();
}

function handleGlowRangeInput(e) {
    const percent = parseInt(e.target.value, 10);
    dom.glowRangeVal.innerText = percent;
    scanGlowRange = percent * 2;
    saveLocalSettings(); // 👈
    redrawCanvas();
}

function handleToggleCursor() { showPlayline = !showPlayline; saveLocalSettings(); applyOverlayVisibility(); redrawCanvas(); }
function handleToggleHighlight() { showHighlights = !showHighlights; saveLocalSettings(); applyOverlayVisibility(); redrawCanvas(); }
function handleToggleScanGlow() { showScanGlow = !showScanGlow; saveLocalSettings(); applyOverlayVisibility(); redrawCanvas(); }
function handleToggleFlyin() { enableFlyin = !enableFlyin; saveLocalSettings(); applyOverlayVisibility(); redrawCanvas(); }

function handleProgressInput(event) {
    const targetTime = Number(event.target.value);
    if (!Number.isFinite(targetTime)) return;
    seekToTime(targetTime);
}

function handleAudioOffsetInput(e) {
    audioOffsetSec = parseFloat(e.target.value);
    dom.audioOffsetVal.innerText = (audioOffsetSec > 0 ? '+' : '') + audioOffsetSec.toFixed(2);
    // ... (保留原有音频时间轴同步逻辑)
}

function handleExportRatioChange(e) {
    const ratio = e.target.value;
    saveLocalSettings(); // 👈
    syncViewportSizingMode(ratio);
    resizeCanvas();
}

// 包含上次 4K / 120帧互斥逻辑的版本
function handleExportResolutionChange() {
    if (dom.exportResSelect && dom.exportFpsSelect) {
        const is4K = dom.exportResSelect.value === "3840";
        const fps120Option = dom.exportFpsSelect.querySelector('option[value="120"]');
        if (fps120Option) {
            fps120Option.disabled = is4K;
            if (is4K && dom.exportFpsSelect.value === "120") dom.exportFpsSelect.value = "60";
        }
    }
    saveLocalSettings(); // 👈
    syncViewportSizingMode();
    resizeCanvas();
}

function handleExportFpsChange() {
    if (dom.exportResSelect && dom.exportFpsSelect) {
        const is120Fps = dom.exportFpsSelect.value === "120";
        const res4KOption = dom.exportResSelect.querySelector('option[value="3840"]');
        if (res4KOption) {
            res4KOption.disabled = is120Fps;
            if (is120Fps && dom.exportResSelect.value === "3840") {
                dom.exportResSelect.value = "2560";
                syncViewportSizingMode();
                resizeCanvas();
            }
        }
    }
    saveLocalSettings(); // 👈
}

function handlePlaylineRatioInput(e) {
    const percent = parseInt(e.target.value, 10);
    dom.playlineRatioVal.innerText = percent;
    playlineRatio = percent / 100;
    saveLocalSettings(); // 👈
    redrawCanvas();
}

function handleStickyLockRatioInput(e) {
    const percent = parseInt(e.target.value, 10);
    dom.stickyLockRatioVal.innerText = percent;
    stickyLockRatio = percent / 100;
    saveLocalSettings(); // 👈
    redrawCanvas();
}

function handleWindowKeydown(e) {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
    if (["input", "textarea", "select"].includes(activeTag)) {
        return;
    }

    if (e.code === "Space") {
        e.preventDefault();
        if (dom.playBtn && !dom.playBtn.disabled) {
            dom.playBtn.click();
        }
        return;
    }

    if (e.code !== "ArrowLeft" && e.code !== "ArrowRight") {
        return;
    }

    e.preventDefault();

    if (!mapData || mapData.length < 2) {
        return;
    }

    const currentTime = parseFloat(dom.progressSlider?.value || "0") || 0;
    const seekStepSec = 1;
    const delta = e.code === "ArrowLeft" ? -seekStepSec : seekStepSec;
    const targetTime = clamp(currentTime + delta, 0, getTotalDuration());

    seekToTime(targetTime);
}

bindUiEvents({
    dom,
    handleAudioInputChange: audioFeature.handleAudioInputChange,
    handleAudioOffsetInput,
    handleExportRatioChange,
    handleExportResolutionChange,
    handleExportFpsChange,
    handleGlowRangeInput,
    handleStickyLockRatioInput,
    handleWindowKeydown,
    handlePlaylineRatioInput,
    handleProgressInput,
    handleResize: () => {
        syncViewportSizingMode();
        resizeCanvas();
    },
    onCancelExport: () => exportFeature.cancelExport(),
    onDelayInput: updateFlyinParams,
    onDistInput: updateFlyinParams,
    onExportPngClick: () => exportFeature.runPngExportFlow(),
    onExportVideoClick: () => exportFeature.runExportFlow(),
    onScatterInput: updateFlyinParams,
    onToggleCursor: handleToggleCursor,
    onToggleFlyin: handleToggleFlyin,
    onToggleHighlight: handleToggleHighlight,
    onToggleScanGlow: handleToggleScanGlow,
});

function saveLocalSettings() {
    const settings = {
        themeBg: defaultBgColor,
        themeNote: defaultNoteColor,
        showPlayline,
        showHighlights,
        showScanGlow,
        enableFlyin,
        distPercent: dom.distSlider ? dom.distSlider.value : "50",
        scatterPercent: dom.scatterSlider ? dom.scatterSlider.value : "50",
        delayPercent: dom.delaySlider ? dom.delaySlider.value : "50",
        glowRangePercent: dom.glowRangeSlider ? dom.glowRangeSlider.value : "50",
        playlineRatioPercent: dom.playlineRatioSlider ? dom.playlineRatioSlider.value : "50",
        stickyLockRatioPercent: dom.stickyLockRatioSlider ? dom.stickyLockRatioSlider.value : "50",
        musicFont: document.getElementById('musicFontSelect') ? document.getElementById('musicFontSelect').value : "Bravura",
        exportRatio: dom.exportRatioSelect ? dom.exportRatioSelect.value : "16:9",
        exportRes: dom.exportResSelect ? dom.exportResSelect.value : "1920",
        exportFps: dom.exportFpsSelect ? dom.exportFpsSelect.value : "60"
    };
    localStorage.setItem('scoreScrollSettings', JSON.stringify(settings));
}

function loadLocalSettings() {
    const saved = localStorage.getItem('scoreScrollSettings');
    if (!saved) return;
    try {
        const settings = JSON.parse(saved);

        // 1. 恢复布尔状态 (Show/Hide)
        if (typeof settings.showPlayline === 'boolean') showPlayline = settings.showPlayline;
        if (typeof settings.showHighlights === 'boolean') showHighlights = settings.showHighlights;
        if (typeof settings.showScanGlow === 'boolean') showScanGlow = settings.showScanGlow;
        if (typeof settings.enableFlyin === 'boolean') enableFlyin = settings.enableFlyin;

        // 2. 恢复颜色主题 (Dark/Light)
        if (settings.themeBg) defaultBgColor = settings.themeBg;
        if (settings.themeNote) defaultNoteColor = settings.themeNote;
        if (dom.bgColorPicker) dom.bgColorPicker.value = defaultBgColor;
        if (dom.noteColorPicker) dom.noteColorPicker.value = defaultNoteColor;
        document.documentElement.style.setProperty('--viewport-bg', defaultBgColor);
        document.documentElement.style.setProperty('--note-color', defaultNoteColor);

        // 3. 恢复滑块数值
        if (settings.distPercent && dom.distSlider) { dom.distSlider.value = settings.distPercent; dom.distVal.innerText = settings.distPercent; }
        if (settings.scatterPercent && dom.scatterSlider) { dom.scatterSlider.value = settings.scatterPercent; dom.scatterVal.innerText = settings.scatterPercent; }
        if (settings.delayPercent && dom.delaySlider) { dom.delaySlider.value = settings.delayPercent; dom.delayVal.innerText = settings.delayPercent; }

        if (settings.glowRangePercent && dom.glowRangeSlider) {
            dom.glowRangeSlider.value = settings.glowRangePercent;
            dom.glowRangeVal.innerText = settings.glowRangePercent;
            scanGlowRange = parseInt(settings.glowRangePercent, 10) * 2;
        }
        if (settings.playlineRatioPercent && dom.playlineRatioSlider) {
            dom.playlineRatioSlider.value = settings.playlineRatioPercent;
            dom.playlineRatioVal.innerText = settings.playlineRatioPercent;
            playlineRatio = parseInt(settings.playlineRatioPercent, 10) / 100;
        }
        if (settings.stickyLockRatioPercent && dom.stickyLockRatioSlider) {
            dom.stickyLockRatioSlider.value = settings.stickyLockRatioPercent;
            dom.stickyLockRatioVal.innerText = settings.stickyLockRatioPercent;
            stickyLockRatio = parseInt(settings.stickyLockRatioPercent, 10) / 100;
        }

        // 4. 恢复下拉菜单状态
        if (settings.musicFont && document.getElementById('musicFontSelect')) {
            document.getElementById('musicFontSelect').value = settings.musicFont;
            compileFontSignatures(settings.musicFont);
        }
        if (settings.exportRatio && dom.exportRatioSelect) dom.exportRatioSelect.value = settings.exportRatio;
        if (settings.exportRes && dom.exportResSelect) dom.exportResSelect.value = settings.exportRes;
        if (settings.exportFps && dom.exportFpsSelect) dom.exportFpsSelect.value = settings.exportFps;

    } catch (e) {
        console.warn('解析本地设置失败', e);
    }
}

window.onload = () => {
    loadLocalSettings();
    if (typeof handleExportResolutionChange === 'function') handleExportResolutionChange();
    if (typeof handleExportFpsChange === 'function') handleExportFpsChange();
    syncViewportSizingMode();
    resizeCanvas();
    applyOverlayVisibility();
    updateProgressUI(0);
};
