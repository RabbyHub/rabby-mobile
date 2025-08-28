import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { PerpsSelectTokenPopup } from './PerpsSelectTokenPopup';
import { PerpsDepositTokenModal } from './PerpsDepositTokenModal';
import { formatUsdValue } from '@/utils/number';
import BigNumber from 'bignumber.js';
import { Account } from '@/core/services/preference';
import { useRequest } from 'ahooks';
import { openapi } from '@/core/request';
import {
  ARB_USDC_TOKEN_ID,
  ARB_USDC_TOKEN_SERVER_CHAIN,
} from '@/constant/perps';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { AssetAvatar } from '@/components';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { getTokenSymbol } from '@/utils/token';

export const PerpsDepositPopup: React.FC<{
  account?: Account | null;
  visible?: boolean;
  onClose?(): void;
  onDeposit?(v: string): void;
}> = ({ visible, onClose, account, onDeposit }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });
  const [amount, setAmount] = React.useState<string>('');

  const [isShowTokenPopup, setIsShowTokenPopup] = useState(false);

  const { t } = useTranslation();

  const { data: arbUsdc, runAsync: runFetchUsdcToken } = useRequest(
    async () => {
      if (!account) {
        return null;
      }
      const arbUsdcToken = await openapi.getToken(
        account.address,
        ARB_USDC_TOKEN_SERVER_CHAIN,
        ARB_USDC_TOKEN_ID,
      );
      return ensureAbstractPortfolioToken(arbUsdcToken);
    },
    {
      refreshDeps: [account?.address],
      manual: true,
    },
  );

  const { runAsync: handleDeposit, loading } = useRequest(
    async () => {
      console.log('--------', amount);
      await onDeposit?.(amount);
    },
    {
      manual: true,
    },
  );

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      runFetchUsdcToken();
    }
  }, [runFetchUsdcToken, visible]);

  if (!account) {
    return null;
  }

  return (
    <>
      <AppBottomSheetModal
        ref={modalRef}
        // snapPoints={snapPoints}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        onDismiss={onClose}
        // enableDynamicSizing
        snapPoints={[376]}
        maxDynamicContentSize={maxHeight}>
        <AutoLockView style={[styles.container]}>
          <View>
            <Text style={styles.title}>
              {t('page.perps.PerpsDepositPopup.title')}
            </Text>
          </View>
          <View style={styles.formItem}>
            <View style={styles.formItemLabelRow}>
              <Text style={styles.formItemLabel}>
                {t('page.perps.PerpsDepositPopup.amount')}
              </Text>
              <Text style={styles.formItemDesc}>
                {t('page.perps.PerpsDepositPopup.balance')}:{' '}
                {arbUsdc
                  ? formatUsdValue(
                      new BigNumber(arbUsdc.amount || 0)
                        .times(arbUsdc.price || 0)
                        .toString(),
                    )
                  : '$0'}
              </Text>
            </View>
            <View style={styles.inputContainer}>
              <BottomSheetTextInput
                keyboardType="numeric"
                style={styles.input}
                placeholder="$0"
                value={amount}
                onChangeText={setAmount}
              />
              <View style={styles.divider} />
              {arbUsdc ? (
                <TouchableOpacity
                  onPress={() => {
                    setIsShowTokenPopup(true);
                  }}>
                  <View style={styles.tokenContainer}>
                    <AssetAvatar
                      size={26}
                      chain={arbUsdc?.chain}
                      logo={arbUsdc?.logo_url}
                      chainSize={12}
                    />
                    <Text style={styles.tokenText}>
                      {getTokenSymbol(arbUsdc)}
                    </Text>

                    <RcIconSwapBottomArrow />
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <Button
            type="primary"
            title={t('page.perps.PerpsDepositPopup.depositBtn')}
            onPress={handleDeposit}
            loading={loading}
          />
        </AutoLockView>
      </AppBottomSheetModal>
      <PerpsSelectTokenPopup
        account={account}
        visible={isShowTokenPopup}
        onClose={() => {
          setIsShowTokenPopup(false);
        }}
      />
    </>
  );
};

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      height: '100%',
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      paddingBottom: 56,
      paddingHorizontal: 20,
      display: 'flex',
      flexDirection: 'column',
    },
    formItem: {
      flex: 1,
    },
    formItemLabelRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    formItemLabel: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    formItemDesc: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    inputContainer: {
      borderRadius: 16,
      paddingVertical: 28,
      paddingHorizontal: 20,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    input: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '700',
      // color: ctx.colors2024['neutral-body'],
      flex: 1,
    },
    inputError: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: ctx.colors2024['neutral-error'],
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderColor: ctx.colors2024['neutral-error'],
      borderWidth: 1,
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '800',
      color: ctx.colors2024['neutral-title-1'],
      marginBottom: 24,
      textAlign: 'center',
    },
    divider: {
      width: 1,
      height: 28,
      backgroundColor: ctx.colors2024['neutral-line'],
    },
    tokenContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      padding: 4,
      backgroundColor: ctx.colors2024['neutral-line'],
      borderRadius: 100,
    },
    tokenText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
  };
});
