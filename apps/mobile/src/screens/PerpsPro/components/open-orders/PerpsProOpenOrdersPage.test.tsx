import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { View, type ListRenderItem } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { RetainedScenePagerBody } from '@/components/RetainedScenePagerList/RetainedScenePagerBody';
import type { PerpsProOpenOrdersControls } from './PerpsProOpenOrdersControls';
import { PerpsProOpenOrdersPage } from './PerpsProOpenOrdersPage';

type Row = { key: string };
type BodyProps = React.ComponentProps<typeof RetainedScenePagerBody<Row>>;
type ControlsProps = React.ComponentProps<typeof PerpsProOpenOrdersControls>;
type PageProps = React.ComponentProps<typeof PerpsProOpenOrdersPage<Row>>;

const mockSelectTab = jest.fn();
const mockBodyRender = jest.fn<void, [BodyProps]>();
const mockControlsRender = jest.fn<void, [ControlsProps]>();
const mockBodyMount = jest.fn();
const mockBodyUnmount = jest.fn();

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react') as typeof React;
  return {
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
  };
});

// Unit seams: this suite covers composition and geometry, not the native pager
// protocol or Controls styling. RenderActivityBoundary remains real.
jest.mock('@/components/RetainedScenePagerList/RetainedScenePagerBody', () => {
  const ReactModule = require('react') as typeof React;
  const native = require('react-native');
  return {
    RetainedScenePagerBody: function MockRetainedScenePagerBody(
      props: BodyProps,
    ) {
      ReactModule.useEffect(() => {
        mockBodyMount();
        return mockBodyUnmount;
      }, []);
      ReactModule.useImperativeHandle(
        props.ref,
        () => ({ selectTab: mockSelectTab }),
        [],
      );
      mockBodyRender(props);
      return ReactModule.createElement(native.View, {
        testID: 'unit-orders-body',
      });
    },
  };
});

jest.mock('./PerpsProOpenOrdersControls', () => {
  const ReactModule = require('react') as typeof React;
  const native = require('react-native');
  return {
    PerpsProOpenOrdersControls: function MockPerpsProOpenOrdersControls(
      props: ControlsProps,
    ) {
      mockControlsRender(props);
      return ReactModule.createElement(
        native.View,
        {
          testID: 'unit-orders-controls',
          accessibilityLabel: `${props.category}:${props.basicCount}:${props.conditionalCount}:${props.isCancelAllPending}`,
        },
        ...(['basic', 'conditional'] as const).map(category =>
          ReactModule.createElement(native.Pressable, {
            key: category,
            testID: `unit-orders-select-${category}`,
            onPress: () => props.onSetCategory(category),
          }),
        ),
      );
    },
  };
});

const renderItem: ListRenderItem<Row> = ({ item }) => (
  <View testID={`unit-order-${item.key}`} />
);

const makeProps = (): PageProps => ({
  context: {
    active: true,
    interactive: true,
    contentTop: 1248,
    viewportHeight: 800,
    minimumPageHeight: 752,
  },
  controls: {
    basicCount: 2,
    category: 'basic',
    conditionalCount: 1,
    hideOtherSymbols: false,
    isCancelAllPending: false,
    onCancelAll: jest.fn(),
    onToggleHideOtherSymbols: jest.fn(),
  },
  onCategoryChange: jest.fn(),
  identityKey: 'account-a',
  rowsByCategory: {
    basic: [{ key: 'basic-order' }],
    conditional: [{ key: 'conditional-order' }],
  },
  presentationByCategory: { basic: 'populated', conditional: 'populated' },
  contentStyleByCategory: {
    basic: [
      { minHeight: 900, paddingTop: 20, paddingBottom: 80 },
      { paddingHorizontal: 16 },
    ],
    conditional: {
      minHeight: 600,
      paddingTop: 12,
      paddingBottom: 24,
      paddingHorizontal: 8,
    },
  },
  renderItem,
  pinnedHeight: 48,
  scrollOffset: { value: 80 } as SharedValue<number>,
});

const bodyProps = () =>
  mockBodyRender.mock.calls[mockBodyRender.mock.calls.length - 1][0];
const controlsProps = () =>
  mockControlsRender.mock.calls[mockControlsRender.mock.calls.length - 1][0];
const layoutEvent = (height: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
});

describe('PerpsProOpenOrdersPage composition (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('owns one Controls block outside the Body and forwards shared row inputs', () => {
    const props = makeProps();
    const view = render(<PerpsProOpenOrdersPage {...props} />);

    expect(view.getAllByTestId('unit-orders-controls')).toHaveLength(1);
    expect(view.getAllByTestId('unit-orders-body')).toHaveLength(1);
    expect(
      within(view.getByTestId('unit-orders-body')).queryByTestId(
        'unit-orders-controls',
      ),
    ).toBeNull();
    expect(view.toJSON()).toMatchObject({
      children: [
        { props: { testID: 'perps-pro-open-orders-controls-layout' } },
        { props: { testID: 'unit-orders-body' } },
      ],
    });
    expect(controlsProps()).toMatchObject(props.controls);
    expect(bodyProps()).toMatchObject({
      activeKey: 'basic',
      keys: ['basic', 'conditional'],
      activityEnabled: true,
      interactionEnabled: true,
      identityKey: 'account-a',
      rowStartOffset: 1248,
      minimumPageHeight: 752,
      pinnedHeight: 48,
      viewportHeight: 800,
    });
    expect(bodyProps().dataByKey).toBe(props.rowsByCategory);
    expect(bodyProps().scrollOffset).toBe(props.scrollOffset);
    expect(bodyProps().renderItemByKey.basic).toBe(props.renderItem);
    expect(bodyProps().renderItemByKey.conditional).toBe(props.renderItem);
    expect(bodyProps().indicatorPosition.value).toBe(0);
    expect(bodyProps().gestureActive.value).toBe(false);
    expect(bodyProps().indicatorPosition).not.toBe(props.scrollOffset);
  });

  it('requests taps through the Body and commits only a valid Body selection', () => {
    const props = makeProps();
    const view = render(<PerpsProOpenOrdersPage {...props} />);

    fireEvent.press(view.getByTestId('unit-orders-select-conditional'));

    expect(mockSelectTab).toHaveBeenCalledTimes(1);
    expect(mockSelectTab).toHaveBeenCalledWith('conditional');
    expect(props.onCategoryChange).not.toHaveBeenCalled();
    expect(bodyProps().activeKey).toBe('basic');
    expect(controlsProps().category).toBe('basic');

    act(() => {
      bodyProps().onTabChange('unsupported');
      bodyProps().onTabChange('');
      bodyProps().onTabChange('account');
    });
    expect(props.onCategoryChange).not.toHaveBeenCalled();

    act(() => bodyProps().onTabChange('conditional'));
    expect(props.onCategoryChange).toHaveBeenCalledTimes(1);
    expect(props.onCategoryChange).toHaveBeenLastCalledWith('conditional');

    view.rerender(
      <PerpsProOpenOrdersPage
        {...props}
        controls={{ ...props.controls, category: 'conditional' }}
      />,
    );
    expect(bodyProps().activeKey).toBe('conditional');
    expect(controlsProps().category).toBe('conditional');
    act(() => bodyProps().onTabChange('basic'));
    expect(props.onCategoryChange).toHaveBeenLastCalledWith('basic');
    expect(mockSelectTab).toHaveBeenCalledTimes(1);
  });

  it('blocks disabled subtree touches above the native pager and retains its instance when interaction returns', () => {
    const props = makeProps();
    const view = render(<PerpsProOpenOrdersPage {...props} />);
    const root = view.getByTestId('perps-pro-open-orders-page');
    const body = view.getByTestId('unit-orders-body');
    expect(root.props.collapsable).toBe(false);
    expect(root.props.pointerEvents).toBe('auto');

    const disabledStates: PageProps[] = [
      {
        ...props,
        presentationByCategory: {
          basic: 'authoritativeEmpty',
          conditional: 'authoritativeEmpty',
        },
      },
      {
        ...props,
        context: { ...props.context, active: false, interactive: false },
      },
      {
        ...props,
        context: { ...props.context, interactive: false },
      },
    ];
    for (const disabledProps of disabledStates) {
      view.rerender(<PerpsProOpenOrdersPage {...disabledProps} />);
      expect(root.props.pointerEvents).toBe('none');
      expect(bodyProps().interactionEnabled).toBe(false);
      expect(view.getByTestId('unit-orders-body')).toBe(body);

      view.rerender(<PerpsProOpenOrdersPage {...props} />);
      expect(root.props.pointerEvents).toBe('auto');
      expect(bodyProps().interactionEnabled).toBe(true);
      expect(view.getByTestId('unit-orders-body')).toBe(body);
    }
    expect(mockBodyMount).toHaveBeenCalledTimes(1);
    expect(mockBodyUnmount).not.toHaveBeenCalled();
    fireEvent.press(view.getByTestId('unit-orders-select-conditional'));
    expect(mockSelectTab).toHaveBeenCalledWith('conditional');
    view.unmount();
    expect(mockBodyUnmount).toHaveBeenCalledTimes(1);
  });

  it('subtracts measured Controls once and retains category padding while overriding content minimums', () => {
    const props = makeProps();
    const view = render(<PerpsProOpenOrdersPage {...props} />);
    const controlsLayout = view.getByTestId(
      'perps-pro-open-orders-controls-layout',
    );

    fireEvent(controlsLayout, 'layout', layoutEvent(96));

    expect(bodyProps().rowStartOffset).toBe(1344);
    expect(bodyProps().minimumPageHeight).toBe(656);
    expect(bodyProps().pageStyleByKey).toEqual({
      basic: {
        minHeight: 656,
        paddingTop: 20,
        paddingBottom: 80,
        paddingHorizontal: 16,
      },
      conditional: {
        minHeight: 656,
        paddingTop: 12,
        paddingBottom: 24,
        paddingHorizontal: 8,
      },
    });
    expect(bodyProps().viewportHeight).toBe(800);
    expect(bodyProps().pinnedHeight).toBe(48);

    fireEvent(controlsLayout, 'layout', layoutEvent(96));
    expect(bodyProps().rowStartOffset).toBe(1344);
    expect(bodyProps().minimumPageHeight).toBe(656);

    view.rerender(
      <PerpsProOpenOrdersPage
        {...props}
        context={{
          ...props.context,
          contentTop: 1600,
          minimumPageHeight: 600,
          viewportHeight: 900,
        }}
      />,
    );
    expect(bodyProps().rowStartOffset).toBe(1696);
    expect(bodyProps().minimumPageHeight).toBe(504);
    expect(bodyProps().viewportHeight).toBe(900);

    fireEvent(controlsLayout, 'layout', layoutEvent(700));
    expect(bodyProps().rowStartOffset).toBe(2300);
    expect(bodyProps().minimumPageHeight).toBe(0);
    expect(bodyProps().pageStyleByKey.basic).toMatchObject({ minHeight: 0 });
    expect(bodyProps().pageStyleByKey.conditional).toMatchObject({
      minHeight: 0,
    });
  });

  it.each([-1, NaN, Infinity, -Infinity])(
    'ignores invalid Controls height %s',
    height => {
      const view = render(<PerpsProOpenOrdersPage {...makeProps()} />);
      const controlsLayout = view.getByTestId(
        'perps-pro-open-orders-controls-layout',
      );
      fireEvent(controlsLayout, 'layout', layoutEvent(96));
      const measuredPageStyle = bodyProps().pageStyleByKey;

      fireEvent(controlsLayout, 'layout', layoutEvent(height));

      expect(bodyProps().rowStartOffset).toBe(1344);
      expect(bodyProps().minimumPageHeight).toBe(656);
      expect(bodyProps().pageStyleByKey).toBe(measuredPageStyle);
    },
  );

  it('removes authoritative-empty Controls and restores their measured extent only after native height zero', () => {
    const props = makeProps();
    const view = render(<PerpsProOpenOrdersPage {...props} />);
    const controlsLayout = view.getByTestId(
      'perps-pro-open-orders-controls-layout',
    );
    fireEvent(controlsLayout, 'layout', layoutEvent(96));

    view.rerender(
      <PerpsProOpenOrdersPage
        {...props}
        presentationByCategory={{
          basic: 'authoritativeEmpty',
          conditional: 'authoritativeEmpty',
        }}
      />,
    );

    expect(view.queryByTestId('unit-orders-controls')).toBeNull();
    expect(view.getByTestId('unit-orders-body')).toBeTruthy();
    expect(bodyProps().interactionEnabled).toBe(false);
    expect(bodyProps().rowStartOffset).toBe(1344);
    expect(bodyProps().minimumPageHeight).toBe(656);

    fireEvent(controlsLayout, 'layout', layoutEvent(0));

    expect(bodyProps().rowStartOffset).toBe(1248);
    expect(bodyProps().minimumPageHeight).toBe(752);
    expect(bodyProps().pageStyleByKey.basic).toMatchObject({ minHeight: 752 });
    expect(bodyProps().pageStyleByKey.conditional).toMatchObject({
      minHeight: 752,
    });
    expect(bodyProps().interactionEnabled).toBe(false);
  });

  it.each(['filteredEmpty', 'unresolved'] as const)(
    'keeps Controls and child interaction for %s presentation',
    presentation => {
      const props = makeProps();
      const view = render(
        <PerpsProOpenOrdersPage
          {...props}
          controls={{ ...props.controls, category: 'conditional' }}
          presentationByCategory={{
            basic: presentation,
            conditional: presentation,
          }}
        />,
      );

      expect(view.getAllByTestId('unit-orders-controls')).toHaveLength(1);
      expect(bodyProps().interactionEnabled).toBe(true);
      expect(bodyProps().indicatorPosition.value).toBe(1);
      fireEvent(
        view.getByTestId('perps-pro-open-orders-controls-layout'),
        'layout',
        layoutEvent(96),
      );
      expect(bodyProps().rowStartOffset).toBe(1344);
      expect(bodyProps().minimumPageHeight).toBe(656);
    },
  );

  it('freezes inactive Controls props while Body and geometry stay live, then resumes latest Controls', () => {
    const props = makeProps();
    const view = render(<PerpsProOpenOrdersPage {...props} />);
    const controlsLayout = view.getByTestId(
      'perps-pro-open-orders-controls-layout',
    );
    fireEvent(controlsLayout, 'layout', layoutEvent(96));
    const inactiveContext = {
      ...props.context,
      active: false,
      interactive: false,
    };
    view.rerender(
      <PerpsProOpenOrdersPage {...props} context={inactiveContext} />,
    );
    const frozenControls = controlsProps();
    const controlsRenderCount = mockControlsRender.mock.calls.length;
    const latestProps: PageProps = {
      ...props,
      context: {
        ...inactiveContext,
        contentTop: 1600,
        minimumPageHeight: 600,
        viewportHeight: 900,
      },
      controls: {
        ...props.controls,
        basicCount: 4,
        conditionalCount: 3,
        category: 'conditional',
        hideOtherSymbols: true,
        isCancelAllPending: true,
        onCancelAll: jest.fn(),
      },
      rowsByCategory: {
        basic: [{ key: 'latest-basic' }],
        conditional: [{ key: 'latest-conditional' }],
      },
    };

    view.rerender(<PerpsProOpenOrdersPage {...latestProps} />);

    expect(mockControlsRender).toHaveBeenCalledTimes(controlsRenderCount);
    expect(controlsProps()).toBe(frozenControls);
    expect(
      view.getByTestId('unit-orders-controls').props.accessibilityLabel,
    ).toBe('basic:2:1:false');
    expect(controlsLayout.props.pointerEvents).toBe('none');
    expect(bodyProps()).toMatchObject({
      activeKey: 'conditional',
      activityEnabled: false,
      interactionEnabled: false,
      rowStartOffset: 1696,
      minimumPageHeight: 504,
      viewportHeight: 900,
    });
    expect(bodyProps().dataByKey).toBe(latestProps.rowsByCategory);

    fireEvent(controlsLayout, 'layout', layoutEvent(120));

    expect(mockControlsRender).toHaveBeenCalledTimes(controlsRenderCount);
    expect(bodyProps().rowStartOffset).toBe(1720);
    expect(bodyProps().minimumPageHeight).toBe(480);

    view.rerender(
      <PerpsProOpenOrdersPage
        {...latestProps}
        context={{ ...latestProps.context, active: true, interactive: true }}
      />,
    );

    expect(mockControlsRender).toHaveBeenCalledTimes(controlsRenderCount + 1);
    expect(controlsProps()).toMatchObject(latestProps.controls);
    expect(
      view.getByTestId('unit-orders-controls').props.accessibilityLabel,
    ).toBe('conditional:4:3:true');
    expect(controlsLayout.props.pointerEvents).toBe('auto');
    expect(bodyProps()).toMatchObject({
      activityEnabled: true,
      interactionEnabled: true,
      rowStartOffset: 1720,
      minimumPageHeight: 480,
    });
  });

  it('keeps frozen Controls extent until authoritative-empty removal actually lays out', () => {
    const props = makeProps();
    const view = render(<PerpsProOpenOrdersPage {...props} />);
    const controlsLayout = view.getByTestId(
      'perps-pro-open-orders-controls-layout',
    );
    fireEvent(controlsLayout, 'layout', layoutEvent(96));
    const inactiveProps: PageProps = {
      ...props,
      context: { ...props.context, active: false, interactive: false },
    };
    view.rerender(<PerpsProOpenOrdersPage {...inactiveProps} />);
    const emptyProps: PageProps = {
      ...inactiveProps,
      presentationByCategory: {
        basic: 'authoritativeEmpty',
        conditional: 'authoritativeEmpty',
      },
    };

    view.rerender(<PerpsProOpenOrdersPage {...emptyProps} />);

    expect(view.getByTestId('unit-orders-controls')).toBeTruthy();
    expect(controlsLayout.props.pointerEvents).toBe('none');
    expect(bodyProps().interactionEnabled).toBe(false);
    expect(bodyProps().rowStartOffset).toBe(1344);
    expect(bodyProps().minimumPageHeight).toBe(656);

    view.rerender(
      <PerpsProOpenOrdersPage {...emptyProps} context={props.context} />,
    );

    expect(view.queryByTestId('unit-orders-controls')).toBeNull();
    expect(bodyProps().rowStartOffset).toBe(1344);
    expect(bodyProps().interactionEnabled).toBe(false);
    fireEvent(controlsLayout, 'layout', layoutEvent(0));
    expect(bodyProps().rowStartOffset).toBe(1248);
    expect(bodyProps().minimumPageHeight).toBe(752);
  });
});
