export function bindUiEvents({
    dom,
    handleAudioInputChange,
    handleAudioOffsetInput,
    handleCustomRatioCancel,
    handleCustomRatioConfirm,
    handleCustomRatioInput,
    handleExportRatioChange,
    handleExportResolutionChange,
    handleExportFpsChange,
    handleGlowRangeInput,
    handleStickyLockRatioInput,
    handleWindowKeydown,
    handlePlaylineRatioInput,
    handleProgressInput,
    handleResize,
    onCancelExport,
    onDelayInput,
    onDistInput,
    onExportPngClick,
    onExportVideoClick,
    onScatterInput,
    onToggleCursor,
    onToggleFlyin,
    onToggleHighlight,
    onToggleScanGlow,
}) {
    const bindSliderDoubleClickReset = (slider, defaultValue = "50") => {
        slider?.addEventListener("dblclick", () => {
            if (slider.value === defaultValue) return;
            slider.value = defaultValue;
            slider.dispatchEvent(new Event("input", { bubbles: true }));
        });
    };

    dom.audioInput?.addEventListener("change", handleAudioInputChange);
    dom.audioOffsetSlider?.addEventListener("input", handleAudioOffsetInput);
    dom.customRatioCancelBtn?.addEventListener("click", handleCustomRatioCancel);
    dom.customRatioConfirmBtn?.addEventListener("click", handleCustomRatioConfirm);
    dom.customRatioInput?.addEventListener("input", handleCustomRatioInput);
    dom.distSlider?.addEventListener("input", onDistInput);
    dom.scatterSlider?.addEventListener("input", onScatterInput);
    dom.delaySlider?.addEventListener("input", onDelayInput);
    dom.glowRangeSlider?.addEventListener("input", handleGlowRangeInput);
    dom.toggleCursorBtn?.addEventListener("click", onToggleCursor);
    dom.toggleHighlightBtn?.addEventListener("click", onToggleHighlight);
    dom.toggleScanGlowBtn?.addEventListener("click", onToggleScanGlow);
    dom.toggleFlyinBtn?.addEventListener("click", onToggleFlyin);
    dom.progressSlider?.addEventListener("input", handleProgressInput);
    dom.exportRatioSelect?.addEventListener("change", handleExportRatioChange);
    dom.exportResSelect?.addEventListener("change", handleExportResolutionChange);
    dom.exportFpsSelect?.addEventListener("change", handleExportFpsChange);
    dom.cancelExportBtn?.addEventListener("click", onCancelExport);
    dom.playlineRatioSlider?.addEventListener("input", handlePlaylineRatioInput);
    dom.stickyLockRatioSlider?.addEventListener("input", handleStickyLockRatioInput);
    bindSliderDoubleClickReset(dom.distSlider);
    bindSliderDoubleClickReset(dom.scatterSlider);
    bindSliderDoubleClickReset(dom.delaySlider);
    bindSliderDoubleClickReset(dom.glowRangeSlider);
    bindSliderDoubleClickReset(dom.playlineRatioSlider);
    bindSliderDoubleClickReset(dom.stickyLockRatioSlider);
    dom.exportPngBtn?.addEventListener("click", onExportPngClick);
    dom.exportVideoBtn?.addEventListener("click", onExportVideoClick);
    window.addEventListener("keydown", handleWindowKeydown);
    window.addEventListener("resize", handleResize);
}
