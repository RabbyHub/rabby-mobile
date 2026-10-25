import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { Account } from '@/core/startupServices/preference';
import type { LimitOrderRow } from '../../hooks/useLimitOrders';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { PerpsLimitOrdersSectionView } from './SectionView';

const mockCancelOrders = jest.fn();
const mockPopup = jest.fn();

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: require('zustand').create(() => ({ currentPerpsAccount: null })),
}));
jest.mock('@/screens/PerpsMarketDetail/hooks/usePerpsPosition', () => ({
  usePerpsPosition: () => ({ handleCancelLimitOrders: mockCancelOrders }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (value: unknown) => value,
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/utils/perps', () => ({ getStatsReportSide: jest.fn() }));
jest.mock('@/utils/stats', () => ({ stats: { report: jest.fn() } }));
jest.mock('@/constant', () => ({ APP_VERSIONS: { fromNative: 'test' } }));
jest.mock('./PerpsLimitOrderItem', () => ({
  PerpsLimitOrderItem: ({ onPress }: { onPress: () => void }) =>
    require('react').createElement(require('react-native').View, {
      testID: 'order-row',
      onTouchEnd: onPress,
    }),
}));
jest.mock('./PerpsLimitOrderDetailPopup', () => ({
  PerpsLimitOrderDetailPopup: (props: {
    visible: boolean;
    onCancel: () => Promise<void>;
  }) => {
    mockPopup(props);
    return props.visible
      ? require('react').createElement(require('react-native').View, {
          testID: 'order-detail-portal',
          onTouchEnd: props.onCancel,
        })
      : null;
  },
}));

const row = {
  order: {
    oid: 1,
    coin: 'BTC',
    side: 'B',
    origSz: '1',
    limitPx: '100',
  },
  leverage: null,
  marginUsage: 0,
} as LimitOrderRow;

const account = { address: '0x123', type: 'Simple Key Pair' } as Account;

function deferredApproval() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  perpsStore.setState({ currentPerpsAccount: account });
  mockCancelOrders.mockResolvedValue([1]);
});

afterEach(() => jest.restoreAllMocks());

it('keeps a retained selection but only hosts its portal while selected, independently of preview display activity', async () => {
  const props = { rows: [row], handleActionApproveStatus: jest.fn() };
  const screen = render(<PerpsLimitOrdersSectionView {...props} />);
  fireEvent(screen.getByTestId('order-row'), 'touchEnd');
  expect(screen.getByTestId('order-detail-portal')).toBeOnTheScreen();
  const oldCancel = mockPopup.mock.calls.at(-1)?.[0].onCancel;

  screen.rerender(
    <PerpsLimitOrdersSectionView {...props} sceneActive={false} />,
  );
  expect(screen.queryByTestId('order-detail-portal')).toBeNull();
  await act(async () => oldCancel());
  expect(props.handleActionApproveStatus).not.toHaveBeenCalled();

  screen.rerender(<PerpsLimitOrdersSectionView {...props} sceneActive />);
  expect(screen.getByTestId('order-detail-portal')).toBeOnTheScreen();
});

it('does not open a row in a preview even when a queued row event arrives', () => {
  const screen = render(
    <PerpsLimitOrdersSectionView
      rows={[row]}
      handleActionApproveStatus={jest.fn()}
      sceneActive={false}
    />,
  );
  fireEvent(screen.getByTestId('order-row'), 'touchEnd');
  expect(screen.queryByTestId('order-detail-portal')).toBeNull();
  expect(mockPopup.mock.calls.at(-1)?.[0].order).toBeUndefined();
});

it('does not submit a single cancellation after its approval returns to a hidden scene', async () => {
  const approval = deferredApproval();
  const props = {
    rows: [row],
    handleActionApproveStatus: jest.fn(() => approval.promise),
  };
  const screen = render(<PerpsLimitOrdersSectionView {...props} />);
  fireEvent(screen.getByTestId('order-row'), 'touchEnd');
  fireEvent(screen.getByTestId('order-detail-portal'), 'touchEnd');
  expect(props.handleActionApproveStatus).toHaveBeenCalledTimes(1);
  screen.rerender(
    <PerpsLimitOrdersSectionView {...props} sceneActive={false} />,
  );
  await act(async () => approval.resolve());
  expect(mockCancelOrders).not.toHaveBeenCalled();
  expect(screen.queryByTestId('order-detail-portal')).toBeNull();
});

it('does not show a delayed cancel-all confirmation or execute an old confirmation while hidden', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const approval = deferredApproval();
  const props = {
    rows: [row],
    handleActionApproveStatus: jest.fn(() => approval.promise),
  };
  const screen = render(<PerpsLimitOrdersSectionView {...props} />);
  fireEvent.press(screen.getByText('page.perps.cancelAll'));
  screen.rerender(
    <PerpsLimitOrdersSectionView {...props} sceneActive={false} />,
  );
  await act(async () => approval.resolve());
  expect(alert).not.toHaveBeenCalled();

  screen.rerender(<PerpsLimitOrdersSectionView {...props} sceneActive />);
  await act(async () => {
    fireEvent.press(screen.getByText('page.perps.cancelAll'));
  });
  const confirm = alert.mock.calls[0][2]?.[1].onPress;
  expect(confirm).toBeDefined();
  screen.rerender(
    <PerpsLimitOrdersSectionView {...props} sceneActive={false} />,
  );
  await act(async () => confirm?.());
  expect(mockCancelOrders).not.toHaveBeenCalled();
});

it('clears the retained row on account change and never reopens it from a late cancellation', async () => {
  const cancellation = deferredApproval();
  mockCancelOrders.mockImplementation(() =>
    cancellation.promise.then(() => [1]),
  );
  const props = {
    rows: [row],
    handleActionApproveStatus: jest.fn().mockResolvedValue(undefined),
  };
  const screen = render(<PerpsLimitOrdersSectionView {...props} />);
  fireEvent(screen.getByTestId('order-row'), 'touchEnd');
  await act(async () => {
    fireEvent(screen.getByTestId('order-detail-portal'), 'touchEnd');
  });
  expect(mockCancelOrders).toHaveBeenCalledTimes(1);
  screen.rerender(
    <PerpsLimitOrdersSectionView {...props} sceneActive={false} />,
  );
  act(() =>
    perpsStore.setState({
      currentPerpsAccount: { ...account, address: '0x456' },
    }),
  );
  await act(async () => cancellation.resolve());
  screen.rerender(<PerpsLimitOrdersSectionView {...props} sceneActive />);
  expect(screen.queryByTestId('order-detail-portal')).toBeNull();
});
