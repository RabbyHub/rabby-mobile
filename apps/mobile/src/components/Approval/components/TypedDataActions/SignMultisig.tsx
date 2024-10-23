import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SignMultiSigActions } from '@rabby-wallet/rabby-api/dist/types';
import { Col, Row, Table } from '../Actions/components/Table';
import * as Values from '../Actions/components/Values';
import { MultiSigRequireData } from '@rabby-wallet/rabby-action';
import LogoWithText from '../Actions/components/LogoWithText';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Chain } from '@/constant/chains';
import { Text, View } from 'react-native';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubTable, SubCol, SubRow } from '../Actions/components/SubTable';
import { findChain } from '@/utils/chain';

const PushMultiSig = ({
  data,
  requireData,
  chain,
}: {
  data: SignMultiSigActions;
  requireData: MultiSigRequireData;
  chain?: Chain;
  engineResults: Result[];
}) => {
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();

  const multiSigInfo = useMemo(() => {
    if (!chain) {
      for (const key in requireData?.contract) {
        const contract = requireData.contract[key];
        const c = findChain({
          serverId: key,
        });
        if (contract.multisig && c) {
          return {
            ...contract.multisig,
            chain: c,
          };
        }
      }
    } else {
      const contract = requireData.contract?.[chain.serverId];
      if (contract) {
        return { ...contract.multisig, chain };
      }
    }
  }, [requireData, chain]);

  const addressRef = React.useRef(null);

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
            <View ref={addressRef}>
              <Values.AddressWithCopy
                address={data.multisig_id}
                chain={multiSigInfo?.chain}
              />
            </View>
          </Row>
        </Col>

        <SubTable target={addressRef}>
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
