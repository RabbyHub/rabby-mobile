import { useCallback, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import {
  MaterialTabBar,
  MaterialTabBarProps,
  MaterialTabItem,
} from 'react-native-collapsible-tab-view';
import { AnimatedStyle } from 'react-native-reanimated';
import { getAddrChainInfo, useAddrTop3Chains } from '../../useChainInfo';
import { ChainSelector } from '../AssetRenderItems/SectionHeaders';
import {
  apisSingleHome,
  useHomeReachTop,
  useSingleHomeAddress,
  useSingleHomeChain,
} from '../../hooks/singleHome';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import i18next from 'i18next';
import { apisTheme } from '@/hooks/theme';
import { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import { EndBg } from '../BgComponents';

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

interface DynamicCustomMaterialTabBarProps {
  materialTabBarProps: MaterialTabBarProps<string>;
  containerStyle: StyleProp<ViewStyle>;
  indicatorStyle: AnimatedStyle;
}
export const DynamicCustomMaterialTabBar = (
  props: DynamicCustomMaterialTabBarProps,
) => {
  const renderTabItem = useCallback(
    (_props: any) => (
      <MaterialTabItem
        {..._props}
        android_ripple={null}
        pressOpacity={1}
        inactiveOpacity={1}
      />
    ),
    [],
  );

  const { selectedChain } = useSingleHomeChain();

  const chainSelectModalRef = useRef<
    ReturnType<typeof createGlobalBottomSheetModal2024> | undefined
  >();
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
    <View style={props.containerStyle}>
      <MaterialTabBar
        {...props.materialTabBarProps}
        TabItemComponent={renderTabItem}
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
