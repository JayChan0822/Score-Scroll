export function calculateStickySystemDelta({ type, baseWidth, currentWidth }) {
    const normalizedBaseWidth = Number.isFinite(baseWidth) ? baseWidth : 0;
    const normalizedCurrentWidth = Number.isFinite(currentWidth) ? currentWidth : 0;
    let delta = normalizedCurrentWidth - normalizedBaseWidth;

    const usesSyntheticPadding = type !== 'key' || normalizedBaseWidth > 0;
    if (usesSyntheticPadding) {
        if (normalizedBaseWidth === 0 && normalizedCurrentWidth > 0) delta += 15;
        else if (normalizedBaseWidth > 0 && normalizedCurrentWidth === 0) delta -= 15;
    }

    return delta;
}

export function getStickyBlockDisplayWidth({ type, blockWidth, clearsKeySignature = false }) {
    const normalizedWidth = Number.isFinite(blockWidth) ? blockWidth : 0;

    if (type === 'key' && clearsKeySignature) {
        return 0;
    }

    return normalizedWidth;
}

export function calculateRehearsalMarkStickyYOffset({
    hasOpeningClefAnchor,
    rehearsalMaxY,
    clefMinY,
    padding = 4,
}) {
    const normalizedRehearsalMaxY = Number.isFinite(rehearsalMaxY) ? rehearsalMaxY : null;
    const normalizedClefMinY = Number.isFinite(clefMinY) ? clefMinY : null;
    const normalizedPadding = Number.isFinite(padding) ? padding : 0;

    if (!hasOpeningClefAnchor || normalizedRehearsalMaxY === null || normalizedClefMinY === null) {
        return 0;
    }

    const targetBottomY = normalizedClefMinY - normalizedPadding;
    return targetBottomY - normalizedRehearsalMaxY;
}

export function resolveRehearsalMarkTargetExtraY({
    itemBlockIndex,
    currentActive,
    targetExtraY,
    currentExtraY,
}) {
    const normalizedTargetExtraY = Number.isFinite(targetExtraY) ? targetExtraY : 0;

    if (
        Number.isFinite(itemBlockIndex)
        && Number.isFinite(currentActive)
        && itemBlockIndex < currentActive
        && Number.isFinite(currentExtraY)
    ) {
        return currentExtraY;
    }

    return normalizedTargetExtraY;
}

function isOpeningStickyBlock(minX, stickyMinX, openingThresholdX) {
    return Number.isFinite(minX)
        && Number.isFinite(stickyMinX)
        && Number.isFinite(openingThresholdX)
        && minX <= stickyMinX + openingThresholdX;
}

export function calculateStickyBlockLockDistance({
    type,
    blockMinX,
    firstBlockMinX,
    openingClefMinX,
    fallbackAnchorX,
    openingThresholdX,
    stickyMinX,
}) {
    const normalizedBlockMinX = Number.isFinite(blockMinX) ? blockMinX : 0;
    const normalizedFirstBlockMinX = Number.isFinite(firstBlockMinX) ? firstBlockMinX : normalizedBlockMinX;
    const normalizedStickyMinX = Number.isFinite(stickyMinX) ? stickyMinX : 0;
    const normalizedOpeningThresholdX = Number.isFinite(openingThresholdX) ? openingThresholdX : 0;
    const normalizedFallbackAnchorX = Number.isFinite(fallbackAnchorX) ? fallbackAnchorX : null;

    let anchorX = normalizedStickyMinX;
    if (type === "inst") {
        anchorX = normalizedFirstBlockMinX;
    } else if (type === "reh" && isOpeningStickyBlock(openingClefMinX, normalizedStickyMinX, normalizedOpeningThresholdX)) {
        anchorX = openingClefMinX;
    } else if (isOpeningStickyBlock(normalizedFirstBlockMinX, normalizedStickyMinX, normalizedOpeningThresholdX)) {
        anchorX = normalizedFirstBlockMinX;
    } else if (normalizedFallbackAnchorX !== null) {
        anchorX = normalizedFallbackAnchorX;
    }

    return Math.max(0, normalizedBlockMinX - anchorX);
}
