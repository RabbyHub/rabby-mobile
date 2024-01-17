import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chain } from '@debank/common';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ParsedActionData, SendNFTRequireData } from './utils';
import { Table, Col, Row } from './components/Table';
import LogoWithText from './components/LogoWithText';
import NFTWithName from './components/NFTWithName';
import * as Values from './components/Values';
import ViewMore from './components/ViewMore';
import { SecurityListItem } from './components/SecurityListItem';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import DescItem from './components/DescItem';

const SendNFT = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['sendNFT'];
  requireData: SendNFTRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const actionData = data!;
  const { init } = useApprovalSecurityEngine();
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  useEffect(() => {
    init();
  }, []);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.sendNFT.title')}
            </Text>
          </Row>
          <Row>
            <NFTWithName nft={actionData?.nft}></NFTWithName>
            <View>
              {actionData?.nft?.amount > 1 && (
                <DescItem>
                  <Text style={commonStyle.secondaryText}>
                    Amount: {actionData?.nft?.amount}
                  </Text>
                </DescItem>
              )}
              <DescItem>
                <ViewMore
                  type="nft"
                  data={{
                    nft: actionData.nft,
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
              {t('page.signTx.send.sendTo')}
            </Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={actionData.to} chain={chain} />
              <View>
                <DescItem>
                  <Values.AddressMemo address={actionData.to} />
                </DescItem>
                {requireData.name && <DescItem>{requireData.name}</DescItem>}
                <SecurityListItem
                  engineResult={engineResultMap['1016']}
                  dangerText={t('page.signTx.send.receiverIsTokenAddress')}
                  id="1016"
                />
                <SecurityListItem
                  engineResult={engineResultMap['1037']}
                  dangerText={t('page.signTx.send.contractNotOnThisChain')}
                  id="1037"
                />
                {requireData.cex && (
                  <>
                    <DescItem>
                      <LogoWithText
                        logo={requireData.cex.logo}
                        text={requireData.cex.name}
                        logoSize={14}
                        textStyle={{
                          fontSize: 13,
                          lineHeight: 15,
                          color: '#4B4D59',
                          fontWeight: 'normal',
                        }}
                      />
                    </DescItem>
                    <SecurityListItem
                      engineResult={engineResultMap['1039']}
                      dangerText={t('page.signTx.send.notTopupAddress')}
                      id="1039"
                    />
                    <SecurityListItem
                      engineResult={engineResultMap['1038']}
                      dangerText={t('page.signTx.sendNFT.nftNotSupport')}
                      id="1038"
                    />
                  </>
                )}
                <SecurityListItem
                  engineResult={engineResultMap['1036']}
                  warningText={<Values.Transacted value={false} />}
                  id="1036"
                />
                <SecurityListItem
                  engineResult={engineResultMap['1042']}
                  safeText={t('page.signTx.send.onMyWhitelist')}
                  id="1042"
                />
                <DescItem>
                  <ViewMore
                    type="receiver"
                    data={{
                      address: actionData.to,
                      chain,
                      eoa: requireData.eoa,
                      cex: requireData.cex,
                      contract: requireData.contract,
                      usd_value: requireData.usd_value,
                      hasTransfer: requireData.hasTransfer,
                      isTokenContract: requireData.isTokenContract,
                      name: requireData.name,
                      onTransferWhitelist: requireData.onTransferWhitelist,
                    }}
                  />
                </DescItem>
              </View>
            </View>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default SendNFT;
