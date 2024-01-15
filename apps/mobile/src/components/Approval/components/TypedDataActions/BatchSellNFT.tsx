import React, { useEffect, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ContractRequireData, TypedDataActionData } from './utils';
import { Table, Col, Row } from '../Actions/components/Table';
import NFTWithName from '../Actions/components/NFTWithName';
import * as Values from '../Actions/components/Values';
import { SecurityListItem } from '../Actions/components/SecurityListItem';
import ViewMore from '../Actions/components/ViewMore';
import { ProtocolListItem } from '../Actions/components/ProtocolListItem';
import LogoWithText from '../Actions/components/LogoWithText';
import SecurityLevelTagNoText from '../SecurityEngine/SecurityLevelTagNoText';
import { addressUtils } from '@rabby-wallet/base-utils';
import { Chain } from '@debank/common';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { Text, View } from 'react-native';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
const { isSameAddress } = addressUtils;

const BatchSellNFT = ({
  data,
  requireData,
  chain,
  engineResults,
  sender,
}: {
  data: TypedDataActionData['batchSellNFT'];
  requireData: ContractRequireData;
  chain: Chain;
  engineResults: Result[];
  sender: string;
}) => {
  const actionData = data!;
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
        isSameAddress(item.address, requireData.id),
    );
  }, [contractWhitelist, requireData]);

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  const hasReceiver = useMemo(() => {
    return !isSameAddress(actionData.receiver, sender);
  }, [actionData, sender]);

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
            <Text>{t('page.signTypedData.sellNFT.listNFT')}</Text>
          </Row>
          <View className="flex-1 overflow-hidden">
            {actionData.pay_nft_list.map(nft => (
              <Row key={nft.id}>
                <NFTWithName nft={nft} />
                <View className="desc-list">
                  <ViewMore
                    type="nft"
                    data={{
                      nft,
                      chain,
                    }}
                  />
                </View>
              </Row>
            ))}
          </View>
        </Col>
        <Col>
          <Row isTitle>
            <Text>{t('page.signTypedData.sellNFT.receiveToken')}</Text>
          </Row>
          <Row>
            <View className="relative">
              <LogoWithText
                logo={actionData.receive_token.logo_url}
                text={`${formatAmount(
                  actionData.receive_token.amount,
                )} ${ellipsisTokenSymbol(
                  getTokenSymbol(actionData.receive_token),
                )}`}
                logoRadius={16}
                icon={
                  <Values.TokenLabel
                    isFake={actionData.receive_token.is_verified === false}
                    isScam={
                      actionData.receive_token.is_verified !== false &&
                      !!actionData.receive_token.is_suspicious
                    }
                  />
                }
              />
              {engineResultMap['1116'] && (
                <SecurityLevelTagNoText
                  enable={engineResultMap['1116'].enable}
                  level={
                    processedRules.includes('1116')
                      ? 'proceed'
                      : engineResultMap['1116'].level
                  }
                  onClick={() => handleClickRule('1116')}
                />
              )}
              {engineResultMap['1117'] && (
                <SecurityLevelTagNoText
                  enable={engineResultMap['1117'].enable}
                  level={
                    processedRules.includes('1117')
                      ? 'proceed'
                      : engineResultMap['1117'].level
                  }
                  onClick={() => handleClickRule('1117')}
                />
              )}
            </View>
            <View className="desc-list">
              <Text>
                ≈
                {formatUsdValue(
                  new BigNumber(actionData.receive_token.amount)
                    .times(actionData.receive_token.price)
                    .toFixed(),
                )}
              </Text>
            </View>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text>{t('page.signTypedData.buyNFT.expireTime')}</Text>
          </Row>
          <Row>
            {actionData.expire_at ? (
              <Values.TimeSpanFuture to={Number(actionData.expire_at)} />
            ) : (
              <Text>-</Text>
            )}
          </Row>
        </Col>
        {actionData.takers.length > 0 && (
          <Col>
            <Row isTitle>
              <Text>{t('page.signTypedData.sellNFT.specificBuyer')}</Text>
            </Row>
            <Row>
              <Values.Address address={actionData.takers[0]} chain={chain} />
              {engineResultMap['1114'] && (
                <SecurityLevelTagNoText
                  enable={engineResultMap['1114'].enable}
                  level={
                    processedRules.includes('1114')
                      ? 'proceed'
                      : engineResultMap['1114'].level
                  }
                  onClick={() => handleClickRule('1114')}
                />
              )}
            </Row>
          </Col>
        )}
        {hasReceiver && (
          <Col>
            <Row isTitle>
              <Text>{t('page.signTx.swap.receiver')}</Text>
            </Row>
            <Row>
              <Values.Address address={actionData.receiver} chain={chain} />
              <View className="desc-list">
                <SecurityListItem
                  id="1115"
                  engineResult={engineResultMap['1115']}
                  dangerText={t('page.signTx.swap.notPaymentAddress')}
                />
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
              <ViewMore
                type="contract"
                data={{
                  ...requireData,
                  address: requireData.id,
                  chain,
                  title: t('page.signTypedData.buyNFT.listOn'),
                }}
              />
            </View>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default BatchSellNFT;
