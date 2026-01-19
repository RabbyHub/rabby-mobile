import React, { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Table, Col, Row } from './components/Table';
import LogoWithText from './components/LogoWithText';
import * as Values from './components/Values';
import ViewMore from './components/ViewMore';
import { ParsedActionData, SwapRequireData } from '@rabby-wallet/rabby-action';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { Chain } from '@/constant/chains';
import SecurityLevelTagNoText from '../SecurityEngine/SecurityLevelTagNoText';
import { SecurityListItem } from './components/SecurityListItem';
import { ProtocolListItem } from './components/ProtocolListItem';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import { useThemeColors } from '@/hooks/theme';
import { SubTable, SubCol, SubRow } from './components/SubTable';

const { isSameAddress } = addressUtils;

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

  const swapReceiveRef = React.useRef(null);
  const swapMinRef = React.useRef(null);
  const swapReceiverRef = React.useRef(null);
  const swapContractRef = React.useRef(null);

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
                    {formatAmount(payToken.amount)}{' '}
                  </Text>
                  <Values.TokenSymbol
                    token={payToken}
                    style={commonStyle.primaryText}
                  />
                </View>
              }
            />
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.swap.receiveToken')}
            </Text>
          </Row>
          <Row>
            <View>
              <LogoWithText
                logo={receiveToken.logo_url}
                text={
                  balanceChange.success && balanceChange.support ? (
                    <View className="flex flex-row">
                      <Text
                        ref={swapReceiveRef}
                        style={commonStyle.primaryText}>
                        {formatAmount(receiveToken.amount)}{' '}
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
          </Row>
        </Col>

        <SubTable target={swapReceiveRef}>
          {balanceChange.success && balanceChange.support && (
            <SecurityListItem
              title={t('page.signTx.swap.valueDiff')}
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
          )}
          {balanceChange.support && !balanceChange.success && (
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.subRowTitleText}>
                  {t('page.signTx.swap.valueDiff')}
                </Text>
              </SubRow>
              <SubRow>
                <Text style={commonStyle.subRowText}>
                  {t('page.signTx.swap.simulationFailed')}
                </Text>
              </SubRow>
            </SubCol>
          )}
          {!balanceChange.support && (
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.subRowTitleText}>
                  {t('page.signTx.swap.valueDiff')}
                </Text>
              </SubRow>
              <SubRow style={{ flex: 2 }}>
                <Text style={[commonStyle.subRowText, { textAlign: 'right' }]}>
                  {t('page.signTx.swap.simulationNotSupport')}
                </Text>
              </SubRow>
            </SubCol>
          )}
        </SubTable>

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
                  <Text ref={swapMinRef} style={commonStyle.primaryText}>
                    {formatAmount(minReceive.amount)}{' '}
                    <Values.TokenSymbol
                      token={minReceive}
                      style={commonStyle.primaryText}
                    />
                  </Text>
                }
              />
            </View>
          </Row>
        </Col>
        <SubTable target={swapMinRef}>
          {slippageTolerance === null && (
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.subRowTitleText}>
                  {t('page.signTx.swap.slippageTolerance')}
                </Text>
              </SubRow>
              <SubRow>
                <Text style={commonStyle.subRowText}>
                  {t('page.signTx.swap.slippageFailToLoad')}
                </Text>
              </SubRow>
            </SubCol>
          )}
          {slippageTolerance !== null && (
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.subRowTitleText}>
                  {t('page.signTx.swap.slippageTolerance')}
                </Text>
              </SubRow>
              <SubRow>
                {hasReceiver ? (
                  <Text>-</Text>
                ) : (
                  <Values.Percentage
                    style={commonStyle.subRowText}
                    value={slippageTolerance}
                  />
                )}

                {engineResultMap['1011'] && (
                  <SecurityLevelTagNoText
                    inSubTable
                    enable={engineResultMap['1011'].enable}
                    level={
                      currentTx.processedRules.includes('1011')
                        ? 'proceed'
                        : engineResultMap['1011'].level
                    }
                    onClick={() => handleClickRule('1011')}
                  />
                )}
              </SubRow>
            </SubCol>
          )}
        </SubTable>
        {hasReceiver && (
          <>
            <Col>
              <Row isTitle>
                <Text style={commonStyle.rowTitleText}>
                  {t('page.signTx.swap.receiver')}
                </Text>
              </Row>
              <Row>
                <View ref={swapReceiverRef}>
                  <Values.AddressWithCopy address={receiver} chain={chain} />
                </View>
              </Row>
            </Col>
            <SubTable target={swapReceiverRef}>
              <SecurityListItem
                engineResult={engineResultMap['1069']}
                id="1069"
                warningText={t('page.signTx.swap.unknownAddress')}
              />
              {!engineResultMap['1069'] && (
                <>
                  <SubCol>
                    <SubRow isTitle>
                      <Text style={commonStyle.rowTitleText}>
                        {t('page.signTx.address')}
                      </Text>
                    </SubRow>
                    <SubRow>
                      <Values.AccountAlias address={receiver} />
                    </SubRow>
                  </SubCol>
                  <SubCol>
                    <SubRow isTitle>
                      <Text style={commonStyle.rowTitleText}>
                        {t('page.addressDetail.source')}
                      </Text>
                    </SubRow>
                    <SubRow>
                      <Values.KnownAddress address={receiver} />
                    </SubRow>
                  </SubCol>
                </>
              )}
            </SubTable>
          </>
        )}
        <Col>
          <Row isTitle itemsCenter>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.interactContract')}
            </Text>
          </Row>
          <Row>
            <ViewMore
              type="contract"
              data={{
                bornAt: requireData.bornAt,
                protocol: requireData.protocol,
                rank: requireData.rank,
                address: requireData.id,
                hasInteraction: requireData.hasInteraction,
                chain,
              }}>
              <View ref={swapContractRef}>
                <Values.Address address={requireData.id} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={swapContractRef}>
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
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.hasInteraction')}
              </Text>
            </SubRow>
            <SubRow>
              <Values.Interacted value={requireData.hasInteraction} />
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

export default Swap;
