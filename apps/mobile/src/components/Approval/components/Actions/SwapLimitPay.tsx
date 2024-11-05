import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Table, Col, Row } from '../Actions/components/Table';
import * as Values from '../Actions/components/Values';
import { SecurityListItem } from '../Actions/components/SecurityListItem';
import ViewMore from '../Actions/components/ViewMore';
import { ProtocolListItem } from '../Actions/components/ProtocolListItem';
import LogoWithText from '../Actions/components/LogoWithText';
import { SubCol, SubRow, SubTable } from './components/SubTable';
import {
  ParsedTransactionActionData,
  SwapRequireData,
} from '@rabby-wallet/rabby-action';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import { addressUtils } from '@rabby-wallet/base-utils';
import { Chain } from '@/constant/chains';
import { Text, View } from 'react-native';
import { formatAmount } from '@/utils/number';

const { isSameAddress } = addressUtils;

const SwapLimitPay = ({
  data,
  requireData,
  chain,
  engineResults,
  sender,
}: {
  data: ParsedTransactionActionData['swapLimitPay'];
  requireData: SwapRequireData;
  chain: Chain;
  engineResults: Result[];
  sender: string;
}) => {
  const actionData = data!;
  const commonStyle = useCommonStyle();
  const { t } = useTranslation();
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

  const receiverAddressRef = React.useRef(null);
  const swapLimitPayAddressRef = React.useRef(null);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.swap.receiveToken')}
            </Text>
          </Row>
          <Row>
            <LogoWithText
              logo={actionData.receiveToken.logo_url}
              text={
                <View style={commonStyle.rowFlexCenterItem}>
                  <Text style={commonStyle.primaryText}>
                    {formatAmount(actionData.receiveToken.amount)}{' '}
                  </Text>
                  <Values.TokenSymbol
                    token={actionData.receiveToken}
                    style={commonStyle.primaryText}
                  />
                </View>
              }
            />
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.swapLimitPay.maxPay')}
            </Text>
          </Row>
          <Row>
            <LogoWithText
              logo={actionData.payToken.logo_url}
              text={
                <View style={commonStyle.rowFlexCenterItem}>
                  <Text style={commonStyle.primaryText}>
                    {formatAmount(actionData.payToken.max_amount)}{' '}
                  </Text>
                  <Values.TokenSymbol
                    token={actionData.payToken}
                    style={commonStyle.primaryText}
                  />
                </View>
              }
            />
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
                <View ref={receiverAddressRef}>
                  <Values.AddressWithCopy
                    address={actionData.receiver}
                    chain={chain}
                  />
                </View>
              </Row>
            </Col>
            <SubTable target={receiverAddressRef}>
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
              <View ref={swapLimitPayAddressRef}>
                <Values.Address address={requireData.id} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={swapLimitPayAddressRef}>
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
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.hasInteraction')}
              </Text>
            </SubRow>
            <SubRow>
              <Values.Interacted value={requireData.hasInteraction} />
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

export default SwapLimitPay;
