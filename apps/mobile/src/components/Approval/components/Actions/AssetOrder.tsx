import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ContractRequireData } from '@rabby-wallet/rabby-action';
import { ParsedActionData } from '@rabby-wallet/rabby-action';
import { Table, Col, Row } from '../Actions/components/Table';
import NFTWithName from '../Actions/components/NFTWithName';
import * as Values from '../Actions/components/Values';
import { SecurityListItem } from '../Actions/components/SecurityListItem';
import ViewMore from '../Actions/components/ViewMore';
import { ProtocolListItem } from '../Actions/components/ProtocolListItem';
import LogoWithText from '../Actions/components/LogoWithText';
import SecurityLevelTagNoText from '../SecurityEngine/SecurityLevelTagNoText';
import { SubCol, SubRow, SubTable } from './components/SubTable';
import { StyleSheet, Text, View } from 'react-native';
import useCommonStyle from '../../hooks/useCommonStyle';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { Chain } from '@/constant/chains';
import { addressUtils } from '@rabby-wallet/base-utils';
import { formatTokenAmount } from '@/utils/number';

const { isSameAddress } = addressUtils;

const AssetOrder = ({
  data,
  requireData,
  chain,
  engineResults,
  sender,
}: {
  data: ParsedActionData['assetOrder'];
  requireData: ContractRequireData;
  chain: Chain;
  engineResults: Result[];
  sender: string;
}) => {
  const commonStyle = useCommonStyle();
  const actionData = data!;
  const { t } = useTranslation();
  const {
    init,
    userData: { contractWhitelist },
    rules,
    currentTx: { processedRules },
    openRuleDrawer,
  } = useApprovalSecurityEngine();

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isInWhitelist = useMemo(() => {
    return contractWhitelist.some(
      item =>
        item.chainId === chain?.serverId &&
        isSameAddress(item.address, requireData?.id ?? ''),
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
    return !isSameAddress(actionData.receiver || '', sender);
  }, [actionData, sender]);

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

  const assetOrderReceiverRef = React.useRef(null);
  const assetOrderAddressRef = React.useRef(null);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.assetOrder.listAsset')}
            </Text>
          </Row>
          <Row
            style={StyleSheet.flatten({
              gap: 6,
              alignItems: 'flex-end',
            })}>
            {actionData.payTokenList.map(token => (
              <LogoWithText
                key={token.id}
                logo={token.logo_url}
                text={
                  <View style={commonStyle.rowFlexCenterItem}>
                    <Text style={commonStyle.primaryText}>
                      {formatTokenAmount(token.amount)}{' '}
                    </Text>
                    <Values.TokenSymbol
                      token={token}
                      style={commonStyle.primaryText}
                    />
                  </View>
                }
              />
            ))}
            {actionData.payNFTList.map(nft => (
              <ViewMore
                key={nft.id}
                type="nft"
                data={{
                  nft,
                  chain,
                }}>
                <NFTWithName nft={nft} />
              </ViewMore>
            ))}
            {actionData.payNFTList.length <= 0 &&
              actionData.payTokenList.length <= 0 && <>-</>}
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.assetOrder.receiveAsset')}
            </Text>
          </Row>
          <Row>
            <View
              style={StyleSheet.flatten({
                gap: 6,
                alignItems: 'flex-end',
              })}>
              {actionData.receiveTokenList.map(token => (
                <LogoWithText
                  className="overflow-hidden w-full"
                  key={token.id}
                  logo={token.logo_url}
                  text={
                    <View style={commonStyle.rowFlexCenterItem}>
                      <Text style={commonStyle.primaryText}>
                        {formatTokenAmount(token.amount)}{' '}
                      </Text>
                      <Values.TokenSymbol
                        token={token}
                        style={commonStyle.primaryText}
                      />
                    </View>
                  }
                />
              ))}
              {actionData.receiveNFTList.map(nft => (
                <ViewMore
                  key={nft.id}
                  type="nft"
                  data={{
                    nft,
                    chain,
                  }}>
                  <NFTWithName nft={nft} />
                </ViewMore>
              ))}
              {actionData.receiveTokenList.length <= 0 &&
                actionData.receiveNFTList.length <= 0 && (
                  <Text style={commonStyle.primaryText}>-</Text>
                )}
            </View>
            {engineResultMap['1144'] && (
              <SecurityLevelTagNoText
                enable={engineResultMap['1144'].enable}
                level={
                  processedRules.includes('1144')
                    ? 'proceed'
                    : engineResultMap['1144'].level
                }
                onClick={() => handleClickRule('1144')}
              />
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
              <Values.AddressWithCopy
                address={actionData.takers[0]}
                chain={chain}
              />
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
        {hasReceiver && actionData.receiver && (
          <>
            <Col>
              <Row isTitle>
                <Text style={commonStyle.rowTitleText}>
                  {t('page.signTx.swap.receiver')}
                </Text>
              </Row>
              <Row>
                <View ref={assetOrderReceiverRef}>
                  <Values.AddressWithCopy
                    address={actionData.receiver}
                    chain={chain}
                  />
                </View>
              </Row>
            </Col>
            <SubTable target={assetOrderReceiverRef}>
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
            <ViewMore
              type="contract"
              data={{
                ...requireData,
                address: requireData.id,
                chain,
                title: t('page.signTypedData.buyNFT.listOn'),
              }}>
              <View ref={assetOrderAddressRef}>
                <Values.Address address={requireData.id} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={assetOrderAddressRef}>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.protocol')}
              </Text>
            </SubRow>
            <SubRow>
              <ProtocolListItem protocol={requireData.protocol} />
            </SubRow>
          </SubCol>

          {isInWhitelist && (
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.rowTitleText}>
                  {t('page.signTx.myMark')}
                </Text>
              </SubRow>
              <SubRow>
                <Text style={commonStyle.primaryText}>
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
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTypedData.buyNFT.expireTime')}
            </Text>
          </Row>
          <Row>
            {actionData.expireAt ? (
              <Values.TimeSpanFuture
                style={commonStyle.primaryText}
                to={Number(actionData.expireAt)}
              />
            ) : (
              <Text style={commonStyle.primaryText}>-</Text>
            )}
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default AssetOrder;
