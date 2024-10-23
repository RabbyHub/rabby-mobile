import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PushMultiSigAction } from '@rabby-wallet/rabby-api/dist/types';
import { Col, Row, Table } from './components/Table';
import * as Values from './components/Values';
import { Chain } from '@/constant/chains';
import { PushMultiSigRequireData } from '@rabby-wallet/rabby-action';
import LogoWithText from './components/LogoWithText';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubTable, SubCol, SubRow } from './components/SubTable';

const PushMultiSig = ({
  data,
  requireData,
  chain,
}: {
  data: PushMultiSigAction;
  requireData: PushMultiSigRequireData;
  chain: Chain;
}) => {
  const commonStyle = useCommonStyle();
  const { t } = useTranslation();
  const multiSigInfo = useMemo(() => {
    const contract = requireData.contract?.[chain.serverId];
    if (contract) {
      return contract.multisig;
    }
  }, [requireData, chain]);

  const multiSignAddressRef = React.useRef(null);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.submitMultisig.multisigAddress')}
            </Text>
          </Row>
          <Row>
            <View ref={multiSignAddressRef}>
              <Values.AddressWithCopy
                address={data.multisig_id}
                chain={chain}
              />
            </View>
          </Row>
        </Col>

        <SubTable target={multiSignAddressRef}>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.subRowTitleText}>
                {t('page.signTx.addressNote')}
              </Text>
            </SubRow>
            <SubRow>
              <Values.AddressMemo
                textStyle={commonStyle.subRowText}
                address={data.multisig_id}
              />
            </SubRow>
          </SubCol>
          {multiSigInfo && (
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.subRowTitleText}>
                  {t('page.signTx.label')}
                </Text>
              </SubRow>
              <SubRow>
                <LogoWithText
                  logo={multiSigInfo.logo_url}
                  text={multiSigInfo.name}
                  logoSize={14}
                  textStyle={commonStyle.subRowText}
                />
              </SubRow>
            </SubCol>
          )}
        </SubTable>
      </Table>
    </View>
  );
};

export default PushMultiSig;
