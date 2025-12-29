import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { View, Text, Dimensions, TouchableOpacity, Modal } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { AssetAvatar } from '@/components';
import { useLongPressTokenAtom } from '../hooks';
import { ellipsisOverflowedText } from '@/utils/text';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { ExternalTokenRow } from '@/screens/Home/components/AssetRenderItems';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { IS_ANDROID } from '@/core/native/utils';
import { formatAmount } from '@/utils/math';
import { formatUsdValue } from '@/utils/number';
import BigNumber from 'bignumber.js';
import { RootNames } from '@/constant/layout';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { navigateDeprecated } from '@/utils/navigation';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';

export const TokenInfoPopup = () => {
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;
  const { styles, isLight } = useTheme2024({ getStyle });
  const [longPressToken, setLongPressToken] = useLongPressTokenAtom();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const handleClose = () => {
    setLongPressToken({
      visible: false,
      tokenItem: null,
      position: { x: 0, y: 0, height: 0 },
      tokenEntity: null,
    });
  };

  const usdValueStr = useMemo(() => {
    if (
      !longPressToken.tokenEntity?.price ||
      !longPressToken.tokenItem?.amount
    ) {
      return '0';
    }
    const amount = longPressToken.tokenItem?.amount || 0;
    const amountBn = new BigNumber(amount);
    const priceBn = new BigNumber(longPressToken.tokenEntity?.price || 0);
    const usdValue = amountBn.times(priceBn).toNumber();
    return formatUsdValue(usdValue);
  }, [longPressToken.tokenEntity?.price, longPressToken.tokenItem?.amount]);

  return (
    <Modal
      transparent
      visible={longPressToken.visible}
      animationType="none"
      onDismiss={handleClose}>
      <View
        style={{
          width: windowWidth,
          height: windowHeight,
          ...styles.container,
        }}>
        {longPressToken.tokenItem && (
          <View
            style={{
              ...styles.tokenItemContainer,
              left: Math.floor(longPressToken.position.x),
              top: Math.floor(longPressToken.position.y),
            }}>
            <View style={styles.token}>
              <AssetAvatar
                size={26}
                chain={longPressToken.tokenItem.chain}
                logo={longPressToken.tokenItem.logo_url}
                chainSize={0}
              />
              <Text numberOfLines={1} style={styles.tokenSymbol}>
                {ellipsisOverflowedText(
                  getTokenSymbol(longPressToken.tokenItem),
                  5,
                )}
              </Text>
            </View>
            <RcIconSwapBottomArrow />
          </View>
        )}
        {longPressToken.tokenEntity && (
          <ExternalTokenRow
            data={
              {
                ...longPressToken.tokenEntity,
                _isPined: false,
                _isFold: false,
                _isExcludeBalance: false,
                _usdValueStr: usdValueStr,
                _amountStr: formatAmount(longPressToken.tokenItem?.amount),
                _tokenId: longPressToken.tokenEntity.id,
              } as unknown as AbstractPortfolioToken
            }
            style={{
              ...styles.renderItemWrapper,
              left: windowWidth > 360 ? Math.floor((windowWidth - 360) / 2) : 0,
              top: Math.floor(
                longPressToken.position.y + longPressToken.position.height + 13,
              ),
            }}
            onPressRightIcon={() => {
              if (longPressToken.tokenItem) {
                navigateDeprecated(RootNames.TokenDetail, {
                  token: tokenItemToITokenItem(longPressToken.tokenItem, ''),
                  account: currentAccount,
                  needUseCacheToken: true,
                });
                handleClose();
              }
            }}
            onTokenPress={() => {}}
            touchable={false}
            logoSize={40}
          />
        )}
        {IS_ANDROID ? (
          <TouchableOpacity
            onPress={handleClose}
            style={styles.overlay}
            activeOpacity={1}
          />
        ) : (
          <TouchableOpacity
            onPress={handleClose}
            style={styles.blurView}
            activeOpacity={1}>
            <BlurView
              blurType={isLight ? 'dark' : 'light'}
              blurAmount={10}
              reducedTransparencyFallbackColor="white"
              style={styles.blurView}
            />
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'absolute',
    zIndex: 10,
    elevation: 10,
  },
  tokenItemContainer: {
    position: 'absolute',
    zIndex: 3,
    elevation: 3,
    borderRadius: 12,
    // TODO: backgroundColor: colors2024['neutral-card-2'],
    backgroundColor: colors2024['neutral-line'],
    // backgroundColor: colors2024['neutral-bg-2'],

    // paddingLeft: 16,
    // paddingRight: 12,
    padding: 4,
    height: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  token: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  tokenSymbol: {
    lineHeight: 20,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  overlay: {
    position: 'absolute',
    zIndex: 2,
    elevation: 2,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  blurView: {
    position: 'absolute',
    zIndex: 2,
    elevation: 2,
    width: '100%',
    height: '100%',
  },
  renderItemWrapper: {
    position: 'absolute',
    zIndex: 3,
    elevation: 3,
    width: 360,
  },
}));
