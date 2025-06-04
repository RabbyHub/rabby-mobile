import { RcIconEmptyCC } from '@/assets/icons/gnosis';
import { apisSafe } from '@/core/apis/safe';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import type { BasicSafeInfo } from '@rabby-wallet/gnosis-sdk';
import { useRequest } from 'ahooks';
import { maxBy, sortBy, uniqBy } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeNonceOptionListItem } from './SafeNonceOptionListItem';
import { SafeNoncePendingOptionContent } from './SafeNoncePendingOptionContent';
import { Account } from '@/core/services/preference';

interface OptionListProps {
  chainId: number;
  value?: number;
  onChange?(value: number): void;
  safeInfo?: BasicSafeInfo | null;
  account: Account;
}

export const SafeNonceOptionList = ({
  chainId,
  value,
  onChange,
  safeInfo,
  account,
}: OptionListProps) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const {
    data: pendingList,
    loading: isLoadingPendingList,
    refreshAsync,
    error,
  } = useRequest(
    async () => {
      if (!account?.address) {
        return;
      }
      return apisSafe.getGnosisPendingTxs(account?.address, chainId.toString());
    },
    {
      cacheKey: `gnosis-pending-txs-${account?.address}-${chainId}`,
    },
  );

  const pendingOptionlist = useMemo(() => {
    return sortBy(uniqBy(pendingList || [], 'nonce'), 'nonce');
  }, [pendingList]);

  const recommendNonce = useMemo(() => {
    const maxNonceTx = pendingList?.length
      ? maxBy(pendingList || [], item => +item.nonce)
      : null;
    return maxNonceTx != null ? +maxNonceTx.nonce + 1 : safeInfo?.nonce;
  }, [pendingList, safeInfo]);

  if (isLoadingPendingList && !pendingList) {
    return (
      <View style={[styles.loadingContent]}>
        <ActivityIndicator size="small" color={colors['neutral-foot']} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.alertError}>
        <RcIconEmptyCC color={colors['neutral-body']} width={32} height={32} />

        <Text style={styles.alertErrorMessage}>
          Fail to load pending transactions, {/* <TouchableOpacity> */}
          <Text
            style={styles.underline}
            onPress={() => {
              refreshAsync();
            }}>
            Retry
          </Text>
          {/* </TouchableOpacity> */}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.nonceSelectOptionList}>
      {recommendNonce != null ? (
        <View>
          <Text style={[styles.nonceSelectOptionGroupTitle]}>
            {t('page.signTx.SafeNonceSelector.optionGroup.recommendTitle')}
          </Text>
          <SafeNonceOptionListItem
            checked={+recommendNonce === value}
            onPress={() => {
              onChange?.(+recommendNonce);
            }}
            isHideDivider>
            <Text>
              {recommendNonce} - {t('page.signTx.SafeNonceSelector.option.new')}
            </Text>
          </SafeNonceOptionListItem>
        </View>
      ) : null}
      {pendingList?.length ? (
        <View>
          <Text style={styles.nonceSelectOptionGroupTitle}>
            {t('page.signTx.SafeNonceSelector.optionGroup.replaceTitle')}
          </Text>
          {pendingOptionlist?.map((item, index, list) => {
            return (
              <SafeNonceOptionListItem
                key={item.nonce}
                checked={+item.nonce === value}
                isHideDivider={index + 1 === list.length}
                onPress={() => {
                  onChange?.(+item.nonce);
                }}>
                <SafeNoncePendingOptionContent data={item} chainId={chainId} />
              </SafeNonceOptionListItem>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  nonceSelectOptionList: {
    borderRadius: 6,
    backgroundColor: colors['neutral-bg-3'],
    marginTop: 8,
  },
  nonceSelectOptionGroupTitle: {
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 12,
    color: colors['neutral-body'],
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
  },
  loadingContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  alertError: {
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 40,
    borderRadius: 6,
    backgroundColor: colors['neutral-bg-3'],
    marginTop: 8,
    gap: 12,
  },
  alertErrorMessage: {
    color: colors['neutral-body'],
    textAlign: 'center',
    fontSize: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  underline: {
    textDecorationLine: 'underline',
    color: colors['neutral-body'],
    textAlign: 'center',
    fontSize: 12,
  },
}));
