const fs = require('fs');
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const vm = require('vm');

async function preserveImportedSvgDuringSmoke(page) {
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
}

async function loadFixtureIntoScore(page, fixturePath) {
  await page.goto('/index.html');
  await preserveImportedSvgDuringSmoke(page);
  await page.setInputFiles('#svgInput', fixturePath);
  await expect.poll(async () => page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    return svg ? svg.querySelectorAll('*').length : 0;
  })).toBeGreaterThan(0);
}

async function getTextClassification(page, selectors) {
  return page.evaluate((requestedSelectors) => {
    const svg = document.querySelector('#svg-sandbox svg');
    if (!svg) return null;

    return requestedSelectors.map((selector) => {
      const el = Array.from(svg.querySelectorAll('text')).find((node) => (
        (node.textContent || '').trim() === selector.text
        && node.getAttribute('x') === selector.x
        && node.getAttribute('y') === selector.y
      ));

      return {
        ...selector,
        exists: Boolean(el),
        classes: el?.className?.baseVal || '',
      };
    });
  }, selectors);
}

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
  await expect(page.locator('head link[rel="icon"]')).toHaveCount(1);
  await expect(page.locator('head script[src="./vendor/mp4-muxer.js"]')).toHaveCount(1);
  await expect(page.locator('head script[type="module"][src^="./scripts/app.js"]')).toHaveCount(1);
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
  expect(responseStatuses.get('/favicon.ico') ?? 200).toBe(200);
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
  expect(zoomBox.x - viewportBox.x).toBeGreaterThanOrEqual(0);
  expect(zoomBox.y - viewportBox.y).toBeGreaterThanOrEqual(0);
  expect(zoomBox.x - viewportBox.x).toBeLessThan(32);
  expect(zoomBox.y - viewportBox.y).toBeLessThan(32);
});

test('uses the 8px minimum height threshold for initial barline detection', async () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'app.js'), 'utf8');

  expect(appSource).toContain('vLine.height >= 8');
});

test('registers dedicated double-whole notehead signatures for the provided round fonts', async () => {
  const registrySource = fs.readFileSync(
    path.resolve(__dirname, '..', 'scripts', 'data', 'music-font-registry.js'),
    'utf8'
  );
  const executableSource = registrySource.replace(
    'export const MusicFontRegistry =',
    'globalThis.MusicFontRegistry ='
  );
  const context = { globalThis: {} };
  vm.runInNewContext(executableSource, context);
  const musicFontRegistry = context.globalThis.MusicFontRegistry;

  const expectedSignatures = {
    Ash: ['MCCCCCCCCLCCCCLCCCCCCCCCMCCCCCC'],
    Bravura: ['MLCLCLCLCMLCLCLCLCMCCCCMCCCCCCCCCCMLCLCLCLCMLCLCLCLC'],
    Broadway: ['MCCCCCCCCCLCCCCCCCCCCCCCCCCCCCCCCCMCCCCLCCCCLCCLCMCCCCCCCCLCCLCMCCCCC'],
    Engraver: ['MLCCLLLLLCCCLLLLMLLLLMLLLLMCCCCCC'],
    'Golden Age': ['MLLLCLLLMLLLCLCLLCLLLLCCLLMLLLCLLLMCC'],
    Jazz: ['MLLLLLLMCLCCLLLLCCLLLLCCLLLLCCLLLLMLLLLLLMCCCC'],
    Legacy: ['MLLLLMLLLLMLLLLCCCLLLLLCCLMCCCCCC'],
    Leipzig: ['MLCCLCCCCLCCLCCLCCCCLCCMCCCCLCCCCCMLCCLCCMLCCLCC'],
    Leland: ['MCCCCCCCMCCCCCCCCCCCCCCCCCCCCMCCCCCCCMCCCCCCCC'],
    Maestro: ['MLLLLMLLLLMLLLLCCLLLLLCCLMCCCCCC'],
    Petaluma: ['MCLCCCCCCCCMCLCCCCLCCCCCCLCCCMCCCCCLCCLCCCCCCCMCCCCCCCCCMCCCCCCCCCLCCMCCCCCCCCCCLCC'],
    Sebastian: ['MCCLCCLCCLCCLCCLCCLMCCLCCLMCCLCCLMCCCCLCCCCL'],
  };

  expect(
    Object.fromEntries(
      Object.entries(expectedSignatures).map(([fontName, signatures]) => [
        fontName,
        musicFontRegistry[fontName]?.noteheads?.Notehead_DoubleWhole || null,
      ])
    )
  ).toEqual(expectedSignatures);
});

test('registers all provided grand-staff brace signatures for the desktop font samples', async () => {
  const registrySource = fs.readFileSync(
    path.resolve(__dirname, '..', 'scripts', 'data', 'music-font-registry.js'),
    'utf8'
  );
  const executableSource = registrySource.replace(
    'export const MusicFontRegistry =',
    'globalThis.MusicFontRegistry ='
  );
  const context = { globalThis: {} };
  vm.runInNewContext(executableSource, context);
  const musicFontRegistry = context.globalThis.MusicFontRegistry;

  const expectedSignatures = {
    Ash: [
      'MCCCCCCCCCCCCCCCCCCCCCC',
      'MCCCLCCCCCCLCCC',
      'MCCCCCLCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCCLCCL',
      'MLCCCCCCCCCCLCCCCCLCCLCCCCCL',
    ],
    Bravura: [
      'MCCCCCCCCCCCCCCCCCCCCCC',
      'MCCCLCCCCCCLCCC',
      'MCCCCCLCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCCLCCL',
      'MLCCCCCCCCCCLCCCCCLCCLCCCCCL',
    ],
    Broadway: [
      'MCCCCCCCCCCCCCCCCCCCCCC',
      'MCCCLCCCCCCLCCC',
      'MCCCCCLCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCCLCCL',
      'MLCCCCCCCCCCLCCCCCLCCLCCCCCL',
    ],
    Engraver: [
      'MCCCCCCCCCCCCCCCCCCCCCC',
      'MCCCLCCCCCCLCCC',
      'MCCCCCLCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCCLCCL',
      'MLCCCCCCCCCCLCCCCCLCCLCCCCCL',
    ],
    'Golden Age': [
      'MCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCLCCC',
      'MCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCLCCC',
      'MCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCLCCC',
      'MCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCLCCC',
      'MCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCLCCC',
    ],
    Jazz: [
      'MCCCCCCCCCCCCCCCCCCCCCC',
      'MCCCLCCCCCCLCCC',
      'MCCCCCLCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCCLCCL',
      'MLCCCCCCCCCCLCCCCCLCCLCCCCCL',
    ],
    Legacy: [
      'MCCCCCCCCCCCCCCCCCCCCCC',
      'MCCCLCCCCCCLCCC',
      'MCCCCCLCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCCLCCL',
      'MLCCCCCCCCCCLCCCCCLCCLCCCCCL',
    ],
    Leipzig: [
      'MCCCCCCCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCCCCCCCC',
      'MCCCCCLCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCCLCCL',
      'MLCCCCCCCCCCLCCCCCLCCLCCCCCL',
    ],
    Leland: [
      'MCCCCCCCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCCCCC',
      'MCLCCCCLCCCCCCLCLCLCLCLCCCCC',
    ],
    Maestro: [
      'MCCCLCCCCCCLCCC',
      'MCCCLCCCCCCLCCC',
      'MCCCLCCCCCCLCCC',
      'MCCCLCCCCCCLCCC',
      'MCCCLCCCCCCLCCC',
    ],
    Petaluma: [
      'MCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCLCCC',
      'MCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCLCCC',
      'MCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCLCCC',
      'MCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCLCCC',
      'MCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCLCCC',
    ],
    Sebastian: [
      'MCCCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCC',
      'MCCCCCCCCCCCCCCCCC',
      'MLCCCCCCLCLCLCCLC',
    ],
  };

  expect(
    Object.fromEntries(
      Object.entries(expectedSignatures).map(([fontName, signatures]) => [
        fontName,
        musicFontRegistry[fontName]?.clefs?.['Brace (大谱表花括号)'] || null,
      ])
    )
  ).toEqual(expectedSignatures);
});

test('anchors sticky left edge to the virtual system start when no physical opening barline exists', async () => {
  const svgAnalysisSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'features', 'svg-analysis.js'), 'utf8');

  expect(svgAnalysisSource).toContain('window.hasPhysicalStartBarline === false');
  expect(svgAnalysisSource).toContain('stickyMinX = globalAbsoluteSystemInternalX;');
});

test('uses absolute system-start coordinates in downstream barline mapping and audio alignment', async () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'app.js'), 'utf8');
  const audioSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'features', 'audio.js'), 'utf8');

  expect(appSource).toContain('const absoluteSystemStartX = Number.isFinite(window.globalAbsoluteSystemInternalX)');
  expect(appSource).not.toContain('cluster.x < globalSystemInternalX - 5');
  expect(appSource).not.toContain('Math.abs(cluster.x - globalSystemInternalX) <= 5');
  expect(appSource).not.toContain('uniqueBarlines.unshift(globalSystemInternalX);');

  expect(audioSource).toContain('const absoluteSystemStartX = Number.isFinite(window.globalAbsoluteSystemInternalX)');
  expect(audioSource).not.toContain('centerX > getGlobalSystemInternalX()');
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

test('extends playback with a two-second tail buffer', async ({ page }) => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'app.js'), 'utf8');
  const exportSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'features', 'export-video.js'), 'utf8');

  await page.goto('/index.html');

  const playbackData = await page.evaluate(async () => {
    const playbackModule = await import(`/scripts/features/playback.js?tail-buffer=${Date.now()}`);
    const { createPlaybackHelpers, PLAYBACK_TAIL_BUFFER_SEC } = playbackModule;
    const mapData = [
      { time: 0, x: 0 },
      { time: 2, x: 100 },
      { time: 4, x: 200 },
    ];
    const totalDuration = mapData[mapData.length - 1].time + PLAYBACK_TAIL_BUFFER_SEC;
    const helpers = createPlaybackHelpers({
      getCachedViewportWidth: () => 600,
      getMapData: () => mapData,
      getTotalDuration: () => totalDuration,
    });

    return {
      gainAtTailEnd: helpers.getPlaybackGainByTime(totalDuration),
      gainAtTailMid: helpers.getPlaybackGainByTime(5),
      gainBeforeTail: helpers.getPlaybackGainByTime(3.99),
      hasGainHelper: typeof helpers.getPlaybackGainByTime === 'function',
      tailAtBaseX: helpers.getInterpolatedXByTime(4).x,
      tailAtEndAtEnd: helpers.getInterpolatedXByTime(totalDuration).atEnd,
      tailAtMidX: helpers.getInterpolatedXByTime(5).x,
      tailBufferSec: PLAYBACK_TAIL_BUFFER_SEC,
    };
  });

  expect(playbackData.tailBufferSec).toBe(2);
  expect(playbackData.hasGainHelper).toBe(true);
  expect(playbackData.tailAtBaseX).toBe(200);
  expect(playbackData.tailAtMidX).toBeGreaterThan(200);
  expect(playbackData.tailAtEndAtEnd).toBe(true);
  expect(playbackData.gainBeforeTail).toBeCloseTo(1, 2);
  expect(playbackData.gainAtTailMid).toBeCloseTo(0.5, 2);
  expect(playbackData.gainAtTailEnd).toBe(0);
  expect(appSource).toContain('getPlaybackGainByTime');
  expect(appSource).toContain('currentTime >= total');
  expect(exportSource).toContain('createGain');
  expect(exportSource).toContain('linearRampToValueAtTime');
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

test('preserves opening barlines, instrument names, and key signatures for transformed Opus SVG imports', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'green-tea-opening-anchor.svg');

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

    const openingBarlines = Array.from(svg.querySelectorAll('line, polyline'))
      .filter((el) => (el.className?.baseVal || '').includes('highlight-barline'))
      .map((el) => ({
        points: el.getAttribute('points') || '',
        x1: el.getAttribute('x1') || '',
        x2: el.getAttribute('x2') || '',
        classes: el.className?.baseVal || '',
      }));

    const piano = Array.from(svg.querySelectorAll('text'))
      .find((el) => (el.textContent || '').trim() === 'Piano');

    const firstFlat = Array.from(svg.querySelectorAll('text'))
      .find((el) => (el.textContent || '').trim() === '');

    return {
      openingBarlines,
      pianoClasses: piano?.className?.baseVal || '',
      firstFlatClasses: firstFlat?.className?.baseVal || '',
    };
  });

  expect(detectionState).not.toBeNull();
  expect(detectionState.openingBarlines.length).toBeGreaterThan(0);
  expect(detectionState.pianoClasses).toContain('highlight-instname');
  expect(detectionState.firstFlatClasses).toContain('highlight-keysig');
  expect(detectionState.firstFlatClasses).not.toContain('highlight-accidental');
});

test('preserves choir fixture piano opening key signatures', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'choir-with-piano-opening-keysig.svg');
  await loadFixtureIntoScore(page, fixturePath);

  const openingPianoFlats = await getTextClassification(page, [
    { text: '', x: '650', y: '2417' },
    { text: '', x: '650', y: '3380' },
  ]);

  expect(openingPianoFlats).not.toBeNull();
  expect(openingPianoFlats.every((item) => item.exists)).toBe(true);
  expect(openingPianoFlats.every((item) => item.classes.includes('highlight-keysig'))).toBe(true);
  expect(openingPianoFlats.every((item) => !item.classes.includes('highlight-accidental'))).toBe(true);
});

test('preserves green tea fixture piano opening key signatures', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'green-tea-opening-keysig.svg');
  await loadFixtureIntoScore(page, fixturePath);

  const openingPianoFlats = await getTextClassification(page, [
    { text: '', x: '859', y: '1122' },
    { text: '', x: '859', y: '1555' },
  ]);

  expect(openingPianoFlats).not.toBeNull();
  expect(openingPianoFlats.every((item) => item.exists)).toBe(true);
  expect(openingPianoFlats.every((item) => item.classes.includes('highlight-keysig'))).toBe(true);
  expect(openingPianoFlats.every((item) => !item.classes.includes('highlight-accidental'))).toBe(true);
});

test('preserves italic font-style for imported text when drawing to canvas', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'italic-text-preservation.svg');
  const fixtureSvg = fs.readFileSync(fixturePath, 'utf8');

  await page.goto('/index.html');
  const extractedFont = await page.evaluate(async (svgContent) => {
    const { createSvgAnalysisFeature } = await import('/scripts/features/svg-analysis.js');
    const host = document.createElement('div');
    host.innerHTML = svgContent;
    const svg = host.querySelector('svg');
    if (!svg) return null;

    document.body.appendChild(svg);
    const svgAnalysisFeature = createSvgAnalysisFeature({
      getFallbackSystemInternalX: () => 0,
      getMathFlyinParams: () => ({ randX: 0, randY: 0, delayDist: 0 }),
      identifyClefOrBrace: () => null,
    });

    const result = svgAnalysisFeature.buildRenderQueue(svg);
    svg.remove();

    const textItem = result.renderQueue.find((item) => item.type === 'text' && item.text === 'Col Ped.');
    return textItem?.font || null;
  }, fixtureSvg);

  expect(extractedFont).toContain('italic');
});

test('keeps split opening instrument labels sticky for Dorico imports', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'water-town-opening-instruments.svg');

  await page.goto('/index.html');
  await preserveImportedSvgDuringSmoke(page);
  await page.setInputFiles('#svgInput', fixturePath);
  await expect.poll(async () => page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    return svg ? svg.querySelectorAll('*').length : 0;
  }), { timeout: 20000 }).toBeGreaterThan(0);

  const openingInstrumentParts = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    if (!svg) return null;

    const collect = (text) => Array.from(svg.querySelectorAll('text'))
      .filter((el) => (el.textContent || '').trim() === text)
      .map((el) => ({
        classes: el.className?.baseVal || '',
        fontFamily: getComputedStyle(el).fontFamily,
      }));

    return {
      clarinet: collect('Clarinet (B'),
      flat: collect('♭'),
      closingParen: collect(')'),
      piano: collect('Piano'),
    };
  });

  expect(openingInstrumentParts).not.toBeNull();
  expect(openingInstrumentParts.clarinet.some((item) => item.classes.includes('highlight-instname'))).toBe(true);
  expect(openingInstrumentParts.flat.some((item) => (
    item.classes.includes('highlight-instname') && item.fontFamily.includes('Bravura Text')
  ))).toBe(true);
  expect(openingInstrumentParts.closingParen.some((item) => item.classes.includes('highlight-instname'))).toBe(true);
  expect(openingInstrumentParts.piano.some((item) => item.classes.includes('highlight-instname'))).toBe(true);
});

test('preserves opening instrument and expression fonts when drawing Dorico imports to canvas', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'water-town-opening-instruments.svg');

  await page.goto('/index.html');
  await preserveImportedSvgDuringSmoke(page);
  await page.evaluate(() => {
    if (window.__fillTextCallsInstalled) {
      window.__fillTextCalls = [];
      return;
    }

    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    window.__fillTextCallsInstalled = true;
    window.__fillTextCalls = [];

    CanvasRenderingContext2D.prototype.fillText = function patchedFillText(text, x, y, ...rest) {
      window.__fillTextCalls.push({
        alpha: this.globalAlpha,
        fillStyle: this.fillStyle,
        font: this.font,
        text: String(text),
        x,
        y,
      });
      return originalFillText.call(this, text, x, y, ...rest);
    };
  });

  await page.setInputFiles('#svgInput', fixturePath);
  await expect.poll(async () => page.evaluate(() => (window.__fillTextCalls || []).length), { timeout: 20000 }).toBeGreaterThan(0);

  const drawCalls = await page.evaluate(() => {
    const calls = window.__fillTextCalls || [];
    const collect = (text) => calls
      .filter((call) => (call.text || '').trim() === text)
      .map(({ alpha, fillStyle, font }) => ({ alpha, fillStyle, font }));

    return {
      clarinet: collect('Clarinet (B'),
      flat: collect('♭'),
      poco: collect('poco'),
    };
  });

  expect(drawCalls.clarinet.some((call) => call.font.includes('STFangsong'))).toBe(true);
  expect(drawCalls.flat.some((call) => call.font.includes('Bravura Text'))).toBe(true);
  expect(drawCalls.poco.some((call) => call.font.includes('italic') && call.font.includes('Nepomuk'))).toBe(true);
});

test('reclassifies the Violin II measure-21 flat in Dorico imports as an accidental', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'water-town-opening-instruments.svg');

  await page.goto('/index.html');
  await preserveImportedSvgDuringSmoke(page);
  await page.setInputFiles('#svgInput', fixturePath);
  await expect.poll(async () => page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    return svg ? svg.querySelectorAll('*').length : 0;
  }), { timeout: 20000 }).toBeGreaterThan(0);

  const state = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    if (!svg) return null;

    const violinIILabel = Array.from(svg.querySelectorAll('text'))
      .find((el) => (el.textContent || '').trim() === 'Violin II');
    const violinIIRect = violinIILabel?.getBoundingClientRect() || null;
    const violinIICenterY = violinIIRect ? violinIIRect.top + violinIIRect.height / 2 : null;
    const flatSignature = 'MCCLCCCCCCCLMCCCCLC';

    const targets = Array.from(svg.querySelectorAll('path')).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        signature: (el.getAttribute('d') || '').replace(/[^A-Za-z]/g, '').toUpperCase(),
        classes: el.className?.baseVal || '',
        left: rect.left,
        centerY: rect.top + rect.height / 2,
      };
    }).filter((item) => (
      item.signature === flatSignature
      && item.left >= 3275
      && item.left <= 3295
      && violinIICenterY !== null
      && Math.abs(item.centerY - violinIICenterY) <= 25
    ));

    return {
      violinIICenterY,
      targets,
    };
  });

  expect(state).not.toBeNull();
  expect(state.violinIICenterY).not.toBeNull();
  expect(state.targets.length).toBeGreaterThan(0);
  expect(state.targets.every((item) => item.classes.includes('highlight-accidental'))).toBe(true);
  expect(state.targets.every((item) => !item.classes.includes('highlight-keysig'))).toBe(true);
});

test('classifies MuseScore opening semantic classes before signature guessing', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'musescore-opening-classes.svg');
  await loadFixtureIntoScore(page, fixturePath);

  const classState = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    if (!svg) return null;

    const findElements = (token) => Array.from(svg.querySelectorAll('path'))
      .filter((el) => (el.getAttribute('class') || '').split(/\s+/).includes(token))
      .map((el) => ({
        className: el.className?.baseVal || '',
        transform: el.getAttribute('transform') || '',
      }));

    return {
      brackets: findElements('Bracket'),
      clefs: findElements('Clef'),
      keySigs: findElements('KeySig'),
      timeSigs: findElements('TimeSig'),
    };
  });

  expect(classState).not.toBeNull();
  expect(classState.brackets).toHaveLength(1);
  expect(classState.clefs).toHaveLength(2);
  expect(classState.keySigs).toHaveLength(2);
  expect(classState.timeSigs).toHaveLength(4);
  expect(classState.brackets[0].className).toContain('highlight-brace');
  expect(classState.clefs.every((item) => item.className.includes('highlight-clef'))).toBe(true);
  expect(classState.keySigs.every((item) => item.className.includes('highlight-keysig'))).toBe(true);
  expect(classState.timeSigs.every((item) => item.className.includes('highlight-timesig'))).toBe(true);
});

test('uses the left staff edge as a virtual start anchor when no physical opening barline exists', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'no-opening-barline-single-staff.svg');
  await loadFixtureIntoScore(page, fixturePath);

  const anchorState = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    if (!svg) return null;

    const horizontals = [];
    const verticals = [];

    Array.from(svg.querySelectorAll('polyline, line')).forEach((el) => {
      let x1;
      let y1;
      let x2;
      let y2;

      if (el.tagName.toLowerCase() === 'line') {
        x1 = Number(el.getAttribute('x1'));
        y1 = Number(el.getAttribute('y1'));
        x2 = Number(el.getAttribute('x2'));
        y2 = Number(el.getAttribute('y2'));
      } else {
        const coords = (el.getAttribute('points') || '')
          .trim()
          .split(/\s+|,/)
          .filter(Boolean)
          .map(Number);
        if (coords.length < 4) return;
        x1 = coords[0];
        y1 = coords[1];
        x2 = coords[coords.length - 2];
        y2 = coords[coords.length - 1];
      }

      if ([x1, y1, x2, y2].some((value) => !Number.isFinite(value))) return;

      if (Math.abs(y1 - y2) < 1) {
        horizontals.push(Math.min(x1, x2));
      } else if (Math.abs(x1 - x2) < 1 && Math.abs(y1 - y2) >= 8) {
        verticals.push({
          x: x1,
          height: Math.abs(y1 - y2),
          classes: el.className?.baseVal || '',
        });
      }
    });

    verticals.sort((a, b) => a.x - b.x);

    return {
      staffLeftEdge: Math.min(...horizontals),
      startAnchor: window.globalAbsoluteSystemInternalX,
      hasPhysicalStartBarline: window.hasPhysicalStartBarline,
      firstPhysicalBarline: verticals[0] || null,
      openingBarlineCount: verticals.filter((item) => item.classes.includes('highlight-barline')).length,
    };
  });

  expect(anchorState).not.toBeNull();
  expect(anchorState.startAnchor).toBeCloseTo(anchorState.staffLeftEdge, 1);
  expect(anchorState.hasPhysicalStartBarline).toBe(false);
  expect(anchorState.firstPhysicalBarline).not.toBeNull();
  expect(anchorState.firstPhysicalBarline.x).toBeGreaterThan(anchorState.startAnchor + 50);
  expect(anchorState.firstPhysicalBarline.classes).not.toContain('highlight-barline');
  expect(anchorState.openingBarlineCount).toBe(0);
});

test('recognizes the Sebastian opening treble clef variant in the no-opening-barline fixture', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'no-opening-barline-single-staff.svg');
  await loadFixtureIntoScore(page, fixturePath);

  const clefState = await page.evaluate(() => {
    const targetSignature = 'MCCCCCCCCLCCCLMCCCCCCMCCLCCMCCCCCCCCCCCCCLLCCCCCCCCCCCCL';
    const clefs = Array.from(document.querySelectorAll('#svg-sandbox svg path.highlight-clef'))
      .map((el) => {
        return {
          signature: (el.getAttribute('d') || '').replace(/[^A-Za-z]/g, '').toUpperCase(),
        };
      });

    return {
      count: clefs.length,
      targetMatched: clefs.some((item) => item.signature === targetSignature),
    };
  });

  expect(clefState.count).toBeGreaterThan(0);
  expect(clefState.targetMatched).toBe(true);
});

test('keeps Finale Ash opening time signatures decoded into the timeline', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'no-opening-barline-single-staff.svg');
  await loadFixtureIntoScore(page, fixturePath);

  const state = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    const highlighted = Array.from(svg.querySelectorAll('text.highlight-timesig'))
      .map((el) => (el.textContent || '').trim());
    const display = document.getElementById('timeSigDisplay');
    const color = display ? window.getComputedStyle(display).color : '';

    return {
      highlighted,
      displayText: display?.textContent?.trim() || '',
      displayColor: color,
    };
  });

  expect(state.highlighted).toEqual(['', '']);
  expect(state.displayText).toBe('4/4');
  expect(state.displayColor).not.toBe('rgb(255, 42, 95)');
});

test('recognizes visually giant opening Bravura time signatures before later meter changes', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'no-opening-barline-single-staff-bravura.svg');
  await loadFixtureIntoScore(page, fixturePath);

  const state = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    const highlighted = Array.from(svg.querySelectorAll('text.highlight-timesig'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          text: (el.textContent || '').trim(),
          token: el.getAttribute('data-time-sig-token') || '',
          left: rect.left,
        };
      })
      .sort((a, b) => a.left - b.left);

    const display = document.getElementById('timeSigDisplay');
    const color = display ? window.getComputedStyle(display).color : '';

    return {
      highlighted,
      displayText: display?.textContent?.trim() || '',
      displayColor: color,
    };
  });

  expect(state.highlighted.length).toBeGreaterThanOrEqual(2);
  expect(state.highlighted[0].token).toBe('4');
  expect(state.highlighted[1].token).toBe('4');
  expect(state.displayText).toBe('4/4');
  expect(state.displayColor).not.toBe('rgb(255, 42, 95)');
});

test('reclassifies mid-system naturals near notes as accidentals in single-line scores', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'zhangchengyao-mid-system-naturals.svg');
  await loadFixtureIntoScore(page, fixturePath);

  const state = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    const naturalSignature = 'MCCCCCCCCCCMCCCCCCCCCCCCCC';
    const openingTimeSigRight = Math.max(
      ...Array.from(svg.querySelectorAll('.highlight-timesig')).map((el) => el.getBoundingClientRect().right)
    );

    const naturals = Array.from(svg.querySelectorAll('path')).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        signature: (el.getAttribute('d') || '').replace(/[^A-Za-z]/g, '').toUpperCase(),
        classes: el.className?.baseVal || '',
        left: rect.left,
      };
    }).filter((item) => item.signature === naturalSignature && item.left > openingTimeSigRight + 500);

    return {
      hasPhysicalStartBarline: window.hasPhysicalStartBarline,
      openingTimeSigRight,
      naturals,
    };
  });

  expect(state.hasPhysicalStartBarline).toBe(false);
  expect(state.naturals.length).toBeGreaterThan(0);
  expect(state.naturals.every((item) => item.classes.includes('highlight-accidental'))).toBe(true);
  expect(state.naturals.every((item) => !item.classes.includes('highlight-keysig'))).toBe(true);
});

test('reclassifies mid-system flats adjacent to hollow noteheads instead of leaving them as key signatures', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'zhangchengyao-mid-system-naturals.svg');
  await loadFixtureIntoScore(page, fixturePath);

  const state = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    const flatSignature = 'MCCLCCLMCCCLCLCLCCCCCLCLCLCCL';
    const hollowNoteheadSignature = 'MCCCCMCCCCCCCC';
    const openingTimeSigRight = Math.max(
      ...Array.from(svg.querySelectorAll('.highlight-timesig')).map((el) => el.getBoundingClientRect().right)
    );

    const items = Array.from(svg.querySelectorAll('path')).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        signature: (el.getAttribute('d') || '').replace(/[^A-Za-z]/g, '').toUpperCase(),
        classes: el.className?.baseVal || '',
        left: rect.left,
        right: rect.right,
        centerY: rect.top + rect.height / 2,
      };
    });

    const targets = items.filter((item) => {
      if (item.signature !== flatSignature) return false;
      if (item.left <= openingTimeSigRight + 500) return false;
      return items.some((other) => {
        const dx = other.left - item.right;
        const dy = Math.abs(other.centerY - item.centerY);
        return other.signature === hollowNoteheadSignature && dx >= -2 && dx <= 8 && dy <= 2;
      });
    });

    return { targets };
  });

  expect(state.targets.length).toBeGreaterThan(0);
  expect(state.targets.every((item) => item.classes.includes('highlight-accidental'))).toBe(true);
  expect(state.targets.every((item) => !item.classes.includes('highlight-keysig'))).toBe(true);
});

test('preserves mid-system key-signature clusters after a double barline', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'geometric-mid-keysig.svg');
  await loadFixtureIntoScore(page, fixturePath);

  const state = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    const targetSegments = Array.from(svg.querySelectorAll('line.highlight-keysig, polyline.highlight-keysig'))
      .map((el) => ({
        classes: el.className?.baseVal || '',
      }));

    return {
      targetSegments,
    };
  });

  expect(state.targetSegments.length).toBeGreaterThanOrEqual(12);
  expect(state.targetSegments.every((item) => item.classes.includes('highlight-keysig'))).toBe(true);
  expect(state.targetSegments.every((item) => !item.classes.includes('highlight-accidental'))).toBe(true);
});

test('preserves mid-system sharp key-signature clusters even after earlier notes in the same staff', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'zhangchengyao-mid-system-sharp-keysig.svg');
  await loadFixtureIntoScore(page, fixturePath);

  const state = await page.evaluate(() => {
    const targetSignature = 'MCCCCCCCCMCLCCCCLCCLCCCLCCLCCCLCCCCCLCCCLCCCCCLCCLCLCCLCCLCCCLCCLCLCL';
    const sharps = Array.from(document.querySelectorAll('#svg-sandbox svg path'))
      .map((el) => ({
        signature: (el.getAttribute('d') || '').replace(/[^A-Za-z]/g, '').toUpperCase(),
        classes: el.className?.baseVal || '',
        left: el.getBoundingClientRect().left,
      }))
      .filter((item) => item.signature === targetSignature && item.left >= 1640 && item.left <= 1675);

    return { sharps };
  });

  expect(state.sharps.length).toBe(3);
  expect(state.sharps.every((item) => item.classes.includes('highlight-keysig'))).toBe(true);
  expect(state.sharps.every((item) => !item.classes.includes('highlight-accidental'))).toBe(true);
});

test('keeps opening time-signature offset isolated from later score time signatures', async () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'app.js'), 'utf8');

  expect(appSource).toContain('const appliedExtraX = isPinned ? item.currentExtraX : 0;');
  expect(appSource).toContain('tx: flyOffsetX + pinShiftX + appliedExtraX,');
});

test('anchors no-opening-barline bridge lines to the first visible sticky music glyph', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'no-opening-barline-single-staff-bravura.svg');
  await loadFixtureIntoScore(page, fixturePath);

  const state = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    const staffLineStarts = Array.from(svg.querySelectorAll('line, polyline')).map((el) => {
      let x1;
      let y1;
      let x2;
      let y2;

      if (el.tagName.toLowerCase() === 'line') {
        x1 = Number(el.getAttribute('x1'));
        y1 = Number(el.getAttribute('y1'));
        x2 = Number(el.getAttribute('x2'));
        y2 = Number(el.getAttribute('y2'));
      } else {
        const coords = (el.getAttribute('points') || '')
          .trim()
          .split(/\s+|,/)
          .filter(Boolean)
          .map(Number);
        if (coords.length < 4) return null;
        x1 = coords[0];
        y1 = coords[1];
        x2 = coords[coords.length - 2];
        y2 = coords[coords.length - 1];
      }

      if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
      if (Math.abs(y1 - y2) >= 1) return null;
      if (Math.abs(x1 - x2) <= 100) return null;

      const box = typeof el.getBBox === 'function' ? el.getBBox() : null;
      const matrix = typeof el.getCTM === 'function' ? el.getCTM() : null;
      if (!box || !matrix) return null;

      const corners = [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x, y: box.y + box.height },
        { x: box.x + box.width, y: box.y + box.height },
      ].map((point) => ({
        x: matrix.a * point.x + matrix.c * point.y + matrix.e,
        y: matrix.b * point.x + matrix.d * point.y + matrix.f,
      }));

      return Math.min(...corners.map((point) => point.x));
    }).filter((value) => Number.isFinite(value));

    const openingStickies = Array.from(
      svg.querySelectorAll('.highlight-clef, .highlight-keysig, .highlight-timesig, .highlight-brace, .highlight-barline')
    ).map((el) => {
      const box = typeof el.getBBox === 'function' ? el.getBBox() : null;
      const matrix = typeof el.getCTM === 'function' ? el.getCTM() : null;
      if (!box || !matrix) return null;
      const corners = [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x, y: box.y + box.height },
        { x: box.x + box.width, y: box.y + box.height },
      ].map((point) => ({
        x: matrix.a * point.x + matrix.c * point.y + matrix.e,
        y: matrix.b * point.x + matrix.d * point.y + matrix.f,
      }));
      return Math.min(...corners.map((point) => point.x));
    }).filter((value) => Number.isFinite(value));

    return {
      bridgeStartX: window.globalAbsoluteBridgeStartX,
      systemStartX: window.globalAbsoluteSystemInternalX,
      leftmostStaffLineX: staffLineStarts.length ? Math.min(...staffLineStarts) : null,
      leftmostOpeningStickyX: openingStickies.length ? Math.min(...openingStickies) : null,
      hasPhysicalStartBarline: window.hasPhysicalStartBarline,
    };
  });

  expect(state.hasPhysicalStartBarline).toBe(false);
  expect(state.leftmostStaffLineX).not.toBeNull();
  expect(state.leftmostOpeningStickyX).not.toBeNull();
  expect(state.bridgeStartX).toBeCloseTo(state.leftmostStaffLineX, 1);
  expect(state.bridgeStartX).toBeLessThan(state.leftmostOpeningStickyX - 1);
  expect(state.bridgeStartX).toBeGreaterThan(state.systemStartX + 20);
});

test('decodes non-MuseScore path time signatures into the timeline', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'path-time-signature.svg');
  await loadFixtureIntoScore(page, fixturePath);

  const state = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    const highlightedPaths = Array.from(svg.querySelectorAll('path.highlight-timesig'))
      .map((el) => ({
        signature: (el.getAttribute('d') || '').replace(/[^A-Za-z]/g, '').toUpperCase(),
        token: el.getAttribute('data-time-sig-token') || '',
      }));
    const display = document.getElementById('timeSigDisplay');
    const color = display ? window.getComputedStyle(display).color : '';

    return {
      highlightedPaths,
      displayText: display?.textContent?.trim() || '',
      displayColor: color,
    };
  });

  expect(state.highlightedPaths).toHaveLength(2);
  expect(state.displayText).toBe('4/4');
  expect(state.displayColor).not.toBe('rgb(255, 42, 95)');
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

test('detects nested bracket cap lines that attach to another bracket vertical', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'nested-bracket-caps.svg');

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

  const bracketCapState = await page.evaluate(() => {
    const svg = document.querySelector('#svg-sandbox svg');
    if (!svg) return null;

    const openingBarline = Array.from(svg.querySelectorAll('line, polyline'))
      .find((el) => el.getAttribute('x1') === '107.789' && el.getAttribute('x2') === '107.789');

    const outerTopCap = Array.from(svg.querySelectorAll('line, polyline'))
      .find((el) => el.getAttribute('points') === '100.561,70.3465 108.175,70.3465');

    const nestedTopCap = Array.from(svg.querySelectorAll('line, polyline'))
      .find((el) => el.getAttribute('points') === '97.4327,190.147 100.946,190.147');

    const nestedBottomCap = Array.from(svg.querySelectorAll('line, polyline'))
      .find((el) => el.getAttribute('points') === '97.4327,268.157 100.946,268.157');

    return {
      openingBarlineClasses: openingBarline?.className?.baseVal || '',
      outerTopCapClasses: outerTopCap?.className?.baseVal || '',
      nestedTopCapClasses: nestedTopCap?.className?.baseVal || '',
      nestedBottomCapClasses: nestedBottomCap?.className?.baseVal || '',
    };
  });

  expect(bracketCapState).not.toBeNull();
  expect(bracketCapState.openingBarlineClasses).toContain('highlight-barline');
  expect(bracketCapState.openingBarlineClasses).not.toContain('highlight-brace');
  expect(bracketCapState.outerTopCapClasses).toContain('highlight-brace');
  expect(bracketCapState.nestedTopCapClasses).toContain('highlight-brace');
  expect(bracketCapState.nestedBottomCapClasses).toContain('highlight-brace');
});

test('automatically fits score height on import, window resize, and mobile ratio change', async ({ page }) => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'auto-fit-zoom.svg');

  await page.setViewportSize({ width: 1280, height: 900 });
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

  const initialZoom = await page.locator('#zoomValDisplay').textContent();

  await page.setInputFiles('#svgInput', fixturePath);

  await expect.poll(async () => page.locator('#zoomValDisplay').textContent()).not.toBe(initialZoom);
  const zoomAfterImport = await page.locator('#zoomValDisplay').textContent();

  await page.setViewportSize({ width: 820, height: 900 });
  await expect.poll(async () => page.locator('#zoomValDisplay').textContent()).not.toBe(zoomAfterImport);
  const zoomAfterResize = await page.locator('#zoomValDisplay').textContent();

  await page.selectOption('#exportRatioSelect', '9:16');
  await expect.poll(async () => page.locator('#zoomValDisplay').textContent()).not.toBe(zoomAfterResize);
});

test('routes ratio changes and resize handling through score auto-fit logic', async () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'app.js'), 'utf8');

  expect(appSource).toContain('function fitScoreToViewportHeight');
  expect(appSource).toContain('fitScoreToViewportHeight();');
  expect(appSource).toContain('if (currentRawSvgContent && !isExportingVideoMode) {');
});

test('uses a left preview with a right stacked control column on desktop and stacks vertically on mobile', async ({ page }) => {
  const htmlSource = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

  expect(htmlSource).toContain('workspace-scale-frame');
  expect(htmlSource).toContain('class="workspace-layout"');
  expect(htmlSource).toContain('class="control-stack"');
  expect(htmlSource).toContain('sources-card');
  expect(htmlSource).toContain('appearance-card');
  expect(htmlSource).toContain('effects-card');
  expect(htmlSource).toContain('transport-card');
  expect(htmlSource).toContain('playback-card');
  expect(htmlSource).toContain('export-card');
  expect(htmlSource).toContain('delay-4');
  expect(htmlSource).toContain('delay-5');

  await page.setViewportSize({ width: 1180, height: 960 });
  await page.goto('/index.html');

  const workspaceScaleFrame = page.locator('.workspace-scale-frame');
  const controlCards = page.locator('.control-stack > .bento-card');
  const workspaceLayout = page.locator('.workspace-layout');
  const canvasBox = await page.locator('#score-canvas').boundingBox();
  const viewportBox = await page.locator('#viewport').boundingBox();
  const stageWrapBox = await page.locator('.stage-wrap').boundingBox();
  const controlStackBox = await page.locator('.control-stack').boundingBox();
  const sourcesBox = await page.locator('.sources-card').boundingBox();
  const playbackBox = await page.locator('.playback-card').boundingBox();
  const effectsBox = await page.locator('.effects-card').boundingBox();
  const appearanceBox = await page.locator('.appearance-card').boundingBox();
  const exportBox = await page.locator('.export-card').boundingBox();
  const workspaceTransform = await workspaceLayout.evaluate((node) => getComputedStyle(node).transform);
  const workspaceScaleMatch = workspaceTransform.match(/matrix\(([^,]+)/);
  const workspaceScale = workspaceScaleMatch ? Number.parseFloat(workspaceScaleMatch[1]) : Number.NaN;

  await expect(workspaceScaleFrame).toHaveCount(1);
  await expect(controlCards).toHaveCount(5);
  expect(canvasBox).not.toBeNull();
  expect(viewportBox).not.toBeNull();
  expect(stageWrapBox).not.toBeNull();
  expect(controlStackBox).not.toBeNull();
  expect(sourcesBox).not.toBeNull();
  expect(playbackBox).not.toBeNull();
  expect(effectsBox).not.toBeNull();
  expect(appearanceBox).not.toBeNull();
  expect(exportBox).not.toBeNull();
  expect(workspaceTransform).not.toBe('none');
  expect(Number.isFinite(workspaceScale)).toBe(true);
  expect(workspaceScale).toBeGreaterThan(0.5);
  expect(workspaceScale).toBeLessThanOrEqual(1);

  expect(sourcesBox.x + sourcesBox.width).toBeLessThan(viewportBox.x + 5);
  expect(playbackBox.x + playbackBox.width).toBeLessThan(viewportBox.x + 5);
  expect(effectsBox.x + effectsBox.width).toBeLessThan(viewportBox.x + 5);
  expect(sourcesBox.y).toBeLessThan(playbackBox.y);
  expect(playbackBox.y).toBeLessThan(effectsBox.y);
  expect(effectsBox.y).toBeLessThan(appearanceBox.y);
  expect(effectsBox.y).toBeLessThan(exportBox.y);
  expect(appearanceBox.x).toBeLessThan(exportBox.x);
  expect(Math.abs(appearanceBox.y - exportBox.y)).toBeLessThan(8);
  expect(controlStackBox.width).toBeGreaterThan(320);
  expect(Math.abs(canvasBox.width - viewportBox.width)).toBeLessThan(4);
  expect(Math.abs(canvasBox.height - viewportBox.height)).toBeLessThan(4);
  expect(Math.abs(stageWrapBox.height - controlStackBox.height)).toBeLessThan(4);
  expect(Math.abs(viewportBox.height - controlStackBox.height)).toBeLessThan(4);

  await page.selectOption('#exportRatioSelect', '9:16');

  const viewportBoxAfterRatio = await page.locator('#viewport').boundingBox();
  const controlStackBoxAfterRatio = await page.locator('.control-stack').boundingBox();

  expect(viewportBoxAfterRatio).not.toBeNull();
  expect(controlStackBoxAfterRatio).not.toBeNull();
  expect(Math.abs(viewportBoxAfterRatio.height - controlStackBoxAfterRatio.height)).toBeLessThan(4);

  await page.setViewportSize({ width: 1024, height: 960 });

  const viewportBoxAfterResize = await page.locator('#viewport').boundingBox();
  const controlStackBoxAfterResize = await page.locator('.control-stack').boundingBox();

  expect(viewportBoxAfterResize).not.toBeNull();
  expect(controlStackBoxAfterResize).not.toBeNull();
  expect(Math.abs(viewportBoxAfterResize.height - controlStackBoxAfterResize.height)).toBeLessThan(4);

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.reload();

  const viewportBoxMobile = await page.locator('#viewport').boundingBox();
  const sourcesBoxMobile = await page.locator('.sources-card').boundingBox();
  const playbackBoxMobile = await page.locator('.playback-card').boundingBox();
  const effectsBoxMobile = await page.locator('.effects-card').boundingBox();
  const appearanceBoxMobile = await page.locator('.appearance-card').boundingBox();
  const exportBoxMobile = await page.locator('.export-card').boundingBox();

  expect(viewportBoxMobile).not.toBeNull();
  expect(sourcesBoxMobile).not.toBeNull();
  expect(playbackBoxMobile).not.toBeNull();
  expect(effectsBoxMobile).not.toBeNull();
  expect(appearanceBoxMobile).not.toBeNull();
  expect(exportBoxMobile).not.toBeNull();

  expect(sourcesBoxMobile.y).toBeLessThan(playbackBoxMobile.y);
  expect(playbackBoxMobile.y).toBeLessThan(effectsBoxMobile.y);
  expect(effectsBoxMobile.y).toBeLessThan(appearanceBoxMobile.y);
  expect(appearanceBoxMobile.y).toBeLessThan(exportBoxMobile.y);
});
