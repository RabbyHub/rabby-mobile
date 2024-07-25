import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { RevokeTokenApproveRequireData, ParsedActionData } from './utils';
import { Table, Col, Row } from './components/Table';
import LogoWithText from './components/LogoWithText';
import * as Values from './components/Values';
import { ProtocolListItem } from './components/ProtocolListItem';
import ViewMore from './components/ViewMore';
import useCommonStyle from '../../hooks/useCommonStyle';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { SubTable, SubCol, SubRow } from './components/SubTable';

export const BatchRevokePermit2 = ({
  data,
  requireData,
  chain,
}: {
  data: ParsedActionData['permit2BatchRevokeToken'];
  requireData: RevokeTokenApproveRequireData;
  chain: Chain;
  raw?: Record<string, string | number>;
  engineResults: Result[];
  onChange?(tx: Record<string, any>): void;
}) => {
  const actionData = data!;
  const commonStyle = useCommonStyle();
  const { init } = useApprovalSecurityEngine();
  const { t } = useTranslation();

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revokePermit2AddressRef = React.useRef(null);

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
            <View
              style={StyleSheet.flatten({
                flexDirection: 'column',
                rowGap: 12,
              })}>
              {actionData.revoke_list.map(item => (
                <LogoWithText
                  logo={item.token.logo_url}
                  text={
                    <Values.TokenSymbol
                      token={requireData.token}
                      style={commonStyle.primaryText}
                    />
                  }
                />
              ))}
            </View>
          </Row>
        </Col>
        <Col>
          <Row isTitle itemsCenter>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.revokeTokenApprove.revokeFrom')}
            </Text>
          </Row>
          <Row>
            <ViewMore
              type="spender"
              data={{
                ...requireData,
                spender: actionData.revoke_list[0].spender,
                chain,
                isRevoke: true,
              }}>
              <View ref={revokePermit2AddressRef}>
                <Values.Address
                  address={actionData.revoke_list[0].spender}
                  chain={chain}
                />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={revokePermit2AddressRef}>
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
