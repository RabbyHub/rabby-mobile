import ChainFilterItem from '@/components/Token/ChainFilterItem';
import { SWITCH_HEADER_HEIGHT } from '@/constant/layout';
import { ThemeColors2024 } from '@/constant/theme';
import { useTheme2024 } from '@/hooks/theme';
import { useFindChain } from '@/hooks/useFindChain';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';

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
          <Text>edit addr</Text>
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
    backgroundColor: colors2024['neutral-bg-1'],
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
    color: isLight
      ? ThemeColors2024.dark['neutral-title-1']
      : ThemeColors2024.light['neutral-title-1'],
  },
  container: {
    flexDirection: 'row',
    height: SWITCH_HEADER_HEIGHT,
    justifyContent: 'space-between',
    alignContent: 'center',
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
