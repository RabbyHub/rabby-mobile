import React, { useMemo, useEffect } from 'react';
import { View, Text } from 'react-native';
import { BigNumber } from 'bignumber.js';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { useTranslation } from 'react-i18next';
import { Table, Col, Row } from './components/Table';
import LogoWithText from './components/LogoWithText';
import * as Values from './components/Values';
import ViewMore from './components/ViewMore';
import { ParsedActionData, SwapRequireData } from './utils';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { Chain } from '@debank/common';
import SecurityLevelTagNoText from '../SecurityEngine/SecurityLevelTagNoText';
import { SecurityListItem } from './components/SecurityListItem';
import { ProtocolListItem } from './components/ProtocolListItem';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import DescItem from './components/DescItem';

const { isSameAddress } = addressUtils;

const CrossSwapToken = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['crossSwapToken'];
  requireData: SwapRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const { payToken, receiveToken, usdValueDiff, usdValuePercentage, receiver } =
    data!;
  const { t } = useTranslation();
  const { rules, userData, currentTx, openRuleDrawer, init } =
    useApprovalSecurityEngine();
  const { processedRules } = currentTx;
  const { contractWhitelist } = userData;
  const commonStyle = useCommonStyle();

  const isInWhitelist = useMemo(() => {
    return contractWhitelist.some(
      item =>
        item.chainId === chain.serverId &&
        isSameAddress(item.address, requireData.id),
    );
  }, [contractWhitelist, requireData, chain]);

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  const hasReceiver = useMemo(() => {
    return !isSameAddress(receiver, requireData.sender);
  }, [requireData, receiver]);

  const handleClickRule = (id: string) => {
    const rule = rules.find(item => item.id === id);
    if (!rule) return;
    const result = engineResultMap[id];
    openRuleDrawer({
      ruleConfig: rule,
      value: result?.value,
      level: result?.level,
      ignored: processedRules.includes(id),
    });
  };

  useEffect(() => {
    init();
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
                <>
                  <Text>{formatAmount(payToken.amount)} </Text>
                  <Values.TokenSymbol token={payToken} />
                </>
              }
              logoRadius={16}
            />
            <View>
              <DescItem>
                <Text style={commonStyle.secondaryText}>
                  ≈
                  {formatUsdValue(
                    new BigNumber(payToken.amount)
                      .times(payToken.price)
                      .toFixed(),
                  )}
                </Text>
              </DescItem>
              <DescItem>
                <Values.DisplayChain
                  chainServerId={payToken.chain}
                  textStyle={commonStyle.secondaryText}
                />
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
            <View className="flex flex-row relative pr-[10]">
              <LogoWithText
                logo={receiveToken.logo_url}
                logoRadius={16}
                text={
                  <>
                    <Text style={commonStyle.primaryText}>
                      {formatAmount(receiveToken.min_amount)}{' '}
                    </Text>
                    <Values.TokenSymbol
                      token={receiveToken}
                      style={commonStyle.primaryText}
                    />
                  </>
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
              {engineResultMap['1107'] && (
                <SecurityLevelTagNoText
                  enable={engineResultMap['1107'].enable}
                  level={
                    processedRules.includes('1107')
                      ? 'proceed'
                      : engineResultMap['1107'].level
                  }
                  onClick={() => handleClickRule('1107')}
                />
              )}
              {engineResultMap['1108'] && (
                <SecurityLevelTagNoText
                  enable={engineResultMap['1108'].enable}
                  level={
                    processedRules.includes('1108')
                      ? 'proceed'
                      : engineResultMap['1108'].level
                  }
                  onClick={() => handleClickRule('1108')}
                />
              )}
            </View>
            <View>
              <DescItem>
                <Text style={commonStyle.secondaryText}>
                  ≈
                  {formatUsdValue(
                    new BigNumber(receiveToken.min_amount)
                      .times(receiveToken.price)
                      .toFixed(),
                  )}
                </Text>
              </DescItem>
              <DescItem>
                <Values.DisplayChain
                  chainServerId={receiveToken.chain}
                  textStyle={commonStyle.secondaryText}
                />
              </DescItem>
              <SecurityListItem
                engineResult={engineResultMap['1104']}
                id="1104"
                dangerText={
                  <>
                    <Text style={commonStyle.secondaryText}>
                      {t('page.signTx.swap.valueDiff')}{' '}
                    </Text>
                    <Values.Percentage
                      value={usdValuePercentage!}
                      style={commonStyle.secondaryText}
                    />
                    <Text style={commonStyle.secondaryText}>
                      ({formatUsdValue(usdValueDiff || '')})
                    </Text>
                  </>
                }
                warningText={
                  <>
                    <Text style={commonStyle.secondaryText}>
                      {t('page.signTx.swap.valueDiff')}{' '}
                    </Text>
                    <Values.Percentage
                      value={usdValuePercentage!}
                      style={commonStyle.secondaryText}
                    />{' '}
                    <Text style={commonStyle.secondaryText}>
                      ({formatUsdValue(usdValueDiff || '')})
                    </Text>
                  </>
                }
              />
            </View>
          </Row>
        </Col>
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
                  engineResult={engineResultMap['1096']}
                  id="1096"
                  warningText={t('page.signTx.swap.unknownAddress')}
                />
                {!engineResultMap['1096'] && (
                  <>
                    <DescItem>
                      <Values.AccountAlias address={receiver} />
                    </DescItem>
                    <DescItem>
                      <Values.KnownAddress address={receiver} />
                    </DescItem>
                  </>
                )}
              </View>
            </Row>
          </Col>
        )}
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.interactContract')}
            </Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={requireData.id} chain={chain} />
            </View>
            <View>
              <DescItem>
                <ProtocolListItem
                  protocol={requireData.protocol}
                  style={commonStyle.secondaryText}
                />
              </DescItem>
              <DescItem>
                <Values.Interacted
                  value={requireData.hasInteraction}
                  textStyle={commonStyle.secondaryText}
                />
              </DescItem>

              {isInWhitelist && (
                <DescItem>{t('page.signTx.markAsTrust')}</DescItem>
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

export default CrossSwapToken;
