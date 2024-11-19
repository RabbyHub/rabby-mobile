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
import NFTWithName from './components/NFTWithName';
import * as Values from './components/Values';
import { SecurityListItem } from './components/SecurityListItem';
import ViewMore from './components/ViewMore';
import { ProtocolListItem } from './components/ProtocolListItem';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubCol, SubRow, SubTable } from './components/SubTable';

const ApproveNFT = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['approveNFT'];
  requireData: ApproveNFTRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const actionData = data!;
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  const { init } = useApprovalSecurityEngine();

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approveNftAddressRef = React.useRef(null);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.nftApprove.approveNFT')}
            </Text>
          </Row>
          <Row>
            <ViewMore
              type="nft"
              data={{
                nft: actionData.nft,
                chain,
              }}>
              <NFTWithName nft={actionData?.nft} />
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
              <View ref={approveNftAddressRef}>
                <Values.Address address={actionData.spender} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={approveNftAddressRef}>
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
            id="1043"
            engineResult={engineResultMap['1043']}
            dangerText={t('page.signTx.tokenApprove.eoaAddress')}
            title={t('page.signTx.addressTypeTitle')}
          />

          <SecurityListItem
            tip={t('page.signTx.tokenApprove.contractTrustValueTip')}
            id="1147"
            engineResult={engineResultMap['1147']}
            warningText={'$0'}
            title={t('page.signTx.trustValueTitle')}
          />

          <SecurityListItem
            id="1045"
            engineResult={engineResultMap['1045']}
            warningText={t('page.signTx.tokenApprove.deployTimeLessThan', {
              value: '3',
            })}
            title={t('page.signTx.deployTimeTitle')}
          />

          <SecurityListItem
            id="1052"
            engineResult={engineResultMap['1052']}
            title={t('page.signTx.tokenApprove.flagByRabby')}
            dangerText={t('page.signTx.yes')}
          />

          <SecurityListItem
            title={t('page.signTx.myMark')}
            id="1134"
            engineResult={engineResultMap['1134']}
            forbiddenText={t('page.signTx.markAsBlock')}
          />

          <SecurityListItem
            title={t('page.signTx.myMark')}
            id="1136"
            engineResult={engineResultMap['1136']}
            warningText={t('page.signTx.markAsBlock')}
          />

          <SecurityListItem
            title={t('page.signTx.myMark')}
            id="1133"
            engineResult={engineResultMap['1133']}
            safeText={t('page.signTx.markAsTrust')}
          />
        </SubTable>
      </Table>
    </View>
  );
};

export default ApproveNFT;
