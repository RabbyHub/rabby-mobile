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
import { formatAmount, formatUsdValue } from '@/utils/number';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
import { Chain } from '@/constant/chains';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { Text, View } from 'react-native';
import DescItem from '../Actions/components/DescItem';
import useCommonStyle from '../../hooks/useCommonStyle';
const { isSameAddress } = addressUtils;

const ApproveNFT = ({
  data,
  requireData,
  chain,
  engineResults,
  sender,
}: {
  data: TypedDataActionData['sellNFT'];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTypedData.sellNFT.listNFT')}
            </Text>
          </Row>
          <Row>
            <NFTWithName nft={actionData.pay_nft} />
            <View className="desc-list">
              <DescItem>
                <ViewMore
                  type="nft"
                  data={{
                    nft: actionData.pay_nft,
                    chain,
                  }}
                />
              </DescItem>
            </View>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTypedData.sellNFT.receiveToken')}
            </Text>
          </Row>
          <Row>
            <View className="relative">
              <LogoWithText
                logo={actionData.receive_token.logo_url}
                text={
                  <Text style={commonStyle.primaryText}>{`${formatAmount(
                    actionData.receive_token.amount,
                  )} ${ellipsisTokenSymbol(
                    getTokenSymbol(actionData.receive_token),
                  )}`}</Text>
                }
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
              {engineResultMap['1083'] && (
                <SecurityLevelTagNoText
                  enable={engineResultMap['1083'].enable}
                  level={
                    processedRules.includes('1083')
                      ? 'proceed'
                      : engineResultMap['1083'].level
                  }
                  onClick={() => handleClickRule('1083')}
                />
              )}
              {engineResultMap['1084'] && (
                <SecurityLevelTagNoText
                  enable={engineResultMap['1084'].enable}
                  level={
                    processedRules.includes('1084')
                      ? 'proceed'
                      : engineResultMap['1084'].level
                  }
                  onClick={() => handleClickRule('1084')}
                />
              )}
            </View>
            <View className="desc-list">
              <DescItem>
                <Text style={commonStyle.secondaryText}>
                  ≈
                  {formatUsdValue(
                    new BigNumber(actionData.receive_token.amount)
                      .times(actionData.receive_token.price)
                      .toFixed(),
                  )}
                </Text>
              </DescItem>
            </View>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTypedData.buyNFT.expireTime')}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.primaryText}>
              {actionData.expire_at ? (
                <Values.TimeSpanFuture to={Number(actionData.expire_at)} />
              ) : (
                '-'
              )}
            </Text>
          </Row>
        </Col>
        {actionData.takers.length > 0 && (
          <Col>
            <Row isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTypedData.sellNFT.specificBuyer')}
              </Text>
            </Row>
            <Row>
              <View className="relative">
                <Values.Address address={actionData.takers[0]} chain={chain} />
                {engineResultMap['1081'] && (
                  <SecurityLevelTagNoText
                    enable={engineResultMap['1081'].enable}
                    level={
                      processedRules.includes('1081')
                        ? 'proceed'
                        : engineResultMap['1081'].level
                    }
                    onClick={() => handleClickRule('1081')}
                  />
                )}
              </View>
            </Row>
          </Col>
        )}
        {hasReceiver && (
          <Col>
            <Row isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.swap.receiver')}
              </Text>
            </Row>
            <Row>
              <Values.Address address={actionData.receiver} chain={chain} />
              <SecurityListItem
                id="1082"
                engineResult={engineResultMap['1082']}
                dangerText={t('page.signTx.swap.notPaymentAddress')}
              />
            </Row>
          </Col>
        )}
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTypedData.buyNFT.listOn')}
            </Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={requireData.id} chain={chain} />
            </View>
            <View>
              {requireData.protocol && (
                <DescItem>
                  <ProtocolListItem
                    protocol={requireData.protocol}
                    style={commonStyle.secondaryText}
                  />
                </DescItem>
              )}

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
                    ...requireData,
                    address: requireData.id,
                    chain,
                    title: t('page.signTypedData.buyNFT.listOn'),
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

export default ApproveNFT;
