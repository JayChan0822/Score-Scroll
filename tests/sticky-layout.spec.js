const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { test, expect } = require('@playwright/test');

async function importStickyLayout() {
  return import(pathToFileURL(path.resolve(__dirname, '..', 'scripts', 'features', 'sticky-layout.mjs')).href);
}

test('late-only key signatures do not add synthetic padding when no opening key slot exists', async () => {
  const { calculateStickySystemDelta } = await importStickyLayout();

  expect(calculateStickySystemDelta({
    type: 'key',
    baseWidth: 0,
    currentWidth: 30.25,
  })).toBeCloseTo(30.25, 5);
});

test('natural-only key signature blocks clear the sticky key display', async () => {
  const { getStickyBlockDisplayWidth } = await importStickyLayout();

  expect(getStickyBlockDisplayWidth({
    type: 'key',
    blockWidth: 24.5,
    clearsKeySignature: true,
  })).toBe(0);

  expect(getStickyBlockDisplayWidth({
    type: 'key',
    blockWidth: 24.5,
    clearsKeySignature: false,
  })).toBeCloseTo(24.5, 5);
});

test('clefs keep synthetic padding when a sticky clef appears without a base slot', async () => {
  const { calculateStickySystemDelta } = await importStickyLayout();

  expect(calculateStickySystemDelta({
    type: 'clef',
    baseWidth: 0,
    currentWidth: 14.8,
  })).toBeCloseTo(29.8, 5);
});

test('rehearsal marks wait for the opening clef column before locking', async () => {
  const { calculateStickyBlockLockDistance } = await importStickyLayout();

  expect(calculateStickyBlockLockDistance({
    type: 'reh',
    blockMinX: 152,
    firstBlockMinX: 152,
    openingClefMinX: 68,
    openingThresholdX: 200,
    stickyMinX: 20,
  })).toBeCloseTo(84, 5);
});

test('rehearsal marks keep their existing opening lock when no clef anchor exists', async () => {
  const { calculateStickyBlockLockDistance } = await importStickyLayout();

  expect(calculateStickyBlockLockDistance({
    type: 'reh',
    blockMinX: 152,
    firstBlockMinX: 152,
    openingClefMinX: null,
    openingThresholdX: 200,
    stickyMinX: 20,
  })).toBeCloseTo(0, 5);
});

test('rehearsal marks align to a shared sticky height above the opening clef', async () => {
  const { calculateRehearsalMarkStickyYOffset } = await importStickyLayout();

  expect(calculateRehearsalMarkStickyYOffset({
    hasOpeningClefAnchor: true,
    rehearsalMaxY: 32,
    clefMinY: 42,
    padding: 4,
  })).toBeCloseTo(6, 5);

  expect(calculateRehearsalMarkStickyYOffset({
    hasOpeningClefAnchor: true,
    rehearsalMaxY: 38,
    clefMinY: 42,
    padding: 4,
  })).toBe(0);

  expect(calculateRehearsalMarkStickyYOffset({
    hasOpeningClefAnchor: true,
    rehearsalMaxY: 48,
    clefMinY: 42,
    padding: 4,
  })).toBeCloseTo(-10, 5);

  expect(calculateRehearsalMarkStickyYOffset({
    hasOpeningClefAnchor: false,
    rehearsalMaxY: 48,
    clefMinY: 42,
    padding: 4,
  })).toBe(0);
});

test('bottom-lane rehearsal marks align to a shared sticky height below the opening symbols', async () => {
  const { calculateRehearsalMarkStickyYOffset } = await importStickyLayout();

  expect(calculateRehearsalMarkStickyYOffset({
    hasOpeningClefAnchor: true,
    placement: 'below',
    rehearsalMinY: 32,
    openingMaxY: 42,
    padding: 4,
  })).toBeCloseTo(14, 5);

  expect(calculateRehearsalMarkStickyYOffset({
    hasOpeningClefAnchor: true,
    placement: 'below',
    rehearsalMinY: 46,
    openingMaxY: 42,
    padding: 4,
  })).toBe(0);

  expect(calculateRehearsalMarkStickyYOffset({
    hasOpeningClefAnchor: true,
    placement: 'below',
    rehearsalMinY: 56,
    openingMaxY: 42,
    padding: 4,
  })).toBeCloseTo(-10, 5);
});

test('rehearsal-mark y targets freeze replaced marks and keep future marks at origin until activation', async () => {
  const { resolveRehearsalMarkTargetExtraY } = await importStickyLayout();

  expect(resolveRehearsalMarkTargetExtraY({
    itemBlockIndex: 1,
    currentActive: 2,
    targetExtraY: -10,
    currentExtraY: 6,
  })).toBe(6);

  expect(resolveRehearsalMarkTargetExtraY({
    itemBlockIndex: 2,
    currentActive: 2,
    targetExtraY: -10,
    currentExtraY: 6,
  })).toBe(-10);

  expect(resolveRehearsalMarkTargetExtraY({
    itemBlockIndex: 3,
    currentActive: 2,
    targetExtraY: -10,
    currentExtraY: 6,
  })).toBe(0);
});

test('app separates rehearsal sticky padding for above and below placements', async () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'app.js'), 'utf8');

  expect(appSource).toContain('const REHEARSAL_STICKY_PADDING_ABOVE');
  expect(appSource).toContain('const REHEARSAL_STICKY_PADDING_BELOW');
  expect(appSource).toContain('padding: isBottomLane ? REHEARSAL_STICKY_PADDING_BELOW : REHEARSAL_STICKY_PADDING_ABOVE');
});

test('late-only key signatures can lock to an opening fallback column', async () => {
  const { calculateStickyBlockLockDistance } = await importStickyLayout();

  expect(calculateStickyBlockLockDistance({
    type: 'key',
    blockMinX: 240,
    firstBlockMinX: 240,
    openingClefMinX: 68,
    fallbackAnchorX: 102,
    openingThresholdX: 200,
    stickyMinX: 20,
  })).toBeCloseTo(138, 5);
});
