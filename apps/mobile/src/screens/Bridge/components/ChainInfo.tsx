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
import { SelectSortedChainProps } from '@/components/SelectSortedChain';
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

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      // borderRadius: 30,
      // paddingHorizontal: 22,
      // paddingVertical: 16,
      // backgroundColor: colors2024['neutral-bg-2'],
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
      fontSize: 16,
      fontWeight: '700',
      marginLeft: 4,
    },
    icon: {
      marginLeft: 4,
      transform: [{ rotate: '90deg' }],
    },
  };
});

export function ChainInfo({
  chainEnum,
  style,
  onChange,
  supportChains,
  disabledTips,
  hideMainnetTab,
  hideTestnetTab,
  rightArrowIcon,
  titleStyle,
  excludeChains,
  type,
}: React.PropsWithChildren<
  RNViewProps & {
    chainEnum?: CHAINS_ENUM;
    onChange?: (chain: CHAINS_ENUM) => void;
    supportChains?: SelectSortedChainProps['supportChains'];
    disabledTips?: SelectSortedChainProps['disabledTips'];
    hideMainnetTab?: SelectSortedChainProps['hideMainnetTab'];
    hideTestnetTab?: SelectSortedChainProps['hideTestnetTab'];
    type: 'to' | 'from';
    excludeChains?: CHAINS_ENUM[];
    rightArrowIcon?: React.ReactNode;
    titleStyle?: StyleProp<TextStyle>;
  }
>) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const chainItem = useFindChain({
    enum: chainEnum,
  });
  const { t } = useTranslation();

  const modalRef = React.useRef<MODAL_ID>();

  const removeChainModal = React.useCallback(() => {
    if (modalRef.current) {
      removeGlobalBottomSheetModal2024(modalRef.current);
    }
  }, []);

  const createChainModal = React.useCallback(() => {
    modalRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_SORTED_CHAIN,
      value: chainEnum,
      onClose: removeChainModal,
      supportChains,
      disabledTips,
      hideMainnetTab,
      hideTestnetTab,
      excludeChains,
      titleText:
        type === 'from'
          ? t('page.bridge.bridgeFrom')
          : t('page.bridge.bridgeTo'),
      onChange: chain => {
        removeChainModal();
        onChange?.(chain);
      },
    });
  }, [
    type,
    excludeChains,
    chainEnum,
    disabledTips,
    hideMainnetTab,
    hideTestnetTab,
    onChange,
    removeChainModal,
    supportChains,
    t,
  ]);

  return (
    <>
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={createChainModal}>
        <View style={styles.left}>
          <ChainIconImage
            size={16}
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
              width={16}
              height={16}
              style={styles.icon}
              color={colors2024['neutral-foot']}
            />
          )}
        </View>
      </TouchableOpacity>
    </>
  );
}
