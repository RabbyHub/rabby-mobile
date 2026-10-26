import React from 'react';
import { act, render } from '@testing-library/react-native';

import type { KeyringAccountWithAlias } from '@/hooks/account';

import { SortableWhitelistSection } from './SortableWhitelistSection';

type MockSortableItem = {
  account: KeyringAccountWithAlias;
  key: string;
};

type MockGridProps = {
  activeItemScale: number;
  autoScrollExtrapolation: string;
  autoScrollMaxOverscroll: [number, number];
  autoScrollMaxVelocity: number;
  columns: number;
  customHandle: boolean;
  data: MockSortableItem[];
  dragActivationDelay: number;
  dragActivationFailOffset: number;
  onDragStart: (params: {
    fromIndex: number;
    indexToKey: string[];
    key: string;
    keyToIndex: Record<string, number>;
  }) => void;
  onDragEnd: (params: {
    data: MockSortableItem[];
    fromIndex: number;
    toIndex: number;
  }) => void;
  overDrag: string;
  renderItem: (info: {
    index: number;
    item: MockSortableItem;
  }) => React.ReactNode;
  rowGap: number;
  sortEnabled: boolean;
};

let mockGridProps: MockGridProps | undefined;
let mockWhitelistItemProps: Record<
  string,
  {
    interactionDisabled: boolean;
    isActiveDragging: boolean;
  }
> = {};

jest.mock('react-native-reanimated', () => ({
  Extrapolation: {
    CLAMP: 'clamp',
  },
}));

jest.mock('react-native-sortables', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: {
      Grid: (props: MockGridProps) => {
        mockGridProps = props;
        return props.data.map((item, index) => (
          <React.Fragment key={item.key}>
            {props.renderItem({ index, item })}
          </React.Fragment>
        ));
      },
    },
  };
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('@/core/native/utils', () => ({
  IS_ANDROID: false,
}));

jest.mock('./WhiteListItem', () => ({
  WhiteListItemInSheetModal: ({
    account,
    interactionDisabled,
    isActiveDragging,
  }: any) => {
    mockWhitelistItemProps[account.address.toLowerCase()] = {
      interactionDisabled,
      isActiveDragging,
    };
    return null;
  },
}));

const createAccount = (address: string) =>
  ({
    address,
    aliasName: address,
    brandName: 'test',
    type: 'test',
  } as KeyringAccountWithAlias);

describe('SortableWhitelistSection', () => {
  beforeEach(() => {
    mockGridProps = undefined;
    mockWhitelistItemProps = {};
  });

  it('uses a fixed-width single-column grid and clamps dragging to its bounds', () => {
    render(
      <SortableWhitelistSection
        accounts={[createAccount('0xA'), createAccount('0xB')]}
        myAccounts={[]}
        onReorder={jest.fn().mockResolvedValue(true)}
        scrollableRef={{ current: null } as never}
      />,
    );

    expect(mockGridProps).toEqual(
      expect.objectContaining({
        activeItemScale: 1,
        autoScrollExtrapolation: 'clamp',
        autoScrollMaxOverscroll: [0, 50],
        autoScrollMaxVelocity: 750,
        columns: 1,
        customHandle: true,
        dragActivationDelay: 200,
        dragActivationFailOffset: 8,
        overDrag: 'none',
        rowGap: 12,
        sortEnabled: true,
      }),
    );
  });

  it('persists the reordered grid data without changing its members', async () => {
    const onReorder = jest.fn().mockResolvedValue(true);

    render(
      <SortableWhitelistSection
        accounts={[createAccount('0xA'), createAccount('0xB')]}
        myAccounts={[]}
        onReorder={onReorder}
        scrollableRef={{ current: null } as never}
      />,
    );

    const data = mockGridProps?.data;
    expect(data).toBeDefined();

    await act(async () => {
      mockGridProps?.onDragEnd({
        data: [data![1], data![0]],
        fromIndex: 0,
        toIndex: 1,
      });
      await Promise.resolve();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['0xb', '0xa']);
  });

  it('marks only the active item as dragging while disabling row interactions', () => {
    render(
      <SortableWhitelistSection
        accounts={[createAccount('0xA'), createAccount('0xB')]}
        myAccounts={[]}
        onReorder={jest.fn().mockResolvedValue(true)}
        scrollableRef={{ current: null } as never}
      />,
    );

    expect(mockWhitelistItemProps['0xa']).toEqual({
      interactionDisabled: false,
      isActiveDragging: false,
    });
    expect(mockWhitelistItemProps['0xb']).toEqual({
      interactionDisabled: false,
      isActiveDragging: false,
    });

    act(() => {
      mockGridProps?.onDragStart({
        fromIndex: 0,
        indexToKey: ['0xa', '0xb'],
        key: '0xa',
        keyToIndex: { '0xa': 0, '0xb': 1 },
      });
    });

    expect(mockWhitelistItemProps['0xa']).toEqual({
      interactionDisabled: true,
      isActiveDragging: true,
    });
    expect(mockWhitelistItemProps['0xb']).toEqual({
      interactionDisabled: true,
      isActiveDragging: false,
    });
  });
});
