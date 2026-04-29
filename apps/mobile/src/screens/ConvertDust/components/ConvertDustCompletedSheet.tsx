import successAnimation from '@/assets2024/animations/animation-create-success.min.json';
import RcIconSwapFailed from '@/assets2024/icons/convertDust/swap-failed.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import type { Chain } from '@debank/common';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import Lottie from 'lottie-react-native';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export function ConvertDustCompletedSheet({
  chain,
  receiveAmount,
  receiveToken,
  receiveUsd,
  visible,
  onDone,
  onCancel,
  isSuccess,
}: {
  chain?: Chain | null;
  receiveAmount: number;
  receiveToken?: TokenItem | null;
  receiveUsd: number;
  visible: boolean;
  onDone: () => void;
  onCancel?: () => void;
  isSuccess?: boolean;
}) {
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { safeOffBottom } = useSafeSizes();
  const receiveTokenSymbol = receiveToken
    ? getTokenSymbol(receiveToken) || 'Unknown'
    : 'Unknown';

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={[437]}
      backgroundStyle={styles.sheetBackground}
      handleStyle={styles.sheetHandle}
      handleIndicatorStyle={styles.sheetHandleIndicator}
      onDismiss={onCancel}>
      <View style={styles.sheetContent}>
        <View style={styles.heroBlock}>
          {isSuccess ? (
            <View style={styles.lottieContainer}>
              <Lottie
                source={successAnimation}
                style={styles.lottie}
                loop={false}
                autoPlay
              />
            </View>
          ) : (
            <View style={styles.failedIconWrap}>
              <RcIconSwapFailed width={80} />
            </View>
          )}
          <Text style={styles.title}>
            {t('page.convertDust.completed.title')}
          </Text>
        </View>

        <View style={styles.receiveCard}>
          <View style={styles.receiveTokenWrap}>
            <AssetAvatar
              logo={receiveToken?.logo_url}
              size={46}
              chain={chain?.serverId}
              chainSize={18}
              innerChainStyle={styles.receiveChainBadge}
            />
            <Text style={styles.receiveSymbol}>{receiveTokenSymbol}</Text>
          </View>
          <View style={styles.receiveValueWrap}>
            <Text style={styles.receiveHint}>
              {t('page.convertDust.completed.receive')}{' '}
              {formatAmount(receiveAmount)} {receiveTokenSymbol}
            </Text>
            <Text style={styles.receiveValue}>
              +{formatUsdValue(receiveUsd)}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.buttonWrap,
            { paddingBottom: Math.max(38, safeOffBottom) },
          ]}>
          <Button
            title={t('global.Done')}
            height={52}
            containerStyle={styles.buttonContainer}
            buttonStyle={styles.button}
            titleStyle={styles.buttonTitle}
            onPress={onDone}
            noShadow
          />
        </View>
      </View>
    </AppBottomSheetModal>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  sheetBackground: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  sheetHandle: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 10,
  },
  sheetHandleIndicator: {
    width: 50,
    height: 6,
    borderRadius: 100,
    backgroundColor: '#D1D4DB',
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroBlock: {
    marginTop: 24,
    alignItems: 'center',
  },
  lottieContainer: {
    width: 148,
    height: 141,
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  failedIconWrap: {
    marginBottom: 24,
  },
  title: {
    color: '#000000',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
    textAlign: 'center',
  },
  receiveCard: {
    height: 80,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiveTokenWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  receiveChainBadge: {
    borderWidth: 1.5,
    borderColor: colors2024['neutral-bg-1'],
  },
  receiveSymbol: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  receiveValueWrap: {
    alignItems: 'flex-end',
  },
  receiveHint: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  receiveValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 32,
  },
  buttonWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 24,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  buttonContainer: {
    height: 52,
  },
  button: {
    height: 52,
    borderRadius: 12,
  },
  buttonTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
}));
