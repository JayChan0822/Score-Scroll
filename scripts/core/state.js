// @ts-check

/**
 * @typedef {Object} TempoEvent
 * @property {number} ticks
 * @property {number} bpm
 * @property {number} time
 */

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
 * @typedef {Object} SvgTag
 * @property {number} x
 * @property {number} tick
 * @property {number} [y]
 */

/**
 * @typedef {Object} AppState
 * @property {number | undefined} animationFrameId
 * @property {number} audioOffsetSec
 * @property {HTMLAudioElement} audioPlayer
 * @property {boolean} audioWaiting
 * @property {number} cachedViewportWidth
 * @property {boolean} cancelVideoExport
 * @property {number} currentBpm
 * @property {string} defaultBgColor
 * @property {string} defaultNoteColor
 * @property {number} elapsedBeforePause
 * @property {boolean} enableFlyin
 * @property {File | null} globalAudioFile
 * @property {number | null} globalAudioOnsetSec
 * @property {number} globalMidiPpq
 * @property {TempoEvent[]} globalMidiTempos
 * @property {number} globalScoreHeight
 * @property {number} globalSystemBarlineScreenX
 * @property {number} globalSystemInternalX
 * @property {TimeSignaturePoint[]} globalTimeSigs
 * @property {number} globalZoom
 * @property {boolean} isAudioLoaded
 * @property {boolean} isExportingVideoMode
 * @property {boolean} isFinished
 * @property {boolean} isMidiLoaded
 * @property {boolean} isPlaying
 * @property {number} lastHighlightedIndex
 * @property {number} lastRenderClock
 * @property {number} lastUiUpdateTime
 * @property {TimeMapPoint[]} mapData
 * @property {number} midiDurationSec
 * @property {number} playbackSimTime
 * @property {number} playlineRatio
 * @property {Array<Record<string, unknown>>} renderQueue
 * @property {number} scanGlowRange
 * @property {boolean} showHighlights
 * @property {boolean} showPlayline
 * @property {boolean} showScanGlow
 * @property {number} startTime
 * @property {string} currentScoreSourceType
 * @property {number} stickyLockRatio
 * @property {number} stickyMinX
 * @property {SvgTag[]} svgTags
 */

/** @returns {AppState} */
export function createInitialState() {
    return {
        animationFrameId: undefined,
        audioOffsetSec: 0,
        audioPlayer: new Audio(),
        audioWaiting: false,
        cachedViewportWidth: 0,
        cancelVideoExport: false,
        currentBpm: 120,
        defaultBgColor: "#000000",
        defaultNoteColor: "#ffffff",
        elapsedBeforePause: 0,
        enableFlyin: true,
        globalAudioFile: null,
        globalAudioOnsetSec: null,
        globalMidiPpq: 480,
        globalMidiTempos: [],
        globalScoreHeight: 500,
        globalSystemBarlineScreenX: 0,
        globalSystemInternalX: 0,
        globalTimeSigs: [],
        globalZoom: 1.0,
        isAudioLoaded: false,
        isExportingVideoMode: false,
        isFinished: false,
        isMidiLoaded: false,
        isPlaying: false,
        lastHighlightedIndex: -1,
        lastRenderClock: 0,
        lastUiUpdateTime: 0,
        mapData: [],
        midiDurationSec: 0,
        playbackSimTime: 0,
        playlineRatio: 0.5,
        renderQueue: [],
        scanGlowRange: 100,
        showHighlights: true,
        showPlayline: true,
        showScanGlow: true,
        startTime: 0,
        currentScoreSourceType: "Unknown",
        stickyLockRatio: 0.5,
        stickyMinX: 0,
        svgTags: [],
    };
}
