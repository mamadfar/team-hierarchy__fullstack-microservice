'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type FitViewOptions,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTheme } from 'next-themes';
import type { RegistrySnapshot } from '@orbit/shared';
import type { RegistryIndex } from '@/lib/registry';
import { useAppStore } from '@/store/app-store';
import { buildBranchSet, explorerLayout, hierarchyLayout, type OrbitNode } from './layout';
import { nodeTypes } from './nodes';

/** Prototype editor props kept as constants (no UI toggle in the app shell). */
const COLLAB_EDGES = true;
const DENSITY = 'comfortable' as const;

export interface FlowCanvasProps {
  snapshot: RegistrySnapshot;
  index: RegistryIndex;
  /** Queue keys matching the active search; null when not searching. */
  matchKeys: string[] | null;
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowInner {...props} />
    </ReactFlowProvider>
  );
}

function FlowInner({ snapshot, index, matchKeys }: FlowCanvasProps) {
  const rf = useReactFlow<OrbitNode>();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const tab = useAppStore((s) => s.tab);
  const selected = useAppStore((s) => s.selectedKey);
  const aiKeys = useAppStore((s) => s.aiKeys);
  const focusKey = useAppStore((s) => s.focusKey);
  const focusNonce = useAppStore((s) => s.focusNonce);
  const select = useAppStore((s) => s.select);
  const clearSelection = useAppStore((s) => s.clearSelection);

  const [branch, setBranch] = useState('');
  useEffect(() => setBranch(''), [tab]);

  const branchSet = useMemo(
    () => (tab === 'hierarchy' && branch ? buildBranchSet(snapshot, branch) : null),
    [tab, branch, snapshot],
  );
  const base = useMemo(
    () => (tab === 'hierarchy' ? hierarchyLayout(snapshot) : explorerLayout(snapshot, DENSITY)),
    [tab, snapshot],
  );
  const matchSet = useMemo(() => (matchKeys ? new Set(matchKeys) : null), [matchKeys]);
  const aiSet = useMemo(() => (aiKeys.length ? new Set(aiKeys) : null), [aiKeys]);
  const neighbors = useMemo(() => {
    const s = new Set<string>();
    if (selected) {
      for (const l of snapshot.links) {
        if (l.source === selected) s.add(l.target);
        if (l.target === selected) s.add(l.source);
      }
    }
    return s;
  }, [selected, snapshot]);

  const nodes = useMemo<OrbitNode[]>(() => {
    const hdim = (id: string) => (branchSet ? !branchSet.has(id) : false);
    return base.nodes.map((n): OrbitNode => {
      switch (n.type) {
        case 'team': {
          const dim = matchSet
            ? !matchSet.has(n.id)
            : aiSet
              ? !aiSet.has(n.id)
              : !!selected && selected !== n.id && !neighbors.has(n.id);
          const sel = selected === n.id || (aiSet?.has(n.id) ?? false);
          return { ...n, data: { ...n.data, dim, sel } };
        }
        case 'tribeCard':
          return { ...n, data: { ...n.data, sel: selected, dim: hdim(n.id), selB: branch === n.id } };
        case 'companyCard':
          return { ...n, data: { ...n.data, dim: hdim(n.id), selB: branch === n.id } };
        case 'domainCard':
          return { ...n, data: { ...n.data, dim: hdim(n.id), selB: branch === n.id } };
        case 'rootCard':
          return { ...n, data: { ...n.data, dim: hdim(n.id) } };
        default:
          return n;
      }
    });
  }, [base, matchSet, aiSet, selected, neighbors, branchSet, branch]);

  const edges = useMemo<Edge[]>(() => {
    return base.edges.map((e): Edge => {
      if (tab === 'hierarchy') {
        const inB = !!branchSet && branchSet.has(e.source) && branchSet.has(e.target);
        return {
          ...e,
          style: {
            stroke: inB ? 'var(--accent)' : 'var(--edge)',
            strokeWidth: inB ? 2.2 : 1.5,
            opacity: branchSet && !inB ? 0.15 : 1,
          },
        };
      }
      if (!COLLAB_EDGES) return { ...e, hidden: true };
      const hot = !!selected && (e.source === selected || e.target === selected);
      return {
        ...e,
        animated: hot,
        label: hot ? e.label : undefined,
        labelStyle: { fontSize: 10, fill: 'var(--text)', fontFamily: 'var(--font-sans)' },
        labelBgStyle: { fill: 'var(--surface)', fillOpacity: 0.95 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 5,
        style: {
          stroke: hot ? 'var(--accent)' : 'var(--edge)',
          strokeWidth: hot ? 2 : 1.2,
          strokeDasharray: '5 4',
          opacity: selected && !hot ? 0.25 : 0.8,
        },
      };
    });
  }, [base, selected, tab, branchSet]);

  /** fitView with the prototype's retry loop (layout may not be measured yet). */
  const tryFit = useCallback(
    (opts: FitViewOptions<OrbitNode>, tries: number) => {
      rf.fitView(opts)
        .then((ok) => {
          if (!ok && tries > 0) setTimeout(() => tryFit(opts, tries - 1), 170);
        })
        .catch(() => {
          if (tries > 0) setTimeout(() => tryFit(opts, tries - 1), 170);
        });
    },
    [rf],
  );

  // Tab switch re-fits the viewport.
  useEffect(() => {
    const id = setTimeout(() => tryFit({ padding: 0.12, duration: 450 }, 6), 80);
    return () => clearTimeout(id);
  }, [tab, tryFit]);

  // Team focus zoom; in hierarchy focus the owning tribe card.
  const focusRef = useRef({ focusKey, tab });
  focusRef.current = { focusKey, tab };
  useEffect(() => {
    if (focusNonce === 0) return;
    const { focusKey: key, tab: activeTab } = focusRef.current;
    if (!key) return;
    let id = key;
    if (activeTab === 'hierarchy') {
      const team = index.teams.get(key);
      if (team) id = `tribe-${team.tribeSlug}`;
    }
    const tm = setTimeout(
      () => tryFit({ nodes: [{ id }], duration: 550, maxZoom: 1.2, padding: 0.4 }, 6),
      300,
    );
    return () => clearTimeout(tm);
  }, [focusNonce, tryFit]);

  return (
    <ReactFlow<OrbitNode>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.12 }}
      minZoom={0.07}
      maxZoom={1.6}
      nodesConnectable={false}
      nodesDraggable={false}
      elementsSelectable={false}
      zoomOnDoubleClick
      onNodeClick={(_ev, node) => {
        if (node.type === 'team') {
          select(node.id);
          return;
        }
        if (
          tab === 'hierarchy' &&
          (node.type === 'companyCard' || node.type === 'domainCard' || node.type === 'tribeCard')
        ) {
          setBranch(node.id);
          const set = buildBranchSet(snapshot, node.id);
          void rf.fitView({
            nodes: Array.from(set).map((id) => ({ id })),
            duration: 500,
            padding: 0.2,
            maxZoom: 1.05,
          });
        }
      }}
      onPaneClick={() => {
        setBranch('');
        clearSelection();
      }}
    >
      <Background color={dark ? 'rgba(125,151,186,.3)' : 'rgba(125,151,186,.35)'} gap={26} size={1.6} />
      <MiniMap
        pannable
        zoomable
        position="bottom-right"
        nodeColor={(n) => {
          const hue = (n.data as { hue?: number | null }).hue;
          return hue != null ? `oklch(60% 0.14 ${hue})` : 'var(--border)';
        }}
        nodeStrokeWidth={0}
        maskColor={dark ? 'rgba(7,16,30,.72)' : 'rgba(243,246,250,.72)'}
        style={{ background: dark ? '#0f1e34' : '#fdfefe', marginBottom: 74 }}
      />
      <Controls position="bottom-left" showInteractive={false} />
    </ReactFlow>
  );
}
