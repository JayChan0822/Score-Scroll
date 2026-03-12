const GENERIC_FONT_FAMILIES = new Set([
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-serif",
    "ui-sans-serif",
    "ui-monospace",
    "emoji",
    "math",
    "fangsong",
]);

const SYSTEM_FONT_FAMILIES = new Set([
    "-apple-system",
    "blinkmacsystemfont",
    ".applesystemuifont",
]);

function splitFontFamilyList(value) {
    if (typeof value !== "string" || value.trim() === "") return [];

    const families = [];
    let current = "";
    let quote = null;

    for (const char of value) {
        if (quote) {
            current += char;
            if (char === quote) {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            current += char;
            continue;
        }

        if (char === ",") {
            families.push(current);
            current = "";
            continue;
        }

        current += char;
    }

    if (current !== "") {
        families.push(current);
    }

    return families;
}

function normalizeFontFamilyName(value) {
    if (typeof value !== "string") return "";
    return value.trim().replace(/^['"]+|['"]+$/g, "").replace(/\s+/g, " ");
}

function escapeFontString(value) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isLoadableLocalFontFamily(value) {
    if (!value) return false;
    const normalized = value.trim();
    if (!normalized) return false;

    const lowerValue = normalized.toLowerCase();
    if (GENERIC_FONT_FAMILIES.has(lowerValue)) return false;
    if (SYSTEM_FONT_FAMILIES.has(lowerValue)) return false;
    if (normalized.startsWith(".")) return false;

    return true;
}

function getDeclaredFontFamilyValue(node, documentRef) {
    const attrNode = node.closest("[font-family]") || node;
    const declaredValue = attrNode?.getAttribute?.("font-family");
    if (declaredValue && declaredValue.trim()) {
        return declaredValue;
    }

    const computedValue = documentRef?.defaultView?.getComputedStyle?.(node)?.fontFamily;
    return computedValue || "";
}

export function clearInjectedSvgLocalFontFaces(documentRef = document) {
    documentRef.querySelectorAll(".svg-local-font-face").forEach((node) => node.remove());
}

export function collectImportedSvgTextFontFamilies(svgRoot, { documentRef = document } = {}) {
    if (!svgRoot) return [];

    const dedupedFamilies = new Map();

    svgRoot.querySelectorAll("text, tspan").forEach((node) => {
        const familyValue = getDeclaredFontFamilyValue(node, documentRef);
        splitFontFamilyList(familyValue).forEach((rawFamily) => {
            const normalizedFamily = normalizeFontFamilyName(rawFamily);
            if (!isLoadableLocalFontFamily(normalizedFamily)) return;

            const dedupeKey = normalizedFamily.toLowerCase();
            if (!dedupedFamilies.has(dedupeKey)) {
                dedupedFamilies.set(dedupeKey, normalizedFamily);
            }
        });
    });

    return Array.from(dedupedFamilies.values());
}

export async function registerImportedSvgTextFonts(svgRoot, {
    documentRef = document,
    debugLog = () => {},
} = {}) {
    clearInjectedSvgLocalFontFaces(documentRef);

    const families = collectImportedSvgTextFontFamilies(svgRoot, { documentRef });
    if (families.length === 0) {
        return { families: [], availableFamilies: [], missingFamilies: [] };
    }

    if (!documentRef?.head || !documentRef.fonts?.load) {
        debugLog("⚠️ [本地文本字体] 当前环境不支持 Font Loading API，本地字体预加载已跳过。");
        return { families, availableFamilies: [], missingFamilies: families.slice() };
    }

    const styleEl = documentRef.createElement("style");
    styleEl.className = "svg-local-font-face";
    styleEl.textContent = families.map((family) => {
        const escapedFamily = escapeFontString(family);
        return `@font-face { font-family: "${escapedFamily}"; src: local("${escapedFamily}"); font-display: block; }`;
    }).join("\n");
    documentRef.head.appendChild(styleEl);

    debugLog(`🔤 [本地文本字体] 尝试加载: ${families.join(", ")}`);

    await Promise.allSettled(families.map((family) => {
        const escapedFamily = escapeFontString(family);
        return documentRef.fonts.load(`16px "${escapedFamily}"`);
    }));

    const availableFamilies = families.filter((family) => {
        const escapedFamily = escapeFontString(family);
        return documentRef.fonts.check(`16px "${escapedFamily}"`);
    });
    const availableFamilySet = new Set(availableFamilies);
    const missingFamilies = families.filter((family) => !availableFamilySet.has(family));

    if (missingFamilies.length > 0) {
        debugLog(`⚠️ [本地文本字体] 未在系统中找到: ${missingFamilies.join(", ")}`);
    }

    return { families, availableFamilies, missingFamilies };
}
