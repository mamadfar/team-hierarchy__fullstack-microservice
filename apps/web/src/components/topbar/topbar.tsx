'use client';

import { useTranslations } from 'next-intl';
import { useAppStore, type TabId } from '@/store/app-store';
import { IconSidebar } from '@/components/chrome-icons';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LanguageMenu } from './language-menu';
import { ThemeToggle } from './theme-toggle';

export function Topbar() {
  const t = useTranslations();
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <div className="flex-none flex items-center gap-[10px] px-4 py-[10px] border-b border-border bg-surface">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="icon"
            size="iconMd"
            aria-label={t('sidebarT')}
            onClick={toggleSidebar}
            className="flex-none"
          >
            <IconSidebar size={15} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('sidebarT')}</TooltipContent>
      </Tooltip>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList>
          <TabsTrigger value="explorer">{t('tabExplorer')}</TabsTrigger>
          <TabsTrigger value="hierarchy">{t('tabHierarchy')}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex-1" />

      <LanguageMenu />
      <ThemeToggle />
    </div>
  );
}
