import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  ParsedActionData,
  RevokeNFTRequireData,
} from '@rabby-wallet/rabby-action';
import { Table, Col, Row } from './components/Table';
import NFTWithName from './components/NFTWithName';
import * as Values from './components/Values';
import { ProtocolListItem } from './components/ProtocolListItem';
import ViewMore from './components/ViewMore';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubTable, SubCol, SubRow } from './components/SubTable';

const RevokeNFT = ({
  data,
  requireData,
  chain,
}: {
  data: ParsedActionData['revokeNFT'];
  requireData: RevokeNFTRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const actionData = data!;
  const { t } = useTranslation();
  const { init } = useApprovalSecurityEngine();
  const commonStyle = useCommonStyle();

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revokeNftAddressRef = React.useRef(null);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.revokeNFTApprove.revokeNFT')}
            </Text>
          </Row>
          <Row>
            <ViewMore
              type="nft"
              data={{
                nft: actionData.nft,
                chain,
              }}>
              <NFTWithName
                textStyle={commonStyle.primaryText}
                nft={actionData?.nft}
              />
            </ViewMore>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.revokeTokenApprove.revokeFrom')}
            </Text>
          </Row>
          <Row>
            <ViewMore
              type="nftSpender"
              data={{
                ...requireData,
                spender: actionData.spender,
                chain,
                isRevoke: true,
              }}>
              <View ref={revokeNftAddressRef}>
                <Values.Address address={actionData.spender} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={revokeNftAddressRef}>
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
        </SubTable>
      </Table>
    </View>
  );
};

export default RevokeNFT;
