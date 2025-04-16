import ChainFilterItem from '@/components/Token/ChainFilterItem';
import {
  AppRootName,
  RootNames,
  SWITCH_HEADER_HEIGHT,
} from '@/constant/layout';
import { ThemeColors2024 } from '@/constant/theme';
import { useTheme2024 } from '@/hooks/theme';
import { useFindChain } from '@/hooks/useFindChain';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Dimensions, Pressable, Text, View } from 'react-native';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useCallback } from 'react';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { StackActions, useNavigation } from '@react-navigation/native';
import { CurrentAddressProps } from '../../AddressListScreenContainer';

export const enum TabType {
  portfolio = 'portfolio',
  address = 'address',
}

interface IProps {
  currentTab: TabType;
  chainServerId?: string;
  chainLength?: number;
  addressLength?: number;
  onChainClick?: (clear: boolean) => void;
  onChangeTab: (tab: TabType) => void;
}
export const SwitchHeader = ({
  currentTab,
  onChangeTab,
  chainLength,
  onChainClick,
  addressLength,
  chainServerId,
}: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const chainInfo = useFindChain({
    serverId: chainServerId || null,
  });
  const { t } = useTranslation();

  const maxHeight = Dimensions.get('window').height - 104;
  const contentHeight = (addressLength || 0) * (78 + 12) + 60 + 56;
  const navigation = useNavigation<CurrentAddressProps['navigation']>();
  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();

  const onAddAddress = useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.ADD_ADDRESS_SELECT_METHOD,
      onDone: () => {
        removeGlobalBottomSheetModal2024(id);
      },
      shouldRedirectToSetPasswordBefore2024,
      navigateTo: (screen: AppRootName, params?: object) => {
        navigation.dispatch(
          StackActions.push(RootNames.StackAddress, {
            screen,
            params,
          }),
        );
      },
    });
  }, [shouldRedirectToSetPasswordBefore2024, navigation]);

  const handleManageAddress = useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.ADDRESS_QUICK_MANAGER,
      bottomSheetModalProps: {
        snapPoints: [Math.min(contentHeight, maxHeight)],
      },
      type: 'address',
      onAddAddress,
      onCancel: () => {
        removeGlobalBottomSheetModal2024(id);
      },
    });
  }, [contentHeight, maxHeight, onAddAddress]);

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <Pressable
          style={[
            styles.tabContainer,
            currentTab === TabType.portfolio && styles.activeTabContainer,
          ]}
          onPress={() => onChangeTab(TabType.portfolio)}>
          <Text
            style={[
              styles.tab,
              currentTab === TabType.portfolio && styles.activeTab,
            ]}>
            Portfolio
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tabContainer,
            currentTab === TabType.address && styles.activeTabContainer,
          ]}
          onPress={() => onChangeTab(TabType.address)}>
          <Text
            style={[
              styles.tab,
              currentTab === TabType.address && styles.activeTab,
            ]}>
            Address{addressLength ? `(${addressLength})` : ''}
          </Text>
        </Pressable>
      </View>
      <View style={styles.right}>
        {currentTab === TabType.portfolio ? (
          !!chainLength &&
          (chainInfo?.id ? (
            <View style={styles.chainContainer}>
              <ChainFilterItem
                style={styles.chainFilterItem}
                chainItem={chainInfo}
                onPress={() => onChainClick?.(false)}
                onRemoveFilter={() => onChainClick?.(true)}
              />
            </View>
          ) : (
            <Pressable
              style={styles.chainContainer}
              onPress={() => onChainClick?.(false)}>
              <Text style={styles.countChain}>
                {t('page.singleHome.sectionHeader.totalChain', {
                  count: chainLength || 0,
                })}
              </Text>
              <ArrowRightSVG
                style={styles.icon}
                width={16}
                color={colors2024['neutral-body']}
              />
            </Pressable>
          ))
        ) : (
          <Pressable onPress={handleManageAddress}>
            <Text>edit addr</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  tabs: {
    flexDirection: 'row',
    alignContent: 'center',
    gap: 4,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    padding: 4,
    borderRadius: 12,
  },
  tab: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  tabContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  activeTabContainer: {
    backgroundColor: 'rgba(0, 0, 0, 1)',
    borderRadius: 8,
  },
  activeTab: {
    color: ThemeColors2024.dark['neutral-title-1'],
  },
  container: {
    flexDirection: 'row',
    height: SWITCH_HEADER_HEIGHT,
    justifyContent: 'space-between',
    alignContent: 'center',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  chainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chainFilterItem: {
    backgroundColor: 'transparent',
  },
  countChain: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  icon: {
    transform: [{ rotate: '90deg' }],
  },
  right: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
