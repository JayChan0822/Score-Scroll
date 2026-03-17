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

/**
 * @typedef {{ [category: string]: Record<string, string[]> | undefined }} MusicFontDefinition
 */

/** @type {Record<string, MusicFontDefinition>} */
const musicFontRegistry = /** @type {Record<string, MusicFontDefinition>} */ (MusicFontRegistry);

const RANGE_DIGIT_OFFSETS = [
    { start: 0xE080, end: 0xE089, isGiant: false },
    { start: 0xE090, end: 0xE099, isGiant: false },
    { start: 0xE0A0, end: 0xE0A9, isGiant: false },
    { start: 0xF440, end: 0xF449, isGiant: true },
    { start: 0xF506, end: 0xF50F, isGiant: true },
];

const COMMON_TIME_CODEPOINTS = new Map([
    [0xE08A, false],
    [0xF510, true],
]);

const CUT_TIME_CODEPOINTS = new Map([
    [0xE08B, false],
    [0xF511, true],
]);

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
const registryCategorySignatureLookupCache = new Map();

const GLYPH_REGISTRY_CATEGORIES = new Set([
    "timeSignatures",
    "clefs",
    "accidentals",
    "noteheads",
]);

/**
 * @param {number} codepoint
 * @returns {{ digit: string, isGiant: boolean } | null}
 */
function mapCodepointToDigit(codepoint) {
    for (const range of RANGE_DIGIT_OFFSETS) {
        if (codepoint >= range.start && codepoint <= range.end) {
            return {
                digit: String(codepoint - range.start),
                isGiant: Boolean(range.isGiant),
            };
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
 * @param {string} category
 * @returns {Map<string, string[]>}
 */
function buildRegistryCategorySignatureLookup(category) {
    if (registryCategorySignatureLookupCache.has(category)) {
        return registryCategorySignatureLookupCache.get(category);
    }

    /** @type {Map<string, string[]>} */
    const lookup = new Map();

    Object.entries(musicFontRegistry).forEach(([fontName, fontData]) => {
        const categoryMap = fontData?.[category];
        if (!categoryMap || typeof categoryMap !== "object") return;

        Object.values(categoryMap).forEach((signatures) => {
            (Array.isArray(signatures) ? signatures : []).forEach((signature) => {
                if (!signature) return;
                let fonts = lookup.get(signature);
                if (!fonts) {
                    fonts = [];
                    lookup.set(signature, fonts);
                }
                if (!fonts.includes(fontName)) {
                    fonts.push(fontName);
                }
            });
        });
    });

    registryCategorySignatureLookupCache.set(category, lookup);
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
 * @param {{
 *   signature: string,
 *   category: string,
 *   explicitFontFamily?: string,
 *   preferredFontFamily?: string,
 *   contextFontFamily?: string,
 * }} options
 * @returns {string | null}
 */
export function resolveMusicFontFamilyForPathSignature({
    signature,
    category,
    explicitFontFamily = "",
    preferredFontFamily = "",
    contextFontFamily = "",
}) {
    const normalizedExplicitFont = normalizeMusicFontFamily(explicitFontFamily);
    if (normalizedExplicitFont) return normalizedExplicitFont;
    if (!signature || !GLYPH_REGISTRY_CATEGORIES.has(category)) return null;

    const lookup = buildRegistryCategorySignatureLookup(category);
    const candidates = lookup.get(signature) || [];
    if (candidates.length === 0) return null;

    /** @type {string[]} */
    const preferredCandidates = [];
    const normalizedContextFont = normalizeMusicFontFamily(contextFontFamily);
    const normalizedPreferredFont = normalizeMusicFontFamily(preferredFontFamily);
    if (normalizedContextFont) preferredCandidates.push(normalizedContextFont);
    if (normalizedPreferredFont) preferredCandidates.push(normalizedPreferredFont);

    for (const preferredCandidate of preferredCandidates) {
        if (candidates.includes(preferredCandidate)) {
            return preferredCandidate;
        }
    }

    return candidates[0] || null;
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
        const commonTimeIsGiant = COMMON_TIME_CODEPOINTS.get(codepoint);
        if (commonTimeIsGiant !== undefined) {
            return { token: "COMMON", kind: /** @type {TimeSignatureKind} */ ("common"), isGiant: commonTimeIsGiant };
        }
        const cutTimeIsGiant = CUT_TIME_CODEPOINTS.get(codepoint);
        if (cutTimeIsGiant !== undefined) {
            return { token: "CUT", kind: /** @type {TimeSignatureKind} */ ("cut"), isGiant: cutTimeIsGiant };
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
        const digitInfo = mapCodepointToDigit(codepoint);
        if (digitInfo !== null) {
            digits += digitInfo.digit;
            if (digitInfo.isGiant) isGiant = true;
            continue;
        }

        return null;
    }

    return digits ? { token: digits, kind: /** @type {TimeSignatureKind} */ ("number"), isGiant } : null;
}

/**
 * @param {string} signature
 * @param {string} fontFamily
 * @param {{ preferredFontFamily?: string, contextFontFamily?: string }} [options]
 * @returns {DecodedTimeSignature | null}
 */
export function decodeTimeSignaturePath(signature, fontFamily, options = {}) {
    const normalizedFont = resolveMusicFontFamilyForPathSignature({
        signature,
        category: "timeSignatures",
        explicitFontFamily: fontFamily,
        preferredFontFamily: options.preferredFontFamily || "",
        contextFontFamily: options.contextFontFamily || "",
    });
    if (!normalizedFont || !signature) return null;

    const lookup = buildPathLookup(normalizedFont);
    return lookup.get(signature) || null;
}
