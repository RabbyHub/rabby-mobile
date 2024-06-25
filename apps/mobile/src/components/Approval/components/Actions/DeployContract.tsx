import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Col, Row, Table } from './components/Table';
import useCommonStyle from '../../hooks/useCommonStyle';

const DeployContract = () => {
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();

  return (
    <Table>
      <Col>
        <Row isTitle>
          <Text style={commonStyle.rowTitleText}>
            {t('page.signTx.deployContract.descriptionTitle')}
          </Text>
        </Row>
        <Row>
          <Text style={commonStyle.primaryText}>
            {t('page.signTx.deployContract.description')}
          </Text>
        </Row>
      </Col>
    </Table>
  );
};

export default DeployContract;
