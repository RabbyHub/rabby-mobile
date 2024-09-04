import React, { useEffect, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  SwapTokenOrderRequireData,
  ParsedTypedDataActionData,
} from '@rabby-wallet/rabby-action';
import { Table, Col, Row } from '../Actions/components/Table';
import LogoWithText from '../Actions/components/LogoWithText';
import * as Values from '../Actions/components/Values';
import ViewMore from '../Actions/components/ViewMore';
import { SecurityListItem } from '../Actions/components/SecurityListItem';
import { ProtocolListItem } from '../Actions/components/ProtocolListItem';
import SecurityLevelTagNoText from '../SecurityEngine/SecurityLevelTagNoText';
import { Chain } from '@/constant/chains';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { addressUtils } from '@rabby-wallet/base-utils';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { StyleSheet, Text, View } from 'react-native';
import DescItem from '../Actions/components/DescItem';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubTable, SubCol, SubRow } from '../Actions/components/SubTable';
const { isSameAddress } = addressUtils;

const SwapTokenOrder = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedTypedDataActionData['swapTokenOrder'];
  requireData: SwapTokenOrderRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const {
    payToken,
    receiveToken,
    usdValueDiff,
    usdValuePercentage,
    receiver,
    expireAt,
  } = data!;
  const { t } = useTranslation();
  const {
    rules,
    currentTx: { processedRules },
    userData: { contractWhitelist },
    ...apiApprovalSecurityEngine
  } = useApprovalSecurityEngine();
  const commonStyle = useCommonStyle();

  const isInWhitelist = useMemo(() => {
    return contractWhitelist.some(
      item =>
        item.chainId === chain.serverId &&
        isSameAddress(item.address ?? '', requireData.id ?? ''),
    );
  }, [contractWhitelist, requireData, chain]);

  const hasReceiver = useMemo(() => {
    return !isSameAddress(receiver ?? '', requireData.sender ?? '');
  }, [requireData, receiver]);

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  const handleClickRule = (id: string) => {
    const rule = rules.find(item => item.id === id);
    if (!rule) return;
    const result = engineResultMap[id];
    apiApprovalSecurityEngine.openRuleDrawer({
      ruleConfig: rule,
      value: result?.value,
      level: result?.level,
      ignored: processedRules.includes(id),
    });
  };

  useEffect(() => {
    apiApprovalSecurityEngine.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swapTokenOrderReceiverRef = React.useRef(null);
  const swapTokenOrderAddressRef = React.useRef(null);
  const swapTokenOrderReceiveRef = React.useRef(null);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.swap.payToken')}
            </Text>
          </Row>
          <Row>
            <LogoWithText
              logo={payToken.logo_url}
              text={
                <View
                  style={StyleSheet.flatten({
                    flexDirection: 'row',
                    gap: 4,
                  })}>
                  <Values.TokenAmount
                    value={payToken.amount}
                    style={commonStyle.primaryText}
                  />
                  <Values.TokenSymbol
                    token={payToken}
                    style={commonStyle.primaryText}
                  />
                </View>
              }
              textStyle={commonStyle.primaryText}
            />
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.swap.minReceive')}
            </Text>
          </Row>
          <Row>
            <View>
              <LogoWithText
                logo={receiveToken.logo_url}
                text={
                  <View
                    style={StyleSheet.flatten({
                      flexDirection: 'row',
                      gap: 4,
                    })}>
                    <Values.TokenAmount
                      value={receiveToken.amount}
                      style={commonStyle.primaryText}
                    />
                    <Values.TokenSymbol
                      token={receiveToken}
                      style={commonStyle.primaryText}
                    />
                  </View>
                }
                icon={
                  <Values.TokenLabel
                    isFake={receiveToken.is_verified === false}
                    isScam={
                      receiveToken.is_verified !== false &&
                      !!receiveToken.is_suspicious
                    }
                  />
                }
              />
              {engineResultMap['1090'] && (
                <SecurityLevelTagNoText
                  enable={engineResultMap['1090'].enable}
                  level={
                    processedRules.includes('1090')
                      ? 'proceed'
                      : engineResultMap['1090'].level
                  }
                  onClick={() => handleClickRule('1090')}
                />
              )}
              {engineResultMap['1091'] && (
                <SecurityLevelTagNoText
                  enable={engineResultMap['1091'].enable}
                  level={
                    processedRules.includes('1091')
                      ? 'proceed'
                      : engineResultMap['1091'].level
                  }
                  onClick={() => handleClickRule('1091')}
                />
              )}
            </View>
          </Row>
        </Col>
        <SubTable target={swapTokenOrderReceiveRef}>
          <SecurityListItem
            engineResult={engineResultMap['1095']}
            id="1095"
            dangerText={
              <Text style={commonStyle.subRowText}>
                <Values.Percentage value={usdValuePercentage!} /> (
                {formatUsdValue(usdValueDiff || '')})
              </Text>
            }
            warningText={
              <Text style={commonStyle.subRowText}>
                <Values.Percentage value={usdValuePercentage!} /> (
                {formatUsdValue(usdValueDiff || '')})
              </Text>
            }
            title={t('page.signTx.swap.valueDiff')}
          />
        </SubTable>
        {expireAt && (
          <Col>
            <Row isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTypedData.buyNFT.expireTime')}
              </Text>
            </Row>
            <Row>
              <Values.TimeSpanFuture
                to={expireAt}
                style={commonStyle.primaryText}
              />
            </Row>
          </Col>
        )}
        {hasReceiver && (
          <>
            <Col>
              <Row isTitle>
                <Text style={commonStyle.rowTitleText}>
                  {t('page.signTx.swap.receiver')}
                </Text>
              </Row>
              <Row>
                <View ref={swapTokenOrderReceiverRef}>
                  <Values.AddressWithCopy address={receiver} chain={chain} />
                </View>
              </Row>
            </Col>
            <SubTable target={swapTokenOrderReceiverRef}>
              <SecurityListItem
                id="1094"
                engineResult={engineResultMap['1094']}
                dangerText={t('page.signTx.swap.notPaymentAddress')}
              />
            </SubTable>
          </>
        )}
        <Col>
          <Row isTitle itemsCenter>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTypedData.buyNFT.listOn')}
            </Text>
          </Row>
          <Row>
            <View ref={swapTokenOrderAddressRef}>
              <ViewMore
                type="contract"
                data={{
                  ...requireData,
                  address: requireData.id,
                  chain,
                  title: t('page.signTypedData.buyNFT.listOn'),
                }}>
                <Values.Address address={requireData.id} chain={chain} />
              </ViewMore>
            </View>
          </Row>
        </Col>
        <SubTable target={swapTokenOrderAddressRef}>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.subRowTitleText}>
                {t('page.signTx.protocol')}
              </Text>
            </SubRow>
            <SubRow>
              <ProtocolListItem
                style={commonStyle.subRowText}
                protocol={requireData.protocol}
              />
            </SubRow>
          </SubCol>

          {isInWhitelist && (
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.subRowTitleText}>
                  {t('page.signTx.myMark')}
                </Text>
              </SubRow>
              <SubRow>
                <Text style={commonStyle.subRowText}>
                  {t('page.signTx.trusted')}
                </Text>
              </SubRow>
            </SubCol>
          )}

          <SecurityListItem
            id="1135"
            engineResult={engineResultMap['1135']}
            forbiddenText={t('page.signTx.markAsBlock')}
            title={t('page.signTx.myMark')}
          />

          <SecurityListItem
            id="1137"
            engineResult={engineResultMap['1137']}
            warningText={t('page.signTx.markAsBlock')}
            title={t('page.signTx.myMark')}
          />
        </SubTable>
      </Table>
    </View>
  );
};

export default SwapTokenOrder;
