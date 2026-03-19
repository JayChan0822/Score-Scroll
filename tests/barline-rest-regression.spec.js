const path = require('path');
const { test, expect } = require('@playwright/test');

const APP_JS_URL_RE = /\/scripts\/app\.js(?:\?v=.*)?$/;
const QUARTER_REST_SIGNATURE = 'MCLCCLCLCLCCCCLCCLCLCLCCCCCCCCCCCCLCCCCL';

async function exposeRenderQueue(page) {
  await page.route(APP_JS_URL_RE, async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body += `
window.__scoreDebug = {
  getRenderQueue: () => renderQueue,
  getSvgTags: () => svgTags,
  getMidiPpq: () => globalMidiPpq,
  getTimeSigs: () => globalTimeSigs,
};
`;
    await route.fulfill({
      response,
      body,
      headers: {
        ...response.headers(),
        'content-type': 'application/javascript; charset=utf-8',
      },
    });
  });
}

test('does not relabel Wuzetian quarter-rest glyphs as true barlines', async ({ page }) => {
  await exposeRenderQueue(page);
  await page.goto('/index.html');
  await page.setInputFiles('#svgInput', path.resolve(__dirname, '..', '武则天.svg'));

  await page.waitForFunction(() => Boolean(window.__scoreDebug?.getRenderQueue?.()?.length), null, {
    timeout: 30_000,
  });

  const state = await page.evaluate((quarterRestSignature) => {
    const renderQueue = window.__scoreDebug.getRenderQueue();
    const offendingItems = renderQueue
      .filter((item) => item.symbolType === 'TrueBarline')
      .map((item) => ({
        domIndex: item.domIndex,
        signature: item.originalD ? item.originalD.replace(/[^A-Za-z]/g, '').toUpperCase() : '',
        absMinX: item.absMinX,
        absMaxX: item.absMaxX,
        centerY: item.centerY,
      }))
      .filter((item) => item.signature === quarterRestSignature)
      .sort((a, b) => (a.absMinX - b.absMinX) || (a.centerY - b.centerY));

    return {
      offendingCount: offendingItems.length,
      sample: offendingItems.slice(0, 8),
    };
  }, QUARTER_REST_SIGNATURE);

  expect(state).not.toBeNull();
  expect(state.offendingCount).toBe(0);
});
