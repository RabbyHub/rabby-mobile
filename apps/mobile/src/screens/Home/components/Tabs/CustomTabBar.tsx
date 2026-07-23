import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import {
  MaterialTabBar,
  MaterialTabBarProps,
  MaterialTabItem,
  useCurrentTabScrollY,
} from 'react-native-collapsible-tab-view';
import { useAnimatedReaction, withTiming } from 'react-native-reanimated';
import { getAddrChainInfo, useAddrTop3Chains } from '../../useChainInfo';
import { ChainSelector } from '../AssetRenderItems/SectionHeaders';
import {
  apisSingleHome,
  useSingleHomeAddress,
  useSingleHomeChain,
} from '../../hooks/singleHome';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import i18next from 'i18next';
import { apisTheme, useTheme2024 } from '@/hooks/theme';
import { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import { EndBg, useHomeBackgroundOpacity } from '../BgComponents';
import { createGetStyles2024 } from '@/utils/styles';

const disableInnerIndicator = {
  height: 0,
};

function SideChainSelector({
  onChainClick,
  chain,
}: {
  onChainClick?: React.ComponentProps<typeof ChainSelector>['onChainClick'];
  chain?: string;
}) {
  const { currentAddress } = useSingleHomeAddress();
  const { top3Chains } = useAddrTop3Chains(currentAddress);
  return (
    <ChainSelector
      key={top3Chains.sort().join(',')}
      top3Chains={top3Chains}
      onChainClick={onChainClick}
      chainServerId={chain}
    />
  );
}

const TabItem: MaterialTabBarProps<string>['TabItemComponent'] &
  object = props => {
  const { styles } = useTheme2024({ getStyle: getTabItemStyle });
  return (
    <MaterialTabItem
      {...props}
      style={styles.tabBar}
      android_ripple={null}
      pressOpacity={1}
      inactiveOpacity={1}
    />
  );
};

const CustomMaterialTabBarContent = (props: MaterialTabBarProps<string>) => {
  const { styles } = useTheme2024({ getStyle: getTabItemStyle });
  const { selectedChain } = useSingleHomeChain();
  const scrollY = useCurrentTabScrollY();
  const backgroundOpacity = useHomeBackgroundOpacity();

  useAnimatedReaction(
    () => scrollY.value <= 0,
    (isAtTop, wasAtTop) => {
      if (isAtTop === wasAtTop) {
        return;
      }
      backgroundOpacity.value = withTiming(isAtTop ? 1 : 0, {
        duration: 100,
      });
    },
  );

  const chainSelectModalRef = useRef<
    ReturnType<typeof createGlobalBottomSheetModal2024> | undefined
  >(undefined);
  const handleOnChainClick = useCallback((clear: boolean) => {
    if (clear) {
      apisSingleHome.setSelectChainItem(null);
      return;
    }

    if (chainSelectModalRef.current) {
      removeGlobalBottomSheetModal2024(chainSelectModalRef.current);
      chainSelectModalRef.current = undefined;
    }
    const currentAddress = apisSingleHome.getCurrentAddress();
    const { isLight, colors2024 } = apisTheme.getColors2024();
    chainSelectModalRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_CHAIN_WITH_DISTRIBUTE,
      value: apisSingleHome.getSelectedChainItem() || undefined,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        rootViewType: 'View',
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-0']
            : colors2024['neutral-bg-1'],
        },
      },
      chainList: !currentAddress
        ? []
        : getAddrChainInfo(currentAddress).computedResult.chainAssets,
      titleText: i18next.t('page.receiveAddressList.selectChainTitle'),
      onChange: (v: ChainListItem) => {
        apisSingleHome.setSelectChainItem(v);
        if (chainSelectModalRef.current) {
          removeGlobalBottomSheetModal2024(chainSelectModalRef.current);
          chainSelectModalRef.current = undefined;
        }
      },
      onClose: () => {
        if (chainSelectModalRef.current) {
          removeGlobalBottomSheetModal2024(chainSelectModalRef.current);
          chainSelectModalRef.current = undefined;
        }
      },
    });
  }, []);

  return (
    <View
      style={styles.tabsBarContainer}
      onTouchStart={event => {
        event.stopPropagation();
      }}>
      <MaterialTabBar
        {...props}
        TabItemComponent={TabItem}
        indicatorStyle={disableInnerIndicator}
      />
      <SideChainSelector
        chain={selectedChain || undefined}
        onChainClick={handleOnChainClick}
      />
      <EndBg />
    </View>
  );
};

export const DynamicCustomMaterialTabBar = (
  props: MaterialTabBarProps<string>,
) => <CustomMaterialTabBarContent {...props} />;

const getTabItemStyle = createGetStyles2024(() => {
  return {
    tabBar: {
      height: 32,
      width: 'auto',
      flexShrink: 0,
      flex: 0,
      paddingHorizontal: 0,
      // marginRight: 20,
    },
    tabsBarContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 12,
      paddingRight: 12,
      position: 'relative',
      height: 36,
      paddingBottom: 4,
      overflow: 'hidden',
    },
    indicator: {
      height: 0,
    },
  };
});
