import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Table, Col, Row } from './components/Table';
import * as Values from './components/Values';
import { SecurityListItem } from './components/SecurityListItem';
import ViewMore from './components/ViewMore';
import { ProtocolListItem } from './components/ProtocolListItem';
import LogoWithText from './components/LogoWithText';
import { SubCol, SubRow, SubTable } from './components/SubTable';
import {
  ParsedTransactionActionData,
  SwapRequireData,
} from '@rabby-wallet/rabby-action';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { addressUtils } from '@rabby-wallet/base-utils';
import { Chain } from '@/constant/chains';
import { StyleSheet, Text, View } from 'react-native';
import useCommonStyle from '../../hooks/useCommonStyle';
import { formatAmount } from '@/utils/number';

const { isSameAddress } = addressUtils;

const MultiSwap = ({
  data,
  requireData,
  chain,
  engineResults,
  sender,
}: {
  data: ParsedTransactionActionData['multiSwap'];
  requireData: SwapRequireData;
  chain: Chain;
  engineResults: Result[];
  sender: string;
}) => {
  const actionData = data!;
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  const {
    init,
    userData: { contractWhitelist },
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
    return !isSameAddress(actionData.receiver || '', sender);
  }, [actionData, sender]);

  React.useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assetOrderReceiverRef = React.useRef(null);
  const mutilSwapAddress = React.useRef(null);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.swap.payToken')}
            </Text>
          </Row>
          <Row
            style={StyleSheet.flatten({
              gap: 6,
              alignItems: 'flex-end',
            })}>
            {actionData.payTokenList.map(token => (
              <LogoWithText
                className="overflow-hidden w-full"
                key={token.id}
                logo={token.logo_url}
                text={
                  <View style={commonStyle.rowFlexCenterItem}>
                    <Text style={commonStyle.primaryText}>
                      {formatAmount(token.amount)}{' '}
                    </Text>
                    <Values.TokenSymbol
                      token={token}
                      style={commonStyle.primaryText}
                    />
                  </View>
                }
              />
            ))}
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.swap.minReceive')}
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
                        {formatAmount(token.min_amount)}{' '}
                      </Text>
                      <Values.TokenSymbol
                        token={token}
                        style={commonStyle.primaryText}
                      />
                    </View>
                  }
                />
              ))}
            </View>
          </Row>
        </Col>
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
              {t('page.signTx.interactContract')}
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
              <View ref={mutilSwapAddress}>
                <Values.Address address={requireData.id} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={mutilSwapAddress}>
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
        </SubTable>
      </Table>
    </View>
  );
};

export default MultiSwap;
