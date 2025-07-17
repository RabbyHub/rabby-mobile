/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import {
  Modal,
  TouchableWithoutFeedback,
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import RcIconArrowDownCC from '@/assets2024/icons/copyTrading/IconDownPolygon.svg';
import RcIconSelectedCC from '@/assets2024/icons/copyTrading/IconSelected.svg';
import RcIconVectorCC from '@/assets2024/icons/copyTrading/IconVectorCC.svg';
import RcIconTabCountCC from '@/assets2024/icons/copyTrading/IconTabCountCC.svg';
import RcIconTabChangeCC from '@/assets2024/icons/copyTrading/IconTabChangeCC.svg';

import RcIconTabTimeCC from '@/assets2024/icons/copyTrading/IconTabTimeCC.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenLayouts } from '@/constant/layout';
import { IS_IOS } from '@/core/native/utils';
export enum FilterRuleEnum {
  '24hPrice' = '24hPrice',
  'smartMoney' = 'smart money',
  'tokenCreate' = 'token create',
}

export interface FilterTabItem {
  key: FilterRuleEnum;
  title: string;
  rule: string;
  orderKey: 'price_change' | 'buy_address_count' | 'token_create_at';
}

interface FilterDropdownMenuProps {
  isVisible: boolean;
  selectedRule: FilterRuleEnum;
  filterTabList: FilterTabItem[];
  onOpen: () => void;
  onClose: () => void;
  onSelectItem: (rule: FilterRuleEnum) => void;
}

export const FilterDropdownMenu: React.FC<FilterDropdownMenuProps> = ({
  isVisible,
  selectedRule,
  filterTabList,
  onOpen,
  onClose,
  onSelectItem,
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const selectedFilterRule = filterTabList.find(
    item => item.key === selectedRule,
  );

  const handleSelectMenuItem = useMemoizedFn((rule: FilterRuleEnum) => {
    onSelectItem(rule);
  });

  const { top, bottom } = useSafeAreaInsets();

  const iosAddTop = IS_IOS ? 16 : 0;

  const getRenderIcon = (rule: FilterRuleEnum, size: number, color: string) => {
    switch (rule) {
      case FilterRuleEnum.smartMoney:
        return <RcIconTabCountCC width={size} height={size} color={color} />;
      case FilterRuleEnum['24hPrice']:
        return <RcIconTabChangeCC width={size} height={size} color={color} />;
      case FilterRuleEnum.tokenCreate:
        return <RcIconTabTimeCC width={size} height={size} color={color} />;
    }
  };

  return (
    <>
      {/* Filter Button */}
      <LinearGradient
        colors={
          isLight
            ? ['rgba(255, 255, 255, 0)', '#FFFFFF']
            : ['rgba(19, 20, 22, 0)', 'rgba(19, 20, 22, 1)']
        }
        locations={[0, 0.3624]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientMask}
        pointerEvents="none"
      />
      <View style={styles.filterContainer}>
        <TouchableOpacity onPress={onOpen} style={styles.filterButton}>
          <RcIconVectorCC
            height={15}
            color={colors2024['neutral-line']}
            style={{ marginRight: 12 }}
          />
          {getRenderIcon(selectedRule, 22, colors2024['brand-default'])}
          <RcIconArrowDownCC
            width={8}
            color={colors2024['brand-default']}
            style={[styles.arrowIcon, isVisible && styles.arrowIconRotated]}
          />
        </TouchableOpacity>
      </View>

      {/* Dropdown Modal */}
      <Modal
        visible={isVisible}
        transparent={true}
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={onClose}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.menuOverlay}>
            <View
              style={StyleSheet.flatten([
                styles.menuContainer,
                {
                  top: ScreenLayouts.headerAreaHeight + top + 50,
                  right: 16,
                },
              ])}>
              {filterTabList.map(item => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.menuItem,
                    selectedRule === item.key && styles.menuItemSelected,
                  ]}
                  onPress={() => handleSelectMenuItem(item.key)}>
                  {getRenderIcon(
                    item.key,
                    20,
                    selectedRule === item.key
                      ? colors2024['brand-default']
                      : colors2024['neutral-info'],
                  )}
                  <Text
                    style={[
                      styles.menuItemText,
                      selectedRule === item.key && styles.menuItemTextSelected,
                    ]}>
                    {item.title}
                  </Text>
                  {selectedRule === item.key && (
                    <RcIconSelectedCC
                      width={12}
                      color={colors2024['brand-default']}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  filterContainer: {
    position: 'relative',
    // zIndex: 1,
    // right: 0,
    // top: 10,
    paddingRight: 16,
    zIndex: 11,
    // paddingLeft: 12,
    paddingVertical: 6,
    // backgroundColor: colors2024['neutral-bg-1'],
  },
  verticalLine: {
    width: 1,
    height: 15,
    marginRight: 12,
    backgroundColor: colors2024['neutral-line'],
  },
  linearGradient: {
    paddingLeft: 42,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
  },
  arrowIcon: {
    transform: [{ rotate: '0deg' }],
  },
  arrowIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  menuOverlay: {
    flex: 1,
  },
  menuContainer: {
    position: 'absolute',
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 120,
    shadowColor: colors2024['neutral-bg-1'],
    padding: 12,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 0.5,
    borderColor: colors2024['neutral-line'],
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    width: 200,
  },
  menuItemSelected: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-default'],
    borderWidth: 0.5,
    borderRadius: 6,
  },
  menuItemText: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    flex: 1,
  },
  menuItemTextSelected: {
    color: colors2024['brand-default'],
    fontWeight: '500',
  },
  gradientMask: {
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    // left: 0,
    bottom: 0,
    width: 102,
    zIndex: 10,
    right: 0,
  },
}));
