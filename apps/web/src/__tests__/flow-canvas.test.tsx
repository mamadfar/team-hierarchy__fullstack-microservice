import { beforeEach, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import type { ReactFlowProps } from '@xyflow/react';
import type { OrbitNode } from '@/components/canvas/layout';
import { FlowCanvas } from '@/components/canvas/flow-canvas';
import { buildIndex } from '@/lib/registry';
import { useAppStore } from '@/store/app-store';
import { snapshotFromSeed } from './helpers/seed';

const flow = vi.hoisted(() => ({
  props: {} as ReactFlowProps<OrbitNode>,
  fitView: vi.fn().mockResolvedValue(true),
}));

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
  ReactFlow: (props: ReactFlowProps<OrbitNode>) => {
    flow.props = props;
    return null;
  },
  useReactFlow: () => flow,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

it('retains measured node dimensions through selection and layout changes', () => {
  const snapshot = snapshotFromSeed();
  render(<FlowCanvas snapshot={snapshot} index={buildIndex(snapshot)} matchKeys={null} />);
  const team = flow.props.nodes!.find((node) => node.type === 'team')!;
  const dimensions = { width: 214, height: 64 };

  act(() => flow.props.onNodesChange!([{ type: 'dimensions', id: team.id, dimensions }]));
  expect(flow.props.nodes!.find((node) => node.id === team.id)?.measured).toEqual(dimensions);

  act(() => useAppStore.getState().select(team.id));
  const selected = flow.props.nodes!.find((node) => node.id === team.id)!;
  expect(selected.measured).toEqual(dimensions);
  expect(selected.data).toMatchObject({ sel: true });

  act(() => useAppStore.setState({ tab: 'hierarchy' }));
  const tribe = flow.props.nodes!.find((node) => node.type === 'tribeCard')!;
  const tribeDimensions = { width: 236, height: 180 };
  act(() => flow.props.onNodesChange!([
    { type: 'dimensions', id: tribe.id, dimensions: tribeDimensions },
    { type: 'position', id: tribe.id, position: { x: 999, y: 999 } },
  ]));
  const measuredTribe = flow.props.nodes!.find((node) => node.id === tribe.id)!;
  expect(measuredTribe.measured).toEqual(tribeDimensions);
  expect(measuredTribe.position).toEqual(tribe.position);

  act(() => useAppStore.setState({ tab: 'explorer' }));
  expect(flow.props.nodes!.find((node) => node.id === team.id)?.measured).toEqual(dimensions);
});