import RcIconBolt from '@/assets2024/icons/perps/IconBolt.svg';
import { AssetAvatar } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  ARB_USDC_TOKEN_ID,
  ARB_USDC_TOKEN_SERVER_CHAIN,
  HYPE_USDC_TOKEN_ID,
  HYPE_USDC_TOKEN_SERVER_CHAIN,
} from '@/constant/perps';
import { useTheme2024 } from '@/hooks/theme';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import {
  ITokenItem,
  TokenEntityId,
  tokenEntityResourceStore,
  useTokenEntity,
} from '@/store/tokens';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import { NotMatchedHolder } from '@/screens/Approvals/components/Layout';
import { Text } from '@/components/Typography';

const isDirectDepositToken = (item: ITokenItem) => {
  return (
    (item.chain === ARB_USDC_TOKEN_SERVER_CHAIN &&
      isSameAddress(item.id, ARB_USDC_TOKEN_ID)) ||
    (item.chain === HYPE_USDC_TOKEN_SERVER_CHAIN &&
      isSameAddress(item.id, HYPE_USDC_TOKEN_ID))
  );
};

export type PerpsDepositTokenRow = {
  tokenId: TokenEntityId;
};

export const getPerpsDepositTokenFromRow = (row?: PerpsDepositTokenRow) => {
  if (!row) {
    return undefined;
  }
  return tokenEntityResourceStore.getValue(row.tokenId);
};

export const PerpsSelectTokenPopup: React.FC<{
  onClose?(): void;
  visible?: boolean;
  tokenRows: PerpsDepositTokenRow[];
  onSelect?(token: ITokenItem): Promise<void>;
}> = ({ onClose, visible, onSelect, tokenRows }) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const renderItem = useMemoizedFn(
    ({ item }: { item: PerpsDepositTokenRow }) => {
      return (
        <PerpsSelectTokenRow
          row={item}
          styles={styles}
          directDepositLabel={t(
            'page.perps.PerpsDepositTokenModal.directDepositFast',
          )}
          onSelect={onSelect}
        />
      );
    },
  );

  const modalRef = useRef<AppBottomSheetModal>(null);

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
        <View style={styles.subTitleRow}>
          <Text style={styles.subTitleText}>
            {t('page.perps.PerpsSelectTokenPopup.token')}
          </Text>
          <Text style={styles.subTitleText}>
            {t('page.perps.PerpsSelectTokenPopup.balance')}
          </Text>
        </View>
        <BottomSheetFlatList
          keyboardShouldPersistTaps="handled"
          data={tokenRows}
          style={styles.flatList}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          keyExtractor={item => item.tokenId}
          ListEmptyComponent={
            <NotMatchedHolder
              // eslint-disable-next-line react-native/no-inline-styles
              style={{
                height: 400,
              }}
              text={t('page.perps.PerpsSelectTokenPopup.noTokens')}
            />
          }
        />
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const PerpsSelectTokenRow = React.memo(
  ({
    row,
    styles,
    directDepositLabel,
    onSelect,
  }: {
    row: PerpsDepositTokenRow;
    styles: ReturnType<(typeof getStyle)['getStyles']>;
    directDepositLabel: string;
    onSelect?(token: ITokenItem): Promise<void>;
  }) => {
    const token = useTokenEntity(row.tokenId);
    const isDirect = useMemo(
      () => (token ? isDirectDepositToken(token) : false),
      [token],
    );

    if (!token) {
      return null;
    }

    return (
      <TouchableOpacity
        style={[styles.tokenListItem]}
        onPress={() => {
          onSelect?.(token);
        }}>
        <View style={styles.box}>
          <AssetAvatar
            size={46}
            chain={token.chain}
            logo={token.logo_url}
            chainSize={18}
          />
          <Text
            style={StyleSheet.flatten([
              {
                marginLeft: 8,
              },
              styles.text,
            ])}>
            {getTokenSymbol(token)}
          </Text>
          {isDirect ? (
            <View style={styles.depositTag}>
              <Text style={styles.depositTagText}>{directDepositLabel}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rightArea}>
          <Text style={styles.text}>
            {formatUsdValue(
              isDirect ? token.amount : token.amount * token.price || 0,
            )}
          </Text>
          <Text style={styles.amountText}>{formatAmount(token.amount)}</Text>
        </View>
      </TouchableOpacity>
    );
  },
);

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    paddingBottom: 20,
  },
  rightArea: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },

  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    marginBottom: 12,
    textAlign: 'center',
  },

  depositTag: {
    borderRadius: 4,
    backgroundColor: 'rgba(80, 210, 193, 0.12)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    flexDirection: 'row',
    marginLeft: 6,
  },
  depositTagText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
    color: '#50D2C1',
  },

  flatList: {
    flexShrink: 1,
    paddingHorizontal: 16,
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

  amountText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
  },

  subTitleText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
  },

  subTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: 8,
  },

  divider: {
    height: 8,
  },
}));
