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

  const isInWhitelist = useMemo(() => {
    return contractWhitelist.some(
      item =>
        item.chainId === chain.serverId &&
        isSameAddress(item.address ?? '', requireData.id ?? ''),
    );
  }, [contractWhitelist, requireData]);

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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    apiApprovalSecurityEngine.init();
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
                <View className="flex-row">
                  <Text>{formatAmount(payToken.amount)} </Text>
                  <Values.TokenSymbol token={payToken} />
                </View>
              }
              logoRadius={16}
            />
            <View className="desc-list">
              <Text>
                ≈
                {formatUsdValue(
                  new BigNumber(payToken.amount)
                    .times(payToken.price)
                    .toFixed(),
                )}
              </Text>
            </View>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text>{t('page.signTx.swap.minReceive')}</Text>
          </Row>
          <Row>
            <View className="flex relative pr-10 flex-row">
              <LogoWithText
                logo={receiveToken.logo_url}
                logoRadius={16}
                text={
                  <View className="flex-row">
                    <Text>{formatAmount(receiveToken.amount)} </Text>
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
            <View className="desc-list">
              <Text>
                ≈
                {formatUsdValue(
                  new BigNumber(receiveToken.amount)
                    .times(receiveToken.price)
                    .toFixed(),
                )}
              </Text>
              <SecurityListItem
                engineResult={engineResultMap['1095']}
                id="1095"
                dangerText={
                  <View>
                    <Text>{t('page.signTx.swap.valueDiff')} </Text>
                    <Values.Percentage value={usdValuePercentage!} />
                    <Text> ({formatUsdValue(usdValueDiff || '')})</Text>
                  </View>
                }
                warningText={
                  <View>
                    <Text>{t('page.signTx.swap.valueDiff')} </Text>
                    <Values.Percentage value={usdValuePercentage!} />
                    <Text> ({formatUsdValue(usdValueDiff || '')})</Text>
                  </View>
                }
              />
            </View>
          </Row>
        </Col>
        {expireAt && (
          <Col>
            <Row isTitle>
              <Text>{t('page.signTypedData.buyNFT.expireTime')}</Text>
            </Row>
            <Row>
              <Values.TimeSpanFuture to={expireAt} />
            </Row>
          </Col>
        )}
        {hasReceiver && (
          <Col>
            <Row isTitle>
              <Text>{t('page.signTx.swap.receiver')}</Text>
            </Row>
            <Row>
              <Values.Address address={receiver} chain={chain} />
              <View className="desc-list">
                <SecurityListItem
                  engineResult={engineResultMap['1094']}
                  id="1094"
                  warningText={t('page.signTx.swap.unknownAddress')}
                />
                {!engineResultMap['1094'] && (
                  <View>
                    <View>
                      <Values.AccountAlias address={receiver} />
                    </View>
                    <View>
                      <Values.KnownAddress address={receiver} />
                    </View>
                  </View>
                )}
              </View>
            </Row>
          </Col>
        )}
        <Col>
          <Row isTitle>
            <Text>{t('page.signTypedData.buyNFT.listOn')}</Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={requireData.id} chain={chain} />
            </View>
            <View className="desc-list">
              <ProtocolListItem protocol={requireData.protocol} />
              <View>
                <Values.Interacted value={requireData.hasInteraction} />
              </View>

              {isInWhitelist && <Text>{t('page.signTx.markAsTrust')}</Text>}

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
              <View>
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
              </View>
            </View>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default SwapTokenOrder;
