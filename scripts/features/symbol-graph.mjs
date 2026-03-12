function normalizeBandIndex(item) {
    return Number.isInteger(item?.bandIndex) ? item.bandIndex : -1;
}

function sortByXThenY(items) {
    return [...items].sort((a, b) => (
        (a.left - b.left)
        || (a.centerY - b.centerY)
        || String(a.id || '').localeCompare(String(b.id || ''))
    ));
}

function minFinite(values, fallback = Infinity) {
    const finiteValues = values.filter((value) => Number.isFinite(value));
    return finiteValues.length > 0 ? Math.min(...finiteValues) : fallback;
}

function collectContiguousPrefix(candidates, gapMax) {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];

    const contiguousCandidates = [candidates[0]];
    let previousCandidate = candidates[0];

    for (let i = 1; i < candidates.length; i++) {
        const candidate = candidates[i];
        const gap = Math.max(0, candidate.left - previousCandidate.right);
        if (gap > gapMax) break;
        contiguousCandidates.push(candidate);
        previousCandidate = candidate;
    }

    return contiguousCandidates;
}

function canShareBand(a, b, fallbackDyMax) {
    if (a.bandIndex !== -1 && b.bandIndex !== -1) return a.bandIndex === b.bandIndex;
    return Math.abs(a.centerY - b.centerY) <= fallbackDyMax;
}

function horizontalGapBetween(a, b) {
    if (b.left >= a.right) return b.left - a.right;
    if (a.left >= b.right) return a.left - b.right;
    return 0;
}

function collectNoteAdjacentSeedIds(accidentalGroups, noteheads, staffSpace) {
    const normalizedStaffSpace = Math.max(1, Number.isFinite(staffSpace) ? staffSpace : 10);
    const seedDxMin = -normalizedStaffSpace * 0.6;
    const seedDxMax = Math.max(4, normalizedStaffSpace * 1.2);
    const seedDyMax = Math.max(2, normalizedStaffSpace * 1.2);

    const seedIds = new Set();
    (Array.isArray(accidentalGroups) ? accidentalGroups : []).forEach((accidental) => {
        const hasNearbyNote = (Array.isArray(noteheads) ? noteheads : []).some((note) => {
            if (!canShareBand(accidental, note, seedDyMax)) return false;
            const dx = note.left - accidental.right;
            const dy = Math.abs(note.centerY - accidental.centerY);
            return dx >= seedDxMin && dx <= seedDxMax && dy <= seedDyMax;
        });

        if (hasNearbyNote) {
            seedIds.add(accidental._id);
        }
    });

    return seedIds;
}

function spreadAccidentalContagion(accidentalGroups, seedIds, staffSpace) {
    const normalizedStaffSpace = Math.max(1, Number.isFinite(staffSpace) ? staffSpace : 10);
    const spreadGapMax = Math.max(2, normalizedStaffSpace * 1.15);
    const spreadDyMax = Math.max(2, normalizedStaffSpace * 1.8);

    const infectedIds = new Set(seedIds);
    const queue = (Array.isArray(accidentalGroups) ? accidentalGroups : [])
        .filter((candidate) => infectedIds.has(candidate._id));

    while (queue.length > 0) {
        const current = queue.shift();
        (Array.isArray(accidentalGroups) ? accidentalGroups : []).forEach((candidate) => {
            if (infectedIds.has(candidate._id)) return;
            if (!canShareBand(current, candidate, spreadDyMax)) return;

            const gap = horizontalGapBetween(current, candidate);
            const dy = Math.abs(current.centerY - candidate.centerY);
            if (gap > spreadGapMax || dy > spreadDyMax) return;

            infectedIds.add(candidate._id);
            queue.push(candidate);
        });
    }

    return infectedIds;
}

export function buildTrustedBarlineAnchors({
    systemStartX,
    staffSystems,
    candidateClusters,
    staffSpace,
}) {
    const normalizedStaffSpace = Math.max(1, Number.isFinite(staffSpace) ? staffSpace : 10);
    const normalizedSystems = (Array.isArray(staffSystems) ? staffSystems : [])
        .map((system) => ({
            top: Number(system?.top),
            bottom: Number(system?.bottom),
        }))
        .filter((system) => Number.isFinite(system.top) && Number.isFinite(system.bottom) && system.bottom > system.top);

    const anchors = [];
    if (Number.isFinite(systemStartX)) {
        anchors.push({ x: systemStartX, kind: 'system-start', count: 1 });
    }

    const verticalTolerance = Math.max(3, normalizedStaffSpace * 0.8);
    const minimumClusterHeight = Math.max(8, normalizedStaffSpace * 3.2);

    (Array.isArray(candidateClusters) ? candidateClusters : []).forEach((cluster) => {
        const x = Number(cluster?.x);
        const minTop = Number(cluster?.minTop);
        const maxBottom = Number(cluster?.maxBottom);
        const lineCount = Number(cluster?.lineCount);
        const maxLineHeight = Number(cluster?.maxLineHeight);
        if (![x, minTop, maxBottom].every(Number.isFinite)) return;

        const span = maxBottom - minTop;
        if (!(span >= minimumClusterHeight)) return;

        const matchesSystem = normalizedSystems.some((system) => {
            const systemHeight = system.bottom - system.top;
            const minimumCoverage = Math.max(minimumClusterHeight, systemHeight * 0.55);
            const minimumLineHeight = Math.max(minimumClusterHeight, systemHeight * 0.5);
            const touchesSystemTop = minTop <= system.top + verticalTolerance;
            const touchesSystemBottom = maxBottom >= system.bottom - verticalTolerance;

            return touchesSystemTop
                && touchesSystemBottom
                && span >= minimumCoverage
                && maxLineHeight >= minimumLineHeight;
        });

        if (!matchesSystem) return;

        anchors.push({
            x,
            kind: 'barline',
            count: Number.isFinite(lineCount) ? lineCount : 1,
        });
    });

    anchors.sort((a, b) => a.x - b.x);
    return anchors.filter((anchor, index) => {
        if (index === 0) return true;
        return Math.abs(anchor.x - anchors[index - 1].x) > Math.max(1.5, normalizedStaffSpace * 0.2);
    });
}

export function classifyAccidentalGroups({
    accidentalGroups,
    noteheads,
    timeSignatureGlyphs,
    trustedAnchors,
    staffSpace,
}) {
    const normalizedStaffSpace = Math.max(1, Number.isFinite(staffSpace) ? staffSpace : 10);
    const anchorWindowMax = Math.max(48, normalizedStaffSpace * 8);
    const anchorGapMax = Math.max(4, normalizedStaffSpace * 3);
    const boundaryPadding = Math.max(2, normalizedStaffSpace * 0.75);

    const normalizedGroups = sortByXThenY(Array.isArray(accidentalGroups) ? accidentalGroups : [])
        .map((group, index) => ({
            ...group,
            _id: group.id || `acc-group-${index}`,
            bandIndex: normalizeBandIndex(group),
        }));

    const normalizedNotes = sortByXThenY(Array.isArray(noteheads) ? noteheads : [])
        .map((note, index) => ({
            ...note,
            _id: note.id || `note-${index}`,
            bandIndex: normalizeBandIndex(note),
        }));

    const normalizedTimeSigs = sortByXThenY(Array.isArray(timeSignatureGlyphs) ? timeSignatureGlyphs : [])
        .map((item, index) => ({
            ...item,
            _id: item.id || `timesig-${index}`,
            bandIndex: normalizeBandIndex(item),
        }));

    const anchors = [...(Array.isArray(trustedAnchors) ? trustedAnchors : [])]
        .filter((anchor) => Number.isFinite(anchor?.x))
        .sort((a, b) => a.x - b.x);

    const seedIds = collectNoteAdjacentSeedIds(normalizedGroups, normalizedNotes, normalizedStaffSpace);
    const accidentalIds = spreadAccidentalContagion(normalizedGroups, seedIds, normalizedStaffSpace);
    const keySignatureIds = new Set();
    const seenBands = new Set(normalizedGroups.map((group) => group.bandIndex).filter((bandIndex) => bandIndex !== -1));

    seenBands.forEach((bandIndex) => {
        const bandGroups = normalizedGroups.filter((group) => (
            group.bandIndex === bandIndex
            && !accidentalIds.has(group._id)
        ));
        if (bandGroups.length === 0) return;

        const bandNotes = normalizedNotes.filter((note) => note.bandIndex === bandIndex);
        const bandTimeSigs = normalizedTimeSigs.filter((item) => item.bandIndex === bandIndex || item.bandIndex === -1);

        anchors.forEach((anchor, anchorIndex) => {
            const nextAnchorX = anchors[anchorIndex + 1]?.x ?? Infinity;
            const candidatesToRight = bandGroups.filter((group) => (
                group.left >= anchor.x - boundaryPadding
                && group.left < nextAnchorX - boundaryPadding
            ));

            if (candidatesToRight.length === 0) return;

            const firstCandidate = candidatesToRight[0];
            if (firstCandidate.left > anchor.x + anchorWindowMax) return;

            const notesToRight = bandNotes.filter((note) => note.left >= anchor.x - boundaryPadding);
            const timeSigsToRight = bandTimeSigs.filter((item) => item.left >= anchor.x - boundaryPadding);
            const firstRightBoundary = minFinite([
                nextAnchorX - boundaryPadding,
                ...notesToRight.map((note) => note.left),
                ...timeSigsToRight.map((item) => item.left),
            ]);

            const leadingCandidates = candidatesToRight.filter((group) => (
                group.right <= firstRightBoundary + boundaryPadding
            ));
            if (leadingCandidates.length === 0) return;

            const keySignatureCandidates = collectContiguousPrefix(leadingCandidates, anchorGapMax);
            if (keySignatureCandidates.length === 0) return;

            keySignatureCandidates.forEach((candidate) => {
                keySignatureIds.add(candidate._id);
            });
        });
    });

    return {
        keySignatureIds: normalizedGroups
            .filter((group) => keySignatureIds.has(group._id))
            .map((group) => group._id),
        accidentalIds: normalizedGroups
            .filter((group) => accidentalIds.has(group._id) || !keySignatureIds.has(group._id))
            .map((group) => group._id),
    };
}
