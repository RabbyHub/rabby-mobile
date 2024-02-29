import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ApproveTokenRequireData, ParsedActionData } from './utils';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
import { ellipsisOverflowedText } from '@/utils/text';
import { getCustomTxParamsData } from '@/utils/transaction';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { Table, Col, Row } from './components/Table';
import LogoWithText from './components/LogoWithText';
import * as Values from './components/Values';
import ViewMore from './components/ViewMore';
import { SecurityListItem } from './components/SecurityListItem';
import { ProtocolListItem } from './components/ProtocolListItem';
import useCommonStyle from '../../hooks/useCommonStyle';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import DescItem from './components/DescItem';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { BottomSheetInput } from '@/components/Input';
import { Button } from '@/components/Button';

interface ApproveAmountModalProps {
  amount: number | string;
  balance: string | undefined | null;
  token: TokenItem;
  onChange(value: string): void;
  onCancel(): void;
  visible: boolean;
}

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    mainView: {
      paddingHorizontal: 20,
      backgroundColor: colors['neutral-bg-1'],
      height: '100%',
    },
    approveAmountFooter: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    approveAmountFooterLeft: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['neutral-foot'],
    },
    approveAmountFooterBalance: {
      fontSize: 12,
      lineHeight: 14,
      textAlign: 'right',
      textDecorationLine: 'underline',
      color: colors['neutral-foot'],
    },
    approveAmountButton: {
      display: 'flex',
      flexDirection: 'row',
      marginTop: 32,
      justifyContent: 'center',
    },
    editButton: {
      fontSize: 12,
      fontWeight: '500',
      marginLeft: 4,
      color: colors['blue-default'],
    },
  });

const ApproveAmountModal = ({
  balance,
  amount,
  token,
  visible,
  onChange,
  onCancel,
}: ApproveAmountModalProps) => {
  const modalRef = React.useRef<AppBottomSheetModal>(null);

  React.useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  const { t } = useTranslation();
  const [customAmount, setCustomAmount] = useState(
    new BigNumber(amount).toFixed(),
  );
  const [tokenPrice, setTokenPrice] = useState(
    new BigNumber(amount).times(token.price).toNumber(),
  );
  const [canSubmit, setCanSubmit] = useState(false);
  const colors = useThemeColors();
  const styles = getStyle(colors);

  const handleSubmit = () => {
    onChange(customAmount);
  };
  const handleChange = (value: string) => {
    if (/^\d*(\.\d*)?$/.test(value)) {
      setCustomAmount(value);
    }
  };

  useEffect(() => {
    if (
      !customAmount ||
      Number(customAmount) <= 0 ||
      Number.isNaN(Number(customAmount))
    ) {
      setCanSubmit(false);
    } else {
      setCanSubmit(true);
    }
    setTokenPrice(Number(customAmount || 0) * token.price);
  }, [customAmount, token]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      keyboardBlurBehavior="restore"
      onDismiss={onCancel}
      snapPoints={['30%']}>
      <BottomSheetView style={styles.mainView}>
        <AppBottomSheetModalTitle
          title={t('page.signTx.tokenApprove.amountPopupTitle')}
        />
        <View>
          <View>
            <BottomSheetInput
              value={customAmount}
              onChange={e => handleChange(e.nativeEvent.text)}
              autoFocus
              addonAfter={
                <Text>{ellipsisTokenSymbol(getTokenSymbol(token), 4)}</Text>
              }
            />
            <View style={styles.approveAmountFooter}>
              <Text style={styles.approveAmountFooterLeft}>
                ≈
                {ellipsisOverflowedText(
                  formatUsdValue(new BigNumber(tokenPrice).toFixed()),
                  18,
                  true,
                )}
              </Text>
              {balance && (
                <Text
                  style={styles.approveAmountFooterBalance}
                  onPress={() => {
                    setCustomAmount(balance);
                  }}>
                  {t('global.Balance')}:{' '}
                  {formatAmount(new BigNumber(balance).toFixed(4))}
                </Text>
              )}
            </View>
            <View style={styles.approveAmountButton}>
              <Button
                buttonStyle={{
                  width: 200,
                  backgroundColor: colors['blue-default'],
                  height: 44,
                  padding: 10,
                }}
                titleStyle={{
                  color: '#fff',
                  fontSize: 15,
                }}
                onPress={handleSubmit}
                title={t('global.confirmButton')}
                disabled={!canSubmit}
              />
            </View>
          </View>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const TokenApprove = ({
  data,
  requireData,
  chain,
  engineResults,
  raw,
  onChange,
}: {
  data: ParsedActionData['approveToken'];
  requireData: ApproveTokenRequireData;
  chain: Chain;
  raw: Record<string, string | number>;
  engineResults: Result[];
  onChange(tx: Record<string, any>): void;
}) => {
  const actionData = data!;
  const [editApproveModalVisible, setEditApproveModalVisible] = useState(false);
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  const colors = useThemeColors();
  const styles = getStyle(colors);
  const { init } = useApprovalSecurityEngine();

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  const tokenBalance = useMemo(() => {
    return new BigNumber(requireData.token.raw_amount_hex_str || '0')
      .div(10 ** requireData.token.decimals)
      .toFixed();
  }, [requireData]);
  const approveAmount = useMemo(() => {
    return new BigNumber(actionData.token.raw_amount || '0')
      .div(10 ** actionData.token.decimals)
      .toFixed();
  }, [actionData]);

  const handleClickTokenBalance = () => {
    if (new BigNumber(approveAmount).gt(tokenBalance)) {
      handleApproveAmountChange(tokenBalance);
    }
  };

  const handleApproveAmountChange = (value: string) => {
    const result = new BigNumber(value).isGreaterThan(Number.MAX_SAFE_INTEGER)
      ? String(Number.MAX_SAFE_INTEGER)
      : value;
    const data = getCustomTxParamsData(raw.data as string, {
      customPermissionAmount: result,
      decimals: actionData.token.decimals,
    });
    onChange({
      data,
    });
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.tokenApprove.approveToken')}
            </Text>
          </Row>
          <Row>
            <LogoWithText
              logo={actionData.token.logo_url}
              text={
                <View
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                  <View
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'row',
                      overflow: 'hidden',
                    }}>
                    <Values.TokenAmount
                      value={actionData.token.amount}
                      style={{ ...commonStyle.primaryText, maxWidth: '60%' }}
                    />
                    <Values.TokenSymbol
                      token={requireData.token}
                      style={{
                        marginLeft: 2,
                        flex: 0,
                        flexShrink: 0,
                        maxWidth: '40%',
                        ...commonStyle.primaryText,
                      }}
                    />
                  </View>
                  <View style={commonStyle.rowFlexCenterItem}>
                    <Text
                      style={styles.editButton}
                      onPress={() => setEditApproveModalVisible(true)}>
                      {t('global.editButton')}
                    </Text>
                  </View>
                </View>
              }
              logoRadius={16}
              textStyle={{
                flex: 1,
              }}
            />
            <View className="desc-list">
              <DescItem>
                <View className="flex flex-row">
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.tokenApprove.myBalance')}{' '}
                  </Text>
                  <Text
                    style={{
                      ...commonStyle.secondaryText,
                      textDecorationLine: new BigNumber(approveAmount).gt(
                        tokenBalance,
                      )
                        ? 'underline'
                        : 'none',
                    }}
                    onPress={handleClickTokenBalance}>
                    {formatAmount(tokenBalance)}{' '}
                  </Text>
                  <Text style={commonStyle.secondaryText}>
                    {ellipsisTokenSymbol(getTokenSymbol(actionData.token))}
                  </Text>
                </View>
              </DescItem>
            </View>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.tokenApprove.approveTo')}
            </Text>
          </Row>
          <Row>
            <Values.Address address={actionData.spender} chain={chain} />
            <View>
              <ProtocolListItem protocol={requireData.protocol} />

              <SecurityListItem
                id="1022"
                engineResult={engineResultMap['1022']}
                dangerText={t('page.signTx.tokenApprove.eoaAddress')}
              />

              <SecurityListItem
                id="1025"
                engineResult={engineResultMap['1025']}
                warningText={<Values.Interacted value={false} />}
                defaultText={
                  <Values.Interacted value={requireData.hasInteraction} />
                }
              />

              <SecurityListItem
                id="1023"
                engineResult={engineResultMap['1023']}
                dangerText={t('page.signTx.tokenApprove.trustValueLessThan', {
                  value: '$10,000',
                })}
                warningText={t('page.signTx.tokenApprove.trustValueLessThan', {
                  value: '$100,000',
                })}
              />

              <SecurityListItem
                id="1024"
                engineResult={engineResultMap['1024']}
                warningText={t('page.signTx.tokenApprove.deployTimeLessThan', {
                  value: '3',
                })}
              />

              <SecurityListItem
                id="1029"
                engineResult={engineResultMap['1029']}
                dangerText="Flagged by Rabby"
              />

              <SecurityListItem
                id="1134"
                engineResult={engineResultMap['1134']}
                forbiddenText={t('page.signTx.markAsBlock')}
              />

              <SecurityListItem
                id="1136"
                engineResult={engineResultMap['1136']}
                warningText={t('page.signTx.markAsBlock')}
              />

              <SecurityListItem
                id="1133"
                engineResult={engineResultMap['1133']}
                safeText={t('page.signTx.markAsTrust')}
              />

              <DescItem>
                <ViewMore
                  type="spender"
                  data={{
                    ...requireData,
                    spender: actionData.spender,
                    chain,
                  }}
                />
              </DescItem>
            </View>
          </Row>
        </Col>
      </Table>
      <ApproveAmountModal
        balance={tokenBalance}
        amount={approveAmount}
        token={actionData.token}
        onChange={handleApproveAmountChange}
        onCancel={() => setEditApproveModalVisible(false)}
        visible={editApproveModalVisible}
      />
    </View>
  );
};

export default TokenApprove;
