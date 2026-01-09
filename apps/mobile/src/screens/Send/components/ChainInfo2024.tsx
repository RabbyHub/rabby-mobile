import {
  StyleProp,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import { CHAINS_ENUM } from '@/constant/chains';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { SelectSortedChainProps } from '@/components2024/SelectChainWithSummary';
import { useFindChain } from '@/hooks/useFindChain';
import React from 'react';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import {
  MODAL_ID,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { useTranslation } from 'react-i18next';
import { Account } from '@/core/services/preference';

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      borderRadius: 16,
      paddingHorizontal: 22,
      paddingVertical: 16,
      backgroundColor: colors2024['neutral-bg-2'],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    chainName: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      fontWeight: '700',
      marginLeft: 9,
    },
    icon: {
      transform: [{ rotate: '90deg' }],
    },
  };
});

export function ChainInfo2024({
  chainEnum,
  style,
  onChange,
  supportChains,
  disabledTips,
  hideMainnetTab,
  hideTestnetTab,
  rightArrowIcon,
  titleStyle,
  account,
}: React.PropsWithChildren<
  RNViewProps & {
    chainEnum?: CHAINS_ENUM;
    onChange?: (chain: CHAINS_ENUM) => void;
    supportChains?: SelectSortedChainProps['supportChains'];
    disabledTips?: SelectSortedChainProps['disabledTips'];
    hideMainnetTab?: SelectSortedChainProps['hideMainnetTab'];
    hideTestnetTab?: SelectSortedChainProps['hideTestnetTab'];
    rightArrowIcon?: React.ReactNode;
    titleStyle?: StyleProp<TextStyle>;
    account: Account;
  }
>) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const chainItem = useFindChain({
    enum: chainEnum,
  });

  const modalRef = React.useRef<MODAL_ID>();

  const removeChainModal = React.useCallback(() => {
    if (modalRef.current) {
      removeGlobalBottomSheetModal2024(modalRef.current);
    }
  }, []);

  const createChainModal = React.useCallback(() => {
    removeChainModal();
    modalRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY,
      account,
      value: chainEnum,
      onClose: removeChainModal,
      supportChains,
      disabledTips,
      hideMainnetTab,
      hideTestnetTab,
      titleText: t('page.swap.selectChainModalTitle'),
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        rootViewType: 'View',
      },
      onChange: chain => {
        removeChainModal();
        onChange?.(chain);
      },
    });
  }, [
    account,
    chainEnum,
    removeChainModal,
    supportChains,
    disabledTips,
    hideMainnetTab,
    hideTestnetTab,
    t,
    onChange,
  ]);

  return (
    <>
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={createChainModal}>
        <View style={styles.left}>
          <ChainIconImage
            size={24}
            chainEnum={chainEnum}
            isShowRPCStatus={true}
          />
          <Text style={[styles.chainName, titleStyle]}>{chainItem?.name}</Text>
        </View>

        <View>
          {rightArrowIcon ? (
            rightArrowIcon
          ) : (
            <ArrowRightSVG
              style={styles.icon}
              color={colors2024['neutral-title-1']}
            />
          )}
        </View>
      </TouchableOpacity>
    </>
  );
}
