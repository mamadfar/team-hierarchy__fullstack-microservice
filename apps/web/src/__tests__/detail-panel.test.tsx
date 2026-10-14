import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { DetailPanel } from '@/components/detail-panel';
import { buildIndex } from '@/lib/registry';
import { useAppStore } from '@/store/app-store';
import { snapshotFromSeed } from './helpers/seed';
import en from '../../messages/en.json';

const seed = snapshotFromSeed();
const link = seed.links[0];
if (!link) throw new Error('The seed must include a team relationship');
const reason =
  'This team collaborates on platform identity, access reviews, service telemetry, and incident investigations across all supported applications.';
const snapshot = { ...seed, links: [{ ...link, reason }] };
const index = buildIndex(snapshot);
const source = index.teams.get(link.source)!;
const target = index.teams.get(link.target)!;

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DetailPanel snapshot={snapshot} index={index} />
    </NextIntlClientProvider>,
  );
}

describe('relationship details', () => {
  it('shows the full reason below the related team without truncation', () => {
    useAppStore.getState().select(source.queueKey);
    renderPanel();

    const row = screen.getByRole('button', { name: `${target.name} ${reason}` });
    const text = screen.getByText(reason);
    expect(row).toContainElement(text);
    expect(text).toHaveClass('break-words');
    expect(text).not.toHaveClass('whitespace-nowrap', 'text-ellipsis');
    expect(text.parentElement).toHaveClass('flex-col', 'min-w-0');
  });

  it('keeps the reason visible when navigating to the other end of a link', async () => {
    const user = userEvent.setup();
    useAppStore.getState().select(source.queueKey);
    renderPanel();

    await user.click(screen.getByRole('button', { name: `${target.name} ${reason}` }));
    expect(screen.getByRole('dialog', { name: target.name })).toBeVisible();
    expect(screen.getByRole('button', { name: `${source.name} ${reason}` })).toBeVisible();
    expect(screen.getByText(reason)).toBeVisible();
  });

  it('supports keyboard navigation and clears reasons when selection closes', async () => {
    const user = userEvent.setup();
    useAppStore.getState().select(target.queueKey);
    renderPanel();

    screen.getByRole('button', { name: `${source.name} ${reason}` }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: source.name })).toBeVisible();
    await user.click(screen.getByRole('button', { name: en.close }));
    expect(screen.queryByText(reason)).not.toBeInTheDocument();
  });
});