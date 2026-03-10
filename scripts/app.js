import {
    PREVIEW_BOTTOM_BUFFER_PX,
    PRIVATE_USE_GLYPH_REGEX,
    TIME_SIGNATURE_GLYPH_REGEX,
} from "./core/constants.js";
import { getDomRefs } from "./core/dom.js";
import { createInitialState } from "./core/state.js";
import { MusicFontRegistry } from "./data/music-font-registry.js";
import { createAudioFeature } from "./features/audio.js";
import { createExportVideoFeature } from "./features/export-video.js";
import { parseMidiData } from "./features/midi.js";
import {
    createPlaybackHelpers,
    PLAYBACK_SIMULATION_STEP_SEC,
} from "./features/playback.js";
import { bindUiEvents } from "./features/ui-events.js";
import { formatSeconds } from "./utils/format.js";
import { clamp } from "./utils/math.js";

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
    encodedChunks,
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
    isExportingVideo,
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
    stickyMinX,
    svgTags,
    videoEncoder,
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
    createPlaybackState,
    findCurrentIndexByTime,
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

zoomSliderContainer.addEventListener('input', (e) => {
    setGlobalZoom(parseFloat(e.target.value));
});

zoomOutBtn.addEventListener('click', () => {
    setGlobalZoom(globalZoom - 0.1);
});

zoomInBtn.addEventListener('click', () => {
    setGlobalZoom(globalZoom + 0.1);
});

// 🌟 音乐字体特征注册表 (Music Font Registry)
let activeSignatureMap = { clefs: {}, accidentals: {}, noteheads: {} };
let currentRawSvgContent = null; // 用于切换字体时热重载 SVG

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
    console.log(`🔤 音乐字体引擎已切换至: [${fontName}]，特征字典已编译！`);
}

// 默认加载 Default 字典
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

// 🌟 全局缓存：用于存储原生的五线谱绝对位置，以便在遮罩层重新绘制桥梁
window.globalAbsoluteStaffLineYs = [];
window.globalAbsoluteSystemInternalX = Infinity;

function buildRenderQueue(svgRoot) {
    renderQueue = [];
    globalStickyLanes = {};
    window.globalAbsoluteStaffLineYs = [];
    window.globalAbsoluteSystemInternalX = Infinity;
    if (!svgRoot) return;

    let domCounter = 0;
    svgRoot.querySelectorAll('*').forEach(el => el.dataset.domIndex = domCounter++);

    function getAbsoluteMatrix(el) {
        let ctm = el.getCTM();
        return ctm ? { a: ctm.a, b: ctm.b, c: ctm.c, d: ctm.d, e: ctm.e, f: ctm.f } : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    }

    function getAbsoluteXLimits(box, matrix) {
        const x1 = matrix.a * box.x + matrix.c * box.y + matrix.e;
        const x2 = matrix.a * (box.x + box.width) + matrix.c * box.y + matrix.e;
        const x3 = matrix.a * box.x + matrix.c * (box.y + box.height) + matrix.e;
        const x4 = matrix.a * (box.x + box.width) + matrix.c * (box.y + box.height) + matrix.e;
        return { minX: Math.min(x1, x2, x3, x4), maxX: Math.max(x1, x2, x3, x4) };
    }

    function getSymbolType(el) {
        if (el.classList.contains('highlight-instname')) return 'InstName';
        if (el.classList.contains('highlight-clef')) return 'Clef';
        if (el.classList.contains('highlight-keysig')) return 'KeySig';
        if (el.classList.contains('highlight-timesig')) return 'TimeSig';
        if (el.classList.contains('highlight-barline')) return 'Barline';
        if (el.classList.contains('highlight-brace')) return 'Brace';
        if (el.classList.contains('highlight-accidental')) return 'Accidental';
        return null;
    }

    // 🌟 提取真实描边粗细的工具函数
    function extractStrokeWidth(el) {
        const computedSW = window.getComputedStyle(el).strokeWidth;
        const attrSW = el.getAttribute('stroke-width');
        let lw = computedSW ? parseFloat(computedSW) : (attrSW ? parseFloat(attrSW) : 1);
        return (isNaN(lw) || lw <= 0) ? 1 : lw;
    }

    const lines = svgRoot.querySelectorAll('line, polyline');
    lines.forEach(el => {
        const fillRole = 'none';
        const strokeRole = el.dataset.roleStroke || 'fg';
        const lineWidth = extractStrokeWidth(el);
        const matrix = getAbsoluteMatrix(el);
        let box = { x: 0, y: 0, width: 0, height: 0 };
        try { box = el.getBBox(); } catch (e) {}
        const symbolType = getSymbolType(el);

        if (el.tagName.toLowerCase() === 'line') {
            const limits = getAbsoluteXLimits(box, matrix);
            const lx1 = parseFloat(el.getAttribute('x1')), ly1 = parseFloat(el.getAttribute('y1'));
            const lx2 = parseFloat(el.getAttribute('x2')), ly2 = parseFloat(el.getAttribute('y2'));
            if (Math.abs(ly1 - ly2) < 1 && Math.abs(lx1 - lx2) > 100) {
                window.globalAbsoluteStaffLineYs.push({ y: matrix.b * lx1 + matrix.d * ly1 + matrix.f, width: lineWidth * Math.abs(matrix.d || 1) });
            }
            renderQueue.push({
                type: 'line', domIndex: parseInt(el.dataset.domIndex) || 0,
                localX1: lx1, localY1: ly1, localX2: lx2, localY2: ly2,
                lineWidth: lineWidth, fillRole, strokeRole, matrix: matrix,
                absMinX: limits.minX, absMaxX: limits.maxX, symbolType: symbolType,
                centerY: limits.minX + (limits.maxX - limits.minX) / 2, ...getMathFlyinParams()
            });
        } else if (el.tagName.toLowerCase() === 'polyline') {
            const pointsStr = el.getAttribute('points');
            if (!pointsStr) return;
            const coords = pointsStr.trim().split(/\s+|,/).filter(n => n !== '').map(Number);
            if (coords.length < 4) return;
            const lx1 = coords[0], ly1 = coords[1], lx2 = coords[coords.length - 2], ly2 = coords[coords.length - 1];
            if (Math.abs(ly1 - ly2) < 1 && Math.abs(lx1 - lx2) > 100) {
                window.globalAbsoluteStaffLineYs.push({ y: matrix.b * lx1 + matrix.d * ly1 + matrix.f, width: lineWidth * Math.abs(matrix.d || 1) });
            }
            for (let i = 0; i < coords.length - 2; i += 2) {
                const ltx1 = coords[i], lty1 = coords[i + 1], ltx2 = coords[i + 2], lty2 = coords[i + 3];
                const tx1 = matrix.a * ltx1 + matrix.c * lty1 + matrix.e, tx2 = matrix.a * ltx2 + matrix.c * lty2 + matrix.e;
                renderQueue.push({
                    type: 'line', domIndex: parseInt(el.dataset.domIndex) || 0,
                    localX1: ltx1, localY1: lty1, localX2: ltx2, localY2: lty2,
                    lineWidth: lineWidth, fillRole, strokeRole, matrix: matrix,
                    absMinX: Math.min(tx1, tx2), absMaxX: Math.max(tx1, tx2),
                    symbolType: symbolType, centerY: matrix.b * ltx1 + matrix.d * lty1 + matrix.f, ...getMathFlyinParams()
                });
            }
        }
    });

    const rects = svgRoot.querySelectorAll('rect');
    rects.forEach(el => {
        let fillRole = el.dataset.roleFill;
        if (!fillRole) {
            let curr = el, fill = '';
            while (curr && curr !== svgRoot) {
                if (curr.hasAttribute('fill')) { fill = curr.getAttribute('fill').trim().toLowerCase().replace(/\s+/g, ''); break; }
                curr = curr.parentElement;
            }
            if (fill === '#ffffff' || fill === '#fff' || fill === 'white' || fill === 'rgb(255,255,255)') fillRole = 'bg';
            else if (fill === 'none' || fill === 'transparent') fillRole = 'none';
            else fillRole = 'fg';
        }
        const strokeRole = el.dataset.roleStroke || 'none';
        if (fillRole === 'none' && strokeRole === 'none') return;

        const matrix = getAbsoluteMatrix(el);
        let box = { x: 0, y: 0, width: 0, height: 0 };
        try { box = el.getBBox(); } catch (e) {}
        if (box.width === 0 && box.height === 0) {
            box.x = parseFloat(el.getAttribute('x')) || 0; box.y = parseFloat(el.getAttribute('y')) || 0;
            box.width = parseFloat(el.getAttribute('width')) || 0; box.height = parseFloat(el.getAttribute('height')) || 0;
        }

        const limits = getAbsoluteXLimits(box, matrix);
        renderQueue.push({
            type: 'rect', domIndex: parseInt(el.dataset.domIndex) || 0,
            localX: box.x, localY: box.y, width: box.width, height: box.height,
            fillRole, strokeRole, strokeWidth: extractStrokeWidth(el), matrix: matrix,
            absMinX: limits.minX, absMaxX: limits.maxX, symbolType: getSymbolType(el),
            centerY: matrix.b * box.x + matrix.d * (box.y + box.height/2) + matrix.f,
            centerX: limits.minX + (limits.maxX - limits.minX) / 2, ...getMathFlyinParams()
        });
    });

    const polygons = svgRoot.querySelectorAll('polygon');
    polygons.forEach(el => {
        const fillRole = el.dataset.roleFill || 'fg', strokeRole = el.dataset.roleStroke || 'none';
        if (fillRole === 'none' && strokeRole === 'none') return;
        const pointsStr = el.getAttribute('points');
        if (!pointsStr) return;
        const coords = pointsStr.trim().split(/\s+|,/).filter(n => n !== '').map(Number);
        if (coords.length < 6) return;

        const matrix = getAbsoluteMatrix(el);
        let box = { x: 0, y: 0, width: 0, height: 0 };
        try { box = el.getBBox(); } catch (e) {}
        if (box.width === 0 && box.height === 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (let i = 0; i < coords.length; i += 2) {
                if (coords[i] < minX) minX = coords[i]; if (coords[i] > maxX) maxX = coords[i];
                if (coords[i+1] < minY) minY = coords[i+1]; if (coords[i+1] > maxY) maxY = coords[i+1];
            }
            box = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }

        let d = `M ${coords[0]} ${coords[1]} `;
        for(let i = 2; i < coords.length; i += 2) d += `L ${coords[i]} ${coords[i+1]} `;
        d += 'Z';

        const limits = getAbsoluteXLimits(box, matrix);
        renderQueue.push({
            type: 'path', domIndex: parseInt(el.dataset.domIndex) || 0, path2D: new Path2D(d),
            fillRole, strokeRole, strokeWidth: extractStrokeWidth(el), matrix: matrix, originalD: d,
            absMinX: limits.minX, absMaxX: limits.maxX, symbolType: getSymbolType(el),
            centerY: matrix.b * box.x + matrix.d * (box.y + box.height/2) + matrix.f,
            centerX: limits.minX + (limits.maxX - limits.minX) / 2, ...getMathFlyinParams()
        });
    });

    const paths = svgRoot.querySelectorAll('path');
    paths.forEach(el => {
        const fillRole = el.dataset.roleFill || 'fg', strokeRole = el.dataset.roleStroke || 'none';
        if (fillRole === 'none' && strokeRole === 'none') return;
        const d = el.getAttribute('d');
        if (!d) return;

        const matrix = getAbsoluteMatrix(el);
        let box = { x: 0, y: 0, width: 0, height: 0 };
        try { box = el.getBBox(); } catch (e) {}
        const limits = getAbsoluteXLimits(box, matrix);

        renderQueue.push({
            type: 'path', domIndex: parseInt(el.dataset.domIndex) || 0, path2D: new Path2D(d),
            fillRole, strokeRole, strokeWidth: extractStrokeWidth(el), matrix: matrix, originalD: d,
            absMinX: limits.minX, absMaxX: limits.maxX, symbolType: getSymbolType(el),
            centerY: matrix.b * box.x + matrix.d * (box.y + box.height/2) + matrix.f,
            centerX: limits.minX + (limits.maxX - limits.minX) / 2, ...getMathFlyinParams()
        });
    });

    const texts = svgRoot.querySelectorAll('text');
    texts.forEach(el => {
        const textContent = el.textContent || '';
        if (textContent.includes('@')) return;

        const matrix = getAbsoluteMatrix(el);
        let box = { x: 0, y: 0, width: 0, height: 0 };
        try { box = el.getBBox(); } catch (e) {}
        const limits = getAbsoluteXLimits(box, matrix);
        const fontNode = el.closest('[font-size]') || el, familyNode = el.closest('[font-family]') || el, weightNode = el.closest('[font-weight]') || el;
        let fontSize = fontNode.getAttribute('font-size') || '16';
        if (!isNaN(fontSize)) fontSize = `${fontSize}px`;
        else if (!fontSize.includes('px') && !fontSize.includes('em')) fontSize = `${parseFloat(fontSize)}px`;

        renderQueue.push({
            type: 'text', domIndex: parseInt(el.dataset.domIndex) || 0, text: textContent,
            x: parseFloat(el.getAttribute('x')) || 0, y: parseFloat(el.getAttribute('y')) || 0,
            font: `${weightNode.getAttribute('font-weight') || 'normal'} ${fontSize} ${familyNode.getAttribute('font-family') || 'serif'}`,
            fillRole: el.dataset.roleFill || 'fg', strokeRole: 'none', strokeWidth: 0,
            matrix: matrix, absMinX: limits.minX, absMaxX: limits.maxX, symbolType: getSymbolType(el),
            centerY: matrix.b * box.x + matrix.d * (box.y + box.height/2) + matrix.f, box: box, ...getMathFlyinParams()
        });
    });

    // --- 五线谱去重与排挤聚类逻辑保持完全不变 ---
    if (window.globalAbsoluteStaffLineYs.length > 0) {
        window.globalAbsoluteStaffLineYs.sort((a, b) => a.y - b.y);
        const deduped = [];
        window.globalAbsoluteStaffLineYs.forEach(item => { if (deduped.length === 0 || Math.abs(item.y - deduped[deduped.length - 1].y) > 2) deduped.push(item); });
        const validStaffLines = [];
        for (let i = 0; i <= deduped.length - 5; i++) {
            const fiveLines = deduped.slice(i, i + 5);
            const gaps = [fiveLines[1].y - fiveLines[0].y, fiveLines[2].y - fiveLines[1].y, fiveLines[3].y - fiveLines[2].y, fiveLines[4].y - fiveLines[3].y];
            const sortedGaps = gaps.slice().sort((a, b) => a - b);
            const staffSpace = sortedGaps[Math.floor(sortedGaps.length / 2)] || 0;
            if (!(staffSpace > 0.5)) continue;
            if (Math.max(...gaps.map(gap => Math.abs(gap - staffSpace))) <= Math.max(1.25, staffSpace * 0.22)) validStaffLines.push(...fiveLines);
        }
        const finalCleanStaffLines = [];
        validStaffLines.forEach(item => { if (finalCleanStaffLines.length === 0 || Math.abs(item.y - finalCleanStaffLines[finalCleanStaffLines.length - 1].y) > 1) finalCleanStaffLines.push(item); });
        window.globalAbsoluteStaffLineYs = finalCleanStaffLines;
    }

    let initialBarlines = renderQueue.filter(item => item.symbolType === 'Barline');
    if (initialBarlines.length > 0) {
        const absoluteLeftmostBarlineX = Math.min(...initialBarlines.map(b => b.absMinX));
        const startCluster = initialBarlines.filter(b => b.absMinX <= absoluteLeftmostBarlineX + 30);
        window.globalAbsoluteSystemInternalX = Math.max(...startCluster.map(b => b.absMinX));
    } else {
        // 🌟 核心修复：当没有起始小节线时，不要归 0！
        // 而是直接继承之前算好的真实五线谱最左端点 (globalSystemInternalX)
        window.globalAbsoluteSystemInternalX = globalSystemInternalX || 0;
    }

    const stickyTypesMap = { 'InstName': 'inst', 'Clef': 'clef', 'KeySig': 'key', 'TimeSig': 'time', 'Barline': 'bar', 'Brace': 'brace' };
    const stickies = renderQueue.filter(item => item.symbolType && stickyTypesMap[item.symbolType]);
    const CLUSTER_THRESHOLD_X = 35;
    const globalLanes = [];

    // 🌟 终极重构：五线谱物理结界 + 谱号兜底
    const staffLineYs = window.globalAbsoluteStaffLineYs.map(l => l.y);
    const staffBands = buildTimeSignatureStaffBandsFromLineYs(staffLineYs);

    if (staffBands && staffBands.length > 0) {
        // 方案 A：基于真实的五线谱带划分多行
        staffBands.forEach((band, index) => {
            globalLanes.push({
                anchorY: (band.top + band.bottom) / 2,
                bandTop: band.paddedTop,
                bandBottom: band.paddedBottom,
                staffSpace: band.staffSpace, // 🌟 新增：把这行专属的线距存进口袋
                items: [],
                laneId: `lane-${index}`
            });
        });

        stickies.forEach(item => {
            let targetLane = null;
            // 优先严格匹配：元素的 centerY 是否落在这个五线谱带的结界范围内
            targetLane = globalLanes.find(lane => item.centerY >= lane.bandTop && item.centerY <= lane.bandBottom);

            // 如果没匹配上（比如悬浮在很高处的 8va 记号），降级寻找距离中心最近的谱表
            if (!targetLane) {
                let minDiff = Infinity;
                globalLanes.forEach(lane => {
                    const diff = Math.abs(lane.anchorY - item.centerY);
                    if (diff < minDiff) { minDiff = diff; targetLane = lane; }
                });
            }
            if (targetLane) targetLane.items.push(item);
        });
    } else {
        // 方案 B：兜底方案，尊重无五线谱线时的“一个谱号对应一行”逻辑
        const allClefs = stickies.filter(item => item.symbolType === 'Clef');
        if (allClefs.length > 0) {
            let minClefX = Math.min(...allClefs.map(c => c.absMinX));
            const systemClefs = allClefs.filter(c => c.absMinX <= minClefX + 250);

            // 收紧合并容差到 15px，防止多行被错误合并
            systemClefs.forEach(clef => {
                let foundLane = globalLanes.find(lane => Math.abs(lane.anchorY - clef.centerY) < 15);
                if (!foundLane) {
                    globalLanes.push({ anchorY: clef.centerY, items: [], laneId: `lane-${globalLanes.length}` });
                }
            });
        }

        if (globalLanes.length > 0) {
            stickies.forEach(item => {
                let targetLane = null;
                let minDiff = Infinity;
                globalLanes.forEach(lane => {
                    const diff = Math.abs(lane.anchorY - item.centerY);
                    if (diff < minDiff) { minDiff = diff; targetLane = lane; }
                });
                if (targetLane && minDiff < 200) targetLane.items.push(item);
            });
        }
    }

    let globalMinX = Infinity;
    globalLanes.forEach(lane => { lane.items.forEach(item => { if (stickyTypesMap[item.symbolType] === 'inst') return; if (item.absMinX < globalMinX) globalMinX = item.absMinX; }); });
    stickyMinX = (globalMinX === Infinity) ? 0 : globalMinX;

    globalLanes.forEach(lane => {
        const currentStaffSpace = lane.staffSpace || 10;
        const itemsByType = { inst: [], clef: [], key: [], time: [], bar: [], brace: [] };
        lane.items.forEach(item => itemsByType[stickyTypesMap[item.symbolType]].push(item));
        const typeBlocks = {};

        ['inst', 'clef', 'key', 'time', 'bar', 'brace'].forEach(type => {
            let items = itemsByType[type];
            if (items.length === 0) return;
            items.sort((a, b) => a.absMinX - b.absMinX);
            let currentBlock = { minX: items[0].absMinX, maxX: items[0].absMaxX, items: [items[0]] };
            let blocks = [];
            for (let i = 1; i < items.length; i++) {
                let item = items[i], lastItem = currentBlock.items[currentBlock.items.length - 1];
                if (item.absMinX - currentBlock.maxX < CLUSTER_THRESHOLD_X) {
                    currentBlock.items.push(item);
                    if (item.absMaxX > currentBlock.maxX) currentBlock.maxX = item.absMaxX;
                }
                else { currentBlock.width = currentBlock.maxX - currentBlock.minX; blocks.push(currentBlock); currentBlock = { minX: item.absMinX, maxX: item.absMaxX, items: [item] }; }
            }
            currentBlock.width = currentBlock.maxX - currentBlock.minX; blocks.push(currentBlock); typeBlocks[type] = blocks;
        });

        const baseWidths = { inst: 0, clef: 0, key: 0, time: 0, bar: 0, brace: 0 };
        ['inst', 'clef', 'key', 'time', 'bar', 'brace'].forEach(type => { if (typeBlocks[type] && typeBlocks[type].length > 0) { const firstBlock = typeBlocks[type][0]; if (firstBlock.minX <= stickyMinX + 200) baseWidths[type] = firstBlock.width; } });
        globalStickyLanes[lane.laneId] = { typeBlocks, baseWidths };

        ['inst', 'clef', 'key', 'time', 'bar', 'brace'].forEach(type => {
            if (!typeBlocks[type]) return;
            const anchorX = typeBlocks[type][0].minX;
            typeBlocks[type].forEach((block, index) => {
                const lockDistance = Math.max(0, block.minX - anchorX);
                let isMidClef = (type === 'clef' && index > 0);
                block.items.forEach(item => {
                    item.isSticky = true; item.stickyType = type; item.laneId = lane.laneId;
                    item.blockIndex = index; item.lockDistance = lockDistance; item.blockMinX = block.minX; item.blockCenterY = block.items[0].centerY;
                    item.isMidClef = isMidClef; item.midClefOffsetY = 0;
                    item.staffSpace = currentStaffSpace;
                    if (isMidClef && item.type === 'path' && item.originalD) {
                        const sigStr = item.originalD.replace(/[^a-zA-Z]/g, '').toUpperCase();
                        const specificType = identifyClefOrBrace(sigStr, item.originalD);
                        if (specificType && specificType.includes('Bass')) {
                            item.midClefOffsetY = currentStaffSpace * 0.3;
                        } else if (specificType && specificType.includes('Treble')) {
                            item.midClefOffsetY = -currentStaffSpace * 0.3;
                        }
                    }
                });
            });
        });
    });

    renderQueue.sort((a, b) => (a.domIndex || 0) - (b.domIndex || 0));
    console.log(`📦 内存数据库构建：已提取强分离指令 ${renderQueue.length} 条！`);
}

function renderCanvas(currentX) {
    if (!ctx || !canvas) return;

    const noteColor = noteColorPicker ? noteColorPicker.value : defaultNoteColor;
    const bgColor = bgColorPicker ? bgColorPicker.value : defaultBgColor;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 🌟 1. 核心数学重构：动态计算播放线在屏幕上的 X 像素坐标
    const playlineScreenX = cachedViewportWidth * playlineRatio;
    // 计算播放线左右两侧的物理世界距离
    const worldDistanceLeft = playlineScreenX / globalZoom;
    const worldDistanceRight = (cachedViewportWidth - playlineScreenX) / globalZoom;

    const logicalHeight = isExportingVideoMode ? canvas.height : viewportEl.clientHeight;
    const centerY = logicalHeight / 2;
    const scoreCenterY = window.globalScoreTrueCenterY || (globalScoreHeight / 2);

    // 可视范围边界重构
    const leftEdge = currentX - worldDistanceLeft - (100 / globalZoom);
    const rightEdge = currentX + worldDistanceRight + (100 / globalZoom);

    const SCREEN_STOP_MARGIN_PX = Math.max(40, Math.min(150, cachedViewportWidth * 0.06));
    const STOP_MARGIN = SCREEN_STOP_MARGIN_PX / globalZoom;

    // 🌟 吸附锚点重构：不再用 worldHalfWidth，而是用我们算出的左侧距离
    const maxStickySmoothX_initial = worldDistanceLeft + stickyMinX - STOP_MARGIN;

    const activeIdx = {}; const activeWidth = {}; const laneOffsets = {};

    const systemBaseWidths = { clef: 0, key: 0 };
    for (const laneId in globalStickyLanes) {
        const bw = globalStickyLanes[laneId].baseWidths;
        if (bw && bw.clef > systemBaseWidths.clef) systemBaseWidths.clef = bw.clef;
        if (bw && bw.key > systemBaseWidths.key) systemBaseWidths.key = bw.key;
    }

    const systemActiveWidths = { clef: 0, key: 0 };

    let maxStickyRightScreenX = 0; let shouldShowMask = false;

    for (const laneId in globalStickyLanes) {
        activeIdx[laneId] = { inst: -1, clef: -1, key: -1, time: -1, bar: -1, brace: -1 };
        activeWidth[laneId] = { inst: 0, clef: 0, key: 0, time: 0, bar: 0, brace: 0 };
        laneOffsets[laneId] = { clef: 0, key: 0 };
        const { typeBlocks, baseWidths } = globalStickyLanes[laneId];

        ['inst', 'clef', 'key', 'time', 'bar', 'brace'].forEach(type => {
            if (!typeBlocks[type]) return;
            typeBlocks[type].forEach((block, index) => {
                const lockDistance = Math.max(0, block.minX - typeBlocks[type][0].minX);
                const layerMaxX = maxStickySmoothX_initial + lockDistance;
                if (currentX >= layerMaxX) {
                    if (index > activeIdx[laneId][type]) {
                        activeIdx[laneId][type] = index;
                        activeWidth[laneId][type] = (type === 'clef' && index > 0) ? block.width * 1.5 : block.width;
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
        let delta = currentW - b;
        if (b === 0 && currentW > 0) delta += 15; else if (b > 0 && currentW === 0) delta -= 15;
        return delta;
    };

    const sysDeltaClef = calcSystemDelta('clef');
    const sysDeltaKey = calcSystemDelta('key');

    for (const laneId in globalStickyLanes) {
        laneOffsets[laneId].clef = sysDeltaClef;
        laneOffsets[laneId].key = sysDeltaKey;
    }

    const normalDrawList = []; const stickyDrawList = [];

    for (let i = 0; i < renderQueue.length; i++) {
        const item = renderQueue[i];
        let isPinned = false; let pinShiftX = 0; let targetOpacity = 1; let targetExtraX = 0; let targetScale = 1;

        if (item.isSticky) {
            const layerMaxX = maxStickySmoothX_initial + item.lockDistance;
            const currentActive = activeIdx[item.laneId][item.stickyType];
            if (item.blockIndex < currentActive) targetOpacity = 0;
            if (item.stickyType === 'key') targetExtraX = laneOffsets[item.laneId].clef;
            else if (item.stickyType === 'time') targetExtraX = laneOffsets[item.laneId].clef + laneOffsets[item.laneId].key;

            if (currentX >= layerMaxX) { isPinned = true; pinShiftX = currentX - layerMaxX; if (item.isMidClef) targetScale = 1.5; }
            if (item.blockIndex === currentActive) {
                if (layerMaxX - currentX < 300) shouldShowMask = true;
                const worldRightX = item.absMaxX + pinShiftX + targetExtraX + (item.absMaxX - item.blockMinX) * (targetScale - 1);
                // 🌟 重构：遮罩计算也基于播放线位置
                const screenRightX = (worldRightX - currentX) * globalZoom + playlineScreenX;
                if (screenRightX > maxStickyRightScreenX) maxStickyRightScreenX = screenRightX;
            }
        }

        if (item.currentOpacity === undefined) item.currentOpacity = 1;
        if (item.currentExtraX === undefined) item.currentExtraX = 0;
        if (item.currentScale === undefined) item.currentScale = 1;

        if (typeof isPlaying !== 'undefined' && isPlaying) {
            item.currentOpacity += (targetOpacity - item.currentOpacity) * 0.15;
            item.currentExtraX += (targetExtraX - item.currentExtraX) * 0.20;
            item.currentScale += (targetScale - item.currentScale) * 0.15;
        } else {
            item.currentOpacity = targetOpacity; item.currentExtraX = targetExtraX; item.currentScale = targetScale;
        }

        if (item.currentOpacity <= 0.01 && targetOpacity === 0) continue;
        if (!isPinned && (item.absMaxX < leftEdge || item.absMinX > rightEdge)) continue;

        const isPureBg = item.fillRole === 'bg' && (item.strokeRole === 'none' || item.strokeRole === 'bg');
        let drawColor = isPureBg ? bgColor : noteColor;

        if (showHighlights && item.symbolType) {
            if (['Clef', 'Brace', 'TimeSig', 'KeySig', 'Barline', 'InstName', 'TrueBarline'].includes(item.symbolType)) {
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

        const drawCmd = {
            item, drawColor, isPureBg,
            alpha: alpha * item.currentOpacity,
            tx: flyOffsetX + pinShiftX + item.currentExtraX,
            ty: flyOffsetY + ((item.midClefOffsetY || 0) * ((item.currentScale - 1) / 0.5)),
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

        const bgGradient = ctx.createLinearGradient(0, 0, maskW, 0);
        let r = 0, g = 0, b = 0;
        if (bgColor.startsWith('#') && bgColor.length === 7) { r = parseInt(bgColor.slice(1,3), 16); g = parseInt(bgColor.slice(3,5), 16); b = parseInt(bgColor.slice(5,7), 16); }
        bgGradient.addColorStop(0, `rgba(${r},${g},${b},1)`); if (fadeStart > 0) bgGradient.addColorStop(fadeStart / maskW, `rgba(${r},${g},${b},1)`); bgGradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = bgGradient; ctx.fillRect(0, 0, maskW, canvas.height);

        if (window.globalAbsoluteStaffLineYs && window.globalAbsoluteStaffLineYs.length > 0) {
            ctx.save();
            // 🌟 五线谱桥梁连接线起点：改为距离播放线左侧的运算
            const worldMaskLeft = currentX - worldDistanceLeft;
            const worldMaskRight = worldMaskLeft + (maskW / globalZoom);
            const lineGradient = ctx.createLinearGradient(worldMaskLeft, 0, worldMaskRight, 0);
            let nr = 255, ng = 255, nb = 255;
            if (noteColor.startsWith('#') && noteColor.length === 7) { nr = parseInt(noteColor.slice(1,3), 16); ng = parseInt(noteColor.slice(3,5), 16); nb = parseInt(noteColor.slice(5,7), 16); }
            lineGradient.addColorStop(0, `rgba(${nr},${ng},${nb},1)`); if (fadeStart > 0) lineGradient.addColorStop(fadeStart / maskW, `rgba(${nr},${ng},${nb},1)`); lineGradient.addColorStop(1, `rgba(${nr},${ng},${nb},0)`);

            ctx.translate(playlineScreenX, centerY); // 🌟 锚点跟随
            ctx.scale(globalZoom, globalZoom);
            ctx.translate(-currentX, -scoreCenterY);
            let maskPinShiftX = currentX > maxStickySmoothX_initial ? currentX - maxStickySmoothX_initial : 0;
            const bridgeStartX = window.globalAbsoluteSystemInternalX + maskPinShiftX;

            if (worldMaskRight > bridgeStartX) {
                ctx.beginPath();
                window.globalAbsoluteStaffLineYs.forEach(line => { ctx.moveTo(bridgeStartX, line.y); ctx.lineTo(worldMaskRight, line.y); });
                ctx.strokeStyle = lineGradient; ctx.lineWidth = window.globalAbsoluteStaffLineYs[0].width || 1; ctx.stroke();
            }
            ctx.restore();
        }
        ctx.restore();
    }

    ctx.save();
    ctx.translate(playlineScreenX, centerY); // 🌟 吸附音符锚点跟随
    ctx.scale(globalZoom, globalZoom);
    ctx.translate(-currentX, -scoreCenterY);
    executeDrawList(stickyDrawList);
    ctx.restore();

    if (typeof showPlayline !== 'undefined' && showPlayline) {
        ctx.globalAlpha = 1; ctx.save(); ctx.beginPath();
        // 🌟 实体播放线重构：画在你滑块选择的位置
        ctx.moveTo(playlineScreenX, 0); ctx.lineTo(playlineScreenX, canvas.height);
        ctx.lineWidth = 2; ctx.strokeStyle = noteColor; ctx.shadowBlur = 15; ctx.shadowColor = noteColor; ctx.stroke(); ctx.restore();
    }
}

function syncViewportHeight() {
//     if (!viewportEl) return;
//     const rootStyles = document.defaultView.getComputedStyle(document.documentElement);
//     const scoreTopPx = Number.parseFloat(rootStyles.getPropertyValue('--score-top')) || 48;
//
//     // 🌟 修复：把 * globalZoom 加回来！让容器跟随乐谱一起伸缩，防止上下被裁切
//     const targetHeight = Math.max(400, Math.ceil(globalScoreHeight * globalZoom + scoreTopPx + PREVIEW_BOTTOM_BUFFER_PX));
//
//     viewportEl.style.height = `${targetHeight}px`;
    return;
}

function resizeCanvas() {
    if (!canvas || !viewportEl) return;
    syncViewportHeight();
    // 获取视窗的物理像素尺寸
    const rect = viewportEl.getBoundingClientRect();
    // 获取设备的物理像素与独立像素比例 (DPR)
    const dpr = window.devicePixelRatio || 1;

    // 设置 Canvas 内部实际渲染分辨率 (放大)
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // 设置 Canvas 在屏幕上显示的 CSS 尺寸 (缩回原大小)
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // 归一化坐标系
    ctx.scale(dpr, dpr);

    // 更新全局缓存宽度
    cachedViewportWidth = rect.width;

    // 🌟 核心修复：Canvas 尺寸一旦改变就会被系统强制清空，所以我们立刻补画当前帧
    if (typeof renderCanvas === 'function') {
        renderCanvas(smoothX);
    }
}

function preprocessSvgColors(svgNode) {
    // 🌟 智能检测是否为“背景遮罩色”（兼容纯白、极其接近白色的米灰/纸色）
    const isBgColor = (c) => {
        if (!c) return false;
        c = c.toLowerCase().replace(/\s+/g, '');
        if (['none', 'transparent', 'rgba(0,0,0,0)', ''].includes(c)) return false;
        if (c === '#ffffff' || c === '#fff' || c === 'white') return true;
        if (c.startsWith('#') && c.length >= 7) {
            const r = parseInt(c.slice(1,3), 16), g = parseInt(c.slice(3,5), 16), b = parseInt(c.slice(5,7), 16);
            if (r > 240 && g > 240 && b > 240) return true; // 宽容处理 Dorico 的浅色纸张
        }
        if (c.startsWith('rgb')) {
            const match = c.match(/[\d.]+/g);
            if (match && match.length >= 3 && match[0] > 240 && match[1] > 240 && match[2] > 240) return true;
        }
        return false;
    };

    const isNoneColor = (c) => {
        if (!c) return true;
        c = c.toLowerCase().replace(/\s+/g, '');
        return ['none', 'transparent', 'rgba(0,0,0,0)', ''].includes(c);
    };

    svgNode.querySelectorAll('*').forEach(el => {
        if (el.tagName.toLowerCase() === 'style') return;

        const computedStyle = window.getComputedStyle(el);
        const fillOpacity = el.getAttribute('fill-opacity');
        const opacity = el.getAttribute('opacity');

        if (computedStyle.opacity === '0' || fillOpacity === '0' || opacity === '0' || computedStyle.display === 'none') {
            el.dataset.roleFill = 'none';
            el.dataset.roleStroke = 'none';
            return;
        }

        // 溯源 Fill
        let fill = '';
        let currFill = el;
        while (currFill && currFill !== svgNode) {
            if (currFill.hasAttribute('fill')) { fill = currFill.getAttribute('fill'); break; }
            currFill = currFill.parentElement;
        }
        if (!fill) fill = computedStyle.fill;

        if (isBgColor(fill)) el.dataset.roleFill = 'bg';
        else if (isNoneColor(fill)) el.dataset.roleFill = 'none';
        else el.dataset.roleFill = 'fg';

        // 溯源 Stroke
        let stroke = '';
        let currStroke = el;
        while (currStroke && currStroke !== svgNode) {
            if (currStroke.hasAttribute('stroke')) { stroke = currStroke.getAttribute('stroke'); break; }
            currStroke = currStroke.parentElement;
        }
        if (!stroke) stroke = computedStyle.stroke;

        if (isBgColor(stroke)) el.dataset.roleStroke = 'bg';
        else if (isNoneColor(stroke)) el.dataset.roleStroke = 'none';
        else el.dataset.roleStroke = 'fg';
    });
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
        generateManualTempoMap();
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

        console.log(`🎵 解析到全局变速事件：共 ${globalMidiTempos.length} 处速度变化`);

        isMidiLoaded = true;
        bpmSlider.disabled = true;
        bpmSlider.style.opacity = "0.3";
        tempoSourceHint.innerText = "MODE: MIDI AUTO-TEMPO";
        tempoSourceHint.style.color = "#00ffcc";

        // 调用刚刚分离出的计算函数
        if (svgTags && svgTags.length > 0) {
            recalculateMidiTempoMap();
        } else {
            console.log("⏳ MIDI 已就绪，等待 SVG 乐谱导入后进行时空映射...");
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
    let result = activeSignatureMap.clefs[sig] || null;

    // 🌟 跨界捞人：如果当前字体没认出，去 Bravura 字典里兜底查一下
    if (!result && MusicFontRegistry['Bravura'] && MusicFontRegistry['Bravura'].clefs) {
        for (const [symbolName, signatures] of Object.entries(MusicFontRegistry['Bravura'].clefs)) {
            if (signatures.includes(sig)) {
                result = symbolName;
                break;
            }
        }
    }

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
                // 💡 打击乐谱号单条竖线：极度瘦高，高度通常是宽度的 5 倍以上
                if (width > 0.5 && height < width * 5) {
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
    return activeSignatureMap.accidentals[sig] || null;
}

/**
 * 3. 音符头识别器 (已接入字体框架)
 */
function identifyNotehead(sig) {
    return activeSignatureMap.noteheads[sig] || null;
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
        console.log(`🤖 [智能嗅探] 发现目标字体: ${detectedFont} (出现 ${maxCount} 次)`);

        const selectEl = document.getElementById('musicFontSelect');
        // 如果当前下拉菜单不是检测到的字体，自动帮用户切换并重新编译字典
        if (selectEl.value !== detectedFont) {
            selectEl.value = detectedFont;
            compileFontSignatures(detectedFont);
            console.log(`🔤 引擎已自动挂载 [${detectedFont}] 特征字典！`);
        }
    } else {
        console.log('⚠️ [智能嗅探] 未在 SVG 中明确找到已注册的音乐字体，将保持当前选择。');
    }
}

// 提取出的公共方法：处理 SVG 文本
function processSvgContent(svgContent) {
    const sandbox = document.getElementById('svg-sandbox');
    sandbox.innerHTML = svgContent;

    const newSvgRoot = sandbox.querySelector('svg');
    if (!newSvgRoot) return;

    // 清理旧样式
    document.querySelectorAll('.svg-extracted-style').forEach(el => el.remove());

    const styles = newSvgRoot.querySelectorAll('style');
    styles.forEach(style => {
        const newStyle = document.createElement('style');
        newStyle.textContent = style.textContent;
        newStyle.className = 'svg-extracted-style';
        document.head.appendChild(newStyle);
    });

    document.fonts.ready.then(() => {
        if (!isPlaying && typeof renderCanvas === 'function') renderCanvas(smoothX);
    });

    preprocessSvgColors(newSvgRoot);

    const originalQuerySelector = document.querySelector.bind(document);
    document.querySelector = function(selector) {
        if (selector === '#score-container svg') return newSvgRoot;
        return originalQuerySelector(selector);
    };

    // 执行所有雷达扫描
    if (typeof identifyAndHighlightClefs === 'function') identifyAndHighlightClefs();
    if (typeof identifyAndHighlightInitialBarlines === 'function') identifyAndHighlightInitialBarlines();
    if (typeof identifyAndHighlightGeometricBrackets === 'function') identifyAndHighlightGeometricBrackets();
    if (typeof identifyAndHighlightInstrumentNames === 'function') identifyAndHighlightInstrumentNames();
    if (typeof identifyAndHighlightKeySignatures === 'function') identifyAndHighlightKeySignatures();
    if (typeof identifyAndHighlightTimeSignatures === 'function') identifyAndHighlightTimeSignatures();
    if (typeof identifyAndHighlightAccidentals === 'function') identifyAndHighlightAccidentals();

    document.querySelector = originalQuerySelector;

    buildRenderQueue(newSvgRoot);
    initScoreMapping(newSvgRoot);

    if (!isMidiLoaded && svgTags.length > 0) {
        generateManualTempoMap();
    } else if (isMidiLoaded && svgTags.length > 0) {
        recalculateMidiTempoMap();
    } else {
        smoothX = 0;
        updateProgressUI(0);
    }

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
    globalScoreHeight = svgRect.height;
    sandbox.innerHTML = ''; // 销毁沙盒

    resizeCanvas();
    renderCanvas(smoothX);
}

// 改造你的文件上传监听器
document.getElementById('svgInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        currentRawSvgContent = e.target.result; // 保存原文用于热重载
        autoDetectMusicFont(currentRawSvgContent);
        processSvgContent(currentRawSvgContent);
    };
    reader.readAsText(file);
});

// 🌟 监听下拉菜单：切换字体时自动重编译字典，并热重载当前 SVG
document.getElementById('musicFontSelect').addEventListener('change', (e) => {
    const fontName = e.target.value;
    compileFontSignatures(fontName);

    // 如果舞台上已经有乐谱，一键重新扫描
    if (currentRawSvgContent) {
        console.log("🔄 检测到字体库变更，正在热重载并重新扫描当前乐谱...");
        processSvgContent(currentRawSvgContent);
    }
});

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
            staffSpace: curr.staffSpace,
            paddedTop: absoluteTop,
            paddedBottom: absoluteBottom
        });
    }

    return staffBands;
}

function identifyAndHighlightClefs() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;

    let foundCount = 0;
    const mainClefElements = []; // 🌟 用来记录被识别出的主谱号实体

    // --- 1. 常规 Path 谱号扫描 ---
    svgRoot.querySelectorAll('path').forEach(path => {
        const d = path.getAttribute('d');
        const sig = d.replace(/[^a-zA-Z]/g, '').toUpperCase();
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
        const char = (textEl.textContent || '').trim();
        if (!char) return;
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

    console.log(`✅ 谱号扫描完毕：主谱号 ${foundCount} 个，绑定游离八度修饰符 ${adoptedCount} 个。`);
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

function identifyAndHighlightInitialBarlines() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;
    globalSystemBarlineScreenX = 0;

    const lines = svgRoot.querySelectorAll('polyline, line');
    let staffLeftEdges = [];
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

        if (Math.abs(y1 - y2) < 1) {
            staffLeftEdges.push(Math.min(x1, x2));
        } else if (Math.abs(x1 - x2) < 1) {
            verticalLines.push({ element: line, x: x1, height: Math.abs(y1 - y2) });
        }
    });

    if (staffLeftEdges.length === 0) return;

    const absoluteLeftEdge = Math.min(...staffLeftEdges);

    // 🌟 1. 寻找系统最左侧的谱号 (Clef) 作为视觉锚点
    let leftmostClefX = Infinity;
    svgRoot.querySelectorAll('.highlight-clef').forEach(clef => {
        try {
            let box = clef.getBBox();
            let ctm = clef.getCTM();
            if (ctm) {
                const x1 = ctm.a * box.x + ctm.c * box.y + ctm.e;
                const x2 = ctm.a * (box.x + box.width) + ctm.c * box.y + ctm.e;
                const minX = Math.min(x1, x2);
                if (minX < leftmostClefX) leftmostClefX = minX;
            } else {
                if (box.x < leftmostClefX) leftmostClefX = box.x;
            }
        } catch(e) {}
    });

    // 🌟 2. 过滤有效垂直线（剔除短促的符干，保留高度 >= 8 的潜在小节线）
    let validVerticals = verticalLines.filter(vLine => vLine.height >= 8);

    let trueBarlineX = null;
    let trueBarlineScreenX = null;
    let foundCount = 0;

    if (validVerticals.length > 0) {
        let absoluteLeftmostV = Math.min(...validVerticals.map(v => v.x));
        let startCluster = validVerticals.filter(vLine => vLine.x <= absoluteLeftmostV + 30);

        // 🌟 3. 核心判定：这根最左边的线是不是“起手小节线”？
        // 如果它在谱号的右边很远（说明这只是第一小节的结束线），那我们就认为这是一张没有起手小节线的谱子！
        if (leftmostClefX === Infinity || absoluteLeftmostV <= leftmostClefX + 20) {
            let rightmostLine = startCluster.reduce((prev, current) => (prev.x > current.x) ? prev : current);
            trueBarlineX = rightmostLine.x;
            trueBarlineScreenX = rightmostLine.element.getBoundingClientRect().left;

            startCluster.forEach(vLine => {
                vLine.element.classList.add('highlight-barline');
                foundCount++;
            });
        }
    }

    if (trueBarlineX !== null) {
        globalSystemInternalX = trueBarlineX;
    } else {
        if (leftmostClefX !== Infinity) {
            const STAFF_START_OFFSET = -4;
            globalSystemInternalX = leftmostClefX + STAFF_START_OFFSET;
        } else {
            globalSystemInternalX = absoluteLeftEdge;
        }
    }

    globalSystemBarlineScreenX = trueBarlineScreenX !== null
        ? trueBarlineScreenX
        : projectSvgInternalXToScreenX(svgRoot, globalSystemInternalX);

    console.log(`✅ 开头小节线扫描完毕，共点亮 ${foundCount} 根！起点 X 已纠正为：${globalSystemInternalX}`);
}

function identifyAndHighlightGeometricBrackets() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;
    if (!(globalSystemInternalX > 0)) return;

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

        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        const leftX = Math.min(x1, x2);
        const rightX = Math.max(x1, x2);
        const topY = Math.min(y1, y2);
        const bottomY = Math.max(y1, y2);

        if (dx <= 1.5 && dy > 1) {
            segments.push({
                element: el,
                kind: 'vertical',
                x: (x1 + x2) / 2,
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
                y: (y1 + y2) / 2,
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
        console.log(`✅ 几何方括号扫描完毕，共点亮 ${foundCount} 组。`);
    }
}

function identifyAndHighlightInstrumentNames() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;
    if (!(globalSystemBarlineScreenX > 0)) return;

    const textElements = svgRoot.querySelectorAll('text');
    let foundCount = 0;

    textElements.forEach(el => {
        const content = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!content) return;
        if (content.includes('@')) return;
        if (PRIVATE_USE_GLYPH_REGEX.test(content)) return;
        if (TIME_SIGNATURE_GLYPH_REGEX.test(content)) return;

        const textRect = el.getBoundingClientRect();
        if (!(textRect.width > 0)) return;

        if (textRect.right < globalSystemBarlineScreenX - 2) {
            el.classList.add('highlight-instname');
            foundCount++;
        }
    });

    console.log(`✅ 乐器名扫描完毕，共标记 ${foundCount} 个左侧文本。`);
}

function isTimeSignatureTextRectInsideStaffBands(textRect, staffBands, isGiant = false) {
    if (!textRect || !Array.isArray(staffBands) || staffBands.length === 0) return false;

    // 🌟 核心修复 1：如果是跨行大拍号，放宽判定条件！
    // 只要它的上下边界没有跑出整个“大谱表系统”的范围就算数，允许它的中心点悬空在两行谱子中间
    if (isGiant) {
        const globalTop = Math.min(...staffBands.map(b => b.paddedTop));
        const globalBottom = Math.max(...staffBands.map(b => b.paddedBottom));
        return textRect.bottom >= globalTop && textRect.top <= globalBottom;
    }

    // 正常的普通小拍号，依然严格要求中心点必须落在单行五线谱内部
    const centerY = (textRect.top + textRect.bottom) / 2;
    return staffBands.some(band => centerY >= band.paddedTop && centerY <= band.paddedBottom);
}

// 🌟 拍号雷达扫描器 (终极防御版：防孤立数字、防谱外、防远离小节线)
function identifyAndHighlightTimeSignatures() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;

    const staffLineYs = [];
    const verticalLineXs = [];

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
            if (lineRect.width > 24) staffLineYs.push((lineRect.top + lineRect.bottom) / 2);
        } else if (Math.abs(x1 - x2) <= 1.5 && Math.abs(y1 - y2) > 10) {
            verticalLineXs.push((lineRect.left + lineRect.right) / 2);
        }
    });

    const staffBands = buildTimeSignatureStaffBandsFromLineYs(staffLineYs);
    const textElements = Array.from(svgRoot.querySelectorAll('text, tspan'));

    const extendedGiantTimeSigs = [
        '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', ''
    ];

    // 🌟 第一步：收集所有可能成为拍号的候选人
    const candidates = [];
    textElements.forEach(el => {
        // 👇 🛡️ 新增防御 1：如果是已经被识别为乐器名、谱号修饰符的文本，直接踢出！
        if (el.classList.contains('highlight-instname') || el.classList.contains('highlight-clef')) return;

        const content = (el.textContent || '').trim();
        if (!content) return;

        const isPureNumber = /^[0-9]+$/.test(content);
        const isStandardTimeSig = TIME_SIGNATURE_GLYPH_REGEX.test(content);
        const isSibeliusGiant = content.split('').every(char => extendedGiantTimeSigs.includes(char));

        if (isPureNumber || isStandardTimeSig || isSibeliusGiant) {
            // 👇 🛡️ 新增防御 2：拍号绝对不可能出现在物理小节线的最左侧（边距外）！
            const rect = el.getBoundingClientRect();
            if (globalSystemBarlineScreenX > 0 && rect.right < globalSystemBarlineScreenX - 5) {
                return; // 如果这个数字完全在小节线左边，它绝对是声部编号，杀掉！
            }

            candidates.push({
                el, content, isPureNumber, isStandardTimeSig, isSibeliusGiant,
                rect: rect
            });
        }
    });

    let foundCount = 0;
    let rejectedOutsideStaffCount = 0;
    let rejectedFarFromBarlineCount = 0;
    let rejectedSolitaryCount = 0; // 🌟 新增：记录被杀掉的孤立伪装者

    // 🌟 第二步：对候选人进行严格的交叉审查
    candidates.forEach(candidate => {
        const { el, isPureNumber, isStandardTimeSig, isSibeliusGiant, rect } = candidate;

        // 🛡️ 核心修复：孤立纯数字拦截器 (必须有上下对应的数字才是真拍号)
        // 注意：C4/4拍(Common time)等标准符号，以及 Sibelius 的私有大拍号不受此限制
        if (isPureNumber && !isStandardTimeSig && !isSibeliusGiant) {
            const hasPartner = candidates.some(other => {
                if (other === candidate) return false;
                if (!other.isPureNumber) return false;

                const dx = Math.abs(rect.left - other.rect.left);
                const dy = Math.abs(rect.top - other.rect.top);

                // 认亲条件：X 轴左右对齐(偏差<15px)，且 Y 轴有明显的上下分离(5px < dy < 100px)
                return dx < 5 && dy > 0 && dy < 5;
            });

            if (!hasPartner) {
                rejectedSolitaryCount++;
                return; // 杀掉！这就是多小节休止符或者框框里的小节号
            }
        }

        const isGiantText = isSibeliusGiant || rect.height > 80;

        // 🛡️ 校验一：垂直 Y 轴必须在五线谱内
        if (staffBands.length > 0 && !isTimeSignatureTextRectInsideStaffBands(rect, staffBands, isGiantText)) {
            rejectedOutsideStaffCount++;
            return;
        }

        // 🛡️ 校验二：水平 X 轴必须靠近小节线 OR 靠近五线谱起点
        let isNearBarline = false; // 默认改为 false，我们需要明确匹配成功

// 1. 检查物理小节线
        if (verticalLineXs.length > 0) {
            isNearBarline = verticalLineXs.some(barX => {
                const dx = rect.left - barX;
                return dx >= -30 && dx <= 200;
            });
        }

// 2. 🌟 核心修复：如果没匹配到物理线，检查是否靠近五线谱物理起点
        if (!isNearBarline && typeof globalSystemInternalX !== 'undefined') {
            // 将 globalSystemInternalX 转换为屏幕坐标进行对比
            const staffStartX = projectSvgInternalXToScreenX(svgRoot, globalSystemInternalX);
            const dxToStart = rect.left - staffStartX;

            // 如果拍号在五线谱开头往右 250px 范围内，判定为合法拍号
            if (dxToStart >= -10 && dxToStart <= 250) {
                isNearBarline = true;
            }
        }

        el.classList.add('highlight-timesig');
        foundCount++;
    });

    console.log(`✅ 拍号扫描：点亮 ${foundCount} 个 | 排除孤立数字 ${rejectedSolitaryCount} 个 | 排除谱外 ${rejectedOutsideStaffCount} 个 | 远离小节线 ${rejectedFarFromBarlineCount} 个。`);
}

function identifyAndHighlightKeySignatures() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;

    let count = 0;

    // --- 1. Path 变音记号扫描 ---
    svgRoot.querySelectorAll('path').forEach(path => {
        const d = path.getAttribute('d');
        if (!d) return;
        const sig = d.replace(/[^a-zA-Z]/g, '').toUpperCase();
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
        const char = (textEl.textContent || '').trim();
        if (!char) return;
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

    console.log(`📡 变音记号初筛完成，共标记 ${count} 个候选。`);
}

function identifyAndHighlightAccidentals() {
    const svgRoot = document.querySelector('#score-container svg');
    if (!svgRoot) return;

    const horizontalYs = [];
    svgRoot.querySelectorAll('polyline, line').forEach(line => {
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
            x1 = coords[0];
            y1 = coords[1];
            x2 = coords[coords.length - 2];
            y2 = coords[coords.length - 1];
        }

        if (Math.abs(y1 - y2) < 1) {
            horizontalYs.push(y1);
        }
    });

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

    const staffBands = buildTimeSignatureStaffBandsFromLineYs(horizontalYs);
    const noteheads = [];

    // 原来的 path 音符头扫描
    svgRoot.querySelectorAll('path').forEach(path => {
        const d = path.getAttribute('d');
        if (!d) return;
        const sig = d.replace(/[^a-zA-Z]/g, '').toUpperCase();
        if (!identifyNotehead(sig)) return;
        const rect = path.getBoundingClientRect();
        noteheads.push({
            left: rect.left,
            right: rect.right,
            centerY: rect.top + rect.height / 2
        });
    });

    // 🌟 新增的 Text 音符头扫描
    svgRoot.querySelectorAll('text, tspan').forEach(textEl => {
        const char = (textEl.textContent || '').trim();
        if (!char) return;
        if (!identifyNotehead(char)) return;
        const rect = textEl.getBoundingClientRect();
        noteheads.push({
            left: rect.left,
            right: rect.right,
            centerY: rect.top + rect.height / 2
        });
    });

    const accidentalCandidates = [];
    svgRoot.querySelectorAll('.highlight-keysig').forEach((path, index) => {
        const rect = path.getBoundingClientRect();
        accidentalCandidates.push({
            id: `candidate-${index}`,
            element: path,
            left: rect.left,
            right: rect.right,
            centerY: rect.top + rect.height / 2
        });
    });

    const infectedIds = propagateAccidentalContagion(
        accidentalCandidates,
        noteheads,
        staffBands,
        staffSpace
    );

    let accidentalCount = 0;
    accidentalCandidates.forEach(candidate => {
        if (!infectedIds.has(candidate.id)) return;
        candidate.element.classList.remove('highlight-keysig');
        candidate.element.classList.add('highlight-accidental');
        accidentalCount++;
    });

    const { finalKeySignatureCount, finalAccidentalCount } = getFinalAccidentalDisplayCounts(svgRoot);
    console.log(`🎯 变音记号识别完成：最终调号 ${finalKeySignatureCount} 个，最终临时记号 ${finalAccidentalCount} 个。`);
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

function propagateAccidentalContagion(accidentals, noteheads, staffBands, staffSpace) {
    const normalizedStaffSpace = Math.max(1, Number.isFinite(staffSpace) ? staffSpace : 10);
    const bands = Array.isArray(staffBands) ? staffBands : [];
    const seedDxMin = -normalizedStaffSpace * 0.6;
    const seedDxMax = normalizedStaffSpace * 2.6;
    const seedDyMax = normalizedStaffSpace * 1.2;
    const spreadGapMax = Math.max(2, normalizedStaffSpace * 1.15);
    const spreadDyMax = Math.max(2, normalizedStaffSpace * 1.35);

    const resolveBandIndex = (centerY) => {
        for (let i = 0; i < bands.length; i++) {
            const band = bands[i];
            const top = Number.isFinite(band.paddedTop) ? band.paddedTop : band.top;
            const bottom = Number.isFinite(band.paddedBottom) ? band.paddedBottom : band.bottom;
            if (!Number.isFinite(top) || !Number.isFinite(bottom)) continue;
            if (centerY >= top && centerY <= bottom) return i;
        }
        return -1;
    };

    const normalizedAccidentals = (Array.isArray(accidentals) ? accidentals : []).map((item, index) => ({
        ...item,
        _id: item.id || `acc-${index}`,
        bandIndex: resolveBandIndex(item.centerY)
    }));

    const normalizedNotes = (Array.isArray(noteheads) ? noteheads : []).map((item, index) => ({
        ...item,
        _id: item.id || `note-${index}`,
        bandIndex: resolveBandIndex(item.centerY)
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

// 🌟 辅助：拍号解析器，将视觉拍号转化为数学比例
function extractTimeSignatures(queue) {
    const tsItems = queue.filter(item => item.symbolType === 'TimeSig' && item.type === 'text');
    const groups = [];

    // 1. 按 X 坐标聚类（把上下叠在一起的分子分母抓到同一组）
    tsItems.forEach(item => {
        let found = groups.find(g => Math.abs(g.x - item.absMinX) < 30);
        if (!found) {
            found = { x: item.absMinX, items: [] };
            groups.push(found);
        }
        found.items.push(item);
    });

    const timeSigs = [];
    const puaToNum = {
        // Sibelius 私有大拍号
        '':0, '':1, '':2, '':3, '':4, '':5, '':6, '':7, '':8, '':9,
        '':0, '':1, '':2, '':3, '':4, '':5, '':6, '':7, '':8, '':9,
        // 🌟 新增：SMuFL 标准音乐字体拍号 (Bravura, Petaluma, Leland 等通用)
        '':0, '':1, '':2, '':3, '':4, '':5, '':6, '':7, '':8, '':9
    };

    // 2. 解析每一组的分子和分母
    groups.forEach(g => {
        g.items.sort((a, b) => a.centerY - b.centerY);
        const chars = g.items.map(i => i.text.trim()).filter(t => t);
        if (chars.length === 0) return;

        let num = 4, den = 4;
        const joined = chars.join('');

        const isCommonTime = ['C', 'c', ''].includes(joined) || joined.includes('\uE08A');

        // 🌟 加固：拦截 2/2 拍 (Cut Time / Alla Breve)
        // 包含：美分符号 ¢, SMuFL 标准字符 (U+E08B)
        const isCutTime = ['¢', ''].includes(joined) || joined.includes('\uE08B');

        if (isCommonTime) {
            timeSigs.push({x: g.x, num: 4, den: 4});
            return;
        }
        if (isCutTime) {
            timeSigs.push({x: g.x, num: 2, den: 2});
            return;
        }

        const parsedNumbers = [];
        chars.forEach(charStr => {
            let val = '';
            for(let i = 0; i < charStr.length; i++) {
                const c = charStr[i];
                if (/[0-9]/.test(c)) val += c;
                else if (puaToNum[c] !== undefined) val += puaToNum[c];
            }
            if (val.length > 0) parsedNumbers.push(parseInt(val, 10));
        });

        if (parsedNumbers.length >= 2) {
            num = parsedNumbers[0]; den = parsedNumbers[1];
        } else if (parsedNumbers.length === 1) {
            num = parsedNumbers[0]; den = 4;
        } else { return; }

        timeSigs.push({ x: g.x, num, den });
    });

    timeSigs.sort((a, b) => a.x - b.x);
    return timeSigs;
}

// 🌟 1. 终极网格划分：加入防伪基准线与双线缝合的 Tick 映射
function initScoreMapping(svgRoot) {
    if (!svgRoot) return;
    svgTags = [];

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
        if (identifyNotehead(sig)) {
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

    // --- B. 向后兼容：手动 @ 标记 (保持不变) ---
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
    clusters.forEach(cluster => {
        // 基础过滤：排除乐谱最左侧之前的杂讯
        if (globalSystemInternalX > 0 && cluster.x < globalSystemInternalX - 5) return;

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
            return staves.some(staff => {
                return Math.abs(cluster.minTop - staff.top) <= tolerance &&
                    Math.abs(cluster.maxBottom - staff.bottom) <= tolerance;
            });
        };

        // 判定：如果是起手线，或者通过了严苛的端点对齐校验
        if (globalSystemInternalX > 0 && Math.abs(cluster.x - globalSystemInternalX) <= 5) {
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
    if (!hasStartBarline && globalSystemInternalX > 0) {
        // 虚拟线只进映射数组，不参与上面的 barCount 统计
        uniqueBarlines.unshift(globalSystemInternalX);
    }

    document.getElementById('barlineCount').innerText = barCount;
    document.getElementById('measureCount').innerText = mCount;

    // 补齐弱起小节
    if (uniqueBarlines.length > 0 && globalSystemInternalX > 0 && uniqueBarlines[0] - globalSystemInternalX > 60) {
        uniqueBarlines.unshift(globalSystemInternalX);
    }

    if (uniqueBarlines.length < 2) return;

    // --- 3. 提取拍号 ---
    globalTimeSigs = extractTimeSignatures(renderQueue);
    if (globalTimeSigs.length === 0) globalTimeSigs.push({ x: -Infinity, num: 4, den: 4 });

    const timeSigs = globalTimeSigs;
    if (timeSigs.length === 0) timeSigs.push({ x: -Infinity, num: 4, den: 4 });

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

        const quarterNotesPerBar = activeSig.num * (4 / activeSig.den);
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

    console.log(`📊 统计：物理小节线 ${barCount} 条 | 小节数 ${mCount} | 起始模式：${hasStartBarline ? '物理线' : '虚拟补齐'}`);

    console.log(`🎯 完美映射：生成 ${svgTags.length} 个锚点，总长度为 ${currentGlobalTick} Ticks。`);
}

// 🌟 2. MIDI 变速曲线重建：直接读取预先算好的 Tick
function recalculateMidiTempoMap() {
    if (!isMidiLoaded || globalMidiTempos.length === 0) return;

    let tagTimes = [];
    for (let i = 0; i < svgTags.length; i++) {
        const targetTick = svgTags[i].tick; // 直接拿算好的真实时长！

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

// 🌟 3. 无 MIDI 时的手动测速重建：同样基于真实 Tick
function generateManualTempoMap() {
    if (svgTags.length === 0) return;

    // 根据滑块 BPM，算出每一个 Tick 的物理时间秒数
    const secondsPerQuarter = 60 / currentBpm;
    const secondsPerTick = secondsPerQuarter / globalMidiPpq;

    // 直接用绝对 Tick 乘以 单个 Tick 秒数
    const tagTimes = svgTags.map(tag => tag.tick * secondsPerTick);

    midiDurationSec = tagTimes[tagTimes.length - 1] || 0;
    fuseDataWithTempoMap(tagTimes);
}

// 🌟 终极净化版：变速时空缝合 (彻底剔除旧 DOM 动画调用)
function fuseDataWithTempoMap(tagTimes) {
    mapData = [];

    if (svgTags.length === 0) {
        alert("未解析到乐谱坐标，请检查 SVG！");
        return;
    }

    for (let i = 0; i < svgTags.length; i++) {
        mapData.push({
            time: tagTimes[i],
            x: svgTags[i].x,
            y: svgTags[i].y
        });
    }

    isPlaying = false;
    cancelAnimationFrame(animationFrameId);
    elapsedBeforePause = 0;
    lastRenderClock = 0;
    isFinished = false;
    lastHighlightedIndex = -1;
    smoothX = mapData.length > 0 ? mapData[0].x : 0;
    smoothVx = 0;
    playbackSimTime = 0;
    syncTransforms(); // 👈 这里会自动触发 renderCanvas 画出乐谱
    updateProgressUI(0);

    console.log("✅ 全局变速曲线融合完毕！最终驱动数据：", mapData);

    const playBtn = document.getElementById('playBtn');
    playBtn.disabled = false;
    setButtonTextByState();

    if (dom.exportEndInput) {
        dom.exportEndInput.value = getTotalDuration().toFixed(2);
    }

    // 🌟 新增修复：只要时间轴（mapData）生成或重构完毕，立刻尝试与可能提前挂机的音频进行对齐！
    if (typeof audioFeature.tryAlignAudioAndScore === 'function') {
        audioFeature.tryAlignAudioAndScore();
    }
}


let smoothX = 0;
let smoothVx = 0;
const MAX_ACCEL_PX_PER_SEC2 = 3000; // 🚀 核心：大幅提升加速度。允许它快速加速追赶，而不是慢吞吞地导致脱节
const ENTRANCE_OPACITY_DURATION_SEC = 0.6;
const ENTRANCE_TRANSLATE_DURATION_SEC = 0.8;

function getTotalDuration() {
    if (mapData.length < 2) return 0;
    return mapData[mapData.length - 1].time;
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
        toggleFlyinBtn.innerText = enableFlyin ? "Disable Fly-in" : "Enable Fly-in";
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
    isPlaying = true;
    isFinished = false;
    startTime = performance.now() / 1000 - elapsedBeforePause;
    lastRenderClock = performance.now() / 1000;
    smoothVx = getSmoothedTargetVelocityByTime(elapsedBeforePause);
    playbackSimTime = elapsedBeforePause;
    setButtonTextByState();
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

    if (isAudioLoaded && audioWaiting) {
        if (currentTime + audioOffsetSec >= 0) {
            audioPlayer.currentTime = 0;
            audioPlayer.play().catch(() => {});
            audioWaiting = false;
        }
    }

    if (currentTime >= mapData[mapData.length - 1].time) {
        const finalPoint = mapData[mapData.length - 1];
        smoothX = finalPoint.x;
        syncTransforms();

        lastHighlightedIndex = mapData.length - 1;
        isPlaying = false;
        isFinished = true;
        elapsedBeforePause = getTotalDuration();
        lastRenderClock = 0;
        smoothVx = 0;
        playbackSimTime = elapsedBeforePause;
        cancelAnimationFrame(animationFrameId);
        updateProgressUI(elapsedBeforePause);
        setButtonTextByState();
        if (isAudioLoaded) audioPlayer.pause();
        return;
    }

    const currentIndex = findCurrentIndexByTime(currentTime);
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
        }
        startPlayback();
        setButtonTextByState();
    }
});

// 🌟 净化版：重绘滑块监听器
const redrawCanvas = () => { if (!isPlaying && typeof renderCanvas === 'function') renderCanvas(smoothX); };

// 🚀 核心修复：集中更新内存数据库中的粒子参数
function updateFlyinParams() {
    const distPercent = parseInt(dom.distSlider.value, 10);
    const scatterPercent = parseInt(dom.scatterSlider.value, 10);
    const delayPercent = parseInt(dom.delaySlider.value, 10);

    // 更新 UI 界面上的百分比数字
    dom.distVal.innerText = distPercent;
    dom.scatterVal.innerText = scatterPercent;
    dom.delayVal.innerText = delayPercent;

    // 映射回物理数值
    const maxDist = distPercent * 8;
    const maxScatter = scatterPercent * 4;
    const maxDelay = delayPercent * 15;

    // 瞬间洗牌：重新随机生成内存数据库中所有元素的飞入参数
    for (let i = 0; i < renderQueue.length; i++) {
        renderQueue[i].randX = (Math.random() * maxDist + 50);
        renderQueue[i].randY = (Math.random() * maxScatter - maxScatter / 2);
        renderQueue[i].delayDist = Math.random() * (maxDelay * 0.4);
    }

    redrawCanvas();
}

function handleGlowRangeInput(e) {
    const percent = parseInt(e.target.value, 10);
    dom.glowRangeVal.innerText = percent;
    // 50% 对应 100px 光晕，100% 对应 200px
    scanGlowRange = percent * 2;
    redrawCanvas();
}

function handleToggleCursor() {
    showPlayline = !showPlayline;
    applyOverlayVisibility();
    redrawCanvas();
}

function handleToggleHighlight() {
    showHighlights = !showHighlights;
    applyOverlayVisibility();
    redrawCanvas();
}

function handleToggleScanGlow() {
    showScanGlow = !showScanGlow;
    applyOverlayVisibility();
    redrawCanvas();
}

function handleToggleFlyin() {
    enableFlyin = !enableFlyin;
    applyOverlayVisibility();
    redrawCanvas();
}

function handleProgressInput(event) {
    const targetTime = Number(event.target.value);
    if (!Number.isFinite(targetTime)) return;
    seekToTime(targetTime);
}

function handleAudioOffsetInput(e) {
    audioOffsetSec = parseFloat(e.target.value);
    dom.audioOffsetVal.innerText = (audioOffsetSec > 0 ? '+' : '') + audioOffsetSec.toFixed(2);

    // 如果音频已加载，实时拨动其时间轴
    if (isAudioLoaded) {
        let currentVisualTime = isPlaying ? (performance.now() / 1000 - startTime) : elapsedBeforePause;
        let targetAudioTime = currentVisualTime + audioOffsetSec;

        if (targetAudioTime >= 0) {
            if (audioPlayer.readyState > 0 && targetAudioTime <= audioPlayer.duration) {
                audioPlayer.currentTime = targetAudioTime;
            }
            if (isPlaying && audioPlayer.paused) {
                audioPlayer.play().catch(() => {});
            }
            audioWaiting = false;
        } else {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            audioWaiting = isPlaying; // 如果乐谱在播，音频进入等待状态
        }
    }
}

function handleExportRatioChange(e) {
    const ratio = e.target.value;

    if (ratio === 'auto') {
        // 恢复默认模式
        viewportEl.style.aspectRatio = 'auto';
        viewportEl.style.height = 'clamp(400px, 60vh, 800px)';
        viewportEl.style.width = '100%';
        viewportEl.style.maxHeight = 'none';
    } else {
        const parts = ratio.split(':');
        const wRatio = parseInt(parts[0], 10);
        const hRatio = parseInt(parts[1], 10);

        viewportEl.style.aspectRatio = `${wRatio} / ${hRatio}`;

        // 🌟 修改：不论横屏还是竖屏，都强行撑满容器宽度 (100%)，高度由比例自然向下延展
        viewportEl.style.width = '100%';
        viewportEl.style.height = 'auto';
        viewportEl.style.maxHeight = 'none';
    }

    viewportEl.style.margin = '0 auto';

    // 呼叫底层引擎根据新容器形状重新定中心点并渲染
    resizeCanvas();
}

function handlePlaylineRatioInput(e) {
    const percent = parseInt(e.target.value, 10);
    dom.playlineRatioVal.innerText = percent;
    playlineRatio = percent / 100;
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
    handleGlowRangeInput,
    handleWindowKeydown,
    handlePlaylineRatioInput,
    handleProgressInput,
    handleResize: resizeCanvas,
    onCancelExport: () => exportFeature.cancelExport(),
    onDelayInput: updateFlyinParams,
    onDistInput: updateFlyinParams,
    onExportVideoClick: () => exportFeature.runExportFlow(),
    onScatterInput: updateFlyinParams,
    onToggleCursor: handleToggleCursor,
    onToggleFlyin: handleToggleFlyin,
    onToggleHighlight: handleToggleHighlight,
    onToggleScanGlow: handleToggleScanGlow,
});

window.onload = () => {
    resizeCanvas(); // 👈 核心修复：通电！告诉 Canvas 你的真实分辨率大小
    applyOverlayVisibility();
    updateProgressUI(0);
};
