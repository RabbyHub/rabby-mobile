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
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { Chain } from '@debank/common';
import { addressUtils } from '@rabby-wallet/base-utils';
import { Text, View } from 'react-native';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
const { isSameAddress } = addressUtils;

const BuyNFT = ({
  data,
  requireData,
  chain,
  engineResults,
  sender,
}: {
  data: TypedDataActionData['buyNFT'];
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
            <Text>{t('page.signTypedData.buyNFT.payToken')}</Text>
          </Row>
          <Row>
            <LogoWithText
              logo={actionData.pay_token.logo_url}
              text={`${formatAmount(
                actionData.pay_token.amount,
              )} ${ellipsisTokenSymbol(getTokenSymbol(actionData.pay_token))}`}
              logoRadius={16}
            />
            <View className="desc-list">
              <Text>
                ≈
                {formatUsdValue(
                  new BigNumber(actionData.pay_token.amount)
                    .times(actionData.pay_token.price)
                    .toFixed(),
                )}
              </Text>
            </View>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text>{t('page.signTypedData.buyNFT.receiveNFT')}</Text>
          </Row>
          <Row>
            <View className="relative">
              <NFTWithName nft={actionData.receive_nft} showTokenLabel />
              {engineResultMap['1086'] && (
                <SecurityLevelTagNoText
                  enable={engineResultMap['1086'].enable}
                  level={
                    processedRules.includes('1086')
                      ? 'proceed'
                      : engineResultMap['1086'].level
                  }
                  onClick={() => handleClickRule('1086')}
                />
              )}
            </View>
            {engineResultMap['1087'] && (
              <SecurityLevelTagNoText
                enable={engineResultMap['1087'].enable}
                level={
                  processedRules.includes('1087')
                    ? 'proceed'
                    : engineResultMap['1087'].level
                }
                onClick={() => handleClickRule('1087')}
              />
            )}
            <View className="desc-list">
              <ViewMore
                type="nft"
                data={{
                  nft: actionData.receive_nft,
                  chain,
                }}
              />
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
              '-'
            )}
          </Row>
        </Col>
        {hasReceiver && (
          <Col>
            <Row isTitle>
              <Text>{t('page.signTx.swap.receiver')}</Text>
            </Row>
            <Row>
              <Values.Address address={actionData.receiver} chain={chain} />
              <View className="desc-list">
                <SecurityListItem
                  id="1085"
                  engineResult={engineResultMap['1085']}
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

              {isInWhitelist && <li>{t('page.signTx.markAsTrust')}</li>}

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

export default BuyNFT;
