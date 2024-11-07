import React, { useMemo, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { useTranslation } from 'react-i18next';
import { Table, Col, Row } from './components/Table';
import LogoWithText from './components/LogoWithText';
import * as Values from './components/Values';
import {
  ParsedActionData,
  WrapTokenRequireData,
} from '@rabby-wallet/rabby-action';
import { formatAmount } from '@/utils/number';
import { Chain } from '@/constant/chains';
import SecurityLevelTagNoText from '../SecurityEngine/SecurityLevelTagNoText';
import ViewMore from './components/ViewMore';
import { SecurityListItem } from './components/SecurityListItem';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubTable, SubCol, SubRow } from './components/SubTable';
import { ProtocolListItem } from './components/ProtocolListItem';

const { isSameAddress } = addressUtils;

const UnWrapToken = ({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unwrapTokenReceiverRef = React.useRef(null);
  const unwrapTokenAddressRef = React.useRef(null);

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
                <View className="flex flex-row">
                  <Text style={commonStyle.primaryText}>
                    {formatAmount(payToken.amount)}{' '}
                  </Text>
                  <Values.TokenSymbol token={payToken} />
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
            <LogoWithText
              logo={receiveToken.logo_url}
              text={
                <View className="flex flex-row">
                  <Text style={commonStyle.primaryText}>
                    {formatAmount(receiveToken.min_amount)}{' '}
                  </Text>
                  <Values.TokenSymbol token={receiveToken} />
                </View>
              }
              logoRadius={16}
            />
            {engineResultMap['1062'] && (
              <SecurityLevelTagNoText
                enable={engineResultMap['1062'].enable}
                level={
                  processedRules.includes('1062')
                    ? 'proceed'
                    : engineResultMap['1062'].level
                }
                onClick={() => handleClickRule('1062')}
              />
            )}
          </Row>
        </Col>
        {hasReceiver && (
          <>
            <Col>
              <Row isTitle>
                <Text style={commonStyle.rowTitleText}>
                  {t('page.signTx.swap.receiver')}
                </Text>
              </Row>
              <Row>
                <View ref={unwrapTokenReceiverRef}>
                  <Values.AddressWithCopy address={receiver} chain={chain} />
                </View>
              </Row>
            </Col>
            <SubTable target={unwrapTokenReceiverRef}>
              <SecurityListItem
                engineResult={engineResultMap['1093']}
                id="1093"
                warningText={t('page.signTx.swap.unknownAddress')}
              />
              {!engineResultMap['1093'] && (
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
              <View ref={unwrapTokenAddressRef}>
                <Values.Address address={requireData.id} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={unwrapTokenAddressRef}>
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

export default UnWrapToken;
