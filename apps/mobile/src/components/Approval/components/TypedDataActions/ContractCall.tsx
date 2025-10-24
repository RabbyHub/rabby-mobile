import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  ContractRequireData,
  ParsedTypedDataActionData,
} from '@rabby-wallet/rabby-action';
import { Table, Col, Row } from '../Actions/components/Table';
import * as Values from '../Actions/components/Values';
import ViewMore from '../Actions/components/ViewMore';
import { ProtocolListItem } from '../Actions/components/ProtocolListItem';
import { SecurityListItem } from '../Actions/components/SecurityListItem';
import IconQuestionMark from '@/assets2024/icons/common/help-cc.svg';
import { Chain } from '@/constant/chains';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { addressUtils } from '@rabby-wallet/base-utils';
import { StyleSheet, Text, View } from 'react-native';
import { Tip } from '@/components/Tip';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubTable, SubCol, SubRow } from '../Actions/components/SubTable';
import { useTheme2024 } from '@/hooks/theme';
const { isSameAddress } = addressUtils;

const ContractCall = ({
  requireData,
  chain,
  raw,
  engineResults,
}: {
  data: ParsedTypedDataActionData['contractCall'];
  requireData: ContractRequireData;
  chain: Chain;
  raw: Record<string, string | number>;
  engineResults: Result[];
}) => {
  const { t } = useTranslation();
  const { colors2024 } = useTheme2024();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contractCallAddressRef = React.useRef(null);

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
            <ViewMore
              type="contract"
              data={{
                bornAt: requireData.bornAt,
                protocol: requireData.protocol,
                rank: requireData.rank,
                address: requireData.id,
                hasInteraction: requireData.hasInteraction,
                chain,
              }}>
              <View ref={contractCallAddressRef}>
                <Values.Address address={requireData.id} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={contractCallAddressRef}>
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
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.subRowTitleText}>
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
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.contractCall.operation')}
            </Text>
          </Row>
          <Row>
            <View
              style={StyleSheet.flatten({
                flexDirection: 'row',
                alignItems: 'center',
              })}>
              <Text style={commonStyle.primaryText}>{operation || '-'}</Text>
              <Tip
                content={
                  operation
                    ? t('page.signTypedData.contractCall.operationDecoded')
                    : t('page.signTx.contractCall.operationCantDecode')
                }>
                <IconQuestionMark
                  style={StyleSheet.flatten({
                    width: 16,
                    height: 16,
                    marginLeft: 6,
                  })}
                  color={colors2024['neutral-info']}
                />
              </Tip>
            </View>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default ContractCall;
