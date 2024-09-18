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
import { addressUtils } from '@rabby-wallet/base-utils';
import { Chain } from '@/constant/chains';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { StyleSheet, Text, View } from 'react-native';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubCol, SubRow, SubTable } from '../Actions/components/SubTable';
const { isSameAddress } = addressUtils;

const BatchSellNFT = ({
  data,
  requireData,
  chain,
  engineResults,
  sender,
}: {
  data: ParsedTypedDataActionData['batchSellNFT'];
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

  const batchSellNftReceiverRef = React.useRef(null);
  const batchSellNftAddressRef = React.useRef(null);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTypedData.sellNFT.listNFT')}
            </Text>
          </Row>
          <View
            style={StyleSheet.flatten({
              rowGap: 6,
              overflow: 'hidden',
              alignItems: 'flex-end',
            })}>
            {actionData.pay_nft_list.map(nft => (
              <Row key={nft.id}>
                <ViewMore
                  type="nft"
                  data={{
                    nft,
                    chain,
                  }}>
                  <NFTWithName nft={nft} textStyle={commonStyle.primaryText} />
                </ViewMore>
              </Row>
            ))}
          </View>
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
                  <View style={commonStyle.rowFlexCenterItem}>
                    <Values.TokenAmount
                      value={actionData.receive_token.amount}
                      style={commonStyle.primaryText}
                    />
                    <Values.TokenSymbol
                      token={actionData.receive_token}
                      style={StyleSheet.flatten({
                        ...commonStyle.primaryText,
                        marginLeft: 2,
                      })}
                    />
                  </View>
                }
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
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTypedData.buyNFT.expireTime')}
            </Text>
          </Row>
          <Row>
            {actionData.expire_at ? (
              <Values.TimeSpanFuture
                to={Number(actionData.expire_at)}
                style={commonStyle.primaryText}
              />
            ) : (
              <Text style={commonStyle.primaryText}>-</Text>
            )}
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
          <>
            <Col>
              <Row isTitle>
                <Text style={commonStyle.rowTitleText}>
                  {t('page.signTx.swap.receiver')}
                </Text>
              </Row>
              <Row>
                <View ref={batchSellNftReceiverRef}>
                  <Values.AddressWithCopy
                    address={actionData.receiver}
                    chain={chain}
                  />
                </View>
              </Row>
            </Col>
            <SubTable target={batchSellNftReceiverRef}>
              <SecurityListItem
                id="1115"
                engineResult={engineResultMap['1115']}
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
            <View ref={batchSellNftAddressRef}>
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
        <SubTable target={batchSellNftAddressRef}>
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

export default BatchSellNFT;
