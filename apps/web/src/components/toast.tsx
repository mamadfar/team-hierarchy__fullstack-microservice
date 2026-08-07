'use client';

import { useAppStore } from '@/store/app-store';

/** Dark pill toast, bottom-center of the canvas area, auto-dismissed after 2.2s. */
export function Toast() {
  const toast = useAppStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      role="status"
      className="absolute bottom-[26px] left-1/2 -translate-x-1/2 z-40 bg-text text-bg text-[12.5px] font-semibold rounded-full px-[18px] py-2 whitespace-nowrap anim-ofup"
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}
    >
      {toast}
    </div>
  );
}
