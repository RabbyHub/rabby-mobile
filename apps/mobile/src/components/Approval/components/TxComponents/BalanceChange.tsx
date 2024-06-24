import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';
import { CHAINS_ENUM } from '@/constant/chains';
import {
  BalanceChange as IBalanceChange,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { formatAmount } from '@/utils/number';
import useBalanceChange from '../..//hooks/useBalanceChange';
import { Table, Col, Row } from '../Actions/components/Table';
import LogoWithText from '../Actions/components/LogoWithText';
import * as Values from '../Actions/components/Values';
import RcIconAlert from '@/assets/icons/sign/tx/alert-currentcolor.svg';
import { formatNumber, formatUsdValue } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import useCommonStyle from '../../hooks/useCommonStyle';
import { useTokenDetailSheetModalOnApprovals } from '@/components/TokenDetailPopup/hooks';
import NoBalanceSVG from '@/assets/icons/sign/no-balance-cc.svg';
import NFTDefaultSVG from '@/assets/nft-default.svg';

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    tokenBalanceChange: {
      marginTop: 16,
      paddingHorizontal: 16,
    },
    titleText: {
      fontSize: 14,
      color: colors['neutral-title-1'],
      fontWeight: '500',
    },
    usdValueDiff: {
      flex: 1,
      color: colors['neutral-title-1'],
      textAlign: 'right',
      fontSize: 14,
    },
    iconAlert: {
      width: 16,
      marginTop: 2,
      marginRight: 4,
      color: colors['orange-default'],
      position: 'relative',
    },
    headline: {
      fontSize: 14,
      lineHeight: 16,
      fontWeight: '500',
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      color: colors['neutral-title-1'],
    },
    nftIcon: {
      marginRight: 8,
      width: 24,
      height: 24,
      borderRadius: 2,
    },
  });

const NFTBalanceChange = ({
  data,
  type,
}: {
  data: IBalanceChange;
  type: 'receive' | 'send';
}) => {
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  const colors = useThemeColors();
  const styles = getStyle(colors);
  const { hasReceives, receiveNftList, hasTransferedOut, sendNftList } =
    React.useMemo(() => {
      const sendNftList = data.send_nft_list.slice(0);
      const countSendNft = sendNftList.reduce(
        (accu, item) => accu + (item.amount || 0),
        0,
      );
      const hasTransferedOut = sendNftList.length > 0;

      const receiveNftList = data.receive_nft_list.slice(0);
      const countReceives = receiveNftList.reduce(
        (accu, item) => accu + (item.amount || 0),
        0,
      );
      const hasReceives = receiveNftList.length > 0;

      return {
        hasReceives,
        countReceives,
        receiveNftList,
        hasTransferedOut,
        countSendNft,
        sendNftList,
      };
    }, [data]);

  if (type === 'receive' && hasReceives) {
    return (
      <Col>
        <View
          style={StyleSheet.flatten({
            flex: 1,
            overflow: 'hidden',
            gap: 10,
          })}>
          {receiveNftList.map(item => (
            <Row isTitle key={`${item.id}-${item.inner_id}`}>
              <View style={commonStyle.rowFlexCenterItem}>
                <View style={commonStyle.rowFlexCenterItem}>
                  <NFTDefaultSVG style={styles.nftIcon} />
                  <Text
                    style={{
                      ...commonStyle.primaryText,
                      color: colors['green-default'],
                    }}>
                    + {item.amount}{' '}
                  </Text>
                  <Text
                    style={{
                      ...commonStyle.primaryText,
                      color: colors['green-default'],
                    }}>
                    {item.collection ? item.collection.name : item.name}
                  </Text>
                </View>
                <Values.TokenLabel
                  isFake={item.collection?.is_verified === false}
                  isScam={
                    item.collection?.is_verified !== false &&
                    !!item.collection?.is_suspicious
                  }
                />
              </View>
            </Row>
          ))}
        </View>
      </Col>
    );
  }
  if (type === 'send' && hasTransferedOut) {
    return (
      <Col>
        <View
          style={StyleSheet.flatten({
            flex: 1,
            overflow: 'hidden',
            gap: 10,
          })}>
          {sendNftList.map(item => (
            <Row isTitle key={`${item.id}-${item.inner_id}`}>
              <View style={commonStyle.rowFlexCenterItem}>
                <View style={commonStyle.rowFlexCenterItem}>
                  <NFTDefaultSVG style={styles.nftIcon} />
                  <Text
                    style={{
                      ...commonStyle.primaryText,
                      color: colors['red-default'],
                    }}>
                    - {item.amount}{' '}
                  </Text>
                  <Text
                    style={{
                      ...commonStyle.primaryText,
                      color: colors['red-default'],
                    }}>
                    {item.collection ? item.collection.name : item.name}
                  </Text>
                </View>
                <Values.TokenLabel
                  isFake={item.collection?.is_verified === false}
                  isScam={
                    item.collection?.is_verified !== false &&
                    !!item.collection?.is_suspicious
                  }
                />
              </View>
            </Row>
          ))}
        </View>
      </Col>
    );
  }
  return null;
};

const BalanceChange = ({
  data,
  version,
}: {
  data: IBalanceChange;
  isSupport?: boolean;
  isGnosis?: boolean;
  chainEnum?: CHAINS_ENUM;
  version: 'v0' | 'v1' | 'v2';
}) => {
  const { t } = useTranslation();
  const isSuccess = data.success;
  const colors = useThemeColors();
  const styles = getStyle(colors);
  const commonStyle = useCommonStyle();

  const { hasTokenChange, hasNFTChange } = useBalanceChange({
    balance_change: data,
  });

  const hasChange = hasNFTChange || hasTokenChange;

  const { receiveTokenList, sendTokenList, showUsdValueDiff } =
    React.useMemo(() => {
      const receiveTokenList = data.receive_token_list;
      const sendTokenList = data.send_token_list;
      const showUsdValueDiff =
        data.receive_nft_list.length <= 0 &&
        data.send_nft_list.length <= 0 &&
        (data.send_token_list.length > 0 || data.receive_token_list.length > 0);
      return {
        receiveTokenList,
        sendTokenList,
        showUsdValueDiff,
      };
    }, [data]);

  const { openTokenDetailPopup } = useTokenDetailSheetModalOnApprovals();
  const handleClickToken = useCallback(
    (t: TokenItem) => {
      openTokenDetailPopup(t);
    },
    [openTokenDetailPopup],
  );

  if (version === 'v0') {
    return (
      <View
        style={StyleSheet.flatten([
          styles.tokenBalanceChange,
          {
            marginTop: 10,
            paddingBottom: 10,
          },
        ])}>
        <Text style={styles.headline}>
          {t('page.signTx.balanceChange.notSupport')}
        </Text>
      </View>
    );
  }

  if (version === 'v1' && data.error) {
    return (
      <View style={styles.tokenBalanceChange}>
        <Text style={styles.headline}>
          {isSuccess
            ? t('page.signTx.balanceChange.successTitle')
            : t('page.signTx.balanceChange.failedTitle')}
        </Text>

        <Table>
          <Col
            style={StyleSheet.flatten({
              paddingVertical: 10,
            })}>
            <Row isTitle>
              <Text
                style={StyleSheet.flatten({
                  fontSize: 14,
                  color: colors['neutral-title-1'],
                  fontWeight: '500',
                })}>
                {t('page.signTx.balanceChange.errorTitle')}
              </Text>
            </Row>
          </Col>
        </Table>
      </View>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <View style={styles.tokenBalanceChange}>
      <View
        style={StyleSheet.flatten([
          commonStyle.rowFlexCenterItem,
          {
            marginBottom: 8,
          },
        ])}>
        <Text style={styles.titleText}>
          {t('page.signTx.balanceChange.successTitle')}
        </Text>
        {showUsdValueDiff && (
          <Text style={styles.usdValueDiff}>
            {`${data.usd_value_change >= 0 ? '+' : '-'} $${formatNumber(
              Math.abs(data.usd_value_change),
            )}`}
          </Text>
        )}
      </View>
      <View>
        <Table>
          {!hasChange && isSuccess && (
            <Col
              style={StyleSheet.flatten({
                paddingVertical: 10,
              })}>
              <Row
                isTitle
                style={StyleSheet.flatten({
                  gap: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                })}>
                <NoBalanceSVG color={colors['neutral-body']} />
                <Text style={styles.titleText}>
                  {t('page.signTx.balanceChange.noBalanceChange')}
                </Text>
              </Row>
            </Col>
          )}
          {data.error && (
            <Col
              style={StyleSheet.flatten({
                paddingVertical: 10,
              })}>
              <Row
                isTitle
                style={StyleSheet.flatten({
                  ...commonStyle.rowFlexCenterItem,
                  width: '100%',
                  alignItems: 'flex-start',
                })}>
                <RcIconAlert style={styles.iconAlert} />
                <Text
                  style={StyleSheet.flatten({
                    fontSize: 14,
                    fontWeight: '500',
                    color: colors['neutral-title-1'],
                  })}>
                  <Text
                    style={StyleSheet.flatten({
                      color: colors['orange-default'],
                    })}>
                    {t('page.signTx.balanceChange.failedTitle')}
                  </Text>{' '}
                  ({data.error.msg} #{data.error.code})
                </Text>
              </Row>
            </Col>
          )}
          {sendTokenList?.map(token => (
            <Col
              style={StyleSheet.flatten({
                paddingVertical: 12,
                alignItems: 'center',
              })}
              key={token.id}>
              <Row isTitle>
                <LogoWithText
                  logoSize={24}
                  logo={token.logo_url}
                  text={
                    <View style={commonStyle.rowFlexCenterItem}>
                      <Text
                        style={StyleSheet.flatten({
                          ...commonStyle.primaryText,
                          color: colors['red-default'],
                          fontSize: 16,
                        })}>
                        - {formatAmount(token.amount)}{' '}
                      </Text>
                      <Text
                        onPress={() => handleClickToken(token)}
                        style={StyleSheet.flatten({
                          ...commonStyle.primaryText,
                          color: colors['red-default'],
                          fontSize: 16,
                        })}>
                        {getTokenSymbol(token)}
                      </Text>
                    </View>
                  }
                  logoRadius={16}
                  icon={
                    <Values.TokenLabel
                      isFake={token.is_verified === false}
                      isScam={
                        token.is_verified !== false && !!token.is_suspicious
                      }
                    />
                  }
                />
              </Row>
              <Row>
                <Text
                  style={StyleSheet.flatten({
                    ...commonStyle.secondaryText,
                    fontSize: 14,
                  })}>
                  ≈{' '}
                  {formatUsdValue(
                    new BigNumber(token.amount).times(token.price).toFixed(),
                  )}
                </Text>
              </Row>
            </Col>
          ))}
          {receiveTokenList?.map(token => (
            <Col
              style={StyleSheet.flatten({
                paddingVertical: 12,
                alignItems: 'center',
              })}
              key={token.id}>
              <Row isTitle>
                <LogoWithText
                  logoSize={24}
                  logo={token.logo_url}
                  text={
                    <View style={commonStyle.rowFlexCenterItem}>
                      <Text
                        style={StyleSheet.flatten({
                          ...commonStyle.primaryText,
                          color: colors['green-default'],
                          fontSize: 16,
                        })}>
                        + {formatAmount(token.amount)}{' '}
                      </Text>
                      <Text
                        style={StyleSheet.flatten({
                          ...commonStyle.primaryText,
                          color: colors['green-default'],
                          fontSize: 16,
                        })}
                        onPress={() => handleClickToken(token)}>
                        {getTokenSymbol(token)}
                      </Text>
                    </View>
                  }
                  logoRadius={16}
                  icon={
                    <Values.TokenLabel
                      isFake={token.is_verified === false}
                      isScam={
                        token.is_verified !== false && !!token.is_suspicious
                      }
                    />
                  }
                />
              </Row>
              <Row>
                <Text
                  style={StyleSheet.flatten({
                    ...commonStyle.secondaryText,
                    fontSize: 14,
                  })}>
                  ≈{' '}
                  {formatUsdValue(
                    new BigNumber(token.amount).times(token.price).toFixed(),
                  )}
                </Text>
              </Row>
            </Col>
          ))}
          <NFTBalanceChange type="send" data={data} />
          <NFTBalanceChange type="receive" data={data} />
        </Table>
      </View>
    </View>
  );
};

export default BalanceChange;
