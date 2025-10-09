import React, { useMemo, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
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
import { SubCol, SubRow, SubTable } from './components/SubTable';

const { isSameAddress } = addressUtils;

const Swap = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['crossToken'];
  requireData: SwapRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const { payToken, receiveToken, usdValueDiff, usdValuePercentage, receiver } =
    data!;
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

  const hasReceiver = useMemo(() => {
    return !isSameAddress(receiver, requireData.sender);
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
    openRuleDrawer({
      ruleConfig: rule,
      value: result?.value,
      level: result?.level,
      ignored: processedRules.includes(id),
    });
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crossTokenPayRef = React.useRef(null);
  const crossTokenReceiveRef = React.useRef(null);
  const crossTokenReceiverRef = React.useRef(null);
  const crossTokenAddressRef = React.useRef(null);

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
                <View style={commonStyle.rowFlexCenterItem}>
                  <Text ref={crossTokenPayRef} style={commonStyle.primaryText}>
                    {formatAmount(payToken.amount)}{' '}
                  </Text>
                  <Values.TokenSymbol token={payToken} />
                </View>
              }
              logoRadius={16}
            />
          </Row>
        </Col>
        <SubTable target={crossTokenPayRef}>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.subRowTitleText}>
                {t('page.signTx.chain')}
              </Text>
            </SubRow>
            <SubRow>
              <Values.DisplayChain
                chainServerId={payToken.chain}
                textStyle={commonStyle.subRowText}
              />
            </SubRow>
          </SubCol>
        </SubTable>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.swap.minReceive')}
            </Text>
          </Row>
          <Row>
            <LogoWithText
              logo={receiveToken.logo_url}
              logoRadius={16}
              text={
                <View style={commonStyle.rowFlexCenterItem}>
                  <Text
                    ref={crossTokenReceiveRef}
                    style={commonStyle.primaryText}>
                    {formatAmount(receiveToken.min_amount)}{' '}
                  </Text>
                  <Values.TokenSymbol token={receiveToken} />
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
            {engineResultMap['1097'] && (
              <SecurityLevelTagNoText
                enable={engineResultMap['1097'].enable}
                level={
                  processedRules.includes('1097')
                    ? 'proceed'
                    : engineResultMap['1097'].level
                }
                onClick={() => handleClickRule('1097')}
              />
            )}
            {engineResultMap['1098'] && (
              <SecurityLevelTagNoText
                enable={engineResultMap['1098'].enable}
                level={
                  processedRules.includes('1098')
                    ? 'proceed'
                    : engineResultMap['1098'].level
                }
                onClick={() => handleClickRule('1098')}
              />
            )}
          </Row>
        </Col>
        <SubTable target={crossTokenReceiveRef}>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.subRowTitleText}>
                {t('page.signTx.chain')}
              </Text>
            </SubRow>
            <SubRow>
              <Values.DisplayChain
                textStyle={commonStyle.subRowText}
                chainServerId={receiveToken.chain}
              />
            </SubRow>
          </SubCol>
          <SecurityListItem
            engineResult={engineResultMap['1105']}
            id="1105"
            dangerText={
              <>
                <Values.Percentage value={usdValuePercentage!} />
                <Text>({formatUsdValue(usdValueDiff || '')})</Text>
              </>
            }
            warningText={
              <>
                <Values.Percentage
                  style={commonStyle.subRowText}
                  value={usdValuePercentage!}
                />{' '}
                <Text style={commonStyle.subRowText}>
                  ({formatUsdValue(usdValueDiff || '')})
                </Text>
              </>
            }
            title={t('page.signTx.swap.valueDiff')}
          />
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
                <View ref={crossTokenReceiverRef}>
                  <Values.AddressWithCopy
                    style={commonStyle.subRowText}
                    address={receiver}
                    chain={chain}
                  />
                </View>
              </Row>
            </Col>
            <SubTable target={crossTokenReceiverRef}>
              <SecurityListItem
                engineResult={engineResultMap['1103']}
                id="1103"
                dangerText={t('page.signTx.swap.unknownAddress')}
              />
              {!engineResultMap['1103'] && (
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
              <View ref={crossTokenAddressRef}>
                <Values.Address
                  style={commonStyle.subRowText}
                  address={requireData.id}
                  chain={chain}
                />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={crossTokenAddressRef}>
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

export default Swap;
