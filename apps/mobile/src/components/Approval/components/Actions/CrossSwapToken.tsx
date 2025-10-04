import React, { useMemo, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { useTranslation } from 'react-i18next';
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
import { SubTable, SubCol, SubRow } from './components/SubTable';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crossSwapTokenPayRef = React.useRef(null);
  const crossSwapTokenReceiveRef = React.useRef(null);
  const crossSwapTokenReceiverRef = React.useRef(null);
  const crossSwapTokenAddressRef = React.useRef(null);

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
            <View ref={crossSwapTokenPayRef}>
              <LogoWithText
                logo={payToken.logo_url}
                text={
                  <View style={commonStyle.rowFlexCenterItem}>
                    <Text style={commonStyle.primaryText}>
                      {formatAmount(payToken.amount)}{' '}
                    </Text>
                    <Values.TokenSymbol
                      token={payToken}
                      style={commonStyle.primaryText}
                    />
                  </View>
                }
                logoRadius={16}
              />
            </View>
          </Row>
        </Col>

        <SubTable target={crossSwapTokenPayRef}>
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
                    ref={crossSwapTokenReceiveRef}
                    style={commonStyle.primaryText}>
                    {formatAmount(receiveToken.min_amount)}{' '}
                  </Text>
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
          </Row>
        </Col>

        <SubTable target={crossSwapTokenReceiveRef}>
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
            engineResult={engineResultMap['1104']}
            id="1104"
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
                <View ref={crossSwapTokenReceiverRef}>
                  <Values.AddressWithCopy
                    style={commonStyle.subRowText}
                    address={receiver}
                    chain={chain}
                  />
                </View>
              </Row>
            </Col>
            <SubTable target={crossSwapTokenReceiverRef}>
              <SecurityListItem
                engineResult={engineResultMap['1096']}
                id="1096"
                dangerText={t('page.signTx.swap.unknownAddress')}
              />
              {!engineResultMap['1096'] && (
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
                chain,
                hasInteraction: requireData.hasInteraction,
              }}>
              <View ref={crossSwapTokenAddressRef}>
                <Values.Address address={requireData.id} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={crossSwapTokenAddressRef}>
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
              <Text style={commonStyle.subRowTitleText}>
                {t('page.signTx.interacted')}
              </Text>
            </SubRow>
            <SubRow>
              <Values.Boolean value={requireData.hasInteraction} />
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

export default CrossSwapToken;
