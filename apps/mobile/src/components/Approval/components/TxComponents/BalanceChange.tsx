import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';
import { CHAINS_ENUM } from '@debank/common';
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
import DescItem from '../Actions/components/DescItem';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    tokenBalanceChange: {
      marginTop: 14,
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
      padding: 15,
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
        <Row isTitle>{t('page.signTx.nftIn')}</Row>
        <View className="flex-1 overflow-hidden">
          {receiveNftList.map((item, index) => (
            <Row
              hasBottomBorder
              key={`${item.id}-${item.inner_id}`}
              style={
                index === receiveNftList.length - 1
                  ? {
                      borderBottomWidth: 0,
                    }
                  : {}
              }>
              <View className="flex flex-row">
                <View className="flex-1">
                  <Text className="text-r-green-default">+ {item.amount}</Text>
                  <Text>
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
        <Row isTitle>{t('page.signTx.balanceChange.nftOut')}</Row>
        <View className="flex-1 overflow-hidden">
          {sendNftList.map((item, index) => (
            <Row
              hasBottomBorder
              key={`${item.id}-${item.inner_id}`}
              style={
                index === sendNftList.length - 1
                  ? {
                      borderBottomWidth: 0,
                    }
                  : {}
              }>
              <View className="flex">
                <View className="flex-1">
                  <Text className="text-r-red-default">- {item.amount}</Text>
                  <Text>
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

  const handleClickToken = (t: TokenItem) => {
    // TODO
    // dispatch.sign.openTokenDetailPopup(t);
  };

  if (version === 'v0') {
    return (
      <View style={styles.tokenBalanceChange}>
        <View>
          <Table>
            <Col>
              <Row>
                <Text className="text-[15px] text-r-neutral-title-1 font-medium">
                  {t('page.signTx.balanceChange.notSupport')}
                </Text>
              </Row>
            </Col>
          </Table>
        </View>
      </View>
    );
  }

  if (version === 'v1' && data.error) {
    return (
      <View style={styles.tokenBalanceChange}>
        <View>
          <Table>
            <Col>
              <Row>
                <Text className="text-[15px] text-r-neutral-title-1 font-medium">
                  {isSuccess
                    ? t('page.signTx.balanceChange.successTitle')
                    : t('page.signTx.balanceChange.failedTitle')}
                </Text>
              </Row>
            </Col>
            <Col>
              <Row>
                <Text className="text-r-neutral-title-1 font-medium">
                  {t('page.signTx.balanceChange.errorTitle')}
                </Text>
              </Row>
            </Col>
          </Table>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.tokenBalanceChange}>
      <View className="mb-[12] flex flex-row items-center">
        <Text className="text-[16px] font-medium text-r-neutral-title-1">
          {isSuccess
            ? t('page.signTx.balanceChange.successTitle')
            : t('page.signTx.balanceChange.failedTitle')}
        </Text>
        {showUsdValueDiff && (
          <Text className="flex-1 text-r-neutral-body text-right text-[13px]">
            {`${data.usd_value_change >= 0 ? '+' : '-'} $${formatNumber(
              Math.abs(data.usd_value_change),
            )}`}
          </Text>
        )}
      </View>
      <View>
        <Table>
          {!hasChange && isSuccess && (
            <Col>
              <Row>
                <Text className="text-[15px] font-medium text-r-neutral-title-1">
                  {t('page.signTx.balanceChange.noBalanceChange')}
                </Text>
              </Row>
            </Col>
          )}
          {data.error && (
            <Col>
              <Row>
                <View className="flex flex-row">
                  <RcIconAlert className="w-[15px] mr-[6] text-r-neutral-body top-[2px] relative" />
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
          {sendTokenList && sendTokenList.length > 0 && (
            <Col>
              <Row isTitle>
                <Text>{t('page.signTx.balanceChange.tokenOut')}</Text>
              </Row>
              <View className="flex-1 overflow-hidden">
                {sendTokenList.map((token, index) => (
                  <Row
                    hasBottomBorder
                    key={token.id}
                    style={
                      index === sendTokenList.length - 1
                        ? {
                            borderBottomWidth: 0,
                          }
                        : {}
                    }>
                    <LogoWithText
                      logo={token.logo_url}
                      text={
                        <>
                          <Text className="text-r-red-default">
                            - {formatAmount(token.amount)}
                          </Text>
                          <Text onPress={() => handleClickToken(token)}>
                            {getTokenSymbol(token)}
                          </Text>
                        </>
                      }
                      key={token.id}
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

                    <DescItem>
                      <Text>
                        ≈{' '}
                        {formatUsdValue(
                          new BigNumber(token.amount)
                            .times(token.price)
                            .toFixed(),
                        )}
                      </Text>
                    </DescItem>
                  </Row>
                ))}
              </View>
            </Col>
          )}
          {receiveTokenList && receiveTokenList.length > 0 && (
            <Col>
              <Row isTitle>
                <Text>{t('page.signTx.balanceChange.tokenIn')}</Text>
              </Row>
              <View className="flex-1 overflow-hidden">
                {receiveTokenList.map((token, index) => (
                  <Row
                    hasBottomBorder
                    key={token.id}
                    style={
                      index === receiveTokenList.length - 1
                        ? {
                            borderBottomWidth: 0,
                          }
                        : {}
                    }>
                    <LogoWithText
                      logo={token.logo_url}
                      text={
                        <>
                          <Text className="text-r-green-default">
                            + {formatAmount(token.amount)}
                          </Text>
                          <Text onPress={() => handleClickToken(token)}>
                            {getTokenSymbol(token)}
                          </Text>
                        </>
                      }
                      key={token.id}
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
                    <DescItem>
                      <Text>
                        ≈{' '}
                        {formatUsdValue(
                          new BigNumber(token.amount)
                            .times(token.price)
                            .toFixed(),
                        )}
                      </Text>
                    </DescItem>
                  </Row>
                ))}
              </View>
            </Col>
          )}
          <NFTBalanceChange type="send" data={data} />
          <NFTBalanceChange type="receive" data={data} />
        </Table>
      </View>
    </View>
  );
};

export default BalanceChange;
