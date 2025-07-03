import React from 'react';
import {
  Modal,
  TouchableWithoutFeedback,
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import RcIconArrowDownCC from '@/assets2024/icons/copyTrading/IconDownPolygon.svg';
import RcIconSelectedCC from '@/assets2024/icons/copyTrading/IconSelected.svg';
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
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const selectedFilterRule = filterTabList.find(
    item => item.key === selectedRule,
  );

  const handleSelectMenuItem = useMemoizedFn((rule: FilterRuleEnum) => {
    onSelectItem(rule);
  });

  const { top, bottom } = useSafeAreaInsets();

  const iosAddTop = IS_IOS ? 16 : 0;

  return (
    <>
      {/* Filter Button */}
      <View style={styles.filterContainer}>
        <TouchableOpacity style={styles.filterButton} onPress={onOpen}>
          <Text style={styles.filterText}>{selectedFilterRule?.title}</Text>
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
        animationType="fade"
        onRequestClose={onClose}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.menuOverlay}>
            <View
              style={StyleSheet.flatten([
                styles.menuContainer,
                {
                  top: ScreenLayouts.headerAreaHeight + top + 20 + iosAddTop,
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

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  filterContainer: {
    position: 'absolute',
    zIndex: 1,
    right: 0,
    top: 10,
    paddingRight: 12,
    paddingVertical: 6,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors2024['neutral-bg-1'],
    shadowColor: colors2024['neutral-bg-1'],
    shadowOffset: {
      width: -7,
      height: 0,
    },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
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
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    flex: 1,
  },
  menuItemTextSelected: {
    color: colors2024['brand-default'],
    fontWeight: '500',
  },
}));
