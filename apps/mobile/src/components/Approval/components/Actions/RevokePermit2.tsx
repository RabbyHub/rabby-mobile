import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chain } from '@debank/common';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ApproveTokenRequireData, ParsedActionData } from './utils';
import { Table, Col, Row } from './components/Table';
import LogoWithText from './components/LogoWithText';
import * as Values from './components/Values';
import { ProtocolListItem } from './components/ProtocolListItem';
import ViewMore from './components/ViewMore';
import useCommonStyle from '../../hooks/useCommonStyle';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import DescItem from './components/DescItem';

const RevokePermit2 = ({
  data,
  requireData,
  chain,
}: {
  data: ParsedActionData['approveToken'];
  requireData: ApproveTokenRequireData;
  chain: Chain;
  raw: Record<string, string | number>;
  engineResults: Result[];
  onChange(tx: Record<string, any>): void;
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
              {t('page.signTx.revokeTokenApprove.revokeToken')}
            </Text>
          </Row>
          <Row>
            <LogoWithText
              logo={actionData.token.logo_url}
              text={
                <Values.TokenSymbol
                  token={requireData.token}
                  style={commonStyle.primaryText}
                />
              }
              logoRadius={16}
            />
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
            <View className="desc-list">
              <ProtocolListItem
                protocol={requireData.protocol}
                style={commonStyle.primaryText}
              />

              <DescItem>
                <ViewMore
                  type="spender"
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

export default RevokePermit2;
