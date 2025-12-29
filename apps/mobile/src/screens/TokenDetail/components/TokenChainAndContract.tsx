import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import RcIconJumpCC from '@/assets2024/icons/history/IconJumpCC.svg';
import HelpIconCC from '@/assets2024/icons/common/help-cc.svg';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { ellipsisAddress } from '@/utils/address';
import { findChain } from '@/utils/chain';
import { openTxExternalUrl } from '@/utils/transaction';
import { useTranslation } from 'react-i18next';
import { TokenEntityDetail } from '@rabby-wallet/rabby-api/dist/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { ellipsisOverflowedText } from '@/utils/text';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import RcIconCopy from '@/assets2024/icons/tokenDetail/copy.svg';

import { useMemoizedFn } from 'ahooks';
import Clipboard from '@react-native-clipboard/clipboard';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { ITokenItem } from '@/store/tokens';
interface Props {
  token: ITokenItem;
  tokenEntity?: TokenEntityDetail;
}

export const TokenChainAndContract: React.FC<Props> = ({
  token,
  tokenEntity,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const { isContractToken, tokenAddress, chainItem } = React.useMemo(() => {
    const item = findChain({ serverId: token.chain });
    /* for AbstractPortfolioToken,
          id of native token is `{chain.symbol}{chain.symbol}`,
          id of non-native token is `{token_address}{chain.symbol}  */
    // const isContractToken = /^0x.{40}/.test(token.id) && token.id.endsWith(token.chain);
    const _isContractToken =
      /^0x.{40}/.test(token.id) && token.id?.includes(token.id);
    return {
      chainItem: item,
      isContractToken: _isContractToken,
      nativeTokenChainName: !_isContractToken && item ? item.name : '',
      tokenAddress: !_isContractToken
        ? item?.nativeTokenAddress || ''
        : token.id,
    };
  }, [token]);

  const handleCopyAddress = useMemoizedFn<
    React.ComponentProps<typeof TouchableOpacity>['onPress'] & object
  >(evt => {
    evt.stopPropagation();
    if (!token?.id) {
      return;
    }
    Clipboard.setString(token.id);
    toastCopyAddressSuccess(token.id);
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('page.tokenDetail.Info')}</Text>
      </View>
      <View style={styles.itemCard}>
        <View style={styles.itemContainer}>
          <Text style={styles.titleTexet}>
            {t('page.tokenDetail.TokenName')}
          </Text>
          <View style={styles.token}>
            <Text
              style={[styles.contentText]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {ellipsisOverflowedText(token.name || '', 25)}
            </Text>
          </View>
        </View>
        <View style={styles.itemContainer}>
          <Text style={styles.titleTexet}>{t('page.sendToken.Chain')}</Text>
          <View style={styles.token}>
            <ChainIconImage
              size={16}
              chainServerId={token.chain}
              isShowRPCStatus={true}
            />
            <Text
              style={[styles.contentText]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {chainItem?.name}
            </Text>
          </View>
        </View>
        {isContractToken && (
          <View style={styles.itemContainer}>
            <View style={styles.titleContainer}>
              <Text style={styles.titleTexet}>
                {t('page.sendToken.ContractAddress')}
              </Text>
              <TouchableOpacity
                style={styles.iconJump}
                onPress={() => {
                  openTxExternalUrl({
                    chain: chainItem,
                    address: tokenAddress,
                  });
                }}>
                <RcIconJumpCC
                  style={styles.icon}
                  color={colors2024['neutral-foot']}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={handleCopyAddress}
              style={[styles.token, styles.bgContainer]}>
              <Text
                style={styles.contentText}
                numberOfLines={1}
                ellipsizeMode="tail">
                {ellipsisAddress(tokenAddress)}
              </Text>
              <View>
                <RcIconCopy
                  style={styles.icon}
                  color={colors2024['neutral-foot']}
                />
              </View>
            </TouchableOpacity>
          </View>
        )}
        {
          <View style={styles.itemContainer}>
            <View style={styles.helpContent}>
              <Text style={styles.titleTexet}>{t('page.tokenDetail.fdv')}</Text>
              <TouchableOpacity
                onPress={() => {
                  const modalId = createGlobalBottomSheetModal2024({
                    name: MODAL_NAMES.DESCRIPTION,
                    title: t('page.tokenDetail.fdvTitle'),
                    bottomSheetModalProps: {
                      enableContentPanningGesture: true,
                      enablePanDownToClose: true,
                      snapPoints: [400],
                    },
                    sections: [
                      {
                        description: t('page.tokenDetail.fdvContent'),
                      },
                    ],
                    nextButtonProps: {
                      title: (
                        <Text style={styles.modalNextButtonText}>
                          {t('page.newAddress.whatIsSeedPhrase.GotIt')}
                        </Text>
                      ),
                      titleStyle: StyleSheet.flatten([
                        styles.modalNextButtonText,
                      ]),
                      onPress: () => {
                        removeGlobalBottomSheetModal2024(modalId);
                      },
                    },
                  });
                }}>
                <HelpIconCC
                  width={20}
                  height={20}
                  color={colors2024['neutral-info']}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.token}>
              <Text
                style={[styles.contentText]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {tokenEntity?.fdv ? formatUsdValueKMB(tokenEntity?.fdv) : '-'}
              </Text>
            </View>
          </View>
        }
      </View>
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    // marginLeft: 0,
    marginHorizontal: 20,
    marginTop: 12,
    gap: 12,
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    // width: '100%',
  },
  modalNextButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    color: colors2024['neutral-InvertHighlight'],
  },
  itemCard: {
    // marginTop: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    // borderColor: ctx.colors2024['neutral-line'],
    // borderWidth: 1,
    paddingHorizontal: 16,
    // paddingVertical: 12,
    // gap: 12,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },

  headerTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },

  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    // marginBottom: 4,
  },
  helpContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemContainer: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  token: {
    // display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tokenSymbol: {
    flexShrink: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    flexWrap: 'nowrap',
  },
  contract: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,

    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  titleTexet: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  contentText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  icon: {
    width: 14,
    height: 14,
  },
  iconJump: {
    // marginLeft: 6,
  },
  bgContainer: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
}));
