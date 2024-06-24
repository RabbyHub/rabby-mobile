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
import NoBalanceSVG from '@/assets/icons/sign/no-balance.svg';

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    tokenBalanceChange: {
      marginTop: 14,
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
      width: 15,
      marginRight: 6,
      color: colors['neutral-body'],
      top: 2,
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
  const {
    hasReceives,
    receiveNftList,
    hasTransferedOut,
    sendNftList,
    hasSendToken,
    hasReceiveToken,
  } = React.useMemo(() => {
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
    const hasReceiveToken = data.receive_token_list.length > 0;
    const hasSendToken = data.send_token_list.length > 0;

    return {
      hasReceives,
      countReceives,
      receiveNftList,
      hasTransferedOut,
      countSendNft,
      sendNftList,
      hasReceiveToken,
      hasSendToken,
    };
  }, [data]);

  if (type === 'receive' && hasReceives) {
    return (
      <Col>
        <Row isTitle>
          <Text style={commonStyle.rowTitleText}>{t('page.signTx.nftIn')}</Text>
        </Row>
        <View className="flex-1 overflow-hidden">
          {receiveNftList.map((item, index) => (
            <Row key={`${item.id}-${item.inner_id}`}>
              <View style={commonStyle.rowFlexCenterItem}>
                <View style={commonStyle.rowFlexCenterItem}>
                  <Text
                    style={{
                      ...commonStyle.primaryText,
                      color: colors['green-default'],
                    }}>
                    + {item.amount}{' '}
                  </Text>
                  <Text style={commonStyle.primaryText}>
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
      <Col last first={!hasReceives && !hasSendToken && !hasReceiveToken}>
        <Row isTitle>
          <Text style={commonStyle.rowTitleText}>
            {t('page.signTx.balanceChange.nftOut')}
          </Text>
        </Row>
        <View style={{ flex: 1 }}>
          {sendNftList.map((item, index) => (
            <Row
              hasBottomBorder={index < sendNftList.length - 1}
              key={`${item.id}-${item.inner_id}`}>
              <View style={commonStyle.rowFlexCenterItem}>
                <View style={commonStyle.rowFlexCenterItem}>
                  <Text
                    style={{
                      ...commonStyle.primaryText,
                      color: colors['red-default'],
                    }}>
                    - {item.amount}{' '}
                  </Text>
                  <Text style={commonStyle.primaryText}>
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

  // TODO
  if (version === 'v1' && data.error) {
    return (
      <View style={styles.tokenBalanceChange}>
        <Row>
          <Text style={styles.titleText}>
            {isSuccess
              ? t('page.signTx.balanceChange.successTitle')
              : t('page.signTx.balanceChange.failedTitle')}
          </Text>
        </Row>

        <Row>
          <Text className="text-r-neutral-title-1 font-medium">
            {t('page.signTx.balanceChange.errorTitle')}
          </Text>
        </Row>
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
          {isSuccess
            ? t('page.signTx.balanceChange.successTitle')
            : t('page.signTx.balanceChange.failedTitle')}
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
              style={{
                borderBottomWidth: 0,
              }}>
              <Row>
                <Text style={styles.titleText}>
                  {t('page.signTx.balanceChange.noBalanceChange')}
                </Text>
              </Row>
            </Col>
          )}
          {data.error && (
            <Col
              style={{
                borderBottomWidth: 0,
              }}>
              <Row>
                <View style={commonStyle.rowFlexCenterItem}>
                  <RcIconAlert style={styles.iconAlert} />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '500',
                    }}>
                    {data.error.msg} #{data.error.code}
                  </Text>
                </View>
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
