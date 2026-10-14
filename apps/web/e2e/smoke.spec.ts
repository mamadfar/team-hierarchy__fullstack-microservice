import { expect, test } from '@playwright/test';
import { snapshotFromSeed } from '../src/__tests__/helpers/seed';

/**
 * Smoke: load → registry renders → search → select from results → detail
 * panel → chat with a mocked assistant answer → team chip navigates.
 * The registry comes from the real running stack (seeded, MOCK_CONFLUENCE);
 * only the assistant POST /chat is intercepted, so the smoke needs no LLM key.
 */
test('load → search → select → chat (mocked assistant)', async ({ page }) => {
  await page.route('**/chat', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        answer:
          'Streaming owns the Kafka platform, so send this to Streaming with queue key DATA-STR.',
        teams: [{ queueKey: 'DATA-STR', name: 'Streaming', confidence: 0.92 }],
      }),
    }),
  );

  await page.goto('/');

  // First-load overlay disappears once the snapshot arrives.
  await expect(page.getByText('Fetching from Confluence…')).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText(/81 teams/)).toBeVisible();

  // Search ranks DATA-STR for "kafka"; pick it from the results list.
  await page.getByRole('textbox', { name: 'Search teams, apps, keywords…' }).fill('kafka');
  await expect(page.getByText(/Results \(\d+\)/)).toBeVisible();
  await page.getByText('Streaming', { exact: true }).first().click();

  // Detail panel opens with the team's data.
  const panel = page.getByRole('dialog', { name: 'Streaming' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('DATA-STR')).toBeVisible();
  await expect(panel.getByText('Kafka Fleet')).toBeVisible();

  // Chat: open the FAB (visible label "Ask Orbit", accessible name = chat title
  // via aria-label, mirroring the prototype's title attribute), send a question.
  await page.getByRole('button', { name: 'Routing assistant' }).click();
  const chatInput = page.getByRole('textbox', { name: 'e.g. customer says the invoice is wrong…' });
  await chatInput.fill('kafka consumer lag is growing');
  await chatInput.press('Enter');

  await expect(page.getByText(/send this to Streaming/)).toBeVisible();

  // The team chip closes the chat and re-selects the team on the map.
  await page.getByRole('button', { name: 'DATA-STR Streaming' }).click();
  await expect(chatInput).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Streaming' })).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`minimap shows both diagrams and supports navigation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/registry', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(snapshotFromSeed()) }),
    );
    await page.goto('/');
    if (width < 600) await page.getByRole('button', { name: 'Toggle sidebar' }).click();

    const minimap = page.locator('.react-flow__minimap');
    const viewport = page.locator('.react-flow__viewport');
    for (const tab of ['Explorer', 'Hierarchy']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(minimap).toBeVisible();
      await expect.poll(() => page.locator('.react-flow__node').count()).toBeGreaterThan(0);
      await expect(minimap.locator('.react-flow__minimap-node')).toHaveCount(
        await page.locator('.react-flow__node').count(),
      );
      expect(await minimap.locator('.react-flow__minimap-node').evaluateAll((shapes) =>
        shapes.every((shape) =>
          Number(shape.getAttribute('width')) > 0 &&
          Number(shape.getAttribute('height')) > 0 &&
          getComputedStyle(shape).fill !== 'none',
        ),
      )).toBe(true);
      const bounds = (await minimap.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      await minimap.screenshot({ path: testInfo.outputPath(`minimap-${tab}-${width}.png`) });

      const beforePan = await viewport.getAttribute('style');
      await page.mouse.move(bounds.x + 100, bounds.y + 75);
      await page.mouse.down();
      await page.mouse.move(bounds.x + 120, bounds.y + 85, { steps: 5 });
      await page.mouse.up();
      await expect(viewport).not.toHaveAttribute('style', beforePan!);

      const beforeZoom = await viewport.getAttribute('style');
      await page.mouse.wheel(0, -150);
      await expect(viewport).not.toHaveAttribute('style', beforeZoom!);
    }
  });

  test(`relationship reasons wrap outside the map at ${width}px`, async ({ page }, testInfo) => {
    const snapshot = snapshotFromSeed();
    const link = snapshot.links[0];
    if (!link) throw new Error('The seed must include a team relationship');
    const source = snapshot.teams.find((team) => team.queueKey === link.source)!;
    const target = snapshot.teams.find((team) => team.queueKey === link.target)!;
    const reason =
      'This team collaborates on platform identity, access reviews, service telemetry, and incident investigations across all supported applications.';
    snapshot.links = [{ ...link, reason }];
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/registry', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(snapshot) }),
    );
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Search teams, apps, keywords…' }).fill(source.queueKey);
    await page.getByText(source.name, { exact: true }).first().click();

    const panel = page.getByRole('dialog', { name: source.name });
    const text = panel.getByText(reason, { exact: true });
    await text.scrollIntoViewIfNeeded();
    await expect(text).toBeVisible();
    await expect(page.locator('.react-flow__edge-text')).toHaveCount(0);
    await expect(page.locator('.react-flow__edge.animated').first()).toBeAttached();
    const bounds = await text.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const layout = await text.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(style.lineHeight),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      };
    });
    expect(layout.height).toBeGreaterThan(layout.lineHeight * 2);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    await page.screenshot({ path: testInfo.outputPath(`relationships-${width}.png`) });

    await panel.getByRole('button', { name: `${target.name} ${reason}` }).click();
    await expect(page.getByRole('dialog', { name: target.name })).toBeVisible();
    await expect(page.getByRole('dialog', { name: target.name }).getByText(reason)).toBeVisible();
  });
}
