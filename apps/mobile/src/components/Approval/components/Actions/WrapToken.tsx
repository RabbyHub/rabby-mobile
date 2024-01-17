import React, { useMemo, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { useTranslation } from 'react-i18next';
import { Table, Col, Row } from './components/Table';
import LogoWithText from './components/LogoWithText';
import * as Values from './components/Values';
import { ParsedActionData, WrapTokenRequireData } from './utils';
import { formatAmount } from '@/utils/number';
import { Chain } from '@debank/common';
import SecurityLevelTagNoText from '../SecurityEngine/SecurityLevelTagNoText';
import ViewMore from './components/ViewMore';
import { SecurityListItem } from './components/SecurityListItem';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import DescItem from './components/DescItem';

const { isSameAddress } = addressUtils;

const WrapToken = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['wrapToken'];
  requireData: WrapTokenRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const { payToken, receiveToken, receiver } = data!;
  const {
    rules,
    currentTx: { processedRules },
    userData: { contractWhitelist },
    openRuleDrawer,
    init,
  } = useApprovalSecurityEngine();
  const commonStyle = useCommonStyle();

  const { t } = useTranslation();

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

  const hasReceiver = useMemo(() => {
    return !isSameAddress(receiver, requireData.sender);
  }, [requireData, receiver]);

  useEffect(() => {
    init();
  }, []);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text>{t('page.signTx.swap.payToken')}</Text>
          </Row>
          <Row>
            <LogoWithText
              logo={payToken.logo_url}
              text={
                <>
                  <Text style={commonStyle.primaryText}>
                    {formatAmount(payToken.amount)}{' '}
                  </Text>
                  <Values.TokenSymbol token={payToken} />
                </>
              }
              logoRadius={16}
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
            <LogoWithText
              logo={receiveToken.logo_url}
              text={
                <>
                  <Text style={commonStyle.primaryText}>
                    {formatAmount(receiveToken.min_amount)}{' '}
                  </Text>
                  <Values.TokenSymbol token={receiveToken} />
                </>
              }
              logoRadius={16}
            />
            {engineResultMap['1061'] && (
              <SecurityLevelTagNoText
                enable={engineResultMap['1061'].enable}
                level={
                  processedRules.includes('1061')
                    ? 'proceed'
                    : engineResultMap['1061'].level
                }
                onClick={() => handleClickRule('1061')}
              />
            )}
          </Row>
        </Col>
        {hasReceiver && (
          <Col>
            <Row isTitle>{t('page.signTx.swap.receiver')}</Row>
            <Row>
              <Values.Address address={receiver} chain={chain} />
              <View>
                <SecurityListItem
                  engineResult={engineResultMap['1093']}
                  id="1093"
                  warningText={t('page.signTx.swap.unknownAddress')}
                />
                {!engineResultMap['1093'] && (
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
            <View className="desc-list">
              {requireData.protocol && (
                <DescItem>
                  <Values.Protocol
                    value={requireData.protocol}
                    textStyle={commonStyle.secondaryText}
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

export default WrapToken;
