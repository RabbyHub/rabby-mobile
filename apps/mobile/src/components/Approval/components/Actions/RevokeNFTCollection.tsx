import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chain } from '@debank/common';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ApproveNFTRequireData, ParsedActionData } from './utils';
import { Table, Col, Row } from './components/Table';
import * as Values from './components/Values';
import { ProtocolListItem } from './components/ProtocolListItem';
import ViewMore from './components/ViewMore';
import useCommonStyle from '../../hooks/useCommonStyle';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import DescItem from './components/DescItem';

const RevokeNFTCollection = ({
  data,
  requireData,
  chain,
}: {
  data: ParsedActionData['approveNFTCollection'];
  requireData: ApproveNFTRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const actionData = data!;
  const commonStyle = useCommonStyle();
  const { init } = useApprovalSecurityEngine();
  const { t } = useTranslation();

  useEffect(() => {
    init();
  }, []);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.revokeNFTCollectionApprove.revokeCollection')}
            </Text>
          </Row>
          <Row>
            {actionData?.collection?.name}
            <View>
              <DescItem>
                <ViewMore
                  type="collection"
                  data={{
                    collection: actionData.collection,
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
              {t('page.signTx.revokeTokenApprove.revokeFrom')}
            </Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={actionData.spender} chain={chain} />
            </View>
            <View>
              <ProtocolListItem
                protocol={requireData.protocol}
                style={commonStyle.primaryText}
              />

              <DescItem>
                <ViewMore
                  type="nftSpender"
                  data={{
                    ...requireData,
                    spender: actionData.spender,
                    chain,
                    isRevoke: true,
                  }}
                />
              </DescItem>
            </View>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default RevokeNFTCollection;
