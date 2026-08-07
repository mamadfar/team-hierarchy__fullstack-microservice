'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { IconMoon, IconSun } from '@/components/chrome-icons';
import { Button } from '@/components/ui/button';

/** Sun/moon theme toggle (next-themes class strategy, persisted). */
export function ThemeToggle() {
  const t = useTranslations();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === 'dark';
  return (
    <Button
      variant="icon"
      size="iconMd"
      aria-label={t('theme')}
      title={t('theme')}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <IconSun size={15} /> : <IconMoon size={15} />}
    </Button>
  );
}
