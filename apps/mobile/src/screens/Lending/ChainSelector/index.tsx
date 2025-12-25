import { Text, TouchableOpacity, View } from 'react-native';
import { CHAINS_ENUM } from '@/constant/chains';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import {
  MODAL_ID,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';
import ArrowDownSVG from '@/assets/icons/common/arrow-down-cc.svg';
import { useTranslation } from 'react-i18next';
import { apisLending, useFetchLendingData, useSelectedMarket } from '../hooks';
import { getMarketLogo } from '../config/market';

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => {
  return {
    container: {
      borderRadius: 16,
      paddingHorizontal: 22,
      paddingVertical: 16,
      backgroundColor: colors2024['neutral-bg-5'],
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
      lineHeight: 20,
      fontWeight: '700',
      marginLeft: 9,
    },
    icon: {
      // transform: [{ rotate: '90deg' }],
    },
    iconContainer: {
      width: 26,
      height: 26,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 100,
      backgroundColor: isLight
        ? 'rgba(0, 0, 0, 0.1)'
        : colors2024['neutral-line'],
    },
  };
});

export function ChainSelector({
  style,
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
  const { selectedMarketData, setMarketKey, chainEnum } = useSelectedMarket();
  const modalRef = React.useRef<MODAL_ID>();

  const removeChainModal = React.useCallback(() => {
    if (modalRef.current) {
      removeGlobalBottomSheetModal2024(modalRef.current);
    }
  }, []);

  const createChainModal = React.useCallback(() => {
    removeChainModal();
    if (!selectedMarketData?.market) {
      return;
    }
    modalRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_LENDING_CHAIN,
      value: selectedMarketData.market,
      titleText: t('page.Lending.selectMarket'),
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        rootViewType: 'View',
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-0']
            : colors2024['neutral-bg-1'],
        },
      },
      onChange: market => {
        apisLending.setLoading(true, { marketKey: market });
        removeChainModal();
        setMarketKey?.(market);
      },
    });
  }, [
    removeChainModal,
    selectedMarketData?.market,
    t,
    isLight,
    colors2024,
    setMarketKey,
  ]);

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
            source={
              selectedMarketData && getMarketLogo(selectedMarketData.market)
            }
          />
          <Text style={[styles.chainName]}>
            {t('page.Lending.marketSlot', {
              market: selectedMarketData?.marketTitle,
            })}
          </Text>
        </View>

        {!disable ? (
          <View style={styles.iconContainer}>
            <ArrowDownSVG
              width={16}
              height={16}
              style={styles.icon}
              color={colors2024['neutral-body']}
            />
          </View>
        ) : null}
      </TouchableOpacity>
    </>
  );
}
