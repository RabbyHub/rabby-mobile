import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  BatchRevokePermit2RequireData,
  ParsedActionData,
} from '@rabby-wallet/rabby-action';
import { Table, Col, Row } from './components/Table';
import LogoWithText from './components/LogoWithText';
import * as Values from './components/Values';
import { ProtocolListItem } from './components/ProtocolListItem';
import ViewMore from './components/ViewMore';
import useCommonStyle from '../../hooks/useCommonStyle';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { SubTable, SubCol, SubRow } from './components/SubTable';
import { RevokeTokenApproveAction } from '@rabby-wallet/rabby-api/dist/types';

export const BatchRevokePermit2 = ({
  data,
  requireData,
  chain,
}: {
  data: ParsedActionData['permit2BatchRevokeToken'];
  requireData: BatchRevokePermit2RequireData;
  chain: Chain;
  raw?: Record<string, string | number>;
  engineResults: Result[];
  onChange?(tx: Record<string, any>): void;
}) => {
  const actionData = data!;
  const commonStyle = useCommonStyle();
  const { init } = useApprovalSecurityEngine();
  const { t } = useTranslation();
  const group = React.useMemo(() => {
    const list: Record<string, RevokeTokenApproveAction['token'][]> = {};
    actionData.revoke_list.forEach(item => {
      if (!list[item.spender]) {
        list[item.spender] = [];
      }
      list[item.spender].push(item.token);
    });
    return list;
  }, [actionData.revoke_list]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <Table>
        {Object.keys(group).map(spender => (
          <>
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
                  {group[spender].map(token => (
                    <LogoWithText
                      logo={token.logo_url}
                      text={
                        <Values.TokenSymbol
                          token={token}
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
                    ...requireData[spender],
                    spender,
                    chain,
                    isRevoke: true,
                  }}>
                  <View>
                    <Values.Address address={spender} chain={chain} />
                  </View>
                </ViewMore>
              </Row>
            </Col>
            <SubTable>
              <SubCol>
                <SubRow isTitle>
                  <Text style={commonStyle.subRowTitleText}>
                    {t('page.signTx.protocol')}
                  </Text>
                </SubRow>
                <SubRow>
                  <ProtocolListItem
                    style={commonStyle.subRowText}
                    protocol={requireData[spender].protocol}
                  />
                </SubRow>
              </SubCol>
            </SubTable>
          </>
        ))}
      </Table>
    </View>
  );
};
