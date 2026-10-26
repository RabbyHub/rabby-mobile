import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { createStore } from 'zustand/vanilla';

import { getLatestStoreActivityScopeDiagnostics } from '@/core/state/storeActivityDiagnostics';
import { RenderActivityBoundary } from './RenderActivityBoundary';
import { useActivityStore } from './useActivityStore';

const testStore = createStore(() => ({ count: 0 }));

function Consumer({
  marker,
  onRender,
}: {
  marker: string;
  onRender: () => void;
}) {
  onRender();
  const count = useActivityStore(testStore, state => state.count, Object.is, {
    storeLabel: 'render-activity-test-store',
  });

  return <Text testID="value">{`${marker}:${count}`}</Text>;
}

describe('RenderActivityBoundary', () => {
  beforeEach(() => {
    testStore.setState({ count: 0 });
  });

  it('suppresses hidden Store and parent updates, then catches up once', () => {
    const renderConsumer = jest.fn();
    const renderTree = (active: boolean, marker: string) => (
      <RenderActivityBoundary active={active} label="test-render-activity">
        <Consumer marker={marker} onRender={renderConsumer} />
      </RenderActivityBoundary>
    );
    const view = render(renderTree(true, 'active'));

    expect(view.getByTestId('value').props.children).toBe('active:0');

    view.rerender(renderTree(false, 'hidden'));
    expect(view.getByTestId('value').props.children).toBe('hidden:0');

    const renderedBeforeHiddenUpdates = renderConsumer.mock.calls.length;
    act(() => {
      testStore.setState({ count: 1 });
    });
    view.rerender(renderTree(false, 'hidden-latest'));

    expect(view.getByTestId('value').props.children).toBe('hidden:0');
    expect(renderConsumer).toHaveBeenCalledTimes(renderedBeforeHiddenUpdates);

    view.rerender(renderTree(true, 'resumed'));

    expect(view.getByTestId('value').props.children).toBe('resumed:1');
    expect(
      getLatestStoreActivityScopeDiagnostics('test-render-activity'),
    ).toEqual(
      expect.objectContaining({
        active: true,
        stores: [
          expect.objectContaining({
            catchUpCount: 1,
            sourceNotificationCount: 0,
          }),
        ],
      }),
    );
  });
});
