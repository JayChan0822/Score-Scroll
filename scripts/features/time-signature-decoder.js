import { MusicFontRegistry } from "../data/music-font-registry.js";

/**
 * @typedef {"number" | "common" | "cut"} TimeSignatureKind
 */

/**
 * @typedef {Object} DecodedTimeSignature
 * @property {string} token
 * @property {TimeSignatureKind} kind
 * @property {boolean} isGiant
 */

/** @type {Record<string, { timeSignatures?: Record<string, string[]> }>} */
const musicFontRegistry = /** @type {Record<string, { timeSignatures?: Record<string, string[]> }> } */ (MusicFontRegistry);

const RANGE_DIGIT_OFFSETS = [
    { start: 0xE080, end: 0xE089 },
    { start: 0xE090, end: 0xE099 },
    { start: 0xE0A0, end: 0xE0A9 },
    { start: 0xF440, end: 0xF449 },
    { start: 0xF50C, end: 0xF515 },
];

const COMMON_TIME_CODEPOINTS = new Set([0xE08A]);
const CUT_TIME_CODEPOINTS = new Set([0xE08B]);

const FONT_ALIASES = [
    ["finale ash", "Ash"],
    ["finaleash", "Ash"],
    ["ash", "Ash"],
    ["bravura", "Bravura"],
    ["leland", "Leland"],
    ["petaluma", "Petaluma"],
    ["sebastian", "Sebastian"],
    ["opus", "Opus"],
];

const pathTimeSignatureLookupCache = new Map();

/**
 * @param {number} codepoint
 * @returns {string | null}
 */
function mapCodepointToDigit(codepoint) {
    for (const range of RANGE_DIGIT_OFFSETS) {
        if (codepoint >= range.start && codepoint <= range.end) {
            return String(codepoint - range.start);
        }
    }
    return null;
}

/**
 * @param {string} token
 * @returns {DecodedTimeSignature | null}
 */
function toDecodedTimeSignatureToken(token) {
    if (!token) return null;
    if (/^\d+$/.test(token)) return { token, kind: /** @type {TimeSignatureKind} */ ("number"), isGiant: false };
    if (token === "COMMON") return { token, kind: /** @type {TimeSignatureKind} */ ("common"), isGiant: false };
    if (token === "CUT") return { token, kind: /** @type {TimeSignatureKind} */ ("cut"), isGiant: false };
    return null;
}

/**
 * @param {string} fontName
 * @returns {Map<string, DecodedTimeSignature>}
 */
function buildPathLookup(fontName) {
    if (pathTimeSignatureLookupCache.has(fontName)) {
        return pathTimeSignatureLookupCache.get(fontName);
    }

    /** @type {Map<string, DecodedTimeSignature>} */
    const lookup = new Map();
    const fontData = musicFontRegistry[fontName];
    const timeSignatures = fontData?.timeSignatures || {};

    Object.entries(timeSignatures).forEach(([symbolName, signatures]) => {
        const normalizedToken = symbolName === "Common Time"
            ? "COMMON"
            : symbolName === "Cut Time"
                ? "CUT"
                : symbolName;
        const decoded = toDecodedTimeSignatureToken(normalizedToken);
        if (!decoded) return;

        signatures.forEach((signature) => {
            lookup.set(signature, decoded);
        });
    });

    pathTimeSignatureLookupCache.set(fontName, lookup);
    return lookup;
}

/**
 * @param {string} d
 * @returns {string}
 */
export function simplifySvgPathSignature(d) {
    return (d || "").replace(/[^A-Za-z]/g, "").toUpperCase();
}

/**
 * @param {string} fontFamily
 * @returns {string | null}
 */
export function normalizeMusicFontFamily(fontFamily) {
    if (!fontFamily) return null;

    const compact = String(fontFamily).replace(/['"]/g, "").trim();
    const lowered = compact.toLowerCase();

    for (const [needle, normalized] of FONT_ALIASES) {
        if (lowered.includes(needle)) return normalized;
    }

    return musicFontRegistry[compact] ? compact : null;
}

/**
 * @param {Element | null | undefined} el
 * @param {string} [fallback]
 * @returns {string}
 */
export function getInheritedSvgFontFamily(el, fallback = "") {
    let node = el;
    while (node) {
        if (typeof node.getAttribute === "function") {
            const fontFamily = node.getAttribute("font-family");
            if (fontFamily) return fontFamily;
        }
        node = node.parentElement;
    }
    return fallback;
}

/**
 * @param {string} content
 * @returns {DecodedTimeSignature | null}
 */
export function decodeTimeSignatureText(content) {
    const trimmed = (content || "").trim();
    if (!trimmed) return null;

    if (trimmed === "c") {
        return { token: "COMMON", kind: /** @type {TimeSignatureKind} */ ("common"), isGiant: false };
    }

    if (trimmed === "¢") {
        return { token: "CUT", kind: /** @type {TimeSignatureKind} */ ("cut"), isGiant: false };
    }

    if (trimmed.length === 1) {
        const codepoint = trimmed.codePointAt(0);
        if (codepoint === undefined) return null;
        if (COMMON_TIME_CODEPOINTS.has(codepoint)) {
            return { token: "COMMON", kind: /** @type {TimeSignatureKind} */ ("common"), isGiant: false };
        }
        if (CUT_TIME_CODEPOINTS.has(codepoint)) {
            return { token: "CUT", kind: /** @type {TimeSignatureKind} */ ("cut"), isGiant: false };
        }
    }

    let digits = "";
    let isGiant = false;

    for (const char of trimmed) {
        if (/[0-9]/.test(char)) {
            digits += char;
            continue;
        }

        const codepoint = char.codePointAt(0);
        if (codepoint === undefined) return null;
        const digit = mapCodepointToDigit(codepoint);
        if (digit !== null) {
            digits += digit;
            if (codepoint >= 0xF000) isGiant = true;
            continue;
        }

        return null;
    }

    return digits ? { token: digits, kind: /** @type {TimeSignatureKind} */ ("number"), isGiant } : null;
}

/**
 * @param {string} signature
 * @param {string} fontFamily
 * @returns {DecodedTimeSignature | null}
 */
export function decodeTimeSignaturePath(signature, fontFamily) {
    const normalizedFont = normalizeMusicFontFamily(fontFamily);
    if (!normalizedFont || !signature) return null;

    const lookup = buildPathLookup(normalizedFont);
    return lookup.get(signature) || null;
}
