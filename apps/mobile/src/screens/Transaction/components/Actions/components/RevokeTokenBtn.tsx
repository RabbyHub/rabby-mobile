import { Tip } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useRef } from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Button } from '@/components2024/Button';
import { approveToken } from '@/core/apis/approvals';
import { getERC20Allowance } from '@/core/apis/provider';
import { resetNavigationTo } from '@/hooks/navigation';
import { getTokenSymbol } from '@/utils/token';
import { ParsedActionData } from '@rabby-wallet/rabby-action';
import { useMemoizedFn, useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import {
  formatAmount,
  formatTokenAmount,
} from '@rabby-wallet/biz-utils/dist/isomorphic/biz-number';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { StyleProp } from 'react-native';

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
  const { switchSceneSigningAccount } = useSwitchSceneCurrentAccount();

  const { data: allowance } = useRequest(async () => {
    const res = await getERC20Allowance(
      token.chain,
      token.id,
      spender,
      account.address,
    );

    const amount = new BigNumber(res)
      .div(new BigNumber(10).pow(token.decimals))
      .toNumber();

    return amount;
  });

  const handleRevoke = useMemoizedFn(async () => {
    await switchSceneSigningAccount('MultiHistory', account);
    try {
      await approveToken(token.chain, token.id, spender, 0);
    } catch (error) {
      console.error(error);
    } finally {
      await switchSceneSigningAccount('MultiHistory', null);
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
        <Text style={styles.value}>
          {(allowance || 0) >= 1e9
            ? t('global.unlimited')
            : formatAmount(allowance || 0)}{' '}
          {getTokenSymbol(token)}
        </Text>
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
            // loading={btnLoading}
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
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
