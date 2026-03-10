import { debugLog } from "../utils/debug.js";

export function createSvgAnalysisFeature({
    getFallbackSystemInternalX,
    getMathFlyinParams,
    identifyClefOrBrace,
}) {
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

    function buildRenderQueue(svgRoot) {
        const renderQueue = [];
        const globalStickyLanes = {};
        let stickyMinX = 0;
        let globalAbsoluteStaffLineYs = [];
        let globalAbsoluteSystemInternalX = Infinity;

        if (!svgRoot) {
            return {
                globalAbsoluteStaffLineYs,
                globalAbsoluteSystemInternalX,
                globalStickyLanes,
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

        function getSymbolType(el) {
            if (el.classList.contains("highlight-instname")) return "InstName";
            if (el.classList.contains("highlight-clef")) return "Clef";
            if (el.classList.contains("highlight-keysig")) return "KeySig";
            if (el.classList.contains("highlight-timesig")) return "TimeSig";
            if (el.classList.contains("highlight-barline")) return "Barline";
            if (el.classList.contains("highlight-brace")) return "Brace";
            if (el.classList.contains("highlight-accidental")) return "Accidental";
            return null;
        }

        function extractStrokeWidth(el) {
            const computedSW = window.getComputedStyle(el).strokeWidth;
            const attrSW = el.getAttribute("stroke-width");
            const lineWidth = computedSW ? parseFloat(computedSW) : (attrSW ? parseFloat(attrSW) : 1);
            return (Number.isNaN(lineWidth) || lineWidth <= 0) ? 1 : lineWidth;
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
                    globalAbsoluteStaffLineYs.push({ y: matrix.b * lx1 + matrix.d * ly1 + matrix.f, width: lineWidth * Math.abs(matrix.d || 1) });
                }
                renderQueue.push({
                    type: "line", domIndex: parseInt(el.dataset.domIndex) || 0,
                    localX1: lx1, localY1: ly1, localX2: lx2, localY2: ly2,
                    lineWidth, fillRole, strokeRole, matrix,
                    absMinX: limits.minX, absMaxX: limits.maxX, symbolType,
                    centerY: limits.minX + (limits.maxX - limits.minX) / 2, ...getMathFlyinParams(),
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
                    globalAbsoluteStaffLineYs.push({ y: matrix.b * lx1 + matrix.d * ly1 + matrix.f, width: lineWidth * Math.abs(matrix.d || 1) });
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
                        symbolType, centerY: matrix.b * ltx1 + matrix.d * lty1 + matrix.f, ...getMathFlyinParams(),
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
            renderQueue.push({
                type: "rect", domIndex: parseInt(el.dataset.domIndex) || 0,
                localX: box.x, localY: box.y, width: box.width, height: box.height,
                fillRole, strokeRole, strokeWidth: extractStrokeWidth(el), matrix,
                absMinX: limits.minX, absMaxX: limits.maxX, symbolType: getSymbolType(el),
                centerY: matrix.b * box.x + matrix.d * (box.y + box.height / 2) + matrix.f,
                centerX: limits.minX + (limits.maxX - limits.minX) / 2, ...getMathFlyinParams(),
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
            renderQueue.push({
                type: "path", domIndex: parseInt(el.dataset.domIndex) || 0, path2D: new Path2D(d),
                fillRole, strokeRole, strokeWidth: extractStrokeWidth(el), matrix, originalD: d,
                absMinX: limits.minX, absMaxX: limits.maxX, symbolType: getSymbolType(el),
                centerY: matrix.b * box.x + matrix.d * (box.y + box.height / 2) + matrix.f,
                centerX: limits.minX + (limits.maxX - limits.minX) / 2, ...getMathFlyinParams(),
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

            renderQueue.push({
                type: "path", domIndex: parseInt(el.dataset.domIndex) || 0, path2D: new Path2D(d),
                fillRole, strokeRole, strokeWidth: extractStrokeWidth(el), matrix, originalD: d,
                absMinX: limits.minX, absMaxX: limits.maxX, symbolType: getSymbolType(el),
                centerY: matrix.b * box.x + matrix.d * (box.y + box.height / 2) + matrix.f,
                centerX: limits.minX + (limits.maxX - limits.minX) / 2, ...getMathFlyinParams(),
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
            const weightNode = el.closest("[font-weight]") || el;
            let fontSize = fontNode.getAttribute("font-size") || "16";
            if (!Number.isNaN(Number(fontSize))) fontSize = `${fontSize}px`;
            else if (!fontSize.includes("px") && !fontSize.includes("em")) fontSize = `${parseFloat(fontSize)}px`;

            renderQueue.push({
                type: "text", domIndex: parseInt(el.dataset.domIndex) || 0, text: textContent,
                x: parseFloat(el.getAttribute("x")) || 0, y: parseFloat(el.getAttribute("y")) || 0,
                font: `${weightNode.getAttribute("font-weight") || "normal"} ${fontSize} ${familyNode.getAttribute("font-family") || "serif"}`,
                fillRole: el.dataset.roleFill || "fg", strokeRole: "none", strokeWidth: 0,
                matrix, absMinX: limits.minX, absMaxX: limits.maxX, symbolType: getSymbolType(el),
                centerY: matrix.b * box.x + matrix.d * (box.y + box.height / 2) + matrix.f, box, ...getMathFlyinParams(),
            });
        });

        if (globalAbsoluteStaffLineYs.length > 0) {
            globalAbsoluteStaffLineYs.sort((a, b) => a.y - b.y);
            const deduped = [];
            globalAbsoluteStaffLineYs.forEach(item => {
                if (deduped.length === 0 || Math.abs(item.y - deduped[deduped.length - 1].y) > 2) {
                    deduped.push(item);
                }
            });
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
                if (Math.max(...gaps.map(gap => Math.abs(gap - staffSpace))) <= Math.max(1.25, staffSpace * 0.22)) {
                    validStaffLines.push(...fiveLines);
                }
            }
            const finalCleanStaffLines = [];
            validStaffLines.forEach(item => {
                if (finalCleanStaffLines.length === 0 || Math.abs(item.y - finalCleanStaffLines[finalCleanStaffLines.length - 1].y) > 1) {
                    finalCleanStaffLines.push(item);
                }
            });
            globalAbsoluteStaffLineYs = finalCleanStaffLines;
        }

        const initialBarlines = renderQueue.filter(item => item.symbolType === "Barline");
        if (initialBarlines.length > 0) {
            const absoluteLeftmostBarlineX = Math.min(...initialBarlines.map(barline => barline.absMinX));
            const startCluster = initialBarlines.filter(barline => barline.absMinX <= absoluteLeftmostBarlineX + 30);
            globalAbsoluteSystemInternalX = Math.max(...startCluster.map(barline => barline.absMinX));
        } else {
            globalAbsoluteSystemInternalX = getFallbackSystemInternalX() || 0;
        }

        const stickyTypesMap = { InstName: "inst", Clef: "clef", KeySig: "key", TimeSig: "time", Barline: "bar", Brace: "brace" };
        const stickies = renderQueue.filter(item => item.symbolType && stickyTypesMap[item.symbolType]);
        const clusterThresholdX = 35;
        const globalLanes = [];

        const staffLineYs = globalAbsoluteStaffLineYs.map(line => line.y);
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

        let globalMinX = Infinity;
        globalLanes.forEach(lane => {
            lane.items.forEach(item => {
                if (stickyTypesMap[item.symbolType] === "inst") return;
                if (item.absMinX < globalMinX) globalMinX = item.absMinX;
            });
        });
        stickyMinX = globalMinX === Infinity ? 0 : globalMinX;

        globalLanes.forEach(lane => {
            const currentStaffSpace = lane.staffSpace || 10;
            const itemsByType = { inst: [], clef: [], key: [], time: [], bar: [], brace: [] };
            lane.items.forEach(item => itemsByType[stickyTypesMap[item.symbolType]].push(item));
            const typeBlocks = {};

            ["inst", "clef", "key", "time", "bar", "brace"].forEach(type => {
                const items = itemsByType[type];
                if (items.length === 0) return;
                items.sort((a, b) => a.absMinX - b.absMinX);
                let currentBlock = { minX: items[0].absMinX, maxX: items[0].absMaxX, items: [items[0]] };
                const blocks = [];
                for (let i = 1; i < items.length; i++) {
                    const item = items[i];
                    if (item.absMinX - currentBlock.maxX < clusterThresholdX) {
                        currentBlock.items.push(item);
                        if (item.absMaxX > currentBlock.maxX) currentBlock.maxX = item.absMaxX;
                    } else {
                        currentBlock.width = currentBlock.maxX - currentBlock.minX;
                        blocks.push(currentBlock);
                        currentBlock = { minX: item.absMinX, maxX: item.absMaxX, items: [item] };
                    }
                }
                currentBlock.width = currentBlock.maxX - currentBlock.minX;
                blocks.push(currentBlock);
                typeBlocks[type] = blocks;
            });

            const baseWidths = { inst: 0, clef: 0, key: 0, time: 0, bar: 0, brace: 0 };
            ["inst", "clef", "key", "time", "bar", "brace"].forEach(type => {
                if (typeBlocks[type] && typeBlocks[type].length > 0) {
                    const firstBlock = typeBlocks[type][0];
                    if (firstBlock.minX <= stickyMinX + 200) baseWidths[type] = firstBlock.width;
                }
            });
            globalStickyLanes[lane.laneId] = { typeBlocks, baseWidths };

            ["inst", "clef", "key", "time", "bar", "brace"].forEach(type => {
                if (!typeBlocks[type]) return;
                const anchorX = typeBlocks[type][0].minX;
                typeBlocks[type].forEach((block, index) => {
                    const lockDistance = Math.max(0, block.minX - anchorX);
                    const isMidClef = type === "clef" && index > 0;
                    block.items.forEach(item => {
                        item.isSticky = true;
                        item.stickyType = type;
                        item.laneId = lane.laneId;
                        item.blockIndex = index;
                        item.lockDistance = lockDistance;
                        item.blockMinX = block.minX;
                        item.blockCenterY = block.items[0].centerY;
                        item.isMidClef = isMidClef;
                        item.midClefOffsetY = 0;
                        item.staffSpace = currentStaffSpace;
                        if (isMidClef && item.type === "path" && item.originalD) {
                            const sigStr = item.originalD.replace(/[^a-zA-Z]/g, "").toUpperCase();
                            const specificType = identifyClefOrBrace(sigStr, item.originalD);
                            if (specificType && specificType.includes("Bass")) {
                                item.midClefOffsetY = currentStaffSpace * 0.3;
                            } else if (specificType && specificType.includes("Treble")) {
                                item.midClefOffsetY = -currentStaffSpace * 0.3;
                            }
                        }
                    });
                });
            });
        });

        renderQueue.sort((a, b) => (a.domIndex || 0) - (b.domIndex || 0));
        debugLog(`📦 内存数据库构建：已提取强分离指令 ${renderQueue.length} 条！`);

        return {
            globalAbsoluteStaffLineYs,
            globalAbsoluteSystemInternalX,
            globalStickyLanes,
            renderQueue,
            stickyMinX,
        };
    }

    return {
        buildRenderQueue,
        preprocessSvgColors,
    };
}
