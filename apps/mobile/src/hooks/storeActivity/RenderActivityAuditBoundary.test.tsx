import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { createStore } from 'zustand/vanilla';

import { getLatestRenderActivityAuditScopeDiagnostics } from '@/core/state/renderActivityAudit';
import { RenderActivityAuditBoundary } from './RenderActivityAuditBoundary';
import { RenderActivityBoundary } from './RenderActivityBoundary';

const rawStore = createStore(() => ({ count: 0 }));

function RawStoreConsumer({ marker }: { marker: string }) {
  const count = useStoreWithEqualityFn(rawStore, state => state.count);
  return <Text testID="value">{`${marker}:${count}`}</Text>;
}

describe('RenderActivityAuditBoundary', () => {
  beforeEach(() => {
    rawStore.setState({ count: 0 });
  });

  it('observes inactive parent updates and raw Store-driven commits', () => {
    const renderTree = (active: boolean, marker: string) => (
      <RenderActivityAuditBoundary active={active} label="audit-only-scope">
        <RawStoreConsumer marker={marker} />
      </RenderActivityAuditBoundary>
    );
    const view = render(renderTree(true, 'active'));

    view.rerender(renderTree(false, 'hidden'));
    expect(
      getLatestRenderActivityAuditScopeDiagnostics('audit-only-scope'),
    ).toEqual(
      expect.objectContaining({
        active: false,
        inactiveParentUpdateCount: 0,
        inactiveSubtreeCommitCount: 0,
      }),
    );

    act(() => {
      rawStore.setState({ count: 1 });
    });
    view.rerender(renderTree(false, 'hidden-latest'));

    expect(
      getLatestRenderActivityAuditScopeDiagnostics('audit-only-scope'),
    ).toEqual(
      expect.objectContaining({
        inactiveParentUpdateCount: 1,
        inactiveSubtreeCommitCount: 2,
      }),
    );
  });

  it('finds raw Store leaks behind a managed render boundary', () => {
    const renderTree = (active: boolean, marker: string) => (
      <RenderActivityBoundary active={active} label="managed-scope">
        <RawStoreConsumer marker={marker} />
      </RenderActivityBoundary>
    );
    const view = render(renderTree(true, 'active'));

    view.rerender(renderTree(false, 'hidden'));
    act(() => {
      rawStore.setState({ count: 1 });
    });
    view.rerender(renderTree(false, 'hidden-latest'));

    expect(view.getByTestId('value').props.children).toBe('hidden:1');
    expect(
      getLatestRenderActivityAuditScopeDiagnostics('managed-scope'),
    ).toEqual(
      expect.objectContaining({
        inactiveParentUpdateCount: 1,
        inactiveSubtreeCommitCount: 1,
      }),
    );
  });
});
