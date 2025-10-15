import { Tip } from '@/components';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Button } from '@/components2024/Button';
import { approveToken } from '@/core/apis/approvals';
import { getERC20Allowance } from '@/core/apis/provider';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { resetNavigationTo } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { useMiniSigner } from '@/hooks/useSigner';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { formatAmount } from '@rabby-wallet/biz-utils/dist/isomorphic/biz-number';
import { TokenItem, Tx } from '@rabby-wallet/rabby-api/dist/types';
import { Skeleton } from '@rneui/themed';
import { useMemoizedFn, useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, Text, View, ViewStyle } from 'react-native';

interface Props {
  account: KeyringAccountWithAlias;
  token: TokenItem;
  spender: string;
  style?: StyleProp<ViewStyle>;
}

export const RevokeTokenBtn = ({ token, account, spender, style }: Props) => {
  const { t } = useTranslation();
  const { navigation } = useSafeSetNavigationOptions();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const {
    openUI,
    resetGasStore,
    close: closeMiniSign,
  } = useMiniSigner({
    account,
  });
  const { data: allowance, loading } = useRequest(async () => {
    const res = await getERC20Allowance(
      token.chain,
      token.id,
      spender,
      account.address,
      account,
    );

    const amount = new BigNumber(res)
      .div(new BigNumber(10).pow(token.decimals))
      .toNumber();

    return amount;
  });

  const handleRevokeDirectSign = useMemoizedFn(async () => {
    try {
      const data = await approveToken({
        chainServerId: token.chain,
        id: token.id,
        spender,
        amount: 0,
        account,
        isBuild: true,
      });
      const tx = data.params[0] as Tx;
      closeMiniSign();
      resetGasStore();
      const res = await openUI({
        txs: [tx],
      });
    } catch (error) {
      console.error(error);
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      resetNavigationTo(navigation, 'Home');
    }
  });

  const handleRevoke = useMemoizedFn(async () => {
    try {
      if (isAccountSupportMiniApproval(account.type)) {
        await handleRevokeDirectSign();
        return;
      }

      await approveToken({
        chainServerId: token.chain,
        id: token.id,
        spender,
        amount: 0,
        account,
      });
    } catch (error) {
      console.error(error);
    }

    resetNavigationTo(navigation, 'Home');
  });

  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <Text style={styles.label}>
          {t('page.transactions.detail.totalApprovedAmount')}
        </Text>
        {loading ? (
          <Skeleton width={80} height={16} />
        ) : (
          <Text style={styles.value}>
            {(allowance || 0) >= 1e9
              ? t('global.unlimited')
              : formatAmount(allowance || 0)}{' '}
            {getTokenSymbol(token)}
          </Text>
        )}
      </View>
      <View style={styles.buttonContainer}>
        <Tip
          placement="top"
          pressableProps={{
            onPress(ctx) {
              ctx.turnOn();
              if (timerRef.current) {
                clearTimeout(timerRef.current);
              }
              timerRef.current = setTimeout(() => {
                ctx.turnOff();
              }, 3000);
            },
          }}
          content={
            !allowance ? t('page.transactions.detail.NoApproveNeed') : undefined
          }>
          <Button
            loading={loading}
            disabled={!allowance}
            buttonStyle={[styles.ghostButton]}
            titleStyle={[
              styles.ghostTitle,
              !allowance && styles.ghostDisableButton,
            ]}
            onPress={handleRevoke}
            type={'primary'}
            title={t('page.transactions.detail.Revoke')}
          />
        </Tip>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    marginTop: 12,
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },

  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    marginRight: 'auto',
  },

  value: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },

  ghostButton: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-disable'],
  },
  ghostDisableButton: {
    color: colors2024['brand-disable'],
  },
  ghostTitle: {
    color: colors2024['brand-default'],
  },
  buttonContainer: {},
}));
