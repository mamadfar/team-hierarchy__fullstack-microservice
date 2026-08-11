import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { Locale } from '@orbit/shared';
import { LanguageMenu } from '@/components/topbar/language-menu';
import en from '../../messages/en.json';
import hu from '../../messages/hu.json';
import fr from '../../messages/fr.json';
import nl from '../../messages/nl.json';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const messages = { en, hu, fr, nl } as const;

/** Mimics the app: picking a locale re-renders the provider with new messages. */
function Harness() {
  const [locale, setLocale] = useState<Locale>('en');
  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <LanguageMenu onLocaleChange={setLocale} />
      <span data-testid="active-tagline">{messages[locale].tagline}</span>
    </NextIntlClientProvider>
  );
}

describe('language dropdown', () => {
  it('shows the active locale code and all four native names', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: en.language });
    expect(trigger).toHaveTextContent('EN');

    await user.click(trigger);
    expect(await screen.findByText('English')).toBeInTheDocument();
    expect(screen.getByText('Magyar')).toBeInTheDocument();
    expect(screen.getByText('Français')).toBeInTheDocument();
    expect(screen.getByText('Nederlands')).toBeInTheDocument();
  });

  it('switching to Hungarian updates the trigger label and localized copy', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByTestId('active-tagline')).toHaveTextContent('Team Atlas');

    await user.click(screen.getByRole('button', { name: en.language }));
    await user.click(await screen.findByText('Magyar'));

    expect(screen.getByRole('button', { name: hu.language })).toHaveTextContent('HU');
    expect(screen.getByTestId('active-tagline')).toHaveTextContent('Csapattérkép');
  });

  it('then switching to French flips the labels again', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: en.language }));
    await user.click(await screen.findByText('Français'));

    expect(screen.getByRole('button', { name: fr.language })).toHaveTextContent('FR');
    expect(screen.getByTestId('active-tagline')).toHaveTextContent('Atlas des équipes');
  });
});
