/**
 * Icon names accepted in the Confluence "Icon" column (and used by the seed).
 * The web app maps each name to its lucide-react component via ORBIT_TO_LUCIDE.
 * Parser rule: unknown icon names fall back to "box" (never fail a sync over an icon).
 */
export const ORBIT_TO_LUCIDE = {
  search: 'Search',
  megaphone: 'Megaphone',
  gift: 'Gift',
  flag: 'Flag',
  phone: 'Smartphone',
  users: 'Users',
  eye: 'Eye',
  map: 'Map',
  zap: 'Zap',
  bell: 'Bell',
  spark: 'Sparkles',
  mail: 'Mail',
  cart: 'ShoppingCart',
  card: 'CreditCard',
  wallet: 'Wallet',
  globe: 'Globe',
  terminal: 'Terminal',
  bank: 'Landmark',
  filter: 'Filter',
  receipt: 'Receipt',
  doc: 'FileText',
  box: 'Package',
  cloud: 'Cloud',
  server: 'Server',
  db: 'Database',
  code: 'Code',
  settings: 'SlidersHorizontal',
  bug: 'Bug',
  chart: 'BarChart3',
  shield: 'Shield',
  key: 'Key',
  lock: 'Lock',
  headset: 'Headphones',
  bot: 'Bot',
} as const;

export type OrbitIconName = keyof typeof ORBIT_TO_LUCIDE;

export const ORBIT_ICON_NAMES = Object.keys(ORBIT_TO_LUCIDE) as OrbitIconName[];

export const DEFAULT_ICON: OrbitIconName = 'box';

export function normalizeIconName(name: string | null | undefined): OrbitIconName {
  const n = (name ?? '').trim().toLowerCase();
  return (ORBIT_ICON_NAMES as string[]).includes(n) ? (n as OrbitIconName) : DEFAULT_ICON;
}
