import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

async function startDemo(page: Page) {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Welcome' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('flashing');
  await dialog.getByRole('button', { name: 'Play demo' }).click();
  await expect(page.getByRole('status')).toContainText('Demo synth');
}

test('plays the demo in GPU mode with one tap, then switches to Retro', async ({ page, baseURL }) => {
  const errors = trackErrors(page);
  const foreign: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) foreign.push(r.url());
  });

  await startDemo(page);
  await expect(page.locator('canvas[data-scene="butterchurn"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.lcd-scene')).toContainText('MilkDrop presets ·');

  // T toggles Retro mode; the outgoing canvas is disposed after the crossfade.
  await page.locator('body').press('t');
  await expect(page.locator('canvas[data-scene="bars"]')).toBeVisible();
  await expect(page.locator('canvas[data-scene="butterchurn"]')).toHaveCount(0, { timeout: 2000 });
  await expect(page).toHaveURL(/#r=bars$/);

  // Walk every Retro scene, then every GPU scene.
  for (let i = 0; i < 6; i++) await page.locator('body').press('n');
  await expect(page.locator('canvas[data-scene="bars"]')).toBeVisible();
  await page.locator('body').press('t');
  for (const id of ['tunnel', 'grid', 'kaleido', 'blobs']) {
    await page.goto(`/#r=${id}`);
    await expect(page.locator(`canvas[data-scene="${id}"]`)).toBeVisible();
  }

  expect(foreign, 'no third-party requests').toEqual([]);
  expect(errors).toEqual([]);
});

test('switching scenes 50 times leaves one canvas, no errors and no heap growth', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await startDemo(page);
  await expect(page.locator('canvas[data-scene="butterchurn"]')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1000);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const { metrics } = await cdp.send('Performance.getMetrics');
    return metrics.find((m) => m.name === 'JSHeapUsedSize')!.value;
  };
  // Warm up: load every scene once so lazy chunks and preset packs are in the baseline.
  for (const id of ['tunnel', 'grid', 'kaleido', 'blobs', 'butterchurn', 'bars', 'scope', 'fire', 'starfield', 'plasma', 'lissajous']) {
    await page.evaluate((id) => (location.hash = `r=${id}`), id);
    await expect(page.locator(`canvas[data-scene="${id}"]`)).toBeVisible({ timeout: 15_000 });
  }
  await page.waitForTimeout(700);
  const before = await heap();

  // 25 random GPU switches (Butterchurn included), then 25 Retro switches.
  await page.locator('body').press('t');
  for (let i = 0; i < 25; i++) {
    await page.locator('body').press('r');
    await page.waitForTimeout(150);
  }
  await page.locator('body').press('t');
  for (let i = 0; i < 25; i++) {
    await page.locator('body').press('n');
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1000);
  const after = await heap();

  await expect(page.locator('canvas.viz-layer')).toHaveCount(1);
  expect(errors).toEqual([]);
  expect(after / before, `heap ${Math.round(before / 1e6)} MB → ${Math.round(after / 1e6)} MB`).toBeLessThan(1.1);
});

test('help lists every shortcut', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  for (const key of ['Space', 'N / P', 'R', 'T', 'S', 'F', 'H', '/', '?']) {
    await expect(dialog.locator('kbd', { hasText: new RegExp(`^${key.replace(/[/?]/g, '\\$&')}$`) })).toHaveCount(1);
  }
});

test('phone layout: no horizontal scroll, 44 px targets', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /close welcome/i }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const small = await page.locator('.deck button:visible').evaluateAll((els) =>
    els
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width < 44 || r.height < 44)
      .map((r) => `${r.width}x${r.height}`),
  );
  expect(small).toEqual([]);
});

test('without WebGL 2 the app opens in Retro mode, locks the toggle and says why', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl2') return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  const errors = trackErrors(page);
  await page.goto('/#r=tunnel');
  await expect(page.getByRole('status')).toContainText('WebGL 2 is not available');
  await page.getByRole('button', { name: /close welcome/i }).click();
  await expect(page.getByRole('button', { name: 'Retro mode' })).toBeDisabled();
  await page.getByRole('button', { name: 'Play demo' }).click();
  await expect(page.locator('canvas[data-scene="bars"]')).toBeVisible();
  expect(errors).toEqual([]);
});
