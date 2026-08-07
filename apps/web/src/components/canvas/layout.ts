import type { Edge, Node } from '@xyflow/react';
import type { RegistrySnapshot, Team } from '@orbit/shared';
import { companiesInOrder, domainsOfCompany, tribesOfDomain } from '@/lib/registry';

/** Layout constants — identical to the prototype flow-canvas.js. */
export const C = {
  cardW: 214,
  cardH: 64,
  gapY: 10,
  colW: 240,
  tribeHead: 30,
  domPad: 18,
  domHead: 46,
  domGapX: 90,
  compHead: 74,
  compGap: 130,
} as const;

/** Hierarchy constants — colW 236, gapX 26, compGap 70; y rows 0/160/320/470. */
export const H = {
  colW: 236,
  gapX: 26,
  compGap: 70,
  yRoot: 0,
  yCompany: 160,
  yDomain: 320,
  yTribe: 470,
} as const;

export type Density = 'comfortable' | 'compact';

export type TeamNodeData = {
  team: Team;
  hue: number;
  density: Density;
  dim?: boolean;
  sel?: boolean;
};
export type DomainBoxData = { name: string; hue: number; count: number };
export type TribeLabelData = { name: string };
export type CompanyLabelData = {
  name: string;
  hue: number;
  icon: string;
  count: number;
  pageId: string;
};
export type RootCardData = { name: string; companies: number; teams: number; dim?: boolean };
export type CompanyCardData = {
  name: string;
  hue: number;
  icon: string;
  teams: number;
  pageId: string;
  dim?: boolean;
  selB?: boolean;
};
export type DomainCardData = {
  name: string;
  hue: number;
  tribes: number;
  teams: number;
  dim?: boolean;
  selB?: boolean;
};
export type TribeCardData = {
  name: string;
  hue: number;
  teams: Team[];
  dim?: boolean;
  selB?: boolean;
  sel?: string;
};

export type TeamFlowNode = Node<TeamNodeData, 'team'>;
export type DomainBoxNode = Node<DomainBoxData, 'domainBox'>;
export type TribeLabelNode = Node<TribeLabelData, 'tribeLabel'>;
export type CompanyLabelNode = Node<CompanyLabelData, 'companyLabel'>;
export type RootCardNode = Node<RootCardData, 'rootCard'>;
export type CompanyCardNode = Node<CompanyCardData, 'companyCard'>;
export type DomainCardNode = Node<DomainCardData, 'domainCard'>;
export type TribeCardNode = Node<TribeCardData, 'tribeCard'>;

export type OrbitNode =
  | TeamFlowNode
  | DomainBoxNode
  | TribeLabelNode
  | CompanyLabelNode
  | RootCardNode
  | CompanyCardNode
  | DomainCardNode
  | TribeCardNode;

export interface FlowLayout {
  nodes: OrbitNode[];
  edges: Edge[];
}

const teamHue = (team: Team, domainHue: number): number =>
  team.hue != null ? team.hue : domainHue;

function groupTeamsByTribe(snapshot: RegistrySnapshot): Map<string, Team[]> {
  const byTribe = new Map<string, Team[]>();
  for (const team of snapshot.teams) {
    const list = byTribe.get(team.tribeSlug);
    if (list) list.push(team);
    else byTribe.set(team.tribeSlug, [team]);
  }
  return byTribe;
}

const lock = { draggable: false, selectable: false } as const;

/** Explorer: company sections stacked vertically → dashed domain boxes → tribe columns → team cards. */
export function explorerLayout(snapshot: RegistrySnapshot, density: Density): FlowLayout {
  const k = density === 'compact' ? 0.86 : 1;
  const cardH = Math.round(C.cardH * k);
  const gapY = Math.round(C.gapY * k);
  const nodes: OrbitNode[] = [];
  const edges: Edge[] = [];
  const byTribe = groupTeamsByTribe(snapshot);

  let y = 0;
  for (const comp of companiesInOrder(snapshot)) {
    const doms = domainsOfCompany(snapshot, comp.slug);
    nodes.push({
      id: `comp-${comp.slug}`,
      type: 'companyLabel',
      position: { x: 0, y },
      data: {
        name: comp.name,
        hue: comp.hue,
        icon: comp.icon,
        count: comp.teamCount,
        pageId: comp.confluencePageId,
      },
      zIndex: -8,
      ...lock,
    });
    let x = 0;
    let maxH = 0;
    for (const dom of doms) {
      const tribes = tribesOfDomain(snapshot, dom.slug);
      const counts = tribes.map((tr) => byTribe.get(tr.slug)?.length ?? 0);
      const maxN = counts.length ? Math.max(...counts) : 0;
      const w = C.domPad * 2 + tribes.length * C.colW - (C.colW - C.cardW);
      const hh = C.domHead + C.tribeHead + maxN * (cardH + gapY) + C.domPad;
      const dy = y + C.compHead;
      nodes.push({
        id: `dom-${dom.slug}`,
        type: 'domainBox',
        position: { x, y: dy },
        data: {
          name: dom.name,
          hue: dom.hue,
          count: counts.reduce((n, c) => n + c, 0),
        },
        style: { width: w, height: hh },
        zIndex: -10,
        ...lock,
      });
      tribes.forEach((tr, ci) => {
        const cx = x + C.domPad + ci * C.colW;
        const cy = dy + C.domHead;
        nodes.push({
          id: `tribe-${tr.slug}`,
          type: 'tribeLabel',
          position: { x: cx, y: cy },
          data: { name: tr.name },
          zIndex: -5,
          ...lock,
        });
        (byTribe.get(tr.slug) ?? []).forEach((team, ri) => {
          nodes.push({
            id: team.queueKey,
            type: 'team',
            position: { x: cx, y: cy + C.tribeHead + ri * (cardH + gapY) },
            data: { team, hue: teamHue(team, dom.hue), density },
            draggable: false,
          });
        });
      });
      x += w + C.domGapX;
      maxH = Math.max(maxH, hh);
    }
    y += C.compHead + maxH + C.compGap;
  }

  snapshot.links.forEach((l, i) => {
    edges.push({
      id: `l${i}`,
      source: l.source,
      target: l.target,
      label: l.reason,
      type: 'default',
      style: { strokeDasharray: '5 4' },
    });
  });

  return { nodes, edges };
}

/** Hierarchy: root card → company cards → domain cards → tribe cards with team rows. */
export function hierarchyLayout(snapshot: RegistrySnapshot): FlowLayout {
  const nodes: OrbitNode[] = [];
  const edges: Edge[] = [];
  const byTribe = groupTeamsByTribe(snapshot);
  const { colW, gapX, compGap } = H;
  let x = 0;

  for (const comp of companiesInOrder(snapshot)) {
    const doms = domainsOfCompany(snapshot, comp.slug);
    const cx0 = x;
    for (const dom of doms) {
      const tribes = tribesOfDomain(snapshot, dom.slug);
      const x0 = x;
      for (const tr of tribes) {
        nodes.push({
          id: `tribe-${tr.slug}`,
          type: 'tribeCard',
          position: { x, y: H.yTribe },
          data: { name: tr.name, hue: dom.hue, teams: byTribe.get(tr.slug) ?? [] },
          draggable: false,
        });
        edges.push({
          id: `dt-${tr.slug}`,
          source: `hdom-${dom.slug}`,
          target: `tribe-${tr.slug}`,
          type: 'smoothstep',
        });
        x += colW + gapX;
      }
      const mid = (x0 + x - gapX) / 2;
      nodes.push({
        id: `hdom-${dom.slug}`,
        type: 'domainCard',
        position: { x: mid - 110, y: H.yDomain },
        data: {
          name: dom.name,
          hue: dom.hue,
          tribes: tribes.length,
          teams: tribes.reduce((n, tr) => n + (byTribe.get(tr.slug)?.length ?? 0), 0),
        },
        draggable: false,
      });
      edges.push({
        id: `cd-${dom.slug}`,
        source: `hcomp-${comp.slug}`,
        target: `hdom-${dom.slug}`,
        type: 'smoothstep',
      });
      x += 30;
    }
    const cmid = (cx0 + x - 30 - gapX) / 2;
    nodes.push({
      id: `hcomp-${comp.slug}`,
      type: 'companyCard',
      position: { x: cmid - 125, y: H.yCompany },
      data: {
        name: comp.name,
        hue: comp.hue,
        icon: comp.icon,
        teams: comp.teamCount,
        pageId: comp.confluencePageId,
      },
      draggable: false,
    });
    edges.push({
      id: `rc-${comp.slug}`,
      source: 'root',
      target: `hcomp-${comp.slug}`,
      type: 'smoothstep',
    });
    x += compGap;
  }

  const total = x - compGap - gapX - 30;
  nodes.push({
    id: 'root',
    type: 'rootCard',
    position: { x: total / 2 - 140, y: H.yRoot },
    data: {
      name: snapshot.group.name,
      companies: snapshot.companies.length,
      teams: snapshot.teams.length,
    },
    draggable: false,
  });

  return { nodes, edges };
}

/** Hierarchy branch focus: the clicked card plus its ancestors/descendants (and root). */
export function buildBranchSet(snapshot: RegistrySnapshot, id: string): Set<string> {
  const set = new Set<string>(['root', id]);
  const addTribes = (domainSlug: string) => {
    for (const tr of snapshot.tribes) {
      if (tr.domainSlug === domainSlug) set.add(`tribe-${tr.slug}`);
    }
  };
  if (id.startsWith('hcomp-')) {
    const companySlug = id.slice(6);
    for (const dom of snapshot.domains) {
      if (dom.companySlug === companySlug) {
        set.add(`hdom-${dom.slug}`);
        addTribes(dom.slug);
      }
    }
  } else if (id.startsWith('hdom-')) {
    const domainSlug = id.slice(5);
    const dom = snapshot.domains.find((d) => d.slug === domainSlug);
    if (dom) set.add(`hcomp-${dom.companySlug}`);
    addTribes(domainSlug);
  } else if (id.startsWith('tribe-')) {
    const tribeSlug = id.slice(6);
    const tribe = snapshot.tribes.find((t) => t.slug === tribeSlug);
    if (tribe) {
      set.add(`hdom-${tribe.domainSlug}`);
      const dom = snapshot.domains.find((d) => d.slug === tribe.domainSlug);
      if (dom) set.add(`hcomp-${dom.companySlug}`);
    }
  }
  return set;
}
