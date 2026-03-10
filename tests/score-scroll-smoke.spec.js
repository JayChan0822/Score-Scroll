const fs = require('fs');
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

test('optimized score scroll shell loads with key controls', async ({ page }) => {
  const pageErrors = [];
  const failedRequests = [];
  const requestedPaths = new Set();
  const responseStatuses = new Map();

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('request', (request) => {
    requestedPaths.add(new URL(request.url()).pathname);
  });

  page.on('requestfailed', (request) => {
    failedRequests.push(request.url());
  });

  page.on('response', (response) => {
    requestedPaths.add(new URL(response.url()).pathname);
    responseStatuses.set(new URL(response.url()).pathname, response.status());
  });

  page.on('dialog', async (dialog) => {
    await dialog.dismiss();
  });

  await page.goto('/index.html');

  await expect(page).toHaveTitle(/Score Scroll/i);
  await expect(page.locator('head link[href="./styles/main.css"]')).toHaveCount(1);
  await expect(page.locator('head script[src="./vendor/mp4-muxer.js"]')).toHaveCount(1);
  await expect(page.locator('head script[type="module"][src="./scripts/app.js"]')).toHaveCount(1);
  await expect(page.locator('head style')).toHaveCount(0);
  await expect(page.locator('body > script:not([src])')).toHaveCount(0);
  await expect(page.locator('.hero-title')).toBeVisible();
  await expect(page.locator('#viewport')).toBeVisible();
  await expect(page.locator('#score-canvas')).toBeVisible();
  await expect(page.locator('#playBtn')).toBeVisible();
  await expect(page.locator('#playBtn')).toBeDisabled();
  await expect(page.locator('#progressSlider')).toBeDisabled();
  await expect(page.locator('#svgInput')).toBeVisible();
  await expect(page.locator('#exportVideoBtn')).toBeVisible();
  await expect(page.locator('#exportStartInput')).toBeVisible();
  await expect(page.locator('#exportEndInput')).toBeVisible();
  await expect(page.locator('#zoomValDisplay')).toHaveText('100%');
  await expect(page.locator('#exportModal')).toBeHidden();

  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(responseStatuses.get('/vendor/mp4-muxer.js')).toBe(200);
  expect([...requestedPaths]).toEqual(expect.arrayContaining([
    '/vendor/mp4-muxer.js',
    '/scripts/features/audio.js',
    '/scripts/features/export-video.js',
    '/scripts/features/midi.js',
    '/scripts/features/playback.js',
    '/scripts/features/ui-events.js',
    '/scripts/utils/format.js',
    '/scripts/utils/math.js',
  ]));
});

test('shows a local-server warning when opened via file protocol', async ({ page }) => {
  const fileUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

  await page.goto(fileUrl);

  await expect(page.locator('#runtimeWarning')).toBeVisible();
  await expect(page.locator('#runtimeWarning')).toContainText('请通过本地静态服务访问');
  await expect(page.locator('#runtimeWarning')).toContainText('npm run serve');
  await expect(page.locator('#runtimeWarning')).toContainText('http://127.0.0.1:4173/index.html');
});

test('validates export range before starting video export', async ({ page }) => {
  let dialogMessage = null;

  page.on('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  });

  await page.goto('/index.html');

  await expect(page.locator('#exportStartInput')).toBeVisible();
  await expect(page.locator('#exportEndInput')).toBeVisible();

  await page.locator('#exportStartInput').fill('12.5');
  await page.locator('#exportEndInput').fill('10');
  await page.click('#exportVideoBtn');

  await expect.poll(() => dialogMessage).toBe('起始时间必须小于结束时间！');
  await expect(page.locator('#exportModal')).toBeHidden();
});

test('positions the zoom slider at the top-left of the viewport', async ({ page }) => {
  await page.goto('/index.html');

  const zoomControl = page.locator('.zoom-control-wrapper');
  const viewport = page.locator('#viewport');

  await expect(zoomControl).toBeVisible();
  await expect(zoomControl).toHaveCSS('top', '20px');
  await expect(zoomControl).toHaveCSS('left', '20px');

  const viewportBox = await viewport.boundingBox();
  const zoomBox = await zoomControl.boundingBox();

  expect(viewportBox).not.toBeNull();
  expect(zoomBox).not.toBeNull();
  expect(Math.abs((zoomBox.x - viewportBox.x) - 20)).toBeLessThan(2);
  expect(Math.abs((zoomBox.y - viewportBox.y) - 20)).toBeLessThan(2);
});

test('uses the 8px minimum height threshold for initial barline detection', async () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'app.js'), 'utf8');

  expect(appSource).toContain('vLine.height >= 8');
});

test('binds the space shortcut without hijacking focused inputs', async ({ page }) => {
  await page.goto('/index.html');

  await page.evaluate(() => {
    window.__playShortcutClicks = 0;
    const playBtn = document.getElementById('playBtn');
    playBtn.disabled = false;
    playBtn.addEventListener('click', () => {
      window.__playShortcutClicks += 1;
    });
  });

  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__playShortcutClicks)).toBe(1);

  await page.locator('#exportStartInput').focus();
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__playShortcutClicks)).toBe(1);
});

test('removes only the currently unused code paths and config fields', async () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
  const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'app.js'), 'utf8');
  const stateSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'core', 'state.js'), 'utf8');
  const playbackSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'features', 'playback.js'), 'utf8');

  expect(packageJson.main).toBeUndefined();
  expect(appSource).not.toContain('encodedChunks');
  expect(appSource).not.toMatch(/\bisExportingVideo\b/);
  expect(appSource).not.toMatch(/\bvideoEncoder\b/);
  expect(appSource).not.toContain('createPlaybackState');
  expect(stateSource).not.toContain('encodedChunks');
  expect(stateSource).not.toMatch(/\bisExportingVideo\b/);
  expect(stateSource).not.toMatch(/\bvideoEncoder\b/);
  expect(playbackSource).not.toContain('function createPlaybackState');
  expect(playbackSource).not.toContain('createPlaybackState,');
});
