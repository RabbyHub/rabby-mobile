import React from 'react';
import { useTranslation } from 'react-i18next';
import { Col, Row, Table } from '../Actions/components/Table';
import { ParsedTypedDataActionData } from '@rabby-wallet/rabby-action';
import * as Values from '../Actions/components/Values';
import LogoWithText from '../Actions/components/LogoWithText';
import { Text, View } from 'react-native';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubTable, SubCol, SubRow } from '../Actions/components/SubTable';

const CoboSafeModificationDelegatedAddress = ({
  data,
}: {
  data: ParsedTypedDataActionData['coboSafeModificationDelegatedAddress'];
}) => {
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  const actionData = data!;
  const addressRef = React.useRef(null);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t(
                'page.signTx.coboSafeModificationDelegatedAddress.safeWalletTitle',
              )}
            </Text>
          </Row>
          <Row>
            <View ref={addressRef}>
              <Values.AddressWithCopy address={actionData.multisig_id} />
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
                address={actionData.multisig_id}
              />
            </SubRow>
          </SubCol>

          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.subRowTitleText}>
                {t('page.signTx.label')}
              </Text>
            </SubRow>
            <SubRow>
              <LogoWithText
                logo={require('@/assets/icons/wallet/safe.svg')}
                text="Safe"
                logoSize={14}
                textStyle={commonStyle.subRowText}
              />
            </SubRow>
          </SubCol>
        </SubTable>

        <Col>
          <Row isTitle style={{ flex: 0, marginRight: 10 }}>
            <Text style={commonStyle.rowTitleText}>
              {t(
                'page.signTx.coboSafeModificationDelegatedAddress.descriptionTitle',
              )}
            </Text>
          </Row>
          <Row style={{ flex: 1 }}>
            <Text style={commonStyle.primaryText}>{actionData.desc}</Text>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default CoboSafeModificationDelegatedAddress;
