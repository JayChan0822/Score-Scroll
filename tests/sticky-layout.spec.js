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
