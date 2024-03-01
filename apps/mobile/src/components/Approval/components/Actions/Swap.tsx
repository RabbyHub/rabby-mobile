import React, { useMemo, useEffect } from 'react';
import { BigNumber } from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, Text } from 'react-native';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Table, Col, Row } from './components/Table';
import LogoWithText from './components/LogoWithText';
import * as Values from './components/Values';
import ViewMore from './components/ViewMore';
import { ParsedActionData, SwapRequireData } from './utils';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { Chain } from '@/constant/chains';
import SecurityLevelTagNoText from '../SecurityEngine/SecurityLevelTagNoText';
import { SecurityListItem } from './components/SecurityListItem';
import { ProtocolListItem } from './components/ProtocolListItem';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import DescItem from './components/DescItem';
import { useThemeColors } from '@/hooks/theme';

const { isSameAddress } = addressUtils;

const styles = StyleSheet.create({
  wrapper: {},
  header: {
    marginTop: 15,
  },
  iconEditAlias: {
    width: 13,
    height: 13,
    cursor: 'pointer',
  },
  iconScamToken: {
    marginLeft: 4,
    width: 13,
  },
  iconFakeToken: {
    marginLeft: 4,
    width: 13,
  },
});

const Swap = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['swap'];
  requireData: SwapRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const {
    payToken,
    receiveToken,
    slippageTolerance,
    usdValueDiff,
    usdValuePercentage,
    minReceive,
    receiver,
    balanceChange,
  } = data!;

  const { t } = useTranslation();

  const colors = useThemeColors();
  const commonStyle = useCommonStyle();

  const { currentTx, userData, rules, openRuleDrawer, init } =
    useApprovalSecurityEngine();

  const isInWhitelist = useMemo(() => {
    return userData.contractWhitelist.some(
      item =>
        item.chainId === chain.serverId &&
        isSameAddress(item.address, requireData.id),
    );
  }, [userData, requireData, chain]);

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
      ignored: currentTx.processedRules.includes(id),
    });
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                <View className="flex flex-row">
                  <Text style={commonStyle.primaryText}>
                    {formatAmount(payToken.amount)}
                  </Text>
                  <Values.TokenSymbol
                    token={payToken}
                    style={commonStyle.primaryText}
                  />
                </View>
              }
              logoRadius={16}
            />
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
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.swap.receiveToken')}
            </Text>
          </Row>
          <Row>
            <View className="flex relative pr-[10]">
              <LogoWithText
                logo={receiveToken.logo_url}
                logoRadius={16}
                text={
                  balanceChange.success && balanceChange.support ? (
                    <View className="flex flex-row">
                      <Text style={commonStyle.primaryText}>
                        {formatAmount(receiveToken.amount)}
                      </Text>
                      <Values.TokenSymbol
                        token={receiveToken}
                        style={commonStyle.primaryText}
                      />
                    </View>
                  ) : (
                    <Text style={commonStyle.primaryText}>
                      {t('page.signTx.swap.failLoadReceiveToken')}
                    </Text>
                  )
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
              {engineResultMap['1008'] && (
                <SecurityLevelTagNoText
                  enable={engineResultMap['1008'].enable}
                  level={
                    currentTx.processedRules.includes('1008')
                      ? 'proceed'
                      : engineResultMap['1008'].level
                  }
                  onClick={() => handleClickRule('1008')}
                />
              )}
              {engineResultMap['1009'] && (
                <SecurityLevelTagNoText
                  enable={engineResultMap['1009'].enable}
                  level={
                    currentTx.processedRules.includes('1009')
                      ? 'proceed'
                      : engineResultMap['1009'].level
                  }
                  onClick={() => handleClickRule('1009')}
                />
              )}
            </View>
            <View>
              {balanceChange.success && balanceChange.support && (
                <>
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
                  <SecurityListItem
                    engineResult={engineResultMap['1012']}
                    id="1012"
                    dangerText={
                      <Text style={commonStyle.secondaryText}>
                        {t('page.signTx.swap.valueDiff')}{' '}
                        <Values.Percentage value={usdValuePercentage!} /> (
                        {formatUsdValue(usdValueDiff || '')})
                      </Text>
                    }
                    warningText={
                      <Text style={commonStyle.secondaryText}>
                        {t('page.signTx.swap.valueDiff')}{' '}
                        <Values.Percentage value={usdValuePercentage!} /> (
                        {formatUsdValue(usdValueDiff || '')})
                      </Text>
                    }
                  />
                </>
              )}
              {balanceChange.support && !balanceChange.success && (
                <DescItem>
                  <Text>{t('page.signTx.swap.simulationFailed')}</Text>
                </DescItem>
              )}
              {!balanceChange.support && (
                <DescItem>
                  <Text>{t('page.signTx.swap.simulationNotSupport')}</Text>
                </DescItem>
              )}
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
            <View>
              <LogoWithText
                logo={minReceive.logo_url}
                logoRadius={16}
                text={
                  <Text style={commonStyle.primaryText}>
                    {formatAmount(minReceive.amount)}{' '}
                    <Values.TokenSymbol
                      token={minReceive}
                      style={commonStyle.primaryText}
                    />
                  </Text>
                }
              />
            </View>
            <View>
              <DescItem>
                <Text style={commonStyle.secondaryText}>
                  ≈
                  {formatUsdValue(
                    new BigNumber(minReceive.amount)
                      .times(minReceive.price)
                      .toFixed(),
                  )}
                </Text>
              </DescItem>
              <DescItem>
                {slippageTolerance === null && (
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.swap.slippageFailToLoad')}
                  </Text>
                )}
                {slippageTolerance !== null && (
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.swap.slippageTolerance')}{' '}
                    {hasReceiver ? (
                      '-'
                    ) : (
                      <Values.Percentage value={slippageTolerance} />
                    )}
                  </Text>
                )}
                {engineResultMap['1011'] && (
                  <SecurityLevelTagNoText
                    enable={engineResultMap['1011'].enable}
                    level={
                      currentTx.processedRules.includes('1011')
                        ? 'proceed'
                        : engineResultMap['1011'].level
                    }
                    onClick={() => handleClickRule('1011')}
                  />
                )}
              </DescItem>
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
                  engineResult={engineResultMap['1069']}
                  id="1069"
                  warningText={t('page.signTx.swap.unknownAddress')}
                />
                {!engineResultMap['1069'] && (
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
            <Values.Address address={requireData.id} chain={chain} />
            <View>
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
                forbiddenText={
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.markAsBlock')}
                  </Text>
                }
              />

              <SecurityListItem
                id="1137"
                engineResult={engineResultMap['1137']}
                warningText={
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.markAsBlock')}
                  </Text>
                }
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

export default Swap;
