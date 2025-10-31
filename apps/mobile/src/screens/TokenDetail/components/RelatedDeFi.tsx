/* eslint-disable react-native/no-inline-styles */
import { AppBottomSheetModal, AssetAvatar } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolio, AbstractProject } from '@/screens/Home/types';
import { formatTokenAmount } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { RcIconRightCC } from '@/assets/icons/common';
import BigNumber from 'bignumber.js';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View, Text } from 'react-native';
import { ellipsisOverflowedText } from '@/utils/text';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { RelatedDeFiType } from '..';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { ArrowCircleCC } from '@/assets2024/icons/address';

interface Props {
  deFiList: RelatedDeFiType[];
  handleGoDeFi: (
    data: AbstractProject,
    itemList: AbstractPortfolio[],
    symbol: string,
  ) => void;
  symbol: string;
}

interface PopupProps {
  deFiList: RelatedDeFiType[];
  handleGoDeFi: (
    data: AbstractProject,
    itemList: AbstractPortfolio[],
    symbol: string,
  ) => void;
  symbol: string;
  visible: boolean;
  onClose: () => void;
}

const DeFiListPopup = ({
  deFiList,
  handleGoDeFi,
  symbol,
  visible,
  onClose,
}: PopupProps) => {
  const bottomRef = useRef<BottomSheetModalMethods>(null);
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const renderItem = useCallback(
    ({ item, index }: { item: RelatedDeFiType; index: number }) => {
      return (
        <TouchableOpacity
          key={index}
          onPress={() => {
            onClose();
            handleGoDeFi(item, [...(item._portfolios || [])], symbol);
          }}>
          <View style={styles.defiItem}>
            <View style={styles.defiItemContent}>
              <AssetAvatar
                logo={item?.logo}
                size={46}
                chain={item?.chain}
                chainSize={16}
              />
              <View style={styles.content}>
                <Text
                  style={styles.defiItemText}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {/* {token?.name} */}
                  {ellipsisOverflowedText(item?.name, 20)}
                </Text>
                <Text style={styles.defiItemAmoutText}>{`${formatTokenAmount(
                  item?.amount,
                )} ${ellipsisOverflowedText(symbol, 10)}`}</Text>
              </View>
            </View>
            <View style={styles.defiItemContent}>
              <ArrowCircleCC
                style={styles.arrow}
                color={colors2024['neutral-body']}
                backgroundColor={colors2024['neutral-bg-2']}
              />
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [
      handleGoDeFi,
      styles.arrow,
      styles.content,
      styles.defiItemAmoutText,
      colors2024,
      onClose,
      styles.defiItem,
      styles.defiItemContent,
      styles.defiItemText,
      symbol,
    ],
  );

  useEffect(() => {
    if (visible) {
      bottomRef.current?.present();
    } else {
      bottomRef.current?.dismiss();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={bottomRef}
      snapPoints={['85%']}
      onDismiss={onClose}
      enableDismissOnClose
      {...makeBottomSheetProps({
        linearGradientType: 'tx-page',
        colors: colors2024,
      })}
      // enableContentPanningGesture={false}
      handleStyle={styles.bottomBg}
      backgroundStyle={styles.bottomBg}>
      <BottomSheetScrollView style={{ flex: 1 }}>
        <View style={styles.container}>
          <Text style={styles.popupRelateTitle}>
            {t('page.tokenDetail.Defi')}
          </Text>
          {Boolean(deFiList.length) &&
            deFiList.map((item, index) => renderItem({ item, index }))}
        </View>
        <View style={{ height: 120 }} />
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

export const RelatedDeFi: React.FC<Props> = ({
  deFiList,
  handleGoDeFi,
  symbol,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [popupVisible, setPopupVisible] = React.useState(false);

  const { t } = useTranslation();

  const renderItem = useCallback(
    ({ item, index }: { item: RelatedDeFiType; index: number }) => {
      return (
        <TouchableOpacity
          key={index}
          onPress={() =>
            handleGoDeFi(item, [...(item._portfolios || [])], symbol)
          }>
          <View style={styles.defiItem}>
            <View style={styles.defiItemContent}>
              <AssetAvatar
                logo={item?.logo}
                size={46}
                chain={item?.chain}
                chainSize={16}
              />
              <View style={styles.content}>
                <Text
                  style={styles.defiItemText}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {/* {token?.name} */}
                  {ellipsisOverflowedText(item?.name, 20)}
                </Text>
                <Text style={styles.defiItemAmoutText}>{`${formatTokenAmount(
                  item?.amount,
                )} ${ellipsisOverflowedText(symbol, 10)}`}</Text>
              </View>
            </View>
            <View style={styles.defiItemContent}>
              <ArrowCircleCC
                style={styles.arrow}
                color={colors2024['neutral-body']}
                backgroundColor={colors2024['neutral-bg-2']}
              />
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [
      handleGoDeFi,
      styles.defiItem,
      styles.defiItemContent,
      styles.defiItemText,
      styles.arrow,
      styles.content,
      styles.defiItemAmoutText,
      colors2024,
      symbol,
    ],
  );

  const handleOpenDeFiDetail = useCallback(() => {
    setPopupVisible(true);
  }, []);

  const hasMore = useMemo(() => deFiList?.length > 3, [deFiList]);

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.historyHeader}>
        <Text style={styles.relateTitle}>{t('page.tokenDetail.Defi')}</Text>
        {hasMore && (
          <TouchableOpacity
            style={styles.rightContent}
            onPress={handleOpenDeFiDetail}>
            <Text style={styles.headerContent}>
              {t('page.tokenDetail.SeeMore')}
            </Text>
            <RcIconRightCC
              style={styles.arrowStyle}
              width={12}
              height={12}
              color={colors2024['neutral-secondary']}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [
    hasMore,
    handleOpenDeFiDetail,
    styles.rightContent,
    styles.relateTitle,
    styles.headerContent,
    styles.historyHeader,
    styles.arrowStyle,
    colors2024,
    t,
  ]);

  const sortedList = useMemo(
    () =>
      deFiList?.sort((a, b) =>
        new BigNumber(b.amount).comparedTo(new BigNumber(a.amount)),
      ),
    [deFiList],
  );

  return (
    <>
      <View style={styles.container}>
        {ListHeaderComponent()}
        {Boolean(sortedList.length) &&
          sortedList
            .slice(0, 3)
            .map((item, index) => renderItem({ item, index }))}
      </View>
      <DeFiListPopup
        deFiList={sortedList}
        handleGoDeFi={handleGoDeFi}
        symbol={symbol}
        visible={popupVisible}
        onClose={() => {
          setPopupVisible(false);
        }}
      />
    </>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    width: '100%',
    paddingHorizontal: 15,
    marginTop: 20,
    gap: 8,
  },
  bottomBg: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    marginBottom: 4,
  },
  defiItem: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // paddingVertical: 6,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    // borderColor: ctx.colors2024['neutral-line'],
    // borderWidth: 1,
    padding: 16,
  },
  defiItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginBottom: 16,
    // paddingHorizontal: 20,
    gap: 8,
  },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: 30,
  },
  popupRelateTitle: {
    color: ctx.colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  relateTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
  },
  rightContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  historyHeader: {
    // marginVertical: 12,
    // paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    marginLeft: 4,
  },
  content: {
    // alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  defiItemAmoutText: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  defiItemText: {
    flexShrink: 1,
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    flexWrap: 'nowrap',
  },
  arrowStyle: {
    marginTop: 0,
  },

  body: {},
  balanceTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },

  itemCard: {
    marginTop: 12,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 16,
    borderColor: ctx.colors2024['neutral-line'],
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  tokenBox: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
  },
  actionBox: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: ctx.colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  tokenUsd: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
  },
  tokenAmount: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
}));
