import { AssetAvatar } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  ARB_USDC_TOKEN_ID,
  ARB_USDC_TOKEN_SERVER_CHAIN,
} from '@/constant/perps';
import { openapi } from '@/core/request';
import { Account } from '@/core/services/preference';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import useTokenList, {
  EMPTY_TOKEN_LIST,
  getPerpsTokenSelectCacheKey,
  ITokenItem,
  useTokenListComputedStore,
} from '@/store/tokens';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useMemoizedFn, useRequest } from 'ahooks';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NotMatchedHolder } from '@/screens/Approvals/components/Layout';

export const PerpsSelectTokenPopup: React.FC<{
  onClose?(): void;
  visible?: boolean;
  account?: Account | null;
  onSelect?(token: ITokenItem): Promise<void>;
}> = ({ onClose, visible, account, onSelect }) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });
  const registerPerpsTokenSelect = useTokenListComputedStore(
    state => state.registerPerpsTokenSelect,
  );
  const perpsTokenKey = useMemo(() => {
    if (!account?.address) {
      return null;
    }
    return getPerpsTokenSelectCacheKey(account.address);
  }, [account?.address]);
  useEffect(() => {
    if (!account?.address) {
      return;
    }
    registerPerpsTokenSelect(account.address);
  }, [account?.address, registerPerpsTokenSelect]);

  const _tokens = useTokenListComputedStore(state => {
    if (!perpsTokenKey) {
      return EMPTY_TOKEN_LIST;
    }
    return state.perpsTokenSelectCache[perpsTokenKey] || EMPTY_TOKEN_LIST;
  });

  const { data: arbUsdc, runAsync: runFetchUsdcToken } = useRequest(
    async () => {
      if (!account?.address) {
        return;
      }

      const arbUsdcToken = await openapi.getToken(
        account?.address,
        ARB_USDC_TOKEN_SERVER_CHAIN,
        ARB_USDC_TOKEN_ID,
      );
      return tokenItemToITokenItem(arbUsdcToken, '');
    },
    {
      refreshDeps: [account?.address],
      manual: true,
    },
  );

  const tokens = useMemo(() => {
    return !arbUsdc
      ? _tokens
      : [
          arbUsdc,
          ...(_tokens?.filter(
            item =>
              !(
                item.chain === ARB_USDC_TOKEN_SERVER_CHAIN &&
                isSameAddress(item.id, ARB_USDC_TOKEN_ID)
              ) && item.is_core,
          ) || []),
        ];
  }, [_tokens, arbUsdc]);

  useEffect(() => {
    if (visible) {
      if (account) {
        useTokenList.getState().getTokenList(account.address, true);
      }
      runFetchUsdcToken();
    }
  }, [runFetchUsdcToken, visible, account]);

  const renderItem = useMemoizedFn(({ item }: { item: ITokenItem }) => {
    return (
      <TouchableOpacity
        style={[styles.tokenListItem]}
        onPress={() => {
          onSelect?.(item);
        }}>
        <View style={styles.box}>
          <AssetAvatar
            size={46}
            chain={item.chain}
            logo={item.logo_url}
            chainSize={18}
          />
          <Text
            style={StyleSheet.flatten([
              {
                marginLeft: 8,
              },
              styles.text,
            ])}>
            {getTokenSymbol(item)}
          </Text>
          {item.chain === ARB_USDC_TOKEN_SERVER_CHAIN &&
          item.id === ARB_USDC_TOKEN_ID ? (
            <View style={styles.depositTag}>
              <Text style={styles.depositTagText}>
                {t('page.perps.PerpsDepositTokenModal.directTag')}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.text}>
          {formatUsdValue(item.amount * item.price || 0)}
        </Text>
      </TouchableOpacity>
    );
  });

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <>
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: isLight ? 'bg0' : 'bg1',
        })}
        onDismiss={onClose}
        snapPoints={[Dimensions.get('window').height - 200]}>
        <AutoLockView style={styles.container}>
          <Text style={styles.title}>
            {t('page.perps.PerpsSelectTokenPopup.title')}
          </Text>
          <BottomSheetFlatList
            keyboardShouldPersistTaps="handled"
            data={tokens}
            style={styles.flatList}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            keyExtractor={item => item.id + item.chain}
            ListEmptyComponent={
              <NotMatchedHolder
                style={{
                  height: 400,
                }}
                text="No tokens"
              />
            }
          />
        </AutoLockView>
      </AppBottomSheetModal>
    </>
  );
};

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  container: {
    width: '100%',
    // flex: 1
    height: '100%',
    position: 'relative',
    paddingBottom: 20,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    marginBottom: 24,
    textAlign: 'center',
  },

  depositTag: {
    borderRadius: 4,
    backgroundColor: colors2024['brand-light-1'],
    paddingHorizontal: 4,
    paddingVertical: 1,

    marginLeft: 6,
  },
  depositTagText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
  },

  flatList: {
    flexShrink: 1,
    paddingHorizontal: 20,
  },
  tokenListItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    flex: 1,
    width: '100%',
    height: 74,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    borderRadius: 16,
  },

  box: { flexDirection: 'row', alignItems: 'center' },
  text: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },

  divider: {
    height: 8,
  },
}));
