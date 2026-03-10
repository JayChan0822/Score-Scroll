export function createExportVideoFeature({
    dom,
    getAudioOffsetSec,
    getCachedViewportWidth,
    getCanvas,
    getCancelVideoExport,
    getCtx,
    getGlobalAudioFile,
    getGlobalScoreHeight,
    getGlobalZoom,
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
    async function exportHighQualityVideo(baseRes = 1920, fps = 60, aspectRatio = "auto", startSec = 0, endSec = null) {
        if (!("VideoEncoder" in window)) {
            alert("浏览器不支持 WebCodecs，请使用最新版 Chrome。");
            return;
        }

        const fullDuration = getTotalDuration();
        if (fullDuration <= 0) {
            alert("没有可导出的乐谱数据！请先加载曲目。");
            return;
        }

        const finalStartSec = Math.max(0, startSec);
        const finalEndSec = endSec === null ? fullDuration : Math.min(endSec, fullDuration);
        const exportDuration = finalEndSec - finalStartSec;
        if (exportDuration <= 0) {
            alert("导出时间范围无效！");
            return;
        }

        if (getIsPlaying()) {
            dom.playBtn?.click();
        }

        let targetWidth = baseRes;
        let targetHeight;
        let finalExportZoom = getGlobalZoom();

        if (aspectRatio === "auto") {
            const originalPhysWidth = dom.viewportEl?.clientWidth || 1920;
            const exportZoomMultiplier = targetWidth / originalPhysWidth;
            finalExportZoom = getGlobalZoom() * exportZoomMultiplier;
            targetHeight = Math.ceil(getGlobalScoreHeight() * finalExportZoom + 120);
        } else {
            const ratioParts = aspectRatio.split(":");
            const wRatio = parseFloat(ratioParts[0]);
            const hRatio = parseFloat(ratioParts[1]);

            if (wRatio < hRatio) {
                targetHeight = baseRes;
                targetWidth = Math.ceil(targetHeight * (wRatio / hRatio));
            } else {
                targetWidth = baseRes;
                targetHeight = Math.ceil(targetWidth * (hRatio / wRatio));
            }

            const originalPhysWidth = dom.viewportEl?.clientWidth || 1920;
            const exportZoomMultiplier = targetWidth / originalPhysWidth;
            finalExportZoom = getGlobalZoom() * exportZoomMultiplier;
        }

        targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1;
        targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1;
        targetHeight = Math.min(4320, targetHeight);

        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = targetWidth;
        exportCanvas.height = targetHeight;
        exportCanvas.style.position = "fixed";
        exportCanvas.style.top = "-99999px";
        exportCanvas.style.visibility = "hidden";
        document.body.appendChild(exportCanvas);

        const exportCtx = exportCanvas.getContext("2d");

        const originalCanvas = getCanvas();
        const originalCtx = getCtx();
        const originalViewportWidth = getCachedViewportWidth();
        const originalZoom = getGlobalZoom();

        setCanvas(exportCanvas);
        setCtx(exportCtx);
        setCachedViewportWidth(targetWidth);
        setGlobalZoom(finalExportZoom);
        setIsExportingVideoMode(true);

        const muxerOptions = {
            target: new Mp4Muxer.ArrayBufferTarget(),
            video: { codec: "avc", width: targetWidth, height: targetHeight },
            fastStart: "in-memory",
        };
        if (getGlobalAudioFile()) {
            muxerOptions.audio = { codec: "aac", numberOfChannels: 2, sampleRate: 44100 };
        }
        const muxer = new Mp4Muxer.Muxer(muxerOptions);

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
        if (getGlobalAudioFile()) {
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

            const audioCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
                2,
                Math.ceil(exportDuration * 44100),
                44100
            );
            const arrayBuffer = await getGlobalAudioFile().arrayBuffer();
            const decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);

            const source = audioCtx.createBufferSource();
            source.buffer = decodedAudio;
            source.connect(audioCtx.destination);

            let startTimeInVideo = 0;
            let startOffsetInAudio = 0;
            const initialAudioTime = finalStartSec + getAudioOffsetSec();
            if (initialAudioTime >= 0) {
                startOffsetInAudio = initialAudioTime;
            } else {
                startTimeInVideo = Math.abs(initialAudioTime);
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

        const totalFrames = Math.ceil(exportDuration * fps);
        const stepSec = 1 / fps;

        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
            if (getCancelVideoExport()) break;
            if (isEncoderError) break;

            while (videoEncoder.encodeQueueSize >= 10) {
                if (isEncoderError || getCancelVideoExport()) break;
                await new Promise((resolve) => setTimeout(resolve, 1));
            }

            const simulatedTime = finalStartSec + frameIndex * stepSec;
            setSmoothState({
                playbackSimTime: simulatedTime,
                smoothVx: getSmoothedTargetVelocityByTime(simulatedTime),
                smoothX: getInterpolatedXByTime(simulatedTime).x,
            });

            renderCanvas(getSmoothState().smoothX);

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
                const percent = ((frameIndex / totalFrames) * 100).toFixed(1);
                if (dom.exportProgressBar) dom.exportProgressBar.style.width = `${percent}%`;
                if (dom.exportProgressText) dom.exportProgressText.innerText = `${percent}%`;
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }

        const restoreViewportState = () => {
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
        };

        if (getCancelVideoExport()) {
            try { videoEncoder.close(); } catch {}
            restoreViewportState();
            throw new Error("Export cancelled");
        }

        if (isEncoderError) {
            try { videoEncoder.close(); } catch {}
            restoreViewportState();
            throw new Error("Encoder crashed");
        }

        if (dom.exportModalTitle) dom.exportModalTitle.innerText = "MUXING & SAVING...";

        await videoEncoder.flush();
        muxer.finalize();
        restoreViewportState();

        const buffer = muxer.target.buffer;
        const blob = new Blob([buffer], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `Score_Export_${targetWidth}w_${Date.now()}.mp4`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }

    async function runExportFlow() {
        const selectedRatio = dom.exportRatioSelect?.value || "auto";
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
            if (error.message !== "Export cancelled") {
                console.error("导出失败:", error);
                alert("视频导出失败，请查看控制台报错。");
            }
        } finally {
            if (dom.exportModal) {
                dom.exportModal.classList.remove("show");
                setTimeout(() => {
                    dom.exportModal.style.display = "none";
                }, 300);
            }
        }
    }

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
        runExportFlow,
    };
}
