// @ts-check

/**
 * @typedef {Object} DomRefs
 * @property {HTMLInputElement | null} audioInput
 * @property {HTMLInputElement | null} audioOffsetSlider
 * @property {HTMLElement | null} audioOffsetVal
 * @property {HTMLInputElement | null} bgColorPicker
 * @property {HTMLInputElement | null} bpmSlider
 * @property {HTMLElement | null} bpmVal
 * @property {HTMLCanvasElement | null} canvas
 * @property {HTMLButtonElement | null} cancelExportBtn
 * @property {HTMLButtonElement | null} customRatioCancelBtn
 * @property {HTMLButtonElement | null} customRatioConfirmBtn
 * @property {HTMLElement | null} customRatioError
 * @property {HTMLInputElement | null} customRatioInput
 * @property {HTMLElement | null} customRatioModal
 * @property {HTMLInputElement | null} delaySlider
 * @property {HTMLElement | null} delayVal
 * @property {HTMLInputElement | null} distSlider
 * @property {HTMLElement | null} distVal
 * @property {HTMLElement | null} durationDisplay
 * @property {HTMLSelectElement | null} exportFpsSelect
 * @property {HTMLInputElement | null} exportEndInput
 * @property {HTMLElement | null} exportModal
 * @property {HTMLElement | null} exportModalTitle
 * @property {HTMLElement | null} exportProgressBar
 * @property {HTMLElement | null} exportProgressText
 * @property {HTMLButtonElement | null} exportPngBtn
 * @property {HTMLSelectElement | null} exportRatioSelect
 * @property {HTMLSelectElement | null} exportResSelect
 * @property {HTMLInputElement | null} exportStartInput
 * @property {HTMLButtonElement | null} exportVideoBtn
 * @property {HTMLInputElement | null} glowRangeSlider
 * @property {HTMLElement | null} glowRangeVal
 * @property {HTMLInputElement | null} noteColorPicker
 * @property {HTMLButtonElement | null} playBtn
 * @property {HTMLElement | null} previewScrollHost
 * @property {HTMLInputElement | null} playlineRatioSlider
 * @property {HTMLElement | null} playlineRatioVal
 * @property {HTMLElement | null} scoreSourceType
 * @property {HTMLInputElement | null} stickyLockRatioSlider
 * @property {HTMLElement | null} stickyLockRatioVal
 * @property {HTMLInputElement | null} progressSlider
 * @property {HTMLElement | null} sandbox
 * @property {HTMLInputElement | null} scatterSlider
 * @property {HTMLElement | null} scatterVal
 * @property {HTMLElement | null} tempoSourceHint
 * @property {HTMLButtonElement | null} themeDarkBtn
 * @property {HTMLButtonElement | null} themeLightBtn
 * @property {HTMLElement | null} timeDisplay
 * @property {HTMLButtonElement | null} toggleCursorBtn
 * @property {HTMLButtonElement | null} toggleFlyinBtn
 * @property {HTMLButtonElement | null} toggleHighlightBtn
 * @property {HTMLButtonElement | null} toggleScanGlowBtn
 * @property {HTMLElement | null} viewportEl
 * @property {HTMLButtonElement | null} viewportFullscreenBtn
 * @property {HTMLButtonElement | null} zoomInBtn
 * @property {HTMLButtonElement | null} zoomOutBtn
 * @property {HTMLElement | null} zoomSliderContainer
 * @property {HTMLElement | null} zoomValDisplay
 */

/**
 * @template {Element} T
 * @param {Document} doc
 * @param {string} id
 * @returns {T | null}
 */
function byId(doc, id) {
    return /** @type {T | null} */ (doc.getElementById(id));
}

/**
 * @param {Document} [doc=document]
 * @returns {DomRefs}
 */
export function getDomRefs(doc = document) {
    return {
        audioInput: byId(doc, "audioInput"),
        audioOffsetSlider: byId(doc, "audioOffsetSlider"),
        audioOffsetVal: byId(doc, "audioOffsetVal"),
        bgColorPicker: byId(doc, "bgColorPicker"),
        bpmSlider: byId(doc, "bpmSlider"),
        bpmVal: byId(doc, "bpmVal"),
        canvas: byId(doc, "score-canvas"),
        cancelExportBtn: byId(doc, "cancelExportBtn"),
        customRatioCancelBtn: byId(doc, "customRatioCancelBtn"),
        customRatioConfirmBtn: byId(doc, "customRatioConfirmBtn"),
        customRatioError: byId(doc, "customRatioError"),
        customRatioInput: byId(doc, "customRatioInput"),
        customRatioModal: byId(doc, "customRatioModal"),
        delaySlider: byId(doc, "delaySlider"),
        delayVal: byId(doc, "delayVal"),
        distSlider: byId(doc, "distSlider"),
        distVal: byId(doc, "distVal"),
        durationDisplay: byId(doc, "durationDisplay"),
        exportFpsSelect: byId(doc, "exportFpsSelect"),
        exportEndInput: byId(doc, "exportEndInput"),
        exportModal: byId(doc, "exportModal"),
        exportModalTitle: byId(doc, "exportModalTitle"),
        exportProgressBar: byId(doc, "exportProgressBar"),
        exportProgressText: byId(doc, "exportProgressText"),
        exportPngBtn: byId(doc, "exportPngBtn"),
        exportRatioSelect: byId(doc, "exportRatioSelect"),
        exportResSelect: byId(doc, "exportResSelect"),
        exportStartInput: byId(doc, "exportStartInput"),
        exportVideoBtn: byId(doc, "exportVideoBtn"),
        glowRangeSlider: byId(doc, "glowRangeSlider"),
        glowRangeVal: byId(doc, "glowRangeVal"),
        noteColorPicker: byId(doc, "noteColorPicker"),
        playBtn: byId(doc, "playBtn"),
        previewScrollHost: byId(doc, "previewScrollHost"),
        playlineRatioSlider: byId(doc, "playlineRatioSlider"),
        playlineRatioVal: byId(doc, "playlineRatioVal"),
        scoreSourceType: byId(doc, "scoreSourceType"),
        stickyLockRatioSlider: byId(doc, "stickyLockRatioSlider"),
        stickyLockRatioVal: byId(doc, "stickyLockRatioVal"),
        progressSlider: byId(doc, "progressSlider"),
        sandbox: byId(doc, "svg-sandbox"),
        scatterSlider: byId(doc, "scatterSlider"),
        scatterVal: byId(doc, "scatterVal"),
        tempoSourceHint: byId(doc, "tempoSourceHint"),
        themeDarkBtn: byId(doc, "themeDarkBtn"),
        themeLightBtn: byId(doc, "themeLightBtn"),
        timeDisplay: byId(doc, "timeDisplay"),
        toggleCursorBtn: byId(doc, "toggleCursorBtn"),
        toggleFlyinBtn: byId(doc, "toggleFlyinBtn"),
        toggleHighlightBtn: byId(doc, "toggleHighlightBtn"),
        toggleScanGlowBtn: byId(doc, "toggleScanGlowBtn"),
        viewportEl: byId(doc, "viewport"),
        viewportFullscreenBtn: byId(doc, "viewportFullscreenBtn"),
        zoomInBtn: byId(doc, "zoomInBtn"),
        zoomOutBtn: byId(doc, "zoomOutBtn"),
        zoomSliderContainer: byId(doc, "zoomSlider"),
        zoomValDisplay: byId(doc, "zoomValDisplay"),
    };
}
