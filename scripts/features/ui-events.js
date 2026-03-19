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
    dom.exportPngBtn?.addEventListener("click", onExportPngClick);
    dom.exportVideoBtn?.addEventListener("click", onExportVideoClick);
    window.addEventListener("keydown", handleWindowKeydown);
    window.addEventListener("resize", handleResize);
}
