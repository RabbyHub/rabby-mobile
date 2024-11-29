import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  ApproveNFTRequireData,
  ParsedActionData,
} from '@rabby-wallet/rabby-action';
import { Table, Col, Row } from './components/Table';
import * as Values from './components/Values';
import { ProtocolListItem } from './components/ProtocolListItem';
import { SecurityListItem } from './components/SecurityListItem';
import ViewMore from './components/ViewMore';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubTable, SubCol, SubRow } from './components/SubTable';

const ApproveNFTCollection = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['approveNFTCollection'];
  requireData: ApproveNFTRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const actionData = data!;
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  const { init } = useApprovalSecurityEngine();

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approveNftCollectionAddressRef = React.useRef(null);
  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.nftCollectionApprove.approveCollection')}
            </Text>
          </Row>
          <Row>
            <ViewMore
              type="collection"
              data={{
                collection: actionData.collection,
                chain,
              }}>
              <Text style={commonStyle.primaryText}>
                {actionData?.collection?.name || '-'}
              </Text>
            </ViewMore>
          </Row>
        </Col>

        <Col>
          <Row isTitle itemsCenter>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.tokenApprove.approveTo')}
            </Text>
          </Row>
          <Row>
            <ViewMore
              type="nftSpender"
              data={{
                ...requireData,
                spender: actionData.spender,
                chain,
              }}>
              <View ref={approveNftCollectionAddressRef}>
                <Values.Address address={actionData.spender} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={approveNftCollectionAddressRef}>
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
                {t('page.signTx.interacted')}
              </Text>
            </SubRow>
            <SubRow>
              <Values.Boolean value={requireData.hasInteraction} />
            </SubRow>
          </SubCol>

          <SecurityListItem
            id="1053"
            engineResult={engineResultMap['1053']}
            dangerText={t('page.signTx.tokenApprove.eoaAddress')}
            title={t('page.signTx.addressTypeTitle')}
          />

          <SecurityListItem
            tip={t('page.signTx.tokenApprove.contractTrustValueTip')}
            id="1146"
            engineResult={engineResultMap['1146']}
            warningText={'$0'}
            title={t('page.signTx.trustValueTitle')}
          />

          <SecurityListItem
            id="1055"
            engineResult={engineResultMap['1055']}
            warningText={t('page.signTx.tokenApprove.deployTimeLessThan', {
              value: '3',
            })}
            title={t('page.signTx.deployTimeTitle')}
          />

          <SecurityListItem
            id="1060"
            engineResult={engineResultMap['1060']}
            title={t('page.signTx.tokenApprove.flagByRabby')}
            dangerText={t('page.signTx.yes')}
          />

          <SecurityListItem
            id="1134"
            engineResult={engineResultMap['1134']}
            forbiddenText={t('page.signTx.markAsBlock')}
            title={t('page.signTx.myMark')}
          />

          <SecurityListItem
            id="1136"
            engineResult={engineResultMap['1136']}
            warningText={t('page.signTx.markAsBlock')}
            title={t('page.signTx.myMark')}
          />

          <SecurityListItem
            id="1133"
            engineResult={engineResultMap['1133']}
            safeText={t('page.signTx.markAsTrust')}
            title={t('page.signTx.myMark')}
          />
        </SubTable>
      </Table>
    </View>
  );
};

export default ApproveNFTCollection;
