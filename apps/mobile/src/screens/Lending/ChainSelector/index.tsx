import { Text, TouchableOpacity, View } from 'react-native';
import { CHAINS_ENUM } from '@/constant/chains';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
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

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => {
  return {
    container: {
      borderRadius: 16,
      paddingHorizontal: 22,
      paddingVertical: 16,
      backgroundColor: isLight
        ? colors2024['neutral-line']
        : colors2024['neutral-bg-2'],
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

export function ChainSelector({
  chainEnum,
  style,
  onChange,
  disable,
}: React.PropsWithChildren<
  RNViewProps & {
    chainEnum?: CHAINS_ENUM;
    onChange?: (chain: CHAINS_ENUM) => void;
    disable?: boolean;
  }
>) {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
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
      name: MODAL_NAMES.SELECT_LENDING_CHAIN,
      value: chainEnum,
      titleText: t('page.Lending.selectChain'),
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        rootViewType: 'View',
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-0']
            : colors2024['neutral-bg-1'],
        },
      },
      onChange: chain => {
        removeChainModal();
        onChange?.(chain);
      },
    });
  }, [removeChainModal, chainEnum, t, isLight, colors2024, onChange]);

  return (
    <>
      <TouchableOpacity
        style={[styles.container, style]}
        disabled={disable}
        onPress={createChainModal}>
        <View style={styles.left}>
          <ChainIconImage
            size={24}
            chainEnum={chainEnum}
            isShowRPCStatus={true}
          />
          <Text style={[styles.chainName]}>
            {chainItem?.name} {t('page.Lending.market')}
          </Text>
        </View>

        {!disable ? (
          <View>
            <ArrowRightSVG
              style={styles.icon}
              color={colors2024['neutral-title-1']}
            />
          </View>
        ) : null}
      </TouchableOpacity>
    </>
  );
}
