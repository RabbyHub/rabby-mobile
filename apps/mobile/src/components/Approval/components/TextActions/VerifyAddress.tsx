import React from 'react';
import { useTranslation } from 'react-i18next';
import { VerifyAddressAction } from '@rabby-wallet/rabby-api/dist/types';
import { Col, Row, Table } from '../Actions/components/Table';
import * as Values from '../Actions/components/Values';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { View } from 'react-native';

const VerifyAddress = ({
  data,
}: {
  data: VerifyAddressAction;
  engineResults: Result[];
}) => {
  const { t } = useTranslation();

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>{t('page.signText.createKey.interactDapp')}</Row>
          <Row>
            <Values.Protocol value={data.protocol} />
          </Row>
        </Col>
        <Col>
          <Row isTitle>{t('page.signText.createKey.description')}</Row>
          <Row>{data.desc}</Row>
        </Col>
      </Table>
    </View>
  );
};

export default VerifyAddress;
