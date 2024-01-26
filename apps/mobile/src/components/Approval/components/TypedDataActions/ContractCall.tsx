import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ContractRequireData, TypedDataActionData } from './utils';
import { Table, Col, Row } from '../Actions/components/Table';
import * as Values from '../Actions/components/Values';
import ViewMore from '../Actions/components/ViewMore';
import { ProtocolListItem } from '../Actions/components/ProtocolListItem';
import { SecurityListItem } from '../Actions/components/SecurityListItem';
import IconQuestionMark from '@/assets/icons/sign/question-mark-24.svg';
import { Chain } from '@debank/common';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { addressUtils } from '@rabby-wallet/base-utils';
import { Text, View } from 'react-native';
import { Tip } from '@/components/Tip';
import DescItem from '../Actions/components/DescItem';
import useCommonStyle from '../../hooks/useCommonStyle';
const { isSameAddress } = addressUtils;

const ContractCall = ({
  requireData,
  chain,
  raw,
  engineResults,
}: {
  data: TypedDataActionData['contractCall'];
  requireData: ContractRequireData;
  chain: Chain;
  raw: Record<string, string | number>;
  engineResults: Result[];
}) => {
  const { t } = useTranslation();
  const operation = useMemo(() => {
    if (raw.primaryType) {
      return raw.primaryType as string;
    }
    return null;
  }, [raw]);
  const {
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

  useEffect(() => {
    apiApprovalSecurityEngine.init();
  }, []);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.interactContract')}
            </Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={requireData.id} chain={chain} />
            </View>
            <View>
              <DescItem>
                <ProtocolListItem
                  protocol={requireData.protocol}
                  style={commonStyle.secondaryText}
                />
              </DescItem>
              <DescItem>
                <Values.Interacted
                  value={requireData.hasInteraction}
                  textStyle={commonStyle.secondaryText}
                />
              </DescItem>

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
                    hasInteraction: requireData.hasInteraction,
                    bornAt: requireData.bornAt,
                    protocol: requireData.protocol,
                    rank: requireData.rank,
                    address: requireData.id,
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
              {t('page.signTx.contractCall.operation')}
            </Text>
          </Row>
          <Row>
            <View
              style={{
                position: 'relative',
                ...commonStyle.rowFlexCenterItem,
              }}>
              <Text style={commonStyle.primaryText}>{operation || '-'}</Text>
              <Tip
                content={
                  operation
                    ? t('page.signTypedData.contractCall.operationDecoded')
                    : t('page.signTx.contractCall.operationCantDecode')
                }>
                <IconQuestionMark className="w-[12] ml-[6]" />
              </Tip>
            </View>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default ContractCall;
