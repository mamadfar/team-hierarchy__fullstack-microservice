'use client';

import {
  BarChart3,
  Bell,
  Bot,
  Bug,
  Cloud,
  Code,
  CreditCard,
  Database,
  Eye,
  FileText,
  Filter,
  Flag,
  Gift,
  Globe,
  Headphones,
  Key,
  Landmark,
  Lock,
  Mail,
  Map,
  Megaphone,
  Package,
  Receipt,
  Search,
  Server,
  Shield,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Terminal,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { normalizeIconName, type OrbitIconName } from '@orbit/shared';

/** ORBIT_TO_LUCIDE (shared) resolved to actual lucide-react components. */
const LUCIDE_COMPONENTS: Record<OrbitIconName, LucideIcon> = {
  search: Search,
  megaphone: Megaphone,
  gift: Gift,
  flag: Flag,
  phone: Smartphone,
  users: Users,
  eye: Eye,
  map: Map,
  zap: Zap,
  bell: Bell,
  spark: Sparkles,
  mail: Mail,
  cart: ShoppingCart,
  card: CreditCard,
  wallet: Wallet,
  globe: Globe,
  terminal: Terminal,
  bank: Landmark,
  filter: Filter,
  receipt: Receipt,
  doc: FileText,
  box: Package,
  cloud: Cloud,
  server: Server,
  db: Database,
  code: Code,
  settings: SlidersHorizontal,
  bug: Bug,
  chart: BarChart3,
  shield: Shield,
  key: Key,
  lock: Lock,
  headset: Headphones,
  bot: Bot,
};

export function orbitIcon(name: string): LucideIcon {
  return LUCIDE_COMPONENTS[normalizeIconName(name)];
}

export interface OrbitIconProps {
  name: string;
  size: number;
  color: string;
  strokeWidth?: number;
  className?: string;
}

/** Single-team/company icon rendered in its entity color (stroke = solid(hue)). */
export function OrbitIcon({ name, size, color, strokeWidth = 2, className }: OrbitIconProps) {
  const Icon = orbitIcon(name);
  return <Icon size={size} color={color} strokeWidth={strokeWidth} className={className} aria-hidden />;
}
