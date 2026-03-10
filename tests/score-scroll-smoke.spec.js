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
    '/scripts/features/svg-analysis.js',
    '/scripts/features/timeline.js',
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

test('adds jsdoc-based typecheck coverage for the selected core modules', async () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
  const tsconfigPath = path.resolve(__dirname, '..', 'tsconfig.json');
  const targetFiles = [
    path.resolve(__dirname, '..', 'scripts', 'core', 'state.js'),
    path.resolve(__dirname, '..', 'scripts', 'core', 'dom.js'),
    path.resolve(__dirname, '..', 'scripts', 'features', 'audio.js'),
    path.resolve(__dirname, '..', 'scripts', 'features', 'export-video.js'),
    path.resolve(__dirname, '..', 'scripts', 'features', 'playback.js'),
  ];

  expect(packageJson.scripts?.typecheck).toBeDefined();
  expect(fs.existsSync(tsconfigPath)).toBe(true);

  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  expect(tsconfig.compilerOptions?.allowJs).toBe(true);
  expect(tsconfig.compilerOptions?.checkJs).toBe(true);
  expect(tsconfig.compilerOptions?.noEmit).toBe(true);

  for (const filePath of targetFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    expect(source).toContain('// @ts-check');
  }
});

test('extracts the timeline pipeline into a dedicated feature module', async () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'app.js'), 'utf8');
  const timelineModulePath = path.resolve(__dirname, '..', 'scripts', 'features', 'timeline.js');

  expect(fs.existsSync(timelineModulePath)).toBe(true);

  const timelineSource = fs.readFileSync(timelineModulePath, 'utf8');
  expect(timelineSource).toContain('export function createTimelineFeature');
  expect(timelineSource).toContain('function extractTimeSignatures');
  expect(timelineSource).toContain('function recalculateMidiTempoMap');
  expect(timelineSource).toContain('function generateManualTempoMap');
  expect(timelineSource).toContain('function fuseDataWithTempoMap');
  expect(appSource).toContain('createTimelineFeature');
});

test('extracts svg preprocessing and render-queue analysis into a dedicated feature module', async () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'app.js'), 'utf8');
  const svgAnalysisModulePath = path.resolve(__dirname, '..', 'scripts', 'features', 'svg-analysis.js');

  expect(fs.existsSync(svgAnalysisModulePath)).toBe(true);

  const svgAnalysisSource = fs.readFileSync(svgAnalysisModulePath, 'utf8');
  expect(svgAnalysisSource).toContain('export function createSvgAnalysisFeature');
  expect(svgAnalysisSource).toContain('function preprocessSvgColors');
  expect(svgAnalysisSource).toContain('function buildRenderQueue');
  expect(appSource).toContain('createSvgAnalysisFeature');
});

test('adds a png sequence export entry point', async () => {
  const htmlSource = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const domSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'core', 'dom.js'), 'utf8');
  const uiEventsSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'features', 'ui-events.js'), 'utf8');

  expect(htmlSource).toContain('id="exportPngBtn"');
  expect(htmlSource).toContain('Export PNG');
  expect(domSource).toContain('@property {HTMLButtonElement | null} exportPngBtn');
  expect(domSource).toContain('exportPngBtn: byId(doc, "exportPngBtn")');
  expect(uiEventsSource).toContain('onExportPngClick');
  expect(uiEventsSource).toContain('dom.exportPngBtn?.addEventListener("click", onExportPngClick);');
});

test('guards png sequence export behind directory access support', async () => {
  const exportSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'features', 'export-video.js'), 'utf8');
  const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'app.js'), 'utf8');

  expect(exportSource).toContain('async function exportPngSequence');
  expect(exportSource).toContain('showDirectoryPicker');
  expect(exportSource).toContain('image/png');
  expect(exportSource).toContain('score-scroll-png-');
  expect(exportSource).toContain('runPngExportFlow');
  expect(appSource).toContain('exportFeature.runPngExportFlow()');
});

test('writes transparent png frames into an auto-created subfolder', async () => {
  const exportSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'features', 'export-video.js'), 'utf8');
  const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'app.js'), 'utf8');

  expect(exportSource).toContain('createWritable');
  expect(exportSource).toContain('toBlob');
  expect(exportSource).toContain('frame_');
  expect(exportSource).toContain('transparentBackground: true');
  expect(appSource).toContain('function renderCanvas(currentX, options = {})');
  expect(appSource).toContain('const { transparentBackground = false } = options;');
});

test('exports numbered png frames through the directory access api', async ({ page }) => {
  await page.goto('/index.html');

  const exportResult = await page.evaluate(async () => {
    const { createExportVideoFeature } = await import('/scripts/features/export-video.js');

    /** @type {Array<Record<string, unknown>>} */
    const writes = [];
    /** @type {HTMLCanvasElement} */
    let canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;

    /** @type {CanvasRenderingContext2D | null} */
    let ctx = canvas.getContext('2d');
    let cancelVideoExport = false;
    let cachedViewportWidth = 800;
    let globalZoom = 1;
    let smoothState = { playbackSimTime: 0, smoothVx: 0, smoothX: 0 };

    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type) {
      callback(new Blob(['png'], { type: type || 'image/png' }));
    };

    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => ({
        async getDirectoryHandle(name, options) {
          writes.push({ type: 'directory', name, create: options?.create === true });
          return {
            async getFileHandle(fileName, fileOptions) {
              writes.push({ type: 'file-handle', fileName, create: fileOptions?.create === true });
              return {
                async createWritable() {
                  return {
                    async abort() {},
                    async close() {},
                    async write(blob) {
                      writes.push({ type: 'write', fileName, mime: blob.type, size: blob.size });
                    },
                  };
                },
              };
            },
          };
        },
      }),
    });

    const exportModal = document.createElement('div');
    const exportModalTitle = document.createElement('div');
    const exportProgressBar = document.createElement('div');
    const exportProgressText = document.createElement('div');
    const cancelExportBtn = document.createElement('button');
    const playBtn = document.createElement('button');
    const viewportEl = document.createElement('div');
    Object.defineProperty(viewportEl, 'clientWidth', { configurable: true, value: 800 });

    const dom = {
      cancelExportBtn,
      exportEndInput: null,
      exportFpsSelect: null,
      exportModal,
      exportModalTitle,
      exportProgressBar,
      exportProgressText,
      exportRatioSelect: null,
      exportResSelect: null,
      exportStartInput: null,
      playBtn,
      viewportEl,
    };

    const feature = createExportVideoFeature({
      dom,
      getAudioOffsetSec: () => 0,
      getCachedViewportWidth: () => cachedViewportWidth,
      getCanvas: () => canvas,
      getCancelVideoExport: () => cancelVideoExport,
      getCtx: () => ctx,
      getGlobalAudioFile: () => null,
      getGlobalScoreHeight: () => 320,
      getGlobalZoom: () => globalZoom,
      getInterpolatedXByTime: (timeSec) => ({ x: timeSec * 100, index: 0, atEnd: false }),
      getIsPlaying: () => false,
      getSmoothedTargetVelocityByTime: () => 0,
      getSmoothState: () => smoothState,
      getTotalDuration: () => 1,
      renderCanvas: () => {},
      resizeCanvas: () => {},
      setCachedViewportWidth: (width) => {
        cachedViewportWidth = width;
      },
      setCanvas: (nextCanvas) => {
        canvas = nextCanvas;
      },
      setCancelVideoExport: (cancelled) => {
        cancelVideoExport = cancelled;
      },
      setCtx: (nextCtx) => {
        ctx = nextCtx;
      },
      setGlobalZoom: (zoom) => {
        globalZoom = zoom;
      },
      setIsExportingVideoMode: () => {},
      setSmoothState: (nextState) => {
        smoothState = nextState;
      },
    });

    try {
      await feature.exportPngSequence(640, 2, '16:9', 0, 1);
      return {
        modalTitle: exportModalTitle.innerText,
        progressText: exportProgressText.innerText,
        writes,
      };
    } finally {
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
      delete window.showDirectoryPicker;
    }
  });

  const frameWrites = exportResult.writes.filter((entry) => entry.type === 'write');

  expect(exportResult.modalTitle).toBe('SUCCESS!');
  expect(exportResult.progressText).toBe('100.0%');
  expect(exportResult.writes[0]).toMatchObject({ type: 'directory', create: true });
  expect(exportResult.writes[0].name).toMatch(/^score-scroll-png-/);
  expect(frameWrites).toHaveLength(2);
  expect(frameWrites[0]).toMatchObject({ fileName: 'frame_000001.png', mime: 'image/png' });
  expect(frameWrites[1]).toMatchObject({ fileName: 'frame_000002.png', mime: 'image/png' });
});

test('gates debug instrumentation behind a shared debug logger', async () => {
  const debugModulePath = path.resolve(__dirname, '..', 'scripts', 'utils', 'debug.js');

  expect(fs.existsSync(debugModulePath)).toBe(true);

  const debugSource = fs.readFileSync(debugModulePath, 'utf8');
  expect(debugSource).toContain('export const DEBUG_LOGS_ENABLED = false');
  expect(debugSource).toContain('export function debugLog(...args)');
  expect(debugSource).toContain('if (!DEBUG_LOGS_ENABLED) return;');
  expect(debugSource).toContain('console.log(...args);');
});

test('routes selected development logs through the shared debug logger', async () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'app.js'), 'utf8');
  const svgAnalysisSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'features', 'svg-analysis.js'), 'utf8');
  const timelineSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'features', 'timeline.js'), 'utf8');
  const audioSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'features', 'audio.js'), 'utf8');

  expect(appSource).toContain('import { debugLog } from "./utils/debug.js";');
  expect(svgAnalysisSource).toContain('import { debugLog } from "../utils/debug.js";');
  expect(timelineSource).toContain('import { debugLog } from "../utils/debug.js";');
  expect(audioSource).toContain('import { debugLog } from "../utils/debug.js";');

  expect(appSource).not.toContain('console.log(`🔤 音乐字体引擎已切换至:');
  expect(appSource).not.toContain('console.log(`🤖 [智能嗅探] 发现目标字体:');
  expect(svgAnalysisSource).not.toContain('console.log(`📦 内存数据库构建：');
  expect(timelineSource).not.toContain('console.log("✅ 全局变速曲线融合完毕！最终驱动数据：", nextMapData);');
  expect(audioSource).not.toContain('console.log(`🎼 [乐谱分析] 检测到首个音符位于:');
});

test('keeps stacked opening time signatures while rejecting short stems and isolated sebastian digits', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'time-signature-regression.svg');

  await page.goto('/index.html');

  await page.evaluate(() => {
    const sandbox = document.getElementById('svg-sandbox');
    if (!sandbox) return;

    const innerHtmlDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!innerHtmlDescriptor?.get || !innerHtmlDescriptor?.set) return;

    Object.defineProperty(sandbox, 'innerHTML', {
      configurable: true,
      get() {
        return innerHtmlDescriptor.get.call(this);
      },
      set(value) {
        if (value === '' && this.querySelector('svg')) {
          return;
        }
        innerHtmlDescriptor.set.call(this, value);
      },
    });
  });

  await page.setInputFiles('#svgInput', fixturePath);

  await expect.poll(async () => page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    return svg ? svg.querySelectorAll('text').length : 0;
  })).toBeGreaterThan(0);

  const detectionState = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    if (!svg) return null;

    const openingFours = Array.from(svg.querySelectorAll('text'))
      .filter((el) => (el.textContent || '').trim() === '')
      .map((el) => ({
        text: (el.textContent || '').trim(),
        classes: el.className.baseVal || '',
      }));

    const isolatedTwo = Array.from(svg.querySelectorAll('text'))
      .find((el) => (el.textContent || '').trim() === '');

    const shortStem = Array.from(svg.querySelectorAll('line, polyline'))
      .find((el) => el.getAttribute('points') === '88,100 88,113');

    const openingBarline = Array.from(svg.querySelectorAll('line, polyline'))
      .find((el) => el.getAttribute('x1') === '60' && el.getAttribute('x2') === '60');

    return {
      openingFours,
      isolatedTwoClasses: isolatedTwo?.className?.baseVal || '',
      shortStemClasses: shortStem?.className?.baseVal || '',
      openingBarlineClasses: openingBarline?.className?.baseVal || '',
    };
  });

  expect(detectionState).not.toBeNull();
  expect(detectionState.openingFours).toHaveLength(2);
  expect(detectionState.openingFours.every((item) => item.classes.includes('highlight-timesig'))).toBe(true);
  expect(detectionState.isolatedTwoClasses).not.toContain('highlight-timesig');
  expect(detectionState.shortStemClasses).not.toContain('highlight-barline');
  expect(detectionState.openingBarlineClasses).toContain('highlight-barline');
});

test('classifies left-of-system verticals as bracket lines without relying on barline classes', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'bracket-barline-separation.svg');

  await page.goto('/index.html');

  await page.evaluate(() => {
    const sandbox = document.getElementById('svg-sandbox');
    if (!sandbox) return;

    const innerHtmlDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!innerHtmlDescriptor?.get || !innerHtmlDescriptor?.set) return;

    Object.defineProperty(sandbox, 'innerHTML', {
      configurable: true,
      get() {
        return innerHtmlDescriptor.get.call(this);
      },
      set(value) {
        if (value === '' && this.querySelector('svg')) {
          return;
        }
        innerHtmlDescriptor.set.call(this, value);
      },
    });
  });

  await page.setInputFiles('#svgInput', fixturePath);

  await expect.poll(async () => page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    return svg ? svg.querySelectorAll('line, polyline').length : 0;
  })).toBeGreaterThan(0);

  const bracketState = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    if (!svg) return null;

    const firstBarline = Array.from(svg.querySelectorAll('line, polyline'))
      .find((el) => el.getAttribute('x1') === '100' && el.getAttribute('x2') === '100');

    const outerBracketLine = Array.from(svg.querySelectorAll('line, polyline'))
      .find((el) => el.getAttribute('points') === '90,90 90,110');

    const innerBracketLine = Array.from(svg.querySelectorAll('line, polyline'))
      .find((el) => el.getAttribute('points') === '95,80 95,120');

    return {
      firstBarlineClasses: firstBarline?.className?.baseVal || '',
      outerBracketLineClasses: outerBracketLine?.className?.baseVal || '',
      innerBracketLineClasses: innerBracketLine?.className?.baseVal || '',
    };
  });

  expect(bracketState).not.toBeNull();
  expect(bracketState.firstBarlineClasses).toContain('highlight-barline');
  expect(bracketState.firstBarlineClasses).not.toContain('highlight-brace');
  expect(bracketState.outerBracketLineClasses).toContain('highlight-brace');
  expect(bracketState.outerBracketLineClasses).not.toContain('highlight-barline');
  expect(bracketState.innerBracketLineClasses).toContain('highlight-brace');
  expect(bracketState.innerBracketLineClasses).not.toContain('highlight-barline');
});
