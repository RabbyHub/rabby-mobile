import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { Platform, View } from 'react-native';
import type { ViewProps } from 'react-native';
import { ContextMenuView, type MenuConfig } from './ContextMenuView';

const mockLongPressGesture = {
  minDuration: jest.fn().mockReturnThis(),
  runOnJS: jest.fn().mockReturnThis(),
  onStart: jest.fn().mockReturnThis(),
};

jest.mock('react-native-gesture-handler', () => ({
  Gesture: { LongPress: () => mockLongPressGesture },
  GestureDetector: ({ children }: React.PropsWithChildren) => children,
}));

jest.mock('react-native-reanimated', () => ({
  runOnJS: (callback: () => void) => callback,
}));

jest.mock('@/core/native/utils', () => ({
  get IS_ANDROID() {
    return require('react-native').Platform.OS === 'android';
  },
}));

jest.mock('@/hooks/theme', () => ({
  apisTheme: {
    getColors2024: () => ({
      colors2024: { 'neutral-body': '#222222', 'red-default': '#ff0000' },
      isLight: true,
    }),
  },
}));

jest.mock('@rabby-wallet/zeego/context-menu', () => ({
  Root: ({ children }: React.PropsWithChildren) => children,
  Trigger: ({ children }: React.PropsWithChildren) => children,
  Content: () => null,
  Item: () => null,
  ItemTitle: () => null,
  ItemIcon: () => null,
  ItemImage: () => null,
  Label: () => null,
}));

const menu = jest.requireMock('@rabby-wallet/zeego/context-menu');
const { GestureDetector } = jest.requireMock('react-native-gesture-handler');

// Deliberately does not forward injected props to its native child.
const CompositeChild = () => <View testID="composite-content" />;

// Component contracts only: mocks do not prove Fabric mounting or native gestures.
describe('ContextMenuView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('gives Android long press a non-collapsible host even for a composite child', () => {
    const child = <CompositeChild />;
    const getMenuConfig = jest.fn(() => ({ menuActions: [] }));
    render(
      <ContextMenuView
        getMenuConfig={getMenuConfig}
        triggerProps={{ action: 'longPress' }}>
        {child}
      </ContextMenuView>,
    );

    const detector = screen.UNSAFE_getByType(GestureDetector);
    const host = detector.props.children as React.ReactElement<ViewProps>;
    expect(host.type).toBe(View);
    expect(host.props.collapsable).toBe(false);
    expect(host.props.children).toBe(child);
    expect(screen.getByTestId('composite-content').props.collapsable).toBe(
      undefined,
    );
    expect(
      screen.UNSAFE_getByType(menu.Trigger).props
        .androidSuppressNativeLongPress,
    ).toBe(true);

    const show = jest.fn();
    screen.UNSAFE_getByType(menu.Root).props.androidMenuViewRef.current = {
      show,
    };
    act(() => mockLongPressGesture.onStart.mock.calls[0][0]());

    expect(show).toHaveBeenCalledTimes(1);
    expect(getMenuConfig).not.toHaveBeenCalled();
  });

  it.each([
    ['ios', 'longPress'],
    ['android', 'press'],
  ] as const)('keeps the direct child for %s / %s', (platform, action) => {
    jest.replaceProperty(Platform, 'OS', platform);
    const child = <CompositeChild />;
    render(
      <ContextMenuView
        getMenuConfig={() => ({ menuActions: [] })}
        triggerProps={{ action }}>
        {child}
      </ContextMenuView>,
    );

    const trigger = screen.UNSAFE_getByType(menu.Trigger);
    expect(trigger.props.children).toBe(child);
    expect(trigger.props.action).toBe(action);
    expect(trigger.props.androidSuppressNativeLongPress).toBeUndefined();
    expect(screen.UNSAFE_queryByType(GestureDetector)).toBeNull();
  });

  it('reads current actions only through the lazy menu-content callback', () => {
    const onSelect = jest.fn();
    let title = 'Pin';
    const getMenuConfig = jest.fn(
      (): MenuConfig => ({
        menuActions: [
          {
            key: 'pin',
            title,
            icon: 1,
            androidIconName: 'ic_rabby_menu_pin',
            action: onSelect,
          },
        ],
      }),
    );
    render(
      <ContextMenuView
        getMenuConfig={getMenuConfig}
        triggerProps={{ action: 'longPress' }}>
        <CompositeChild />
      </ContextMenuView>,
    );
    expect(getMenuConfig).not.toHaveBeenCalled();

    // The menu owner invokes this callback on open; native opening is not exercised by this component test.
    const getChildren = screen.UNSAFE_getByType(menu.Content).props
      .getChildren as () => React.ReactElement[];
    const readTitle = (item: React.ReactElement) =>
      React.Children.toArray(
        (item.props as React.PropsWithChildren).children,
      ).find(
        entry => React.isValidElement(entry) && entry.type === menu.ItemTitle,
      ) as React.ReactElement<React.PropsWithChildren>;

    expect(readTitle(getChildren()[0]).props.children).toBe('Pin');
    title = 'Unpin';
    const [nextAction] = getChildren();
    expect(readTitle(nextAction).props.children).toBe('Unpin');
    expect(getMenuConfig).toHaveBeenCalledTimes(2);
    expect(onSelect).not.toHaveBeenCalled();
    expect((nextAction.props as { onSelect: () => void }).onSelect).toBe(
      onSelect,
    );
  });
});
