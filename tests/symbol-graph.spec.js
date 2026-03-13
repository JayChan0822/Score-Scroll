const path = require('path');
const { pathToFileURL } = require('url');
const { test, expect } = require('@playwright/test');

async function importSymbolGraph() {
  return import(pathToFileURL(path.resolve(__dirname, '..', 'scripts', 'features', 'symbol-graph.mjs')).href);
}

test('trusted barline anchors reject short geometric-natural fragments', async () => {
  const { buildTrustedBarlineAnchors } = await importSymbolGraph();

  const anchors = buildTrustedBarlineAnchors({
    systemStartX: 80,
    staffSystems: [{ top: 10, bottom: 150 }],
    candidateClusters: [
      { x: 100, minTop: 10, maxBottom: 150, lineCount: 19, maxLineHeight: 140 },
      { x: 250, minTop: 58, maxBottom: 69, lineCount: 3, maxLineHeight: 11 },
    ],
    staffSpace: 10,
  });

  expect(anchors.map((item) => item.x)).toEqual([80, 100]);
});

test('note-adjacent geometric natural groups classify as accidentals without a trusted anchor', async () => {
  const { classifyAccidentalGroups } = await importSymbolGraph();

  const result = classifyAccidentalGroups({
    accidentalGroups: [
      { id: 'geom-natural-1', left: 200, right: 208, centerY: 100, bandIndex: 0 },
    ],
    noteheads: [
      { id: 'note-1', left: 209.2, right: 212.2, centerY: 100.8, bandIndex: 0 },
    ],
    timeSignatureGlyphs: [],
    trustedAnchors: [{ x: 80, kind: 'system-start' }],
    staffSpace: 10,
  });

  expect(result.keySignatureIds).toEqual([]);
  expect(result.accidentalIds).toEqual(['geom-natural-1']);
});

test('key-signature groups require a trusted anchor and a clear right boundary before noteheads', async () => {
  const { classifyAccidentalGroups } = await importSymbolGraph();

  const result = classifyAccidentalGroups({
    accidentalGroups: [
      { id: 'key-flat-1', left: 103, right: 105, centerY: 100, bandIndex: 0 },
      { id: 'note-flat-1', left: 203, right: 205, centerY: 100, bandIndex: 0 },
    ],
    noteheads: [
      { id: 'note-1', left: 132, right: 135, centerY: 100.2, bandIndex: 0 },
      { id: 'note-2', left: 209, right: 212, centerY: 100.1, bandIndex: 0 },
    ],
    timeSignatureGlyphs: [],
    trustedAnchors: [{ x: 100, kind: 'barline' }],
    staffSpace: 10,
  });

  expect(result.keySignatureIds).toEqual(['key-flat-1']);
  expect(result.accidentalIds).toEqual(['note-flat-1']);
});

test('splits leading key-signature candidates from later note-adjacent accidentals in the same anchor window', async () => {
  const { classifyAccidentalGroups } = await importSymbolGraph();

  const result = classifyAccidentalGroups({
    accidentalGroups: [
      { id: 'key-sharp-1', left: 103, right: 106, centerY: 100, bandIndex: 0 },
      { id: 'note-sharp-1', left: 123, right: 126, centerY: 100, bandIndex: 0 },
    ],
    noteheads: [
      { id: 'note-1', left: 133.2, right: 136.2, centerY: 100.1, bandIndex: 0 },
    ],
    timeSignatureGlyphs: [],
    trustedAnchors: [{ x: 100, kind: 'barline' }],
    staffSpace: 10,
  });

  expect(result.keySignatureIds).toEqual(['key-sharp-1']);
  expect(result.accidentalIds).toEqual(['note-sharp-1']);
});

test('preserves a key-signature prefix when stacked note-adjacent accidental suffixes follow', async () => {
  const { classifyAccidentalGroups } = await importSymbolGraph();

  const result = classifyAccidentalGroups({
    accidentalGroups: [
      { id: 'key-sharp-1', left: 103, right: 106, centerY: 100, bandIndex: 0 },
      { id: 'key-sharp-2', left: 111, right: 114, centerY: 95, bandIndex: 0 },
      { id: 'key-sharp-3', left: 119, right: 122, centerY: 101, bandIndex: 0 },
      { id: 'suffix-sharp-1', left: 142, right: 145, centerY: 96, bandIndex: 0 },
      { id: 'suffix-natural-1', left: 149, right: 152, centerY: 101, bandIndex: 0 },
    ],
    noteheads: [
      { id: 'note-1', left: 154, right: 158, centerY: 96, bandIndex: 0 },
      { id: 'note-2', left: 154, right: 158, centerY: 101, bandIndex: 0 },
    ],
    timeSignatureGlyphs: [],
    trustedAnchors: [{ x: 100, kind: 'barline' }],
    staffSpace: 10,
  });

  expect(result.keySignatureIds).toEqual(['key-sharp-1', 'key-sharp-2', 'key-sharp-3']);
  expect(result.accidentalIds).toEqual(['suffix-sharp-1', 'suffix-natural-1']);
});

test('prefers note-adjacent accidentals over nearby barline anchors', async () => {
  const { classifyAccidentalGroups } = await importSymbolGraph();

  const result = classifyAccidentalGroups({
    accidentalGroups: [
      { id: 'borderline-sharp-1', left: 103, right: 106.2, centerY: 100, bandIndex: 0 },
    ],
    noteheads: [
      { id: 'note-1', left: 110.62, right: 114.62, centerY: 100.05, bandIndex: 0 },
    ],
    timeSignatureGlyphs: [],
    trustedAnchors: [{ x: 100, kind: 'barline' }],
    staffSpace: 3.4931640625,
  });

  expect(result.keySignatureIds).toEqual([]);
  expect(result.accidentalIds).toEqual(['borderline-sharp-1']);
});
