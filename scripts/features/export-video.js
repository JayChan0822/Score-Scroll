// @ts-check

const PLAYBACK_TAIL_BUFFER_SEC = 2;

/**
 * @typedef {ReturnType<typeof import("../core/dom.js").getDomRefs>} DomRefs
 */

/**
 * @typedef {Object} SmoothState
 * @property {number} playbackSimTime
 * @property {number} smoothVx
 * @property {number} smoothX
 */

/**
 * @typedef {Object} InterpolatedPosition
 * @property {number} x
 * @property {number} index
 * @property {boolean} atEnd
 */

/**
 * @typedef {Object} RenderCanvasOptions
 * @property {boolean} [transparentBackground]
 */

/**
 * @typedef {Object} ExportVideoFeatureOptions
 * @property {DomRefs} dom
 * @property {() => number} getAudioOffsetSec
 * @property {() => number} getCachedViewportWidth
 * @property {() => HTMLCanvasElement} getCanvas
 * @property {() => boolean} getCancelVideoExport
 * @property {() => CanvasRenderingContext2D | null} getCtx
 * @property {() => string} getEffectiveExportRatio
 * @property {() => File | null} getGlobalAudioFile
 * @property {() => number} getGlobalScoreHeight
 * @property {() => number} getGlobalZoom
 * @property {(timeSec: number) => number} getPlaybackGainByTime
 * @property {(timeSec: number) => InterpolatedPosition} getInterpolatedXByTime
 * @property {() => boolean} getIsPlaying
 * @property {(timeSec: number) => number} getSmoothedTargetVelocityByTime
 * @property {() => SmoothState} getSmoothState
 * @property {() => number} getTotalDuration
 * @property {(smoothX: number, options?: RenderCanvasOptions) => void} renderCanvas
 * @property {() => void} resizeCanvas
 * @property {(width: number) => void} setCachedViewportWidth
 * @property {(canvas: HTMLCanvasElement) => void} setCanvas
 * @property {(cancelled: boolean) => void} setCancelVideoExport
 * @property {(ctx: CanvasRenderingContext2D | null) => void} setCtx
 * @property {(zoom: number) => void} setGlobalZoom
 * @property {(isExporting: boolean) => void} setIsExportingVideoMode
 * @property {(state: SmoothState) => void} setSmoothState
 */

/**
 * @typedef {Object} ExportVideoFeature
 * @property {() => void} cancelExport
 * @property {(baseRes?: number, fps?: number, aspectRatio?: string, startSec?: number, endSec?: number | null) => Promise<void>} exportHighQualityVideo
 * @property {(baseRes?: number, fps?: number, aspectRatio?: string, startSec?: number, endSec?: number | null) => Promise<void>} exportPngSequence
 * @property {() => Promise<void>} runExportFlow
 * @property {() => Promise<void>} runPngExportFlow
 */

/**
 * @param {string | null | undefined} aspectRatio
 * @returns {string | null}
 */
export function normalizeAspectRatioValue(aspectRatio) {
    if (typeof aspectRatio !== "string") {
        return null;
    }

    const sanitized = aspectRatio.trim().replaceAll("：", ":").replace(/\s+/g, "");
    if (!sanitized) {
        return null;
    }

    if (sanitized === "auto") {
        return "auto";
    }

    const ratioParts = sanitized.split(":");
    if (ratioParts.length !== 2) {
        return null;
    }

    const [widthPart, heightPart] = ratioParts;
    const widthValue = Number.parseFloat(widthPart);
    const heightValue = Number.parseFloat(heightPart);
    if (!Number.isFinite(widthValue) || !Number.isFinite(heightValue) || widthValue <= 0 || heightValue <= 0) {
        return null;
    }

    return `${widthPart}:${heightPart}`;
}

/**
 * @param {string | null | undefined} aspectRatio
 * @param {string} [fallbackAspectRatio="auto"]
 * @returns {string}
 */
export function resolveAspectRatioValue(aspectRatio, fallbackAspectRatio = "auto") {
    return normalizeAspectRatioValue(aspectRatio) ?? normalizeAspectRatioValue(fallbackAspectRatio) ?? "auto";
}

/**
 * @param {{
 *   aspectRatio?: string,
 *   baseRes?: number,
 *   globalScoreHeight?: number,
 *   globalZoom?: number,
 *   viewportWidth?: number,
 * }} params
 * @returns {{ finalExportZoom: number, targetHeight: number, targetWidth: number }}
 */
export function computeSharedExportDimensions({
    aspectRatio = "auto",
    baseRes = 1920,
    globalScoreHeight = 0,
    globalZoom = 1,
    viewportWidth = 1920,
}) {
    const resolvedAspectRatio = resolveAspectRatioValue(aspectRatio);
    let targetWidth = baseRes;
    let targetHeight;
    let finalExportZoom = globalZoom;
    const originalPhysWidth = viewportWidth > 0 ? viewportWidth : 1920;

    if (resolvedAspectRatio === "auto") {
        const exportZoomMultiplier = targetWidth / originalPhysWidth;
        finalExportZoom = globalZoom * exportZoomMultiplier;
        targetHeight = Math.ceil(globalScoreHeight * finalExportZoom + 120);
    } else {
        const ratioParts = resolvedAspectRatio.split(":");
        const wRatio = parseFloat(ratioParts[0]);
        const hRatio = parseFloat(ratioParts[1]);

        if (wRatio < hRatio) {
            targetHeight = baseRes;
            targetWidth = Math.ceil(targetHeight * (wRatio / hRatio));
        } else {
            targetWidth = baseRes;
            targetHeight = Math.ceil(targetWidth * (hRatio / wRatio));
        }

        const exportZoomMultiplier = targetWidth / originalPhysWidth;
        finalExportZoom = globalZoom * exportZoomMultiplier;
    }

    targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1;
    targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1;
    targetHeight = Math.min(4320, targetHeight);

    return {
        finalExportZoom,
        targetHeight,
        targetWidth,
    };
}

/**
 * @param {ExportVideoFeatureOptions} options
 * @returns {ExportVideoFeature}
 */
export function createExportVideoFeature({
    dom,
    getAudioOffsetSec,
    getCachedViewportWidth,
    getCanvas,
    getCancelVideoExport,
    getCtx,
    getEffectiveExportRatio,
    getGlobalAudioFile,
    getGlobalScoreHeight,
    getGlobalZoom,
    getPlaybackGainByTime,
    getInterpolatedXByTime,
    getIsPlaying,
    getSmoothedTargetVelocityByTime,
    getSmoothState,
    getTotalDuration,
    renderCanvas,
    resizeCanvas,
    setCachedViewportWidth,
    setCanvas,
    setCancelVideoExport,
    setCtx,
    setGlobalZoom,
    setIsExportingVideoMode,
    setSmoothState,
}) {
    const PNG_MIME_TYPE = "image/png";

    /**
     * @param {number} startSec
     * @param {number | null} endSec
     * @returns {{ exportDuration: number, finalEndSec: number, finalStartSec: number, fullDuration: number } | null}
     */
    function resolveExportWindow(startSec, endSec) {
        const fullDuration = getTotalDuration();
        if (fullDuration <= 0) {
            alert("没有可导出的乐谱数据！请先加载曲目。");
            return null;
        }

        const finalStartSec = Math.max(0, startSec);
        const finalEndSec = endSec === null ? fullDuration : Math.min(endSec, fullDuration);
        const exportDuration = finalEndSec - finalStartSec;

        if (exportDuration <= 0) {
            alert("导出时间范围无效！");
            return null;
        }

        return {
            exportDuration,
            finalEndSec,
            finalStartSec,
            fullDuration,
        };
    }

    /**
     * @param {number} baseRes
     * @param {string} aspectRatio
     * @returns {{ finalExportZoom: number, targetHeight: number, targetWidth: number }}
     */
    function computeExportDimensions(baseRes, aspectRatio) {
        return computeSharedExportDimensions({
            aspectRatio,
            baseRes,
            globalScoreHeight: getGlobalScoreHeight(),
            globalZoom: getGlobalZoom(),
            viewportWidth: dom.viewportEl?.clientWidth || 1920,
        });
    }

    /**
     * @param {number} targetWidth
     * @param {number} targetHeight
     * @param {number} finalExportZoom
     * @returns {{ exportCanvas: HTMLCanvasElement, restoreViewportState: () => void }}
     */
    function activateExportViewport(targetWidth, targetHeight, finalExportZoom) {
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = targetWidth;
        exportCanvas.height = targetHeight;
        exportCanvas.style.position = "fixed";
        exportCanvas.style.top = "-99999px";
        exportCanvas.style.visibility = "hidden";
        document.body.appendChild(exportCanvas);

        const exportCtx = exportCanvas.getContext("2d");
        if (!exportCtx) {
            document.body.removeChild(exportCanvas);
            throw new Error("Unable to create a 2D export context.");
        }

        const originalCanvas = getCanvas();
        const originalCtx = getCtx();
        const originalViewportWidth = getCachedViewportWidth();
        const originalZoom = getGlobalZoom();
        let restored = false;

        setCanvas(exportCanvas);
        setCtx(exportCtx);
        setCachedViewportWidth(targetWidth);
        setGlobalZoom(finalExportZoom);
        setIsExportingVideoMode(true);

        return {
            exportCanvas,
            restoreViewportState: () => {
                if (restored) {
                    return;
                }
                restored = true;

                setCanvas(originalCanvas);
                setCtx(originalCtx);
                setCachedViewportWidth(originalViewportWidth);
                setGlobalZoom(originalZoom);
                setIsExportingVideoMode(false);

                if (exportCanvas.parentNode) {
                    exportCanvas.parentNode.removeChild(exportCanvas);
                }

                resizeCanvas();
                renderCanvas(getSmoothState().smoothX);
            },
        };
    }

    /** @returns {void} */
    function pausePlaybackForExport() {
        if (getIsPlaying()) {
            dom.playBtn?.click();
        }
    }

    /**
     * @param {number} percent
     * @returns {void}
     */
    function updateExportProgress(percent) {
        const clampedPercent = Math.max(0, Math.min(100, percent));
        if (dom.exportProgressBar) dom.exportProgressBar.style.width = `${clampedPercent.toFixed(1)}%`;
        if (dom.exportProgressText) dom.exportProgressText.innerText = `${clampedPercent.toFixed(1)}%`;
    }

    /**
     * @param {string} title
     * @returns {void}
     */
    function openExportModal(title) {
        updateExportProgress(0);
        if (dom.exportModalTitle) dom.exportModalTitle.innerText = title;

        if (dom.cancelExportBtn) {
            dom.cancelExportBtn.innerText = "🛑 CANCEL";
            dom.cancelExportBtn.disabled = false;
        }

        if (dom.exportModal) {
            dom.exportModal.style.display = "flex";
            void dom.exportModal.offsetWidth;
            dom.exportModal.classList.add("show");
        }
    }

    /** @returns {Promise<void>} */
    async function finalizeSuccessfulExport() {
        if (dom.exportModalTitle) dom.exportModalTitle.innerText = "SUCCESS!";
        updateExportProgress(100);
        await new Promise((resolve) => setTimeout(resolve, 800));
    }

    /** @returns {void} */
    function closeExportModal() {
        const exportModal = dom.exportModal;
        if (exportModal) {
            exportModal.classList.remove("show");
            setTimeout(() => {
                exportModal.style.display = "none";
            }, 300);
        }
    }

    /**
     * @param {number} simulatedTime
     * @param {RenderCanvasOptions} [renderOptions]
     * @returns {void}
     */
    function renderExportFrame(simulatedTime, renderOptions = {}) {
        setSmoothState({
            playbackSimTime: simulatedTime,
            smoothVx: getSmoothedTargetVelocityByTime(simulatedTime),
            smoothX: getInterpolatedXByTime(simulatedTime).x,
        });

        renderCanvas(getSmoothState().smoothX, renderOptions);
    }

    /**
     * @param {HTMLCanvasElement} canvasElement
     * @param {string} mimeType
     * @returns {Promise<Blob>}
     */
    function canvasToBlob(canvasElement, mimeType) {
        return new Promise((resolve, reject) => {
            canvasElement.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                    return;
                }
                reject(new Error("PNG frame encode failed."));
            }, mimeType);
        });
    }

    /** @returns {string} */
    function createPngExportFolderName() {
        const now = new Date();
        const year = String(now.getFullYear());
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        return `score-scroll-png-${year}${month}${day}-${hours}${minutes}${seconds}`;
    }

    /**
     * @param {number} targetWidth
     * @returns {string}
     */
    function createMp4ExportFileName(targetWidth) {
        return `Score_Export_${targetWidth}w_${Date.now()}.mp4`;
    }

    /**
     * @returns {Promise<any | null>}
     */
    async function selectPngExportDirectory() {
        const showDirectoryPicker = /** @type {undefined | (() => Promise<any>)} */ (window.showDirectoryPicker);
        if (typeof showDirectoryPicker !== "function") {
            alert("浏览器不支持目录导出，请使用最新版 Chrome 或 Edge。");
            return null;
        }

        try {
            const rootHandle = await showDirectoryPicker.call(window);
            return await rootHandle.getDirectoryHandle(createPngExportFolderName(), { create: true });
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return null;
            }
            throw error;
        }
    }

    /**
     * @param {string} suggestedName
     * @returns {Promise<any | null>}
     */
    async function selectMp4ExportFileHandle(suggestedName) {
        const showSaveFilePicker = /** @type {undefined | ((options?: any) => Promise<any>)} */ (window.showSaveFilePicker);
        if (typeof showSaveFilePicker !== "function") {
            return null;
        }

        try {
            return await showSaveFilePicker.call(window, {
                excludeAcceptAllOption: false,
                suggestedName,
                types: [{
                    accept: {
                        "video/mp4": [".mp4"],
                    },
                    description: "MP4 Video",
                }],
            });
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                throw new Error("Export cancelled");
            }
            throw error;
        }
    }

    /**
     * @param {any} buffer
     * @param {number} targetWidth
     * @returns {Promise<void>}
     */
    async function downloadMp4Buffer(buffer, targetWidth) {
        const blob = new Blob([buffer], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = createMp4ExportFileName(targetWidth);
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }

    /**
     * @param {number} targetWidth
     * @param {number} targetHeight
     * @param {boolean} hasAudio
     * @returns {Promise<{
     *   abortOutput: () => Promise<void>,
     *   finalizeOutput: (muxer: any) => Promise<void>,
     *   muxerOptions: any,
     * }>}
     */
    async function resolveMp4ExportTarget(targetWidth, targetHeight, hasAudio) {
        /** @type {any} */
        const muxerOptions = {
            video: { codec: "avc", width: targetWidth, height: targetHeight },
        };
        if (hasAudio) {
            muxerOptions.audio = { codec: "aac", numberOfChannels: 2, sampleRate: 44100 };
        }

        const FileSystemWritableFileStreamTargetCtor = Mp4Muxer?.FileSystemWritableFileStreamTarget;
        const hasLocalFileStreamingSupport =
            typeof window.FileSystemWritableFileStream === "function" &&
            typeof FileSystemWritableFileStreamTargetCtor === "function";

        if (hasLocalFileStreamingSupport) {
            const fileHandle = await selectMp4ExportFileHandle(createMp4ExportFileName(targetWidth));
            if (fileHandle) {
                const writable = await fileHandle.createWritable();
                return {
                    abortOutput: async () => {
                        if (typeof writable.abort === "function") {
                            await writable.abort();
                            return;
                        }
                        if (typeof writable.close === "function") {
                            await writable.close();
                        }
                    },
                    finalizeOutput: async () => {
                        if (typeof writable.close === "function") {
                            await writable.close();
                        }
                    },
                    muxerOptions: {
                        ...muxerOptions,
                        fastStart: false,
                        target: new FileSystemWritableFileStreamTargetCtor(writable),
                    },
                };
            }
        }

        return {
            abortOutput: async () => {},
            finalizeOutput: async (muxer) => {
                await downloadMp4Buffer(muxer.target.buffer, targetWidth);
            },
            muxerOptions: {
                ...muxerOptions,
                fastStart: "in-memory",
                target: new Mp4Muxer.ArrayBufferTarget(),
            },
        };
    }

    /**
     * @param {number} [baseRes=1920]
     * @param {number} [fps=60]
     * @param {string} [aspectRatio="auto"]
     * @param {number} [startSec=0]
     * @param {number | null} [endSec=null]
     * @returns {Promise<void>}
     */
    async function exportHighQualityVideo(baseRes = 1920, fps = 60, aspectRatio = "auto", startSec = 0, endSec = null) {
        if (!("VideoEncoder" in window)) {
            alert("浏览器不支持 WebCodecs，请使用最新版 Chrome。");
            return;
        }

        const exportWindow = resolveExportWindow(startSec, endSec);
        if (!exportWindow) {
            return;
        }

        const { finalExportZoom, targetHeight, targetWidth } = computeExportDimensions(baseRes, aspectRatio);
        const audioFile = getGlobalAudioFile();
        const exportTarget = await resolveMp4ExportTarget(targetWidth, targetHeight, Boolean(audioFile));

        pausePlaybackForExport();

        const { restoreViewportState } = activateExportViewport(targetWidth, targetHeight, finalExportZoom);
        let didRestoreViewportState = false;
        const restoreViewportIfNeeded = () => {
            if (didRestoreViewportState) {
                return;
            }
            restoreViewportState();
            didRestoreViewportState = true;
        };

        const muxer = new Mp4Muxer.Muxer(exportTarget.muxerOptions);
        let didFinalizeOutput = false;

        try {
            let isEncoderError = false;
            const videoEncoder = new VideoEncoder({
                output: (chunk, metadata) => {
                    if (!isEncoderError && !getCancelVideoExport()) muxer.addVideoChunk(chunk, metadata);
                },
                error: (error) => {
                    console.error("视频编码崩溃:", error);
                    isEncoderError = true;
                },
            });

            const totalPixels = targetWidth * targetHeight;
            let codecString = "avc1.640028";
            let targetBitrate = 10_000_000;

            if (totalPixels >= 8_900_000 || (totalPixels >= 2_000_000 && fps > 60)) {
                targetBitrate = 40_000_000;
                codecString = "avc1.64003E";
            } else if (totalPixels >= 2_000_000) {
                targetBitrate = 20_000_000;
                codecString = "avc1.640034";
            }

            videoEncoder.configure({
                bitrate: targetBitrate,
                codec: codecString,
                framerate: fps,
                hardwareAcceleration: "prefer-hardware",
                height: targetHeight,
                width: targetWidth,
            });

            let audioEncoder = null;
            if (audioFile) {
                audioEncoder = new AudioEncoder({
                    output: (chunk, meta) => {
                        if (!isEncoderError && !getCancelVideoExport()) muxer.addAudioChunk(chunk, meta);
                    },
                    error: (error) => {
                        console.error("音频编码崩溃:", error);
                        isEncoderError = true;
                    },
                });
                audioEncoder.configure({ codec: "mp4a.40.2", sampleRate: 44100, numberOfChannels: 2, bitrate: 192000 });

                const OfflineAudioContextCtor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
                if (!OfflineAudioContextCtor) {
                    throw new Error("OfflineAudioContext is not supported in this browser.");
                }

                const audioCtx = new OfflineAudioContextCtor(2, Math.ceil(exportWindow.exportDuration * 44100), 44100);
                const arrayBuffer = await audioFile.arrayBuffer();
                const decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);

                const source = audioCtx.createBufferSource();
                const gainNode = audioCtx.createGain();
                source.buffer = decodedAudio;
                source.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                let startTimeInVideo = 0;
                let startOffsetInAudio = 0;
                const initialAudioTime = exportWindow.finalStartSec + getAudioOffsetSec();
                if (initialAudioTime >= 0) {
                    startOffsetInAudio = initialAudioTime;
                } else {
                    startTimeInVideo = Math.abs(initialAudioTime);
                }

                const fadeStartSec = Math.max(
                    exportWindow.finalStartSec,
                    exportWindow.fullDuration - PLAYBACK_TAIL_BUFFER_SEC
                );
                const fadeStartOffsetSec = Math.max(0, fadeStartSec - exportWindow.finalStartSec);
                const exportStartGain = getPlaybackGainByTime(exportWindow.finalStartSec);
                const exportEndGain = getPlaybackGainByTime(exportWindow.finalEndSec);
                gainNode.gain.setValueAtTime(exportStartGain, 0);
                if (fadeStartOffsetSec > 0 && fadeStartOffsetSec < exportWindow.exportDuration) {
                    gainNode.gain.setValueAtTime(getPlaybackGainByTime(fadeStartSec), fadeStartOffsetSec);
                }
                if (exportEndGain !== exportStartGain || fadeStartOffsetSec > 0) {
                    gainNode.gain.linearRampToValueAtTime(exportEndGain, exportWindow.exportDuration);
                }

                source.start(startTimeInVideo, startOffsetInAudio);
                const renderedBuffer = await audioCtx.startRendering();

                const numFrames = renderedBuffer.length;
                const chunkSize = 44100;
                for (let i = 0; i < numFrames; i += chunkSize) {
                    if (getCancelVideoExport() || isEncoderError) break;
                    const size = Math.min(chunkSize, numFrames - i);
                    const planarData = new Float32Array(size * 2);
                    const left = renderedBuffer.getChannelData(0);
                    const right = renderedBuffer.numberOfChannels > 1 ? renderedBuffer.getChannelData(1) : left;
                    planarData.set(left.subarray(i, i + size), 0);
                    planarData.set(right.subarray(i, i + size), size);

                    const audioData = new AudioData({
                        data: planarData,
                        format: "f32-planar",
                        numberOfChannels: 2,
                        numberOfFrames: size,
                        sampleRate: 44100,
                        timestamp: (i / 44100) * 1_000_000,
                    });
                    audioEncoder.encode(audioData);
                    audioData.close();
                }
                if (!getCancelVideoExport()) await audioEncoder.flush();
            }

            const totalFrames = Math.ceil(exportWindow.exportDuration * fps);
            const stepSec = 1 / fps;

            for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
                if (getCancelVideoExport()) break;
                if (isEncoderError) break;

                while (videoEncoder.encodeQueueSize >= 10) {
                    if (isEncoderError || getCancelVideoExport()) break;
                    await new Promise((resolve) => setTimeout(resolve, 1));
                }

                const simulatedTime = exportWindow.finalStartSec + frameIndex * stepSec;
                renderExportFrame(simulatedTime);

                const videoFrame = new VideoFrame(getCanvas(), { timestamp: frameIndex * stepSec * 1_000_000 });
                const insertKeyFrame = frameIndex % fps === 0;

                try {
                    videoEncoder.encode(videoFrame, { keyFrame: insertKeyFrame });
                } catch (error) {
                    isEncoderError = true;
                } finally {
                    videoFrame.close();
                }

                if (frameIndex % 30 === 0) {
                    updateExportProgress((frameIndex / totalFrames) * 100);
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
            }

            if (getCancelVideoExport()) {
                try { videoEncoder.close(); } catch {}
                throw new Error("Export cancelled");
            }

            if (isEncoderError) {
                try { videoEncoder.close(); } catch {}
                throw new Error("Encoder crashed");
            }

            if (dom.exportModalTitle) dom.exportModalTitle.innerText = "MUXING & SAVING...";

            await videoEncoder.flush();
            muxer.finalize();
            restoreViewportIfNeeded();
            await exportTarget.finalizeOutput(muxer);
            didFinalizeOutput = true;
        } catch (error) {
            restoreViewportIfNeeded();
            if (!didFinalizeOutput) {
                await exportTarget.abortOutput();
            }
            throw error;
        }
    }

    /** @returns {Promise<void>} */
    async function runExportFlow() {
        const selectedRatio = getEffectiveExportRatio();
        const selectedWidth = parseInt(dom.exportResSelect?.value || "1920", 10);
        const selectedFps = parseInt(dom.exportFpsSelect?.value || "60", 10);
        const startSec = parseFloat(dom.exportStartInput?.value || "0") || 0;

        let endSec = parseFloat(dom.exportEndInput?.value || "");
        if (Number.isNaN(endSec) || endSec <= 0) {
            endSec = getTotalDuration();
        }

        if (startSec >= endSec) {
            alert("起始时间必须小于结束时间！");
            return;
        }

        if (dom.exportProgressBar) dom.exportProgressBar.style.width = "0%";
        if (dom.exportProgressText) dom.exportProgressText.innerText = "0.0%";
        if (dom.exportModalTitle) dom.exportModalTitle.innerText = "RENDERING FRAMES...";

        if (dom.cancelExportBtn) {
            dom.cancelExportBtn.innerText = "🛑 CANCEL";
            dom.cancelExportBtn.disabled = false;
        }

        if (dom.exportModal) {
            dom.exportModal.style.display = "flex";
            void dom.exportModal.offsetWidth;
            dom.exportModal.classList.add("show");
        }

        setCancelVideoExport(false);

        try {
            await exportHighQualityVideo(selectedWidth, selectedFps, selectedRatio, startSec, endSec);

            if (dom.exportModalTitle) dom.exportModalTitle.innerText = "SUCCESS!";
            if (dom.exportProgressBar) dom.exportProgressBar.style.width = "100%";
            if (dom.exportProgressText) dom.exportProgressText.innerText = "100.0%";
            await new Promise((resolve) => setTimeout(resolve, 800));
        } catch (error) {
            if (!(error instanceof Error) || error.message !== "Export cancelled") {
                console.error("导出失败:", error);
                alert("视频导出失败，请查看控制台报错。");
            }
        } finally {
            const exportModal = dom.exportModal;
            if (exportModal) {
                exportModal.classList.remove("show");
                setTimeout(() => {
                    exportModal.style.display = "none";
                }, 300);
            }
        }
    }

    /**
     * @param {number} [baseRes=1920]
     * @param {number} [fps=60]
     * @param {string} [aspectRatio="auto"]
     * @param {number} [startSec=0]
     * @param {number | null} [endSec=null]
     * @returns {Promise<void>}
     */
    async function exportPngSequence(baseRes = 1920, fps = 60, aspectRatio = "auto", startSec = 0, endSec = null) {
        const exportWindow = resolveExportWindow(startSec, endSec);
        if (!exportWindow) {
            return;
        }

        const outputDirectoryHandle = await selectPngExportDirectory();
        if (!outputDirectoryHandle) {
            return;
        }

        pausePlaybackForExport();
        openExportModal("RENDERING PNG FRAMES...");
        setCancelVideoExport(false);

        const { finalExportZoom, targetHeight, targetWidth } = computeExportDimensions(baseRes, aspectRatio);
        const { restoreViewportState } = activateExportViewport(targetWidth, targetHeight, finalExportZoom);
        const totalFrames = Math.max(1, Math.ceil(exportWindow.exportDuration * fps));
        const stepSec = 1 / fps;

        try {
            for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
                if (getCancelVideoExport()) {
                    break;
                }

                const simulatedTime = exportWindow.finalStartSec + frameIndex * stepSec;
                renderExportFrame(simulatedTime, { transparentBackground: true });

                const frameName = `frame_${String(frameIndex + 1).padStart(6, "0")}.png`;
                const frameHandle = await outputDirectoryHandle.getFileHandle(frameName, { create: true });
                const writable = await frameHandle.createWritable();

                try {
                    const pngBlob = await canvasToBlob(getCanvas(), PNG_MIME_TYPE);
                    await writable.write(pngBlob);
                    await writable.close();
                } catch (error) {
                    try {
                        await writable.abort();
                    } catch {}
                    throw error;
                }

                if (frameIndex % 10 === 0 || frameIndex === totalFrames - 1) {
                    updateExportProgress(((frameIndex + 1) / totalFrames) * 100);
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
            }

            if (getCancelVideoExport()) {
                throw new Error("Export cancelled");
            }

            await finalizeSuccessfulExport();
        } catch (error) {
            if (!(error instanceof Error) || error.message !== "Export cancelled") {
                console.error("PNG 序列导出失败:", error);
                alert("PNG 序列导出失败，请查看控制台报错。");
            }
        } finally {
            restoreViewportState();
            closeExportModal();
        }
    }

    /** @returns {Promise<void>} */
    async function runPngExportFlow() {
        const selectedRatio = getEffectiveExportRatio();
        const selectedWidth = parseInt(dom.exportResSelect?.value || "1920", 10);
        const selectedFps = parseInt(dom.exportFpsSelect?.value || "60", 10);
        const startSec = parseFloat(dom.exportStartInput?.value || "0") || 0;

        let endSec = parseFloat(dom.exportEndInput?.value || "");
        if (Number.isNaN(endSec) || endSec <= 0) {
            endSec = getTotalDuration();
        }

        if (startSec >= endSec) {
            alert("起始时间必须小于结束时间！");
            return;
        }

        await exportPngSequence(selectedWidth, selectedFps, selectedRatio, startSec, endSec);
    }

    /** @returns {void} */
    function cancelExport() {
        setCancelVideoExport(true);
        if (dom.cancelExportBtn) {
            dom.cancelExportBtn.innerText = "CANCELLING...";
            dom.cancelExportBtn.disabled = true;
        }
    }

    return {
        cancelExport,
        exportHighQualityVideo,
        exportPngSequence,
        runExportFlow,
        runPngExportFlow,
    };
}
