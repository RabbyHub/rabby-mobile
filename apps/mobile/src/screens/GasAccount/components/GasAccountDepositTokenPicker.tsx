import ImgEmpty from '@/assets2024/images/gasAccount/empty.png';
import ImgEmptyDark from '@/assets2024/images/gasAccount/empty-dark.png';
import { AssetAvatar } from '@/components';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useTheme2024 } from '@/hooks/theme';
import { GasAccountAvailableToken } from '@/screens/GasAccount/hooks/useDepositTokenAvailability';
import { ellipsisAddress } from '@/utils/address';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import { Skeleton } from '@rneui/themed';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Keyboard, View, useWindowDimensions } from 'react-native';
export const GasAccountDepositTokenPicker: React.FC<{
  visible?: boolean;
  onClose?(): void;
  onSelect?(token: GasAccountAvailableToken): void;
  availableTokens: GasAccountAvailableToken[];
  isCheckingAvailability?: boolean;
}> = ({
  visible,
  onClose,
  onSelect,
  availableTokens,
  isCheckingAvailability = false,
}) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyles,
  });
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { height } = useWindowDimensions();

  useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
      return;
    }
    Keyboard.dismiss();
    modalRef.current?.present();
  }, [visible]);

  const handleSelect = useCallback(
    (token: GasAccountAvailableToken) => {
      onSelect?.(token);
      onClose?.();
    },
    [onClose, onSelect],
  );

  const renderItem = useCallback(
    ({ item }: { item: GasAccountAvailableToken }) => {
      return (
        <CustomTouchableOpacity
          style={styles.tokenCard}
          onPress={() => handleSelect(item)}>
          <View style={styles.tokenCardLeft}>
            <AssetAvatar
              size={46}
              logo={item.logo_url}
              chain={item.chain}
              chainSize={18}
            />
            <View style={styles.tokenInfo}>
              <View style={styles.tokenInfoHeading}>
                <Text style={styles.tokenSymbol}>{getTokenSymbol(item)}</Text>
              </View>
              <View style={styles.tokenInfoSubTitle}>
                <WalletIcon
                  address={item.owner_addr}
                  width={14}
                  height={14}
                  borderRadius={7}
                />
                <Text style={styles.addressText}>
                  {ellipsisAddress(item.owner_addr)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.tokenCardRight}>
            <Text style={styles.balanceUsd}>
              {formatUsdValue(item.usd_value || 0)}
            </Text>
            <Text style={styles.balanceAmount}>
              {formatTokenAmount(item.amount || 0)}
            </Text>
          </View>
        </CustomTouchableOpacity>
      );
    },
    [
      handleSelect,
      styles.addressText,
      styles.balanceAmount,
      styles.balanceUsd,
      styles.tokenCard,
      styles.tokenCardLeft,
      styles.tokenCardRight,
      styles.tokenInfo,
      styles.tokenInfoHeading,
      styles.tokenInfoSubTitle,
      styles.tokenSymbol,
    ],
  );

  const loadingList = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, index) => (
        <View key={index} style={styles.tokenCard}>
          <View style={styles.tokenCardLeft}>
            <Skeleton circle width={46} height={46} />
            <View style={styles.skeletonInfo}>
              <Skeleton width={60} height={16} />
              <Skeleton width={110} height={14} />
            </View>
          </View>
          <View style={styles.skeletonRight}>
            <Skeleton width={88} height={16} />
            <Skeleton width={60} height={14} />
          </View>
        </View>
      )),
    [
      styles.skeletonInfo,
      styles.skeletonRight,
      styles.tokenCard,
      styles.tokenCardLeft,
    ],
  );

  return (
    <AppBottomSheetModal
      ref={modalRef}
      // snapPoints={}
      enableDynamicSizing
      maxDynamicContentSize={height - 200}
      onDismiss={onClose}
      enableDismissOnClose
      {...makeBottomSheetProps({
        linearGradientType: isLight ? 'bg0' : 'bg1',
        colors: colors2024,
      })}>
      <BottomSheetView style={styles.container}>
        <Text style={styles.title}>
          {t('page.gasAccount.depositPopup.selectToken')}
        </Text>
        {isCheckingAvailability ? (
          <View style={styles.loadingWrapper}>{loadingList}</View>
        ) : availableTokens.length ? (
          <>
            <View style={styles.header}>
              <Text style={styles.headerText}>
                {t('page.gasAccount.depositPopup.suggestedToken')}
              </Text>
              <Text style={styles.headerText}>
                {t('page.gasTopUp.Balance')}
              </Text>
            </View>
            <BottomSheetFlatList
              data={availableTokens}
              keyExtractor={item =>
                `${item.owner_addr.toLowerCase()}-${item.chain}-${item.id}`
              }
              contentContainerStyle={styles.listContent}
              renderItem={renderItem}
            />
          </>
        ) : (
          <View style={styles.emptyWrapper}>
            <Image
              source={isLight ? ImgEmpty : ImgEmptyDark}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyText}>
              {t('page.gasAccount.depositPopup.noAvailableToken', {
                defaultValue: 'No available token',
              })}
            </Text>
          </View>
        )}
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    paddingTop: 18,
    paddingBottom: 36,
  },
  title: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 22,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 36,
    gap: 10,
  },
  tokenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  tokenCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tokenInfo: {
    marginLeft: 8,
    flex: 1,
    gap: 4,
  },
  tokenInfoHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenInfoSubTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tokenCardRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
    gap: 4,
  },
  tokenSymbol: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  balanceUsd: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  addressText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  balanceAmount: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 88,
  },
  emptyImage: {
    width: 163,
    height: 126,
  },
  emptyText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 24,
    textAlign: 'center',
  },
  loadingWrapper: {
    paddingHorizontal: 16,
    gap: 10,
  },
  skeletonInfo: {
    marginLeft: 8,
    gap: 8,
  },
  skeletonRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
}));
