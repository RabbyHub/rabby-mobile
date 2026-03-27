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
import { ITokenItem } from '@/store/tokens';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useRef } from 'react';
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

export const PerpsSelectTokenPopup: React.FC<{
  onClose?(): void;
  visible?: boolean;
  tokens: ITokenItem[];
  onSelect?(token: ITokenItem): Promise<void>;
}> = ({ onClose, visible, onSelect, tokens }) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

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
          {isDirectDepositToken(item) ? (
            <View style={styles.depositTag}>
              <Text style={styles.depositTagText}>
                {t('page.perps.PerpsDepositTokenModal.directDepositFast')}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rightArea}>
          <Text style={styles.text}>
            {formatUsdValue(
              isDirectDepositToken(item)
                ? item.amount
                : item.amount * item.price || 0,
            )}
          </Text>
          <Text style={styles.amountText}>{formatAmount(item.amount)}</Text>
        </View>
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
          data={tokens}
          style={styles.flatList}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          keyExtractor={item => item.id + item.chain}
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
