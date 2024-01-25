import React, { useEffect, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { SwapTokenOrderRequireData, TypedDataActionData } from './utils';
import { Table, Col, Row } from '../Actions/components/Table';
import LogoWithText from '../Actions/components/LogoWithText';
import * as Values from '../Actions/components/Values';
import ViewMore from '../Actions/components/ViewMore';
import { SecurityListItem } from '../Actions/components/SecurityListItem';
import { ProtocolListItem } from '../Actions/components/ProtocolListItem';
import SecurityLevelTagNoText from '../SecurityEngine/SecurityLevelTagNoText';
import { Chain } from '@debank/common';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { addressUtils } from '@rabby-wallet/base-utils';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { Text, View } from 'react-native';
import DescItem from '../Actions/components/DescItem';
import useCommonStyle from '../../hooks/useCommonStyle';
const { isSameAddress } = addressUtils;

const SwapTokenOrder = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: TypedDataActionData['swapTokenOrder'];
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
  }, []);

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
                  style={{
                    ...commonStyle.rowFlexCenterItem,
                    flex: 1,
                  }}>
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
              logoRadius={16}
              textStyle={{
                flex: 1,
              }}
            />
            <View className="desc-list">
              <DescItem>
                <Text>
                  ≈
                  {formatUsdValue(
                    new BigNumber(payToken.amount)
                      .times(payToken.price)
                      .toFixed(),
                  )}
                </Text>
              </DescItem>
            </View>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.swap.minReceive')}
            </Text>
          </Row>
          <Row>
            <View className="flex relative pr-10 flex-row">
              <LogoWithText
                logo={receiveToken.logo_url}
                logoRadius={16}
                text={
                  <View
                    style={{
                      ...commonStyle.rowFlexCenterItem,
                      flex: 1,
                    }}>
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
            <View className="relative">
              <DescItem>
                <Text style={commonStyle.secondaryText}>
                  ≈
                  {formatUsdValue(
                    new BigNumber(receiveToken.amount)
                      .times(receiveToken.price)
                      .toFixed(),
                  )}
                </Text>
              </DescItem>
              <View className="relative">
                <SecurityListItem
                  engineResult={engineResultMap['1095']}
                  id="1095"
                  dangerText={
                    <View
                      style={{
                        ...commonStyle.rowFlexCenterItem,
                        flexWrap: 'wrap',
                      }}>
                      <Text style={commonStyle.secondaryText}>
                        {t('page.signTx.swap.valueDiff')}{' '}
                      </Text>
                      <Values.Percentage
                        value={usdValuePercentage!}
                        style={commonStyle.secondaryText}
                      />
                      <Text style={commonStyle.secondaryText}>
                        {' '}
                        ({formatUsdValue(usdValueDiff || '')})
                      </Text>
                    </View>
                  }
                  warningText={
                    <View
                      style={{
                        ...commonStyle.rowFlexCenterItem,
                        flexWrap: 'wrap',
                      }}>
                      <Text style={commonStyle.secondaryText}>
                        {t('page.signTx.swap.valueDiff')}{' '}
                      </Text>
                      <Values.Percentage
                        value={usdValuePercentage!}
                        style={commonStyle.secondaryText}
                      />
                      <Text style={commonStyle.secondaryText}>
                        {' '}
                        ({formatUsdValue(usdValueDiff || '')})
                      </Text>
                    </View>
                  }
                />
              </View>
            </View>
          </Row>
        </Col>
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
          <Col>
            <Row isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.swap.receiver')}
              </Text>
            </Row>
            <Row>
              <Values.Address address={receiver} chain={chain} />
              <View>
                <SecurityListItem
                  engineResult={engineResultMap['1094']}
                  id="1094"
                  warningText={t('page.signTx.swap.unknownAddress')}
                />
                {!engineResultMap['1094'] && (
                  <View>
                    <DescItem>
                      <Values.AccountAlias address={receiver} />
                    </DescItem>
                    <DescItem>
                      <Values.KnownAddress
                        address={receiver}
                        textStyle={commonStyle.secondaryText}
                      />
                    </DescItem>
                  </View>
                )}
              </View>
            </Row>
          </Col>
        )}
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTypedData.buyNFT.listOn')}
            </Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={requireData.id} chain={chain} />
            </View>
            <View className="desc-list">
              {requireData.protocol && (
                <DescItem>
                  <ProtocolListItem
                    protocol={requireData.protocol}
                    style={commonStyle.secondaryText}
                  />
                </DescItem>
              )}
              <DescItem>
                <Values.Interacted
                  value={requireData.hasInteraction}
                  textStyle={commonStyle.secondaryText}
                />
              </DescItem>

              {isInWhitelist && (
                <DescItem>
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.markAsTrust')}
                  </Text>
                </DescItem>
              )}

              <SecurityListItem
                id="1135"
                engineResult={engineResultMap['1135']}
                forbiddenText={t('page.signTx.markAsBlock')}
              />

              <SecurityListItem
                id="1137"
                engineResult={engineResultMap['1137']}
                warningText={t('page.signTx.markAsBlock')}
              />
              <DescItem>
                <ViewMore
                  type="contract"
                  data={{
                    hasInteraction: requireData.hasInteraction,
                    bornAt: requireData.bornAt,
                    protocol: requireData.protocol,
                    rank: requireData.rank,
                    address: requireData.id,
                    chain,
                    title: t('page.signTypedData.buyNFT.listOn'),
                  }}
                />
              </DescItem>
            </View>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default SwapTokenOrder;
