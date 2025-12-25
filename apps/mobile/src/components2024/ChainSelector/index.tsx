import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { Chain, CHAINS_ENUM } from '@/constant/chains';
import { Account } from '@/core/services/preference';
import { useTheme2024 } from '@/hooks/theme';
import { findChainByEnum } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '../GlobalBottomSheetModal';
import { MODAL_NAMES } from '../GlobalBottomSheetModal/types';

// import { TestnetChainLogo } from '../Chain/TestnetChainLogo';

interface ChainSelectorProps {
  value: CHAINS_ENUM;
  onChange(value: CHAINS_ENUM): void;
  onAfterOpen?: () => void;
  showRPCStatus?: boolean;
  modalHeight?: number;
  style?: StyleProp<ViewStyle>;
  supportChains?: CHAINS_ENUM[];
  disabledTips?: string | ((ctx: { chain: Chain }) => string);
  hideTestnetTab?: boolean;
  hideMainnetTab?: boolean;
  handleStyle?: ViewStyle;
  titleText?: string;
  excludeChains?: CHAINS_ENUM[];
  needAllAddresses?: boolean;
  onClose?: () => void;
  account?: Account | null;
}

export const ChainSelector = ({
  value,
  onChange,
  style,
  onAfterOpen,
  supportChains,
  disabledTips,
  hideTestnetTab = false,
  hideMainnetTab = false,
  onClose,
  excludeChains,
  titleText,
  needAllAddresses,
  account,
}: ChainSelectorProps) => {
  const { styles } = useTheme2024({
    getStyle,
  });
  const chainInfo = React.useMemo(() => {
    return findChainByEnum(value);
  }, [value]);

  const { t } = useTranslation();

  const activeSelectChainPopup = () => {
    if (!account) return;
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY,
      value: value,
      onClose: () => {
        removeGlobalBottomSheetModal2024(id);
        onClose?.();
      },
      supportChains,
      disabledTips,
      hideTestnetTab,
      hideMainnetTab,
      excludeChains,
      needAllAddresses,
      titleText: titleText || t('page.component.ChainSelector.title'),
      account,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        rootViewType: 'View',
      },
      onChange: chain => {
        removeGlobalBottomSheetModal2024(id);
        onChange?.(chain);
      },
    });
  };

  const handleClickSelector = () => {
    activeSelectChainPopup();
    onAfterOpen?.();
  };

  return (
    <TouchableOpacity
      style={StyleSheet.flatten([styles.wrapper, style])}
      onPress={handleClickSelector}>
      {chainInfo ? (
        <View>
          {chainInfo.isTestnet ? (
            <TestnetChainLogo name={chainInfo.name} style={styles.chainIcon} />
          ) : (
            <Image
              source={{
                uri: chainInfo.logo,
              }}
              style={styles.chainIcon}
            />
          )}
        </View>
      ) : null}
      <Text style={styles.chainText}>
        {findChainByEnum(value)?.name || 'Select Chain'}
      </Text>
      <RcIconArrowRight style={styles.buttonIcon} />
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  chainIcon: {
    width: 24,
    height: 24,
    borderRadius: 24,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors2024['neutral-bg-5'],
    gap: 6,
  },
  chainText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  buttonIcon: {
    transform: [{ rotate: '90deg' }],
  },
}));
