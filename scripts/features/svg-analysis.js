import { debugLog } from "../utils/debug.js";
import {
    calculateStickyBlockLockDistance,
    getStickyBlockDisplayWidth,
} from "./sticky-layout.mjs?v=20260319-reh-bottom-lane-1";

export function createSvgAnalysisFeature({
    getFallbackSystemInternalX,
    getMathFlyinParams,
    identifyClefOrBrace,
    identifyAccidental,
}) {
    const SOURCE_TYPED_MID_CLEF_OFFSETS = {
        Dorico: {
            Bass: 0.3,
            Treble: -0.3,
            AltoTenor: 0,
        },
        Sibelius: {
            Bass: -0.24,
            Treble: -0.3,
            AltoTenor: -0.2,
        },
        MuseScore: {
            Bass: 0.2,
            Treble: -0.2,
            AltoTenor: 0,
        },
        LilyPond: {
            Bass: 0.16,
            Treble: -0.16,
            AltoTenor: 0,
        },
    };

    function getMidClefOffsetY({ sourceType, specificType, staffSpace }) {
        if (!specificType || !Number.isFinite(staffSpace)) return 0;

        const sourceOffsets = SOURCE_TYPED_MID_CLEF_OFFSETS[sourceType] || SOURCE_TYPED_MID_CLEF_OFFSETS.Dorico;
        if (specificType.includes("Bass")) return staffSpace * (sourceOffsets.Bass || 0);
        if (specificType.includes("Treble")) return staffSpace * (sourceOffsets.Treble || 0);
        if (specificType.includes("Alto/Tenor")) return staffSpace * (sourceOffsets.AltoTenor || 0);
        return 0;
    }

    function getMidClefSpecificType(item) {
        if (!item) return null;

        if (item.type === "path" && item.originalD) {
            const sigStr = item.originalD.replace(/[^a-zA-Z]/g, "").toUpperCase();
            const pathType = identifyClefOrBrace(sigStr, item.originalD);
            if (pathType) return pathType;

            if (item.sourceTypeHint === "MuseScore" && item.symbolType === "Clef") {
                if (sigStr === "MCCCCCCCCCCCCCCCCCCCCCCCCCCCCCMCCCCMCCCC") {
                    return "Bass Clef (低音谱号)";
                }
                if (sigStr.startsWith("MCLCLCLCLMCCCCCCCCCCCCCCCCCCLCCLCCL")) {
                    return "Alto/Tenor Clef (中/次中音谱号)";
                }
                if (sigStr.startsWith("MCCCMCCCCCCCCCCCLMCCCCCMCCCC")) {
                    return "Treble Clef (高音谱号)";
                }
            }
        }

        if (item.type === "text" && item.text) {
            const textType = identifyClefOrBrace((item.text || "").trim(), null);
            if (textType) return textType;
        }

        if (item.sourceTypeHint === "MuseScore" && item.symbolType === "Clef") {
            const hintText = [
                item.sourceElementId || "",
                item.sourceClassName || "",
                item.sourceAriaLabel || "",
                item.sourceDataClef || "",
                item.sourceDataSubtype || "",
                item.text || "",
            ].join(" ").toLowerCase();

            if (/\b(?:bass|f-?clef)\b/.test(hintText)) return "Bass Clef (低音谱号)";
            if (/\b(?:treble|g-?clef)\b/.test(hintText)) return "Treble Clef (高音谱号)";
            if (/\b(?:alto|tenor|c-?clef)\b/.test(hintText)) return "Alto/Tenor Clef (中/次中音谱号)";
        }

        return null;
    }

    function getStickyClefIdentity(item) {
        if (!item) return null;

        if (item.type === "path" && item.originalD) {
            const sig = item.originalD.replace(/[^a-zA-Z]/g, "").toUpperCase();
            return identifyClefOrBrace(sig, item.originalD);
        }

        if (item.type === "text" && item.text) {
            return identifyClefOrBrace((item.text || "").trim(), null);
        }

        return null;
    }

    function getLastKnownClefIdentity(items) {
        if (!Array.isArray(items)) return null;

        for (let i = items.length - 1; i >= 0; i--) {
            const identity = getStickyClefIdentity(items[i]);
            if (identity) return identity;
        }

        return null;
    }

    function getStickyKeyAccidentalIdentity(item) {
        if (typeof identifyAccidental !== "function" || !item) return null;

        if (item.type === "path" && item.originalD) {
            const sig = item.originalD.replace(/[^a-zA-Z]/g, "").toUpperCase();
            return identifyAccidental(sig);
        }

        if (item.type === "text" && item.text) {
            return identifyAccidental((item.text || "").trim());
        }

        return null;
    }

    function isNaturalOnlyKeySignatureBlock(items) {
        return Array.isArray(items)
            && items.length > 0
            && items.every((item) => getStickyKeyAccidentalIdentity(item) === "Natural");
    }

    function shouldClearNaturalOnlyKeySignatureBlock({
        type,
        items,
        isOpeningBlock = false,
    }) {
        if (type !== "key") return false;
        if (!isNaturalOnlyKeySignatureBlock(items)) return false;
        return isOpeningBlock !== true;
    }

    function getStickyTimeAnchorX(item) {
        return Number.isFinite(item?.timeSigAnchorX) ? item.timeSigAnchorX : null;
    }

    function getLastKnownTimeAnchorX(items) {
        if (!Array.isArray(items)) return null;

        for (let i = items.length - 1; i >= 0; i--) {
            const anchorX = getStickyTimeAnchorX(items[i]);
            if (anchorX !== null) return anchorX;
        }

        return null;
    }

    function getTimeSigIsGiant(el) {
        if (typeof el?.getAttribute !== "function") return false;
        const rawValue = (el.getAttribute("data-time-sig-giant") || "").trim().toLowerCase();
        return rawValue === "1" || rawValue === "true";
    }

    function shouldStartNewStickyBlock(type, currentBlock, nextItem, clusterThresholdX) {
        if (!currentBlock || !nextItem) return false;

        const gap = nextItem.absMinX - currentBlock.maxX;
        if (gap >= clusterThresholdX) return true;

        if (type === "time") {
            const currentAnchorX = getLastKnownTimeAnchorX(currentBlock.items);
            const nextAnchorX = getStickyTimeAnchorX(nextItem);
            if (currentAnchorX !== null && nextAnchorX !== null && Math.abs(currentAnchorX - nextAnchorX) > 10) {
                return true;
            }
            return false;
        }

        if (type !== "clef") return false;

        // Clefs should not merge just because they are nearby on the x-axis.
        if (gap > 1) return true;

        const currentIdentity = getLastKnownClefIdentity(currentBlock.items);
        const nextIdentity = getStickyClefIdentity(nextItem);
        if (!currentIdentity || !nextIdentity) return false;

        return currentIdentity !== nextIdentity;
    }

    function buildTimeSignatureStaffBandsFromLineYs(lineYs) {
        if (!Array.isArray(lineYs) || lineYs.length === 0) return [];

        const sorted = lineYs
            .filter(y => Number.isFinite(y))
            .sort((a, b) => a - b);
        if (sorted.length === 0) return [];

        const deduped = [];
        sorted.forEach(y => {
            const lastBandY = deduped[deduped.length - 1];
            if (lastBandY === undefined || Math.abs(y - lastBandY) > 0.5) {
                deduped.push(y);
                return;
            }
            deduped[deduped.length - 1] = (lastBandY + y) / 2;
        });

        let globalStaffSpace = 10;
        if (deduped.length >= 2) {
            const allGaps = [];
            for (let i = 0; i < deduped.length - 1; i++) {
                allGaps.push(deduped[i + 1] - deduped[i]);
            }
            allGaps.sort((a, b) => a - b);
            globalStaffSpace = allGaps[Math.floor(allGaps.length * 0.2)] || 10;
            if (globalStaffSpace < 0.5) globalStaffSpace = 10;
        }

        const staves = [];
        let currentStaff = [deduped[0]];
        const clusterMaxGap = globalStaffSpace * 2.5;

        for (let i = 1; i < deduped.length; i++) {
            const y = deduped[i];
            const prevY = currentStaff[currentStaff.length - 1];
            if (y - prevY <= clusterMaxGap) {
                currentStaff.push(y);
            } else {
                staves.push(currentStaff);
                currentStaff = [y];
            }
        }
        if (currentStaff.length > 0) staves.push(currentStaff);

        const stavesBase = staves.map(lines => {
            const top = lines[0];
            const bottom = lines[lines.length - 1];
            let staffSpace = globalStaffSpace;

            if (lines.length > 1) {
                const gaps = [];
                for (let j = 0; j < lines.length - 1; j++) {
                    gaps.push(lines[j + 1] - lines[j]);
                }
                gaps.sort((a, b) => a - b);
                staffSpace = gaps[Math.floor(gaps.length / 2)] || globalStaffSpace;
            }
            return { top, bottom, lines, staffSpace };
        });

        const staffBands = [];
        for (let i = 0; i < stavesBase.length; i++) {
            const curr = stavesBase[i];
            const prev = stavesBase[i - 1];
            const next = stavesBase[i + 1];

            const absoluteTop = prev
                ? (prev.bottom + curr.top) / 2
                : curr.top - curr.staffSpace * 6;

            const absoluteBottom = next
                ? (curr.bottom + next.top) / 2
                : curr.bottom + curr.staffSpace * 6;

            staffBands.push({
                top: curr.top,
                bottom: curr.bottom,
                lineYs: curr.lines.slice(),
                staffSpace: curr.staffSpace,
                paddedTop: absoluteTop,
                paddedBottom: absoluteBottom,
            });
        }

        return staffBands;
    }

    function assignLaneSystemIndices(lanes) {
        if (!Array.isArray(lanes) || lanes.length === 0) return;

        let currentSystemIndex = 0;
        lanes[0].systemIndex = currentSystemIndex;

        for (let i = 1; i < lanes.length; i++) {
            const previousLane = lanes[i - 1];
            const currentLane = lanes[i];
            const previousBottom = Number.isFinite(previousLane.bandBottom) ? previousLane.bandBottom : previousLane.anchorY;
            const currentTop = Number.isFinite(currentLane.bandTop) ? currentLane.bandTop : currentLane.anchorY;
            const gap = currentTop - previousBottom;
            const systemBreakThreshold = Math.max(
                24,
                (previousLane.staffSpace || 0) * 10,
                (currentLane.staffSpace || 0) * 10,
            );

            if (gap > systemBreakThreshold) {
                currentSystemIndex += 1;
            }

            currentLane.systemIndex = currentSystemIndex;
        }
    }

    function splitDenseGlobalLanesByOpeningClefs(lanes) {
        if (!Array.isArray(lanes) || lanes.length === 0) return lanes;

        return lanes.flatMap((lane, laneIndex) => {
            const openingClefs = (Array.isArray(lane.items) ? lane.items : [])
                .filter((item) => item.symbolType === "Clef" && Number.isFinite(item.centerY) && Number.isFinite(item.absMinX))
                .sort((a, b) => a.absMinX - b.absMinX || a.centerY - b.centerY);

            if (openingClefs.length <= 1) return [lane];

            const minClefX = openingClefs[0].absMinX;
            const openingMaxX = minClefX + Math.max(80, (lane.staffSpace || 0) * 8);
            const openingClusters = [];
            const centerTolerance = Math.max(6, (lane.staffSpace || 0) * 1.2);

            openingClefs
                .filter((item) => item.absMinX <= openingMaxX)
                .sort((a, b) => a.centerY - b.centerY)
                .forEach((item) => {
                    const lastCluster = openingClusters[openingClusters.length - 1];
                    if (!lastCluster || Math.abs(item.centerY - lastCluster.centerY) > centerTolerance) {
                        openingClusters.push({ centerY: item.centerY, count: 1 });
                        return;
                    }

                    lastCluster.centerY = ((lastCluster.centerY * lastCluster.count) + item.centerY) / (lastCluster.count + 1);
                    lastCluster.count += 1;
                });

            if (openingClusters.length <= 1) return [lane];

            const splitLanes = openingClusters.map((cluster, index) => {
                const previousCenter = openingClusters[index - 1]?.centerY;
                const nextCenter = openingClusters[index + 1]?.centerY;
                return {
                    ...lane,
                    laneId: `${lane.laneId}-split-${laneIndex}-${index}`,
                    anchorY: cluster.centerY,
                    bandTop: Number.isFinite(previousCenter) ? (previousCenter + cluster.centerY) / 2 : lane.bandTop,
                    bandBottom: Number.isFinite(nextCenter) ? (cluster.centerY + nextCenter) / 2 : lane.bandBottom,
                    items: [],
                };
            });

            lane.items.forEach((item) => {
                let targetLane = splitLanes.find((candidate) => item.centerY >= candidate.bandTop && item.centerY <= candidate.bandBottom) || null;
                if (!targetLane) {
                    let minDiff = Infinity;
                    splitLanes.forEach((candidate) => {
                        const diff = Math.abs(candidate.anchorY - item.centerY);
                        if (diff < minDiff) {
                            minDiff = diff;
                            targetLane = candidate;
                        }
                    });
                }
                if (targetLane) targetLane.items.push(item);
            });

            return splitLanes.filter((candidate) => candidate.items.length > 0);
        });
    }

    function reassignRehearsalMarksToOpeningClefLanes(lanes) {
        if (!Array.isArray(lanes) || lanes.length === 0) return;

        const lanesBySystem = new Map();
        lanes.forEach((lane) => {
            const systemIndex = Number.isFinite(lane?.systemIndex) ? lane.systemIndex : 0;
            if (!lanesBySystem.has(systemIndex)) lanesBySystem.set(systemIndex, []);
            lanesBySystem.get(systemIndex).push(lane);
        });

        lanesBySystem.forEach((systemLanes) => {
            const clefCandidates = systemLanes.flatMap((lane) => (
                (Array.isArray(lane?.items) ? lane.items : [])
                    .filter((item) => (
                        item?.symbolType === "Clef"
                        && Number.isFinite(item.absMinX)
                        && Number.isFinite(item.centerY)
                    ))
                    .map((item) => ({ lane, item }))
            ));
            if (clefCandidates.length === 0) return;

            const minClefX = Math.min(...clefCandidates.map(({ item }) => item.absMinX));
            const openingThresholdX = Math.max(
                80,
                ...systemLanes.map((lane) => (lane?.staffSpace || 0) * 8),
            );
            const openingLaneIds = new Set(
                clefCandidates
                    .filter(({ item }) => item.absMinX <= minClefX + openingThresholdX)
                    .map(({ lane }) => lane.laneId)
            );
            if (openingLaneIds.size === 0) return;

            const openingLanes = systemLanes.filter((lane) => openingLaneIds.has(lane.laneId));
            const reassignments = [];

            systemLanes.forEach((lane) => {
                if (openingLaneIds.has(lane.laneId)) return;

                const rehearsalItems = (Array.isArray(lane?.items) ? lane.items : [])
                    .filter((item) => item?.symbolType === "RehearsalMark" && Number.isFinite(item.centerY));
                if (rehearsalItems.length === 0) return;

                rehearsalItems.forEach((item) => {
                    let targetLane = null;
                    let minDiff = Infinity;

                    openingLanes.forEach((candidate) => {
                        const diff = Math.abs((candidate?.anchorY || 0) - item.centerY);
                        if (diff < minDiff) {
                            minDiff = diff;
                            targetLane = candidate;
                        }
                    });

                    const verticalTolerance = Math.max(
                        48,
                        (lane?.staffSpace || 0) * 8,
                        (targetLane?.staffSpace || 0) * 8,
                    );
                    if (!targetLane || minDiff > verticalTolerance) return;

                    reassignments.push({ item, fromLane: lane, targetLane });
                });
            });

            reassignments.forEach(({ item, fromLane, targetLane }) => {
                fromLane.items = (Array.isArray(fromLane.items) ? fromLane.items : []).filter((candidate) => candidate !== item);
                targetLane.items = [...(Array.isArray(targetLane.items) ? targetLane.items : []), item];
            });
        });
    }

    function registerSharedGiantTimeStickyGroups(renderQueue, stickyMinX, openingThresholdX) {
        const giantTimeItems = renderQueue
            .filter((item) => item.isSticky && item.stickyType === "time" && item.timeSigIsGiant)
            .sort((a, b) => (
                ((a.systemIndex || 0) - (b.systemIndex || 0))
                || (((Number.isFinite(a.timeSigAnchorX) ? a.timeSigAnchorX : a.absMinX) - (Number.isFinite(b.timeSigAnchorX) ? b.timeSigAnchorX : b.absMinX)))
                || (a.absMinX - b.absMinX)
                || (a.centerY - b.centerY)
            ));

        if (giantTimeItems.length === 0) return {};

        /** @type {Map<number, Array<{ anchorX: number, minX: number, maxX: number, items: Array<Record<string, unknown>>, lockDistance?: number }>>} */
        const systemBlocks = new Map();

        giantTimeItems.forEach((item) => {
            const systemIndex = Number.isFinite(item.systemIndex) ? item.systemIndex : 0;
            const anchorX = Number.isFinite(item.timeSigAnchorX) ? item.timeSigAnchorX : item.absMinX;
            let blocks = systemBlocks.get(systemIndex);
            if (!blocks) {
                blocks = [];
                systemBlocks.set(systemIndex, blocks);
            }

            const lastBlock = blocks[blocks.length - 1];
            if (!lastBlock || Math.abs(anchorX - lastBlock.anchorX) > 10) {
                blocks.push({
                    anchorX,
                    minX: item.absMinX,
                    maxX: item.absMaxX,
                    items: [item],
                });
                return;
            }

            lastBlock.items.push(item);
            lastBlock.minX = Math.min(lastBlock.minX, item.absMinX);
            lastBlock.maxX = Math.max(lastBlock.maxX, item.absMaxX);
        });

        const sharedGroupsById = {};
        systemBlocks.forEach((blocks, systemIndex) => {
            if (!Array.isArray(blocks) || blocks.length === 0) return;
            const groupId = `time-giant-system-${systemIndex}`;
            const firstBlock = blocks[0];

            blocks.forEach((block, index) => {
                block.lockDistance = calculateStickyBlockLockDistance({
                    type: "time",
                    blockMinX: block.minX,
                    firstBlockMinX: firstBlock.minX,
                    openingThresholdX,
                    stickyMinX,
                });

                block.items.forEach((item) => {
                    item.sharedStickyGroupId = groupId;
                    item.sharedBlockIndex = index;
                    item.sharedLockDistance = block.lockDistance;
                });
            });

            sharedGroupsById[groupId] = {
                type: "time",
                blocks,
            };
        });

        return sharedGroupsById;
    }

    function getAxisGap(minA, maxA, minB, maxB) {
        if (!Number.isFinite(minA) || !Number.isFinite(maxA) || !Number.isFinite(minB) || !Number.isFinite(maxB)) {
            return Infinity;
        }
        if (maxA < minB) return minB - maxA;
        if (maxB < minA) return minA - maxB;
        return 0;
    }

    function getItemSpanWidth(item) {
        if (!item) return 0;
        return Math.max(0, (item.absMaxX || 0) - (item.absMinX || 0));
    }

    function getItemSpanHeight(item) {
        if (!item) return 0;
        return Math.max(0, (item.absMaxY || 0) - (item.absMinY || 0));
    }

    function isLikelyVerticalBraceStemItem(item) {
        const width = getItemSpanWidth(item);
        const height = getItemSpanHeight(item);
        return height >= 18 && height >= Math.max(width * 3, 18);
    }

    function isBraceStemEndpointAttachment(item, stemItem) {
        if (!item || !stemItem || item === stemItem) return false;
        if (isLikelyVerticalBraceStemItem(item)) return false;

        const attachmentYTolerance = 8;
        const attachmentXTolerance = 8;
        const topYGap = getAxisGap(
            item.absMinY,
            item.absMaxY,
            stemItem.absMinY - attachmentYTolerance,
            stemItem.absMinY + attachmentYTolerance,
        );
        const bottomYGap = getAxisGap(
            item.absMinY,
            item.absMaxY,
            stemItem.absMaxY - attachmentYTolerance,
            stemItem.absMaxY + attachmentYTolerance,
        );
        if (Math.min(topYGap, bottomYGap) > attachmentYTolerance) return false;

        const xGap = getAxisGap(
            item.absMinX,
            item.absMaxX,
            stemItem.absMinX - attachmentXTolerance,
            stemItem.absMaxX + attachmentXTolerance,
        );
        return xGap <= attachmentXTolerance;
    }

    function areBraceItemsNeighboring(leftItem, rightItem) {
        if (!leftItem || !rightItem || leftItem === rightItem) return false;

        const connectionTolerance = 4;
        const xGap = getAxisGap(
            leftItem.absMinX,
            leftItem.absMaxX,
            rightItem.absMinX - connectionTolerance,
            rightItem.absMaxX + connectionTolerance,
        );
        const yGap = getAxisGap(
            leftItem.absMinY,
            leftItem.absMaxY,
            rightItem.absMinY - connectionTolerance,
            rightItem.absMaxY + connectionTolerance,
        );

        return xGap <= connectionTolerance && yGap <= connectionTolerance;
    }

    function areBraceItemsConnected(leftItem, rightItem) {
        if (!leftItem || !rightItem || leftItem === rightItem) return false;

        const leftIsStem = isLikelyVerticalBraceStemItem(leftItem);
        const rightIsStem = isLikelyVerticalBraceStemItem(rightItem);

        if (leftIsStem) return false;
        if (rightIsStem) return isBraceStemEndpointAttachment(leftItem, rightItem);
        return areBraceItemsNeighboring(leftItem, rightItem);
    }

    function buildOpeningBraceStemGroups(items) {
        if (!Array.isArray(items) || items.length === 0) return [];

        const indexedItems = items.map((item, index) => ({ item, index }));
        const claimedItemIndices = new Set();
        const stemEntries = indexedItems
            .filter(({ item }) => isLikelyVerticalBraceStemItem(item))
            .sort((left, right) => {
                const leftSpan = getItemSpanHeight(left.item);
                const rightSpan = getItemSpanHeight(right.item);
                if (Math.abs(leftSpan - rightSpan) > 0.5) return leftSpan - rightSpan;
                return left.item.absMinX - right.item.absMinX;
            });

        const groups = [];

        stemEntries.forEach(({ item: stemItem, index: stemIndex }) => {
            if (claimedItemIndices.has(stemIndex)) return;

            claimedItemIndices.add(stemIndex);
            const groupItems = [stemItem];
            const pendingItems = [stemItem];

            while (pendingItems.length > 0) {
                const anchorItem = pendingItems.pop();
                indexedItems.forEach(({ item, index }) => {
                    if (claimedItemIndices.has(index)) return;
                    const canAttachShortStemSegment = isLikelyVerticalBraceStemItem(item)
                        && getItemSpanHeight(item) < getItemSpanHeight(stemItem) * 0.6
                        && areBraceItemsNeighboring(item, anchorItem);
                    if (!canAttachShortStemSegment && !areBraceItemsConnected(item, anchorItem)) return;
                    claimedItemIndices.add(index);
                    groupItems.push(item);
                    pendingItems.push(item);
                });
            }

            groups.push({
                stemItem,
                items: groupItems,
                minX: Math.min(...groupItems.map((candidate) => candidate.absMinX)),
                maxX: Math.max(...groupItems.map((candidate) => candidate.absMaxX)),
                minY: stemItem.absMinY,
                maxY: stemItem.absMaxY,
                spanY: getItemSpanHeight(stemItem),
            });
        });

        return groups.sort((a, b) => a.minX - b.minX || a.minY - b.minY);
    }

    function buildStickyBlocksForType(items, type, clusterThresholdX) {
        if (!Array.isArray(items) || items.length === 0) return [];

        const sortedItems = items
            .slice()
            .sort((a, b) => a.absMinX - b.absMinX);
        let currentBlock = {
            minX: sortedItems[0].absMinX,
            maxX: sortedItems[0].absMaxX,
            minY: Number.isFinite(sortedItems[0].absMinY) ? sortedItems[0].absMinY : sortedItems[0].centerY,
            maxY: Number.isFinite(sortedItems[0].absMaxY) ? sortedItems[0].absMaxY : sortedItems[0].centerY,
            items: [sortedItems[0]],
        };
        const blocks = [];

        for (let i = 1; i < sortedItems.length; i++) {
            const item = sortedItems[i];
            if (!shouldStartNewStickyBlock(type, currentBlock, item, clusterThresholdX)) {
                currentBlock.items.push(item);
                if (item.absMaxX > currentBlock.maxX) currentBlock.maxX = item.absMaxX;
                if (Number.isFinite(item.absMinY) && item.absMinY < currentBlock.minY) currentBlock.minY = item.absMinY;
                if (Number.isFinite(item.absMaxY) && item.absMaxY > currentBlock.maxY) currentBlock.maxY = item.absMaxY;
            } else {
                currentBlock.width = currentBlock.maxX - currentBlock.minX;
                blocks.push(currentBlock);
                currentBlock = {
                    minX: item.absMinX,
                    maxX: item.absMaxX,
                    minY: Number.isFinite(item.absMinY) ? item.absMinY : item.centerY,
                    maxY: Number.isFinite(item.absMaxY) ? item.absMaxY : item.centerY,
                    items: [item],
                };
            }
        }

        currentBlock.width = currentBlock.maxX - currentBlock.minX;
        blocks.push(currentBlock);
        blocks.forEach((block) => {
            const clearsKeySignature = shouldClearNaturalOnlyKeySignatureBlock({
                type,
                items: block.items,
            });
            block.clearsKeySignature = clearsKeySignature;
            block.stickyWidth = getStickyBlockDisplayWidth({
                type,
                blockWidth: block.width,
                clearsKeySignature,
            });
        });

        return blocks;
    }

    function refreshBraceLaneBlocksAfterSharedInstrumentGroups(globalStickyLanes, stickyMinX, openingThresholdX, clusterThresholdX) {
        if (!globalStickyLanes || typeof globalStickyLanes !== "object") return;

        const recalculateOpeningEnvelopeMaxY = (laneMeta) => {
            const openingSymbolBlocks = ["clef", "key", "time", "bar", "brace"]
                .map((type) => laneMeta.typeBlocks?.[type]?.[0] || null)
                .filter((block) => block && block.minX <= stickyMinX + openingThresholdX);
            laneMeta.openingEnvelopeMaxY = openingSymbolBlocks.length > 0
                ? Math.max(...openingSymbolBlocks.map((block) => block.maxY))
                : null;
        };

        Object.entries(globalStickyLanes).forEach(([laneId, laneMeta]) => {
            const existingBraceBlocks = laneMeta?.typeBlocks?.brace;
            if (!Array.isArray(existingBraceBlocks) || existingBraceBlocks.length === 0) return;

            const braceItems = existingBraceBlocks
                .flatMap((block) => block.items || [])
                .filter((item) => item && item.stickyType === "brace" && !item.sharedStickyGroupId);

            if (braceItems.length === 0) {
                delete laneMeta.typeBlocks.brace;
                if (laneMeta.baseWidths) laneMeta.baseWidths.brace = 0;
                recalculateOpeningEnvelopeMaxY(laneMeta);
                return;
            }

            const rebuiltBraceBlocks = buildStickyBlocksForType(braceItems, "brace", clusterThresholdX);
            const firstBlock = rebuiltBraceBlocks[0];
            rebuiltBraceBlocks.forEach((block, index) => {
                const lockDistance = calculateStickyBlockLockDistance({
                    type: "brace",
                    blockMinX: block.minX,
                    firstBlockMinX: firstBlock.minX,
                    openingThresholdX,
                    stickyMinX,
                });
                block.lockDistance = lockDistance;
                block.items.forEach((item) => {
                    item.isSticky = true;
                    item.stickyType = "brace";
                    item.laneId = laneId;
                    item.systemIndex = Number.isFinite(laneMeta.systemIndex) ? laneMeta.systemIndex : 0;
                    item.blockIndex = index;
                    item.lockDistance = lockDistance;
                    item.blockMinX = block.minX;
                    item.blockMinY = block.minY;
                    item.blockMaxY = block.maxY;
                    item.blockCenterY = block.items[0].centerY;
                    item.isMidClef = false;
                    item.midClefOffsetY = 0;
                });
            });

            laneMeta.typeBlocks.brace = rebuiltBraceBlocks;
            if (laneMeta.baseWidths) {
                laneMeta.baseWidths.brace = firstBlock.minX <= stickyMinX + openingThresholdX
                    ? (Number.isFinite(firstBlock.stickyWidth) ? firstBlock.stickyWidth : firstBlock.width)
                    : 0;
            }
            recalculateOpeningEnvelopeMaxY(laneMeta);
        });
    }

    function registerSharedInstrumentGroupStickyGroups(renderQueue, stickyMinX, openingThresholdX) {
        const labelItems = renderQueue
            .filter((item) => item.symbolType === "InstGroupLabel" && item.type === "text")
            .sort((a, b) => a.centerY - b.centerY || a.absMinX - b.absMinX);

        if (labelItems.length === 0) return {};

        const openingMaxX = Number.isFinite(stickyMinX) ? stickyMinX + openingThresholdX : Infinity;
        const braceCandidates = renderQueue.filter((item) => (
            item.symbolType === "Brace"
            && item.absMinX <= openingMaxX
        ));
        const braceStemGroups = buildOpeningBraceStemGroups(braceCandidates);
        const usedStemGroupIndices = new Set();
        const sharedGroupsById = {};

        labelItems.forEach((labelItem, index) => {
            const labelAnchorX = Number.isFinite(labelItem.absMaxX) ? labelItem.absMaxX : labelItem.absMinX;
            const labelCenterY = Number.isFinite(labelItem.centerY)
                ? labelItem.centerY
                : ((labelItem.absMinY + labelItem.absMaxY) / 2);
            const labelSpanHeight = getItemSpanHeight(labelItem);
            const nearbyKnockoutMaskItems = renderQueue.filter((item) => {
                if (item.symbolType) return false;
                if (item.fillRole !== "bg") return false;
                if (!["rect", "path"].includes(item.type)) return false;
                const width = getItemSpanWidth(item);
                const height = getItemSpanHeight(item);
                if (width <= 0 || height <= 0) return false;
                if (width > 24 || height > Math.max(96, labelSpanHeight + 16)) return false;
                return labelCenterY >= item.absMinY - 12 && labelCenterY <= item.absMaxY + 12;
            });

            const stemGroupMatch = braceStemGroups
                .map((group, groupIndex) => ({ group, groupIndex }))
                .filter(({ groupIndex }) => !usedStemGroupIndices.has(groupIndex))
                .filter(({ group }) => labelCenterY >= group.minY - 2 && labelCenterY <= group.maxY + 2)
                .sort((left, right) => {
                    const leftKnockoutGap = nearbyKnockoutMaskItems.length > 0
                        ? Math.min(...nearbyKnockoutMaskItems.map((item) => getAxisGap(
                            item.absMinX,
                            item.absMaxX,
                            left.group.minX - 6,
                            left.group.maxX + 6,
                        )))
                        : Infinity;
                    const rightKnockoutGap = nearbyKnockoutMaskItems.length > 0
                        ? Math.min(...nearbyKnockoutMaskItems.map((item) => getAxisGap(
                            item.absMinX,
                            item.absMaxX,
                            right.group.minX - 6,
                            right.group.maxX + 6,
                        )))
                        : Infinity;
                    const leftHasKnockoutAlignment = leftKnockoutGap <= 6;
                    const rightHasKnockoutAlignment = rightKnockoutGap <= 6;
                    if (leftHasKnockoutAlignment !== rightHasKnockoutAlignment) {
                        return leftHasKnockoutAlignment ? -1 : 1;
                    }
                    if (Math.abs(leftKnockoutGap - rightKnockoutGap) > 0.5) {
                        return leftKnockoutGap - rightKnockoutGap;
                    }

                    const leftSpan = left.group.spanY;
                    const rightSpan = right.group.spanY;
                    if (Math.abs(leftSpan - rightSpan) > 0.5) return leftSpan - rightSpan;

                    const leftXGap = Math.abs(left.group.minX - labelAnchorX);
                    const rightXGap = Math.abs(right.group.minX - labelAnchorX);
                    return leftXGap - rightXGap;
                })[0] || null;

            if (!stemGroupMatch) return;

            const attachedStemGroups = [stemGroupMatch];
            const attachedStemGroupIndices = new Set([stemGroupMatch.groupIndex]);
            const pendingStemGroups = [stemGroupMatch];

            while (pendingStemGroups.length > 0) {
                const anchorStemGroup = pendingStemGroups.pop();
                braceStemGroups
                    .map((group, groupIndex) => ({ group, groupIndex }))
                    .filter(({ groupIndex }) => !usedStemGroupIndices.has(groupIndex) && !attachedStemGroupIndices.has(groupIndex))
                    .filter(({ group }) => group.spanY < stemGroupMatch.group.spanY * 0.6)
                    .filter(({ group }) => {
                        const xGap = getAxisGap(
                            group.minX,
                            group.maxX,
                            anchorStemGroup.group.minX - 10,
                            anchorStemGroup.group.maxX + 10,
                        );
                        if (xGap > 10) return false;

                        const topGap = getAxisGap(
                            group.minY,
                            group.maxY,
                            anchorStemGroup.group.minY - 12,
                            anchorStemGroup.group.minY + 12,
                        );
                        const bottomGap = getAxisGap(
                            group.minY,
                            group.maxY,
                            anchorStemGroup.group.maxY - 12,
                            anchorStemGroup.group.maxY + 12,
                        );
                        return Math.min(topGap, bottomGap) <= 12;
                    })
                    .forEach((entry) => {
                        attachedStemGroupIndices.add(entry.groupIndex);
                        attachedStemGroups.push(entry);
                        pendingStemGroups.push(entry);
                    });
            }

            attachedStemGroupIndices.forEach((groupIndex) => {
                usedStemGroupIndices.add(groupIndex);
            });
            const braceGroupItems = attachedStemGroups.flatMap(({ group }) => group.items);
            const braceGroupMinX = Math.min(...braceGroupItems.map((item) => item.absMinX));
            const braceGroupMaxX = Math.max(...braceGroupItems.map((item) => item.absMaxX));
            const knockoutMaskItems = nearbyKnockoutMaskItems.filter((item) => (
                getAxisGap(
                    item.absMinX,
                    item.absMaxX,
                    braceGroupMinX - 6,
                    braceGroupMaxX + 6,
                ) <= 6
            ));
            const blockItems = [
                labelItem,
                ...braceGroupItems,
                ...knockoutMaskItems,
            ].filter((item, itemIndex, allItems) => allItems.indexOf(item) === itemIndex);
            const groupId = `inst-group-${index}`;

            blockItems.forEach((item) => {
                item.isSticky = true;
                item.stickyType = "instGroup";
                item.sharedStickyGroupId = groupId;
                item.sharedBlockIndex = 0;
                item.sharedLockDistance = 0;
            });

            sharedGroupsById[groupId] = {
                type: "instGroup",
                blocks: [{
                    minX: Math.min(...blockItems.map((item) => item.absMinX)),
                    maxX: Math.max(...blockItems.map((item) => item.absMaxX)),
                    items: blockItems,
                    lockDistance: 0,
                }],
            };
        });

        return sharedGroupsById;
    }

    function preprocessSvgColors(svgNode) {
        const isBgColor = (colorValue) => {
            if (!colorValue) return false;
            let normalized = colorValue.toLowerCase().replace(/\s+/g, "");
            if (["none", "transparent", "rgba(0,0,0,0)", ""].includes(normalized)) return false;
            if (normalized === "#ffffff" || normalized === "#fff" || normalized === "white") return true;
            if (normalized.startsWith("#") && normalized.length >= 7) {
                const r = parseInt(normalized.slice(1, 3), 16);
                const g = parseInt(normalized.slice(3, 5), 16);
                const b = parseInt(normalized.slice(5, 7), 16);
                if (r > 240 && g > 240 && b > 240) return true;
            }
            if (normalized.startsWith("rgb")) {
                const match = normalized.match(/[\d.]+/g);
                if (match && match.length >= 3 && match[0] > 240 && match[1] > 240 && match[2] > 240) return true;
            }
            return false;
        };

        const isNoneColor = (colorValue) => {
            if (!colorValue) return true;
            let normalized = colorValue.toLowerCase().replace(/\s+/g, "");
            return ["none", "transparent", "rgba(0,0,0,0)", ""].includes(normalized);
        };

        svgNode.querySelectorAll("*").forEach(el => {
            if (el.tagName.toLowerCase() === "style") return;

            const computedStyle = window.getComputedStyle(el);
            const fillOpacity = el.getAttribute("fill-opacity");
            const opacity = el.getAttribute("opacity");

            if (computedStyle.opacity === "0" || fillOpacity === "0" || opacity === "0" || computedStyle.display === "none") {
                el.dataset.roleFill = "none";
                el.dataset.roleStroke = "none";
                return;
            }

            let fill = "";
            let currFill = el;
            while (currFill && currFill !== svgNode) {
                if (currFill.hasAttribute("fill")) {
                    fill = currFill.getAttribute("fill");
                    break;
                }
                currFill = currFill.parentElement;
            }
            if (!fill) fill = computedStyle.fill;

            if (isBgColor(fill)) el.dataset.roleFill = "bg";
            else if (isNoneColor(fill)) el.dataset.roleFill = "none";
            else el.dataset.roleFill = "fg";

            let stroke = "";
            let currStroke = el;
            while (currStroke && currStroke !== svgNode) {
                if (currStroke.hasAttribute("stroke")) {
                    stroke = currStroke.getAttribute("stroke");
                    break;
                }
                currStroke = currStroke.parentElement;
            }
            if (!stroke) stroke = computedStyle.stroke;

            if (isBgColor(stroke)) el.dataset.roleStroke = "bg";
            else if (isNoneColor(stroke)) el.dataset.roleStroke = "none";
            else el.dataset.roleStroke = "fg";
        });
    }

    function buildRenderQueue(svgRoot, options = {}) {
        const { sourceType = "Unknown" } = options;
        const renderQueue = [];
        const globalStickyLanes = {};
        const globalStickySharedGroups = {};
        let stickyMinX = 0;
        let globalAbsoluteStaffLineYs = [];
        let globalAbsoluteBridgeLineYs = [];
        let rawHorizontalBridgeLines = [];
        let globalAbsoluteSystemInternalX = Infinity;
        let globalAbsoluteBridgeStartX = Infinity;

        if (!svgRoot) {
            return {
                globalAbsoluteStaffLineYs,
                globalAbsoluteBridgeLineYs,
                globalAbsoluteBridgeStartX,
                globalAbsoluteSystemInternalX,
                globalStickyLanes,
                globalStickySharedGroups,
                renderQueue,
                stickyMinX,
            };
        }

        let domCounter = 0;
        svgRoot.querySelectorAll("*").forEach(el => {
            el.dataset.domIndex = domCounter++;
        });

        function getAbsoluteMatrix(el) {
            const ctm = el.getCTM();
            return ctm ? { a: ctm.a, b: ctm.b, c: ctm.c, d: ctm.d, e: ctm.e, f: ctm.f } : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        }

        function getAbsoluteXLimits(box, matrix) {
            const x1 = matrix.a * box.x + matrix.c * box.y + matrix.e;
            const x2 = matrix.a * (box.x + box.width) + matrix.c * box.y + matrix.e;
            const x3 = matrix.a * box.x + matrix.c * (box.y + box.height) + matrix.e;
            const x4 = matrix.a * (box.x + box.width) + matrix.c * (box.y + box.height) + matrix.e;
            return { minX: Math.min(x1, x2, x3, x4), maxX: Math.max(x1, x2, x3, x4) };
        }

        function getAbsoluteYLimits(box, matrix) {
            const y1 = matrix.b * box.x + matrix.d * box.y + matrix.f;
            const y2 = matrix.b * (box.x + box.width) + matrix.d * box.y + matrix.f;
            const y3 = matrix.b * box.x + matrix.d * (box.y + box.height) + matrix.f;
            const y4 = matrix.b * (box.x + box.width) + matrix.d * (box.y + box.height) + matrix.f;
            return { minY: Math.min(y1, y2, y3, y4), maxY: Math.max(y1, y2, y3, y4) };
        }

        function getSourceMetadata(el) {
            return {
                sourceTypeHint: sourceType,
                sourceElementId: el.getAttribute("id") || "",
                sourceClassName: el.getAttribute("class") || "",
                sourceAriaLabel: el.getAttribute("aria-label") || "",
                sourceDataClef: el.getAttribute("data-clef") || "",
                sourceDataSubtype: el.getAttribute("data-subtype") || "",
            };
        }

        function getSymbolType(el) {
            if (el.classList.contains("highlight-instgroup-label")) return "InstGroupLabel";
            if (el.classList.contains("highlight-instname")) return "InstName";
            if (el.classList.contains("highlight-rehearsalmark")) return "RehearsalMark";
            if (el.classList.contains("highlight-clef")) return "Clef";
            if (el.classList.contains("highlight-keysig")) return "KeySig";
            if (el.classList.contains("highlight-timesig")) return "TimeSig";
            if (el.classList.contains("highlight-barline")) return "Barline";
            if (el.classList.contains("highlight-brace")) return "Brace";
            if (el.classList.contains("highlight-accidental")) return "Accidental";
            return null;
        }

        function getTimeSigToken(el) {
            return typeof el.getAttribute === "function"
                ? (el.getAttribute("data-time-sig-token") || "")
                : "";
        }

        function getTimeSigAnchorX(el) {
            if (typeof el?.getAttribute !== "function") return null;
            const rawValue = el.getAttribute("data-time-sig-anchor-x");
            const parsedValue = rawValue === null ? NaN : Number(rawValue);
            return Number.isFinite(parsedValue) ? parsedValue : null;
        }

        function extractStrokeWidth(el) {
            const computedSW = window.getComputedStyle(el).strokeWidth;
            const attrSW = el.getAttribute("stroke-width");
            const lineWidth = computedSW ? parseFloat(computedSW) : (attrSW ? parseFloat(attrSW) : 1);
            return (Number.isNaN(lineWidth) || lineWidth <= 0) ? 1 : lineWidth;
        }

        function collectHorizontalBridgeLine(entry) {
            rawHorizontalBridgeLines.push(entry);
        }

        function mergeHorizontalBridgeLineRows(items) {
            if (!Array.isArray(items) || items.length === 0) return [];

            const rowTolerance = 2;
            const mergeGapTolerance = 2;
            const sortedItems = items
                .filter((item) => Number.isFinite(item?.y) && Number.isFinite(item?.minX) && Number.isFinite(item?.maxX))
                .sort((a, b) => (a.y - b.y) || (a.minX - b.minX));

            const rows = [];
            sortedItems.forEach((item) => {
                const lastRow = rows[rows.length - 1];
                if (!lastRow || Math.abs(item.y - lastRow.y) > rowTolerance) {
                    rows.push({ y: item.y, segments: [item] });
                    return;
                }
                lastRow.segments.push(item);
            });

            const mergedRows = [];
            rows.forEach((row) => {
                const segments = row.segments.slice().sort((a, b) => a.minX - b.minX);
                if (segments.length === 0) return;

                let current = { ...segments[0] };
                for (let i = 1; i < segments.length; i++) {
                    const segment = segments[i];
                    if (segment.minX <= current.maxX + mergeGapTolerance) {
                        current.maxX = Math.max(current.maxX, segment.maxX);
                        current.minX = Math.min(current.minX, segment.minX);
                        current.width = Math.max(current.width || 0, segment.width || 0);
                        current.y = (current.y + segment.y) / 2;
                    } else {
                        mergedRows.push(current);
                        current = { ...segment };
                    }
                }

                mergedRows.push(current);
            });

            return mergedRows;
        }

        function getMedian(values) {
            if (!Array.isArray(values) || values.length === 0) return 0;
            const sortedValues = values.slice().sort((a, b) => a - b);
            return sortedValues[Math.floor(sortedValues.length / 2)] ?? 0;
        }

        function dedupeBridgeLinesByY(items, tolerance = 2) {
            if (!Array.isArray(items) || items.length === 0) return [];

            const sortedItems = items
                .filter((item) => Number.isFinite(item?.y) && Number.isFinite(item?.minX) && Number.isFinite(item?.maxX))
                .sort((a, b) => (a.y - b.y) || (a.minX - b.minX) || (a.maxX - b.maxX));

            const deduped = [];
            sortedItems.forEach((item) => {
                const lastItem = deduped[deduped.length - 1];
                if (!lastItem || Math.abs(item.y - lastItem.y) > tolerance) {
                    deduped.push({ ...item });
                    return;
                }

                const lastSpan = lastItem.maxX - lastItem.minX;
                const nextSpan = item.maxX - item.minX;
                if (nextSpan > lastSpan) {
                    deduped[deduped.length - 1] = { ...item };
                }
            });

            return deduped;
        }

        function clusterBridgeLineEnvelopes(items, tolerance) {
            if (!Array.isArray(items) || items.length === 0) return [];

            const sortedItems = items
                .filter((item) => Number.isFinite(item?.minX) && Number.isFinite(item?.maxX) && Number.isFinite(item?.y))
                .sort((a, b) => (a.minX - b.minX) || (a.maxX - b.maxX) || (a.y - b.y));

            const clusters = [];
            sortedItems.forEach((item) => {
                let matchedCluster = null;
                for (let i = 0; i < clusters.length; i++) {
                    const cluster = clusters[i];
                    if (
                        Math.abs(item.minX - cluster.medianMinX) <= tolerance
                        && Math.abs(item.maxX - cluster.medianMaxX) <= tolerance
                    ) {
                        matchedCluster = cluster;
                        break;
                    }
                }

                if (!matchedCluster) {
                    matchedCluster = {
                        items: [],
                        minXs: [],
                        maxXs: [],
                        medianMinX: item.minX,
                        medianMaxX: item.maxX,
                    };
                    clusters.push(matchedCluster);
                }

                matchedCluster.items.push(item);
                matchedCluster.minXs.push(item.minX);
                matchedCluster.maxXs.push(item.maxX);
                matchedCluster.medianMinX = getMedian(matchedCluster.minXs);
                matchedCluster.medianMaxX = getMedian(matchedCluster.maxXs);
            });

            return clusters
                .filter((cluster) => cluster.items.length > 0)
                .sort((a, b) => {
                    const sizeDelta = b.items.length - a.items.length;
                    if (sizeDelta !== 0) return sizeDelta;
                    return a.medianMinX - b.medianMinX;
                })
                .map((cluster) => cluster.items.slice().sort((a, b) => (a.y - b.y) || (a.minX - b.minX)));
        }

        function extractValidatedStaffLines(items) {
            const deduped = dedupeBridgeLinesByY(items, 2);
            if (deduped.length < 5) {
                return {
                    bridgeLines: deduped,
                    staffLines: [],
                };
            }

            const validStaffLines = [];
            for (let i = 0; i <= deduped.length - 5; i++) {
                const fiveLines = deduped.slice(i, i + 5);
                const gaps = [
                    fiveLines[1].y - fiveLines[0].y,
                    fiveLines[2].y - fiveLines[1].y,
                    fiveLines[3].y - fiveLines[2].y,
                    fiveLines[4].y - fiveLines[3].y,
                ];
                const sortedGaps = gaps.slice().sort((a, b) => a - b);
                const staffSpace = sortedGaps[Math.floor(sortedGaps.length / 2)] || 0;
                if (!(staffSpace > 0.5)) continue;
                if (Math.max(...gaps.map((gap) => Math.abs(gap - staffSpace))) <= Math.max(1.25, staffSpace * 0.22)) {
                    validStaffLines.push(...fiveLines);
                }
            }

            const finalCleanStaffLines = [];
            validStaffLines
                .slice()
                .sort((a, b) => a.y - b.y)
                .forEach((item) => {
                    if (
                        finalCleanStaffLines.length === 0
                        || Math.abs(item.y - finalCleanStaffLines[finalCleanStaffLines.length - 1].y) > 1
                    ) {
                        finalCleanStaffLines.push(item);
                    }
                });

            return {
                bridgeLines: deduped,
                staffLines: finalCleanStaffLines,
            };
        }

        function selectDominantEnvelopeBridgeLines(items, maxBridgeSpan) {
            if (!Array.isArray(items) || items.length === 0) return [];

            const fullSpanCandidates = items.filter((item) => (
                (item.maxX - item.minX) >= maxBridgeSpan * 0.9
            ));

            const dominantEnvelopeSource = fullSpanCandidates.length > 0 ? fullSpanCandidates : items;
            const dominantMinX = getMedian(dominantEnvelopeSource.map((item) => item.minX));
            const dominantMaxX = getMedian(dominantEnvelopeSource.map((item) => item.maxX));
            const envelopeTolerance = Math.max(6, maxBridgeSpan * 0.01);

            const envelopeMatches = items.filter((item) => (
                Math.abs(item.minX - dominantMinX) <= envelopeTolerance
                && Math.abs(item.maxX - dominantMaxX) <= envelopeTolerance
            ));

            return envelopeMatches.length > 0
                ? envelopeMatches
                : (fullSpanCandidates.length > 0 ? fullSpanCandidates : items);
        }

        svgRoot.querySelectorAll("line, polyline").forEach(el => {
            const fillRole = "none";
            const strokeRole = el.dataset.roleStroke || "fg";
            const lineWidth = extractStrokeWidth(el);
            const matrix = getAbsoluteMatrix(el);
            let box = { x: 0, y: 0, width: 0, height: 0 };
            try { box = el.getBBox(); } catch (error) {}
            const symbolType = getSymbolType(el);

            if (el.tagName.toLowerCase() === "line") {
                const limits = getAbsoluteXLimits(box, matrix);
                const lx1 = parseFloat(el.getAttribute("x1"));
                const ly1 = parseFloat(el.getAttribute("y1"));
                const lx2 = parseFloat(el.getAttribute("x2"));
                const ly2 = parseFloat(el.getAttribute("y2"));
                if (Math.abs(ly1 - ly2) < 1 && Math.abs(lx1 - lx2) > 100) {
                    collectHorizontalBridgeLine({
                        y: matrix.b * lx1 + matrix.d * ly1 + matrix.f,
                        width: lineWidth * Math.abs(matrix.d || 1),
                        minX: limits.minX,
                        maxX: limits.maxX,
                    });
                }
                renderQueue.push({
                    type: "line", domIndex: parseInt(el.dataset.domIndex) || 0,
                    localX1: lx1, localY1: ly1, localX2: lx2, localY2: ly2,
                    lineWidth, fillRole, strokeRole, matrix,
                    absMinX: limits.minX, absMaxX: limits.maxX, symbolType,
                    absMinY: Math.min(matrix.b * lx1 + matrix.d * ly1 + matrix.f, matrix.b * lx2 + matrix.d * ly2 + matrix.f),
                    absMaxY: Math.max(matrix.b * lx1 + matrix.d * ly1 + matrix.f, matrix.b * lx2 + matrix.d * ly2 + matrix.f),
                    centerY: limits.minX + (limits.maxX - limits.minX) / 2,
                    timeSigAnchorX: getTimeSigAnchorX(el),
                    timeSigIsGiant: getTimeSigIsGiant(el),
                    ...getMathFlyinParams(),
                });
            } else if (el.tagName.toLowerCase() === "polyline") {
                const pointsStr = el.getAttribute("points");
                if (!pointsStr) return;
                const coords = pointsStr.trim().split(/\s+|,/).filter(value => value !== "").map(Number);
                if (coords.length < 4) return;
                const lx1 = coords[0];
                const ly1 = coords[1];
                const lx2 = coords[coords.length - 2];
                const ly2 = coords[coords.length - 1];
                if (Math.abs(ly1 - ly2) < 1 && Math.abs(lx1 - lx2) > 100) {
                    collectHorizontalBridgeLine({
                        y: matrix.b * lx1 + matrix.d * ly1 + matrix.f,
                        width: lineWidth * Math.abs(matrix.d || 1),
                        minX: Math.min(
                            matrix.a * lx1 + matrix.c * ly1 + matrix.e,
                            matrix.a * lx2 + matrix.c * ly2 + matrix.e,
                        ),
                        maxX: Math.max(
                            matrix.a * lx1 + matrix.c * ly1 + matrix.e,
                            matrix.a * lx2 + matrix.c * ly2 + matrix.e,
                        ),
                    });
                }
                for (let i = 0; i < coords.length - 2; i += 2) {
                    const ltx1 = coords[i];
                    const lty1 = coords[i + 1];
                    const ltx2 = coords[i + 2];
                    const lty2 = coords[i + 3];
                    const tx1 = matrix.a * ltx1 + matrix.c * lty1 + matrix.e;
                    const tx2 = matrix.a * ltx2 + matrix.c * lty2 + matrix.e;
                    renderQueue.push({
                        type: "line", domIndex: parseInt(el.dataset.domIndex) || 0,
                        localX1: ltx1, localY1: lty1, localX2: ltx2, localY2: lty2,
                        lineWidth, fillRole, strokeRole, matrix,
                        absMinX: Math.min(tx1, tx2), absMaxX: Math.max(tx1, tx2),
                        absMinY: Math.min(
                            matrix.b * ltx1 + matrix.d * lty1 + matrix.f,
                            matrix.b * ltx2 + matrix.d * lty2 + matrix.f,
                        ),
                        absMaxY: Math.max(
                            matrix.b * ltx1 + matrix.d * lty1 + matrix.f,
                            matrix.b * ltx2 + matrix.d * lty2 + matrix.f,
                        ),
                        symbolType, centerY: matrix.b * ltx1 + matrix.d * lty1 + matrix.f,
                        timeSigAnchorX: getTimeSigAnchorX(el),
                        timeSigIsGiant: getTimeSigIsGiant(el),
                        ...getMathFlyinParams(),
                    });
                }
            }
        });

        svgRoot.querySelectorAll("rect").forEach(el => {
            let fillRole = el.dataset.roleFill;
            if (!fillRole) {
                let curr = el;
                let fill = "";
                while (curr && curr !== svgRoot) {
                    if (curr.hasAttribute("fill")) {
                        fill = curr.getAttribute("fill").trim().toLowerCase().replace(/\s+/g, "");
                        break;
                    }
                    curr = curr.parentElement;
                }
                if (fill === "#ffffff" || fill === "#fff" || fill === "white" || fill === "rgb(255,255,255)") fillRole = "bg";
                else if (fill === "none" || fill === "transparent") fillRole = "none";
                else fillRole = "fg";
            }
            const strokeRole = el.dataset.roleStroke || "none";
            if (fillRole === "none" && strokeRole === "none") return;

            const matrix = getAbsoluteMatrix(el);
            let box = { x: 0, y: 0, width: 0, height: 0 };
            try { box = el.getBBox(); } catch (error) {}
            if (box.width === 0 && box.height === 0) {
                box.x = parseFloat(el.getAttribute("x")) || 0;
                box.y = parseFloat(el.getAttribute("y")) || 0;
                box.width = parseFloat(el.getAttribute("width")) || 0;
                box.height = parseFloat(el.getAttribute("height")) || 0;
            }

            const limits = getAbsoluteXLimits(box, matrix);
            const yLimits = getAbsoluteYLimits(box, matrix);
            renderQueue.push({
                type: "rect", domIndex: parseInt(el.dataset.domIndex) || 0,
                localX: box.x, localY: box.y, width: box.width, height: box.height,
                fillRole, strokeRole, strokeWidth: extractStrokeWidth(el), matrix,
                absMinX: limits.minX, absMaxX: limits.maxX, symbolType: getSymbolType(el),
                absMinY: yLimits.minY, absMaxY: yLimits.maxY,
                centerY: matrix.b * box.x + matrix.d * (box.y + box.height / 2) + matrix.f,
                centerX: limits.minX + (limits.maxX - limits.minX) / 2, ...getMathFlyinParams(),
                timeSigAnchorX: getTimeSigAnchorX(el),
                timeSigIsGiant: getTimeSigIsGiant(el),
            });
        });

        svgRoot.querySelectorAll("circle, ellipse").forEach(el => {
            const fillRole = el.dataset.roleFill || "fg";
            const strokeRole = el.dataset.roleStroke || "none";
            if (fillRole === "none" && strokeRole === "none") return;

            const matrix = getAbsoluteMatrix(el);
            let box = { x: 0, y: 0, width: 0, height: 0 };
            try { box = el.getBBox(); } catch (error) {}
            if (box.width === 0 && box.height === 0) {
                const cx = parseFloat(el.getAttribute("cx")) || 0;
                const cy = parseFloat(el.getAttribute("cy")) || 0;
                const rx = parseFloat(el.getAttribute("rx") || el.getAttribute("r")) || 0;
                const ry = parseFloat(el.getAttribute("ry") || el.getAttribute("r")) || 0;
                box = { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 };
            }

            const limits = getAbsoluteXLimits(box, matrix);
            const yLimits = getAbsoluteYLimits(box, matrix);
            const cx = parseFloat(el.getAttribute("cx")) || (box.x + box.width / 2);
            const cy = parseFloat(el.getAttribute("cy")) || (box.y + box.height / 2);
            const rx = parseFloat(el.getAttribute("rx") || el.getAttribute("r")) || (box.width / 2);
            const ry = parseFloat(el.getAttribute("ry") || el.getAttribute("r")) || (box.height / 2);

            renderQueue.push({
                type: "ellipse", domIndex: parseInt(el.dataset.domIndex) || 0,
                localCX: cx, localCY: cy, radiusX: rx, radiusY: ry,
                fillRole, strokeRole, strokeWidth: extractStrokeWidth(el), matrix,
                absMinX: limits.minX, absMaxX: limits.maxX, symbolType: getSymbolType(el),
                absMinY: yLimits.minY, absMaxY: yLimits.maxY,
                centerY: matrix.b * cx + matrix.d * cy + matrix.f,
                centerX: limits.minX + (limits.maxX - limits.minX) / 2,
                timeSigAnchorX: getTimeSigAnchorX(el),
                timeSigIsGiant: getTimeSigIsGiant(el),
                ...getMathFlyinParams(),
            });
        });

        svgRoot.querySelectorAll("polygon").forEach(el => {
            const fillRole = el.dataset.roleFill || "fg";
            const strokeRole = el.dataset.roleStroke || "none";
            if (fillRole === "none" && strokeRole === "none") return;
            const pointsStr = el.getAttribute("points");
            if (!pointsStr) return;
            const coords = pointsStr.trim().split(/\s+|,/).filter(value => value !== "").map(Number);
            if (coords.length < 6) return;

            const matrix = getAbsoluteMatrix(el);
            let box = { x: 0, y: 0, width: 0, height: 0 };
            try { box = el.getBBox(); } catch (error) {}
            if (box.width === 0 && box.height === 0) {
                let minX = Infinity;
                let maxX = -Infinity;
                let minY = Infinity;
                let maxY = -Infinity;
                for (let i = 0; i < coords.length; i += 2) {
                    if (coords[i] < minX) minX = coords[i];
                    if (coords[i] > maxX) maxX = coords[i];
                    if (coords[i + 1] < minY) minY = coords[i + 1];
                    if (coords[i + 1] > maxY) maxY = coords[i + 1];
                }
                box = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            }

            let d = `M ${coords[0]} ${coords[1]} `;
            for (let i = 2; i < coords.length; i += 2) d += `L ${coords[i]} ${coords[i + 1]} `;
            d += "Z";

            const limits = getAbsoluteXLimits(box, matrix);
            const yLimits = getAbsoluteYLimits(box, matrix);
            renderQueue.push({
                type: "path", domIndex: parseInt(el.dataset.domIndex) || 0, path2D: new Path2D(d),
                fillRole, strokeRole, strokeWidth: extractStrokeWidth(el), matrix, originalD: d,
                absMinX: limits.minX, absMaxX: limits.maxX, symbolType: getSymbolType(el),
                absMinY: yLimits.minY, absMaxY: yLimits.maxY,
                centerY: matrix.b * box.x + matrix.d * (box.y + box.height / 2) + matrix.f,
                centerX: limits.minX + (limits.maxX - limits.minX) / 2,
                timeSigToken: getTimeSigToken(el),
                timeSigAnchorX: getTimeSigAnchorX(el),
                timeSigIsGiant: getTimeSigIsGiant(el),
                ...getSourceMetadata(el),
                ...getMathFlyinParams(),
            });
        });

        svgRoot.querySelectorAll("path").forEach(el => {
            const fillRole = el.dataset.roleFill || "fg";
            const strokeRole = el.dataset.roleStroke || "none";
            if (fillRole === "none" && strokeRole === "none") return;
            const d = el.getAttribute("d");
            if (!d) return;

            const matrix = getAbsoluteMatrix(el);
            let box = { x: 0, y: 0, width: 0, height: 0 };
            try { box = el.getBBox(); } catch (error) {}
            const limits = getAbsoluteXLimits(box, matrix);
            const yLimits = getAbsoluteYLimits(box, matrix);

            renderQueue.push({
                type: "path", domIndex: parseInt(el.dataset.domIndex) || 0, path2D: new Path2D(d),
                fillRole, strokeRole, strokeWidth: extractStrokeWidth(el), matrix, originalD: d,
                absMinX: limits.minX, absMaxX: limits.maxX, symbolType: getSymbolType(el),
                absMinY: yLimits.minY, absMaxY: yLimits.maxY,
                centerY: matrix.b * box.x + matrix.d * (box.y + box.height / 2) + matrix.f,
                centerX: limits.minX + (limits.maxX - limits.minX) / 2,
                timeSigToken: getTimeSigToken(el),
                timeSigAnchorX: getTimeSigAnchorX(el),
                timeSigIsGiant: getTimeSigIsGiant(el),
                ...getSourceMetadata(el),
                ...getMathFlyinParams(),
            });
        });

        svgRoot.querySelectorAll("text").forEach(el => {
            const textContent = el.textContent || "";
            if (textContent.includes("@")) return;

            const matrix = getAbsoluteMatrix(el);
            let box = { x: 0, y: 0, width: 0, height: 0 };
            try { box = el.getBBox(); } catch (error) {}
            const limits = getAbsoluteXLimits(box, matrix);
            const fontNode = el.closest("[font-size]") || el;
            const familyNode = el.closest("[font-family]") || el;
            const styleNode = el.closest("[font-style]") || el;
            const weightNode = el.closest("[font-weight]") || el;
            let fontSize = fontNode.getAttribute("font-size") || "16";
            if (!Number.isNaN(Number(fontSize))) fontSize = `${fontSize}px`;
            else if (!fontSize.includes("px") && !fontSize.includes("em")) fontSize = `${parseFloat(fontSize)}px`;
            const fontStyle = styleNode.getAttribute("font-style") || "normal";
            const fontWeight = weightNode.getAttribute("font-weight") || "normal";
            const fontFamily = familyNode.getAttribute("font-family") || "serif";
            const yLimits = getAbsoluteYLimits(box, matrix);

            renderQueue.push({
                type: "text", domIndex: parseInt(el.dataset.domIndex) || 0, text: textContent,
                x: parseFloat(el.getAttribute("x")) || 0, y: parseFloat(el.getAttribute("y")) || 0,
                font: `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`,
                fillRole: el.dataset.roleFill || "fg", strokeRole: "none", strokeWidth: 0,
                matrix, absMinX: limits.minX, absMaxX: limits.maxX, symbolType: getSymbolType(el),
                absMinY: yLimits.minY, absMaxY: yLimits.maxY,
                centerY: matrix.b * box.x + matrix.d * (box.y + box.height / 2) + matrix.f,
                timeSigToken: getTimeSigToken(el),
                timeSigAnchorX: getTimeSigAnchorX(el),
                timeSigIsGiant: getTimeSigIsGiant(el),
                box,
                ...getSourceMetadata(el),
                ...getMathFlyinParams(),
            });
        });

        const rehTextItems = renderQueue.filter(item => item.type === "text" && item.symbolType === "RehearsalMark");
        const potentialFrames = renderQueue.filter(item => ["rect", "ellipse", "path"].includes(item.type));

        rehTextItems.forEach(rehText => {
            const hasFrame = potentialFrames.some(frame => {
                // 1. X轴包围：框的左右边界应该包裹住文本（允许 2px 的坐标计算容差）
                const isXEnclosing = (frame.absMinX <= rehText.absMinX + 2) && (frame.absMaxX >= rehText.absMaxX - 2);

                // 2. Y轴对齐：框的 Y 轴中心点应该和文本的中心点接近
                const isYAlign = Math.abs(frame.centerY - rehText.centerY) < 15;

                // 3. 尺寸合理：框的宽度应该大于文本宽度，但不能无限大（防止误把长连线或背景框认作排演记号的框）
                const textWidth = Math.max(1, rehText.absMaxX - rehText.absMinX);
                const frameWidth = frame.absMaxX - frame.absMinX;
                const isReasonableWidth = frameWidth >= textWidth && frameWidth < textWidth + 40;

                return isXEnclosing && isYAlign && isReasonableWidth;
            });

            if (!hasFrame) {
                // 如果周围没有合法的框线包围，则剥夺其排演记号的身份，退化为普通文本
                rehText.symbolType = null;
            }
        });
        
        if (rawHorizontalBridgeLines.length > 0) {
            const mergedBridgeLines = mergeHorizontalBridgeLineRows(rawHorizontalBridgeLines);
            const maxBridgeSpan = Math.max(...mergedBridgeLines.map((item) => item.maxX - item.minX), 0);
            const envelopeTolerance = Math.max(6, maxBridgeSpan * 0.01);
            const envelopeClusters = clusterBridgeLineEnvelopes(mergedBridgeLines, envelopeTolerance);
            const validatedBridgeLines = [];
            const validatedStaffLines = [];

            envelopeClusters.forEach((clusterItems) => {
                const validation = extractValidatedStaffLines(clusterItems);
                if (validation.staffLines.length === 0) return;

                validatedBridgeLines.push(...validation.bridgeLines);
                validatedStaffLines.push(...validation.staffLines);
            });

            if (validatedBridgeLines.length > 0) {
                globalAbsoluteBridgeLineYs = validatedBridgeLines
                    .slice()
                    .sort((a, b) => (a.y - b.y) || (a.minX - b.minX) || (a.maxX - b.maxX));
                globalAbsoluteStaffLineYs = validatedStaffLines
                    .slice()
                    .sort((a, b) => (a.y - b.y) || (a.minX - b.minX) || (a.maxX - b.maxX));
            } else {
                globalAbsoluteBridgeLineYs = selectDominantEnvelopeBridgeLines(mergedBridgeLines, maxBridgeSpan);
                const fallbackValidation = extractValidatedStaffLines(globalAbsoluteBridgeLineYs);
                globalAbsoluteBridgeLineYs = fallbackValidation.bridgeLines;
                globalAbsoluteStaffLineYs = fallbackValidation.staffLines;
            }
        }

        const initialBarlines = renderQueue.filter(item => item.symbolType === "Barline");
        if (initialBarlines.length > 0) {
            const absoluteLeftmostBarlineX = Math.min(...initialBarlines.map(barline => barline.absMinX));
            const startCluster = initialBarlines.filter(barline => barline.absMinX <= absoluteLeftmostBarlineX + 30);
            globalAbsoluteSystemInternalX = Math.max(...startCluster.map(barline => barline.absMinX));
        } else {
            globalAbsoluteSystemInternalX = getFallbackSystemInternalX() || 0;
        }
        globalAbsoluteBridgeStartX = globalAbsoluteSystemInternalX;

        renderQueue.forEach(item => {
            if (item.symbolType === "Brace") {
                // 真正的花括号必定位于大谱表系统的极左侧，通常在第一根小节线的左侧或附近。
                // 如果它的起始 X 坐标远远落后于系统起点（例如相差大于 100px 容差），
                // 则说明该元素是乐谱中段发生特征碰撞的普通符号，我们剥夺其 Brace 身份。
                if (item.absMinX > globalAbsoluteSystemInternalX + 100) {
                    item.symbolType = null;
                }
            }
        });

        const stickyTypesMap = { InstName: "inst", RehearsalMark: "reh", Clef: "clef", KeySig: "key", TimeSig: "time", Barline: "bar", Brace: "brace" };
        const stickies = renderQueue.filter(item => item.symbolType && stickyTypesMap[item.symbolType]);
        const clusterThresholdX = 35;
        const globalLanes = [];

        const staffLineYs = (globalAbsoluteBridgeLineYs.length > 0 ? globalAbsoluteBridgeLineYs : globalAbsoluteStaffLineYs).map(line => line.y);
        const staffBands = buildTimeSignatureStaffBandsFromLineYs(staffLineYs);

        if (staffBands && staffBands.length > 0) {
            staffBands.forEach((band, index) => {
                globalLanes.push({
                    anchorY: (band.top + band.bottom) / 2,
                    bandTop: band.paddedTop,
                    bandBottom: band.paddedBottom,
                    staffSpace: band.staffSpace,
                    items: [],
                    laneId: `lane-${index}`,
                });
            });
            assignLaneSystemIndices(globalLanes);

            stickies.forEach(item => {
                let targetLane = globalLanes.find(lane => item.centerY >= lane.bandTop && item.centerY <= lane.bandBottom) || null;
                if (!targetLane) {
                    let minDiff = Infinity;
                    globalLanes.forEach(lane => {
                        const diff = Math.abs(lane.anchorY - item.centerY);
                        if (diff < minDiff) {
                            minDiff = diff;
                            targetLane = lane;
                        }
                    });
                }
                if (targetLane) targetLane.items.push(item);
            });
        } else {
            const allClefs = stickies.filter(item => item.symbolType === "Clef");
            if (allClefs.length > 0) {
                const minClefX = Math.min(...allClefs.map(clef => clef.absMinX));
                const systemClefs = allClefs.filter(clef => clef.absMinX <= minClefX + 250);

                systemClefs.forEach(clef => {
                    let foundLane = globalLanes.find(lane => Math.abs(lane.anchorY - clef.centerY) < 15);
                    if (!foundLane) {
                        globalLanes.push({ anchorY: clef.centerY, items: [], laneId: `lane-${globalLanes.length}` });
                    }
                });
            }

            if (globalLanes.length > 0) {
                stickies.forEach(item => {
                    let targetLane = null;
                    let minDiff = Infinity;
                    globalLanes.forEach(lane => {
                        const diff = Math.abs(lane.anchorY - item.centerY);
                        if (diff < minDiff) {
                            minDiff = diff;
                            targetLane = lane;
                        }
                    });
                    if (targetLane && minDiff < 200) targetLane.items.push(item);
                });
            }
        }

        if (globalLanes.length > 0) {
            const splitLanes = splitDenseGlobalLanesByOpeningClefs(globalLanes);
            if (Array.isArray(splitLanes) && splitLanes.length > 0) {
                globalLanes.length = 0;
                globalLanes.push(...splitLanes);
            }
        }

        globalLanes.forEach((lane) => {
            if (!Number.isFinite(lane.systemIndex)) {
                lane.systemIndex = 0;
            }
        });
        reassignRehearsalMarksToOpeningClefLanes(globalLanes);

        let globalMinX = Infinity;
        globalLanes.forEach(lane => {
            lane.items.forEach(item => {
                if (stickyTypesMap[item.symbolType] === "inst") return;
                if (item.absMinX < globalMinX) globalMinX = item.absMinX;
            });
        });
        stickyMinX = globalMinX === Infinity ? 0 : globalMinX;
        if (window.hasPhysicalStartBarline === false && Number.isFinite(globalAbsoluteSystemInternalX)) {
            const leftmostStaffLineX = (globalAbsoluteBridgeLineYs.length > 0 ? globalAbsoluteBridgeLineYs : globalAbsoluteStaffLineYs)
                .map((line) => line.minX)
                .filter((value) => Number.isFinite(value));
            if (leftmostStaffLineX.length > 0) {
                globalAbsoluteBridgeStartX = Math.min(...leftmostStaffLineX);
            } else if (Number.isFinite(globalMinX)) {
                globalAbsoluteBridgeStartX = globalMinX;
            }
            stickyMinX = globalAbsoluteSystemInternalX;
        }

        const stickyOpeningThresholdX = 200;
        globalLanes.forEach(lane => {
            const currentStaffSpace = lane.staffSpace || 10;
            const itemsByType = { inst: [], reh: [], clef: [], key: [], time: [], bar: [], brace: [] };
            lane.items.forEach(item => itemsByType[stickyTypesMap[item.symbolType]].push(item));
            const typeBlocks = {};

            ["inst", "reh", "clef", "key", "time", "bar", "brace"].forEach(type => {
                const items = itemsByType[type];
                if (items.length === 0) return;
                items.sort((a, b) => a.absMinX - b.absMinX);
                let currentBlock = {
                    minX: items[0].absMinX,
                    maxX: items[0].absMaxX,
                    minY: Number.isFinite(items[0].absMinY) ? items[0].absMinY : items[0].centerY,
                    maxY: Number.isFinite(items[0].absMaxY) ? items[0].absMaxY : items[0].centerY,
                    items: [items[0]],
                };
                const blocks = [];
                for (let i = 1; i < items.length; i++) {
                    const item = items[i];
                    if (!shouldStartNewStickyBlock(type, currentBlock, item, clusterThresholdX)) {
                        currentBlock.items.push(item);
                        if (item.absMaxX > currentBlock.maxX) currentBlock.maxX = item.absMaxX;
                        if (Number.isFinite(item.absMinY) && item.absMinY < currentBlock.minY) currentBlock.minY = item.absMinY;
                        if (Number.isFinite(item.absMaxY) && item.absMaxY > currentBlock.maxY) currentBlock.maxY = item.absMaxY;
                    } else {
                        currentBlock.width = currentBlock.maxX - currentBlock.minX;
                        blocks.push(currentBlock);
                        currentBlock = {
                            minX: item.absMinX,
                            maxX: item.absMaxX,
                            minY: Number.isFinite(item.absMinY) ? item.absMinY : item.centerY,
                            maxY: Number.isFinite(item.absMaxY) ? item.absMaxY : item.centerY,
                            items: [item],
                        };
                    }
                }
                currentBlock.width = currentBlock.maxX - currentBlock.minX;
                blocks.push(currentBlock);
                blocks.forEach((block, index) => {
                    const isOpeningBlock = type === "key"
                        && index === 0
                        && Number.isFinite(block.minX)
                        && block.minX <= stickyMinX + stickyOpeningThresholdX;
                    const clearsKeySignature = shouldClearNaturalOnlyKeySignatureBlock({
                        type,
                        items: block.items,
                        isOpeningBlock,
                    });
                    block.clearsKeySignature = clearsKeySignature;
                    block.stickyWidth = getStickyBlockDisplayWidth({
                        type,
                        blockWidth: block.width,
                        clearsKeySignature,
                    });
                });
                typeBlocks[type] = blocks;
            });

            const openingClefBlock = typeBlocks.clef?.[0] || null;
            const openingClefMinX = openingClefBlock && openingClefBlock.minX <= stickyMinX + stickyOpeningThresholdX
                ? openingClefBlock.minX
                : null;
            const openingTimeBlock = typeBlocks.time?.[0] || null;
            const openingTimeMinX = openingTimeBlock && openingTimeBlock.minX <= stickyMinX + stickyOpeningThresholdX
                ? openingTimeBlock.minX
                : null;

            const baseWidths = { inst: 0, reh: 0, clef: 0, key: 0, time: 0, bar: 0, brace: 0 };
            ["inst", "reh", "clef", "key", "time", "bar", "brace"].forEach(type => {
                if (typeBlocks[type] && typeBlocks[type].length > 0) {
                    const firstBlock = typeBlocks[type][0];
                    if (type === "inst" || firstBlock.minX <= stickyMinX + stickyOpeningThresholdX) {
                        baseWidths[type] = Number.isFinite(firstBlock.stickyWidth)
                            ? firstBlock.stickyWidth
                            : firstBlock.width;
                    }
                }
            });
            const openingSymbolBlocks = ["clef", "key", "time", "bar", "brace"]
                .map((type) => typeBlocks[type]?.[0] || null)
                .filter((block) => block && block.minX <= stickyMinX + stickyOpeningThresholdX);
            const openingEnvelopeMaxY = openingSymbolBlocks.length > 0
                ? Math.max(...openingSymbolBlocks.map((block) => block.maxY))
                : null;
            globalStickyLanes[lane.laneId] = {
                typeBlocks,
                baseWidths,
                systemIndex: Number.isFinite(lane.systemIndex) ? lane.systemIndex : 0,
                anchorY: lane.anchorY,
                bandBottom: lane.bandBottom,
                openingEnvelopeMaxY,
            };

            ["inst", "reh", "clef", "key", "time", "bar", "brace"].forEach(type => {
                if (!typeBlocks[type]) return;
                const firstBlock = typeBlocks[type][0];
                typeBlocks[type].forEach((block, index) => {
                    let fallbackAnchorX = null;
                    const hasOpeningBlock = firstBlock.minX <= stickyMinX + stickyOpeningThresholdX;
                    if (type === "key" && !hasOpeningBlock) {
                        if (Number.isFinite(openingTimeMinX)) fallbackAnchorX = openingTimeMinX;
                        else if (openingClefBlock) fallbackAnchorX = openingClefBlock.maxX;
                    }
                    const lockDistance = calculateStickyBlockLockDistance({
                        type,
                        blockMinX: block.minX,
                        firstBlockMinX: firstBlock.minX,
                        openingClefMinX,
                        fallbackAnchorX,
                        openingThresholdX: stickyOpeningThresholdX,
                        stickyMinX,
                    });
                    block.lockDistance = lockDistance;
                    const isMidClef = type === "clef" && index > 0;
                    const shouldSkipStickyRegistration = type === "key" && block.clearsKeySignature;
                    block.items.forEach(item => {
                        if (shouldSkipStickyRegistration) return;
                        item.isSticky = true;
                        item.stickyType = type;
                        item.laneId = lane.laneId;
                        item.systemIndex = Number.isFinite(lane.systemIndex) ? lane.systemIndex : 0;
                        item.blockIndex = index;
                        item.lockDistance = lockDistance;
                        item.blockMinX = block.minX;
                        item.blockMinY = block.minY;
                        item.blockMaxY = block.maxY;
                        item.blockCenterY = block.items[0].centerY;
                        item.isMidClef = isMidClef;
                        item.midClefOffsetY = 0;
                        item.staffSpace = currentStaffSpace;
                        if (isMidClef) {
                            const specificType = getMidClefSpecificType(item);
                            item.midClefOffsetY = getMidClefOffsetY({
                                sourceType,
                                specificType,
                                staffSpace: currentStaffSpace,
                            });
                        }
                    });
                });
            });
        });

        const instrumentGroupSharedGroups = registerSharedInstrumentGroupStickyGroups(renderQueue, stickyMinX, stickyOpeningThresholdX);
        Object.assign(
            globalStickySharedGroups,
            instrumentGroupSharedGroups,
            registerSharedGiantTimeStickyGroups(renderQueue, stickyMinX, stickyOpeningThresholdX),
        );
        if (Object.keys(instrumentGroupSharedGroups).length > 0) {
            refreshBraceLaneBlocksAfterSharedInstrumentGroups(
                globalStickyLanes,
                stickyMinX,
                stickyOpeningThresholdX,
                clusterThresholdX,
            );
        }

        renderQueue.sort((a, b) => (a.domIndex || 0) - (b.domIndex || 0));
        debugLog(`📦 内存数据库构建：已提取强分离指令 ${renderQueue.length} 条！`);

        return {
            globalAbsoluteStaffLineYs,
            globalAbsoluteBridgeLineYs,
            globalAbsoluteBridgeStartX,
            globalAbsoluteSystemInternalX,
            globalStickyLanes,
            globalStickySharedGroups,
            renderQueue,
            stickyMinX,
        };
    }

    return {
        buildRenderQueue,
        preprocessSvgColors,
    };
}
