import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  ContractRequireData,
  ParsedTypedDataActionData,
} from '@rabby-wallet/rabby-action';
import { Table, Col, Row } from '../Actions/components/Table';
import NFTWithName from '../Actions/components/NFTWithName';
import * as Values from '../Actions/components/Values';
import { SecurityListItem } from '../Actions/components/SecurityListItem';
import ViewMore from '../Actions/components/ViewMore';
import { ProtocolListItem } from '../Actions/components/ProtocolListItem';
import LogoWithText from '../Actions/components/LogoWithText';
import SecurityLevelTagNoText from '../SecurityEngine/SecurityLevelTagNoText';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { Chain } from '@/constant/chains';
import { addressUtils } from '@rabby-wallet/base-utils';
import { Text, View } from 'react-native';
import { formatAmount } from '@/utils/number';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubTable, SubCol, SubRow } from '../Actions/components/SubTable';
const { isSameAddress } = addressUtils;

const BuyNFT = ({
  data,
  requireData,
  chain,
  engineResults,
  sender,
}: {
  data: ParsedTypedDataActionData['buyNFT'];
  requireData: ContractRequireData;
  chain: Chain;
  engineResults: Result[];
  sender: string;
}) => {
  const actionData = data!;
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buyNftReceiverRef = React.useRef(null);
  const buyNftAddressRef = React.useRef(null);

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
            />
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text>{t('page.signTypedData.buyNFT.receiveNFT')}</Text>
          </Row>
          <Row>
            <View className="relative">
              <ViewMore
                type="nft"
                data={{
                  nft: actionData.receive_nft,
                  chain,
                }}>
                <NFTWithName nft={actionData.receive_nft} showTokenLabel />
              </ViewMore>
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
        {hasReceiver && (
          <>
            <Col>
              <Row isTitle>
                <Text style={commonStyle.rowTitleText}>
                  {t('page.signTx.swap.receiver')}
                </Text>
              </Row>
              <Row>
                <View ref={buyNftReceiverRef}>
                  <Values.AddressWithCopy
                    address={actionData.receiver}
                    chain={chain}
                  />
                </View>
              </Row>
            </Col>
            <SubTable target={buyNftReceiverRef}>
              <SecurityListItem
                id="1085"
                engineResult={engineResultMap['1085']}
                dangerText={t('page.signTx.swap.notPaymentAddress')}
              />
            </SubTable>
          </>
        )}
        <Col>
          <Row isTitle itemsCenter>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTypedData.buyNFT.listOn')}
            </Text>
          </Row>
          <Row>
            <View ref={buyNftAddressRef}>
              <ViewMore
                type="contract"
                data={{
                  ...requireData,
                  address: requireData.id,
                  chain,
                  title: t('page.signTypedData.buyNFT.listOn'),
                }}>
                <Values.Address address={requireData.id} chain={chain} />
              </ViewMore>
            </View>
          </Row>
        </Col>
        <SubTable target={buyNftAddressRef}>
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

export default BuyNFT;
