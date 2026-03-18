import {
    getInheritedSvgFontFamily,
    normalizeMusicFontFamily,
} from "./time-signature-decoder.js?v=20260317-glyph-font-fallback-1";

export const SCORE_SOURCE_MUSESCORE = "MuseScore";
export const SCORE_SOURCE_DORICO = "Dorico";
export const SCORE_SOURCE_SIBELIUS = "Sibelius";
export const SCORE_SOURCE_UNKNOWN = "Unknown";

const DETECTOR_SEMANTIC_CLASS_TOKENS = {
    clefs: ["Clef"],
    noteheads: ["Note"],
    timeSignatures: ["TimeSig"],
    keySignatures: ["KeySig"],
    accidentals: ["Accidental"],
    brackets: ["Bracket", "Brace"],
    barlines: ["BarLine"],
};

const SIBELIUS_SYMBOL_FONT_REGEX = /\b(?:Opus(?:\s+Special)?\s+Std|Helsinki|Inkpen2)\b/i;
const SIBELIUS_TEXT_DOMAIN_FONT_REGEX = /\bOpus\s+Text\s+Std\b/i;

function buildSemanticSelector(tokens) {
    return tokens.flatMap((token) => [
        `path[class~="${token}"]`,
        `polyline[class~="${token}"]`,
        `line[class~="${token}"]`,
    ]).join(", ");
}

export function buildScoreAnalysisProfile({ sourceType, selectedMusicFont, svgRoot }) {
    const normalizedSelectedMusicFont = normalizeMusicFontFamily(selectedMusicFont) || selectedMusicFont || "Bravura";
    const semanticAvailability = Object.fromEntries(
        Object.entries(DETECTOR_SEMANTIC_CLASS_TOKENS).map(([detectorName, tokens]) => [
            detectorName,
            Boolean(svgRoot?.querySelector(buildSemanticSelector(tokens))),
        ]),
    );

    return {
        sourceType,
        selectedMusicFont: normalizedSelectedMusicFont,
        semanticAvailability,
    };
}

export function getScoreElementFontInfo(el, fallback = "") {
    const rawFontFamily = getInheritedSvgFontFamily(el, fallback);
    return {
        rawFontFamily,
        normalizedFontFamily: normalizeMusicFontFamily(rawFontFamily) || "",
    };
}

export function hasSemanticCandidates(profile, detectorName) {
    return Boolean(profile?.semanticAvailability?.[detectorName]);
}

export function isSibeliusSymbolFontFamily(fontFamily) {
    if (!fontFamily) return false;
    return SIBELIUS_SYMBOL_FONT_REGEX.test(fontFamily) && !SIBELIUS_TEXT_DOMAIN_FONT_REGEX.test(fontFamily);
}

export function isSibeliusTextDomainFontFamily(fontFamily) {
    return SIBELIUS_TEXT_DOMAIN_FONT_REGEX.test(fontFamily || "");
}
