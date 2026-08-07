import { expect, test } from '@playwright/test';

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
