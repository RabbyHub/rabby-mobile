import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  ApproveTokenRequireData,
  ParsedActionData,
} from '@rabby-wallet/rabby-action';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
import { ellipsisOverflowedText } from '@/utils/text';
import { getCustomTxParamsData } from '@/utils/transaction';
import { formatAmount, formatPrice } from '@/utils/number';
import { Table, Col, Row } from './components/Table';
import * as Values from './components/Values';
import ViewMore from './components/ViewMore';
import { SecurityListItem } from './components/SecurityListItem';
import { ProtocolListItem } from './components/ProtocolListItem';
import useCommonStyle from '../../hooks/useCommonStyle';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { BottomSheetInput } from '@/components/Input';
import { TokenAmountItem } from './components/TokenAmountItem';
import { SubTable, SubCol, SubRow } from './components/SubTable';
import { FooterButtonGroup } from '@/components/FooterButton/FooterButtonGroup';
import { RcIconUnknownToken } from '@/screens/Approvals/icons';

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
      backgroundColor: colors['neutral-bg-1'],
      height: '100%',
    },
    approveAmountFooter: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 12,
    },
    approveAmountFooterLeft: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['neutral-foot'],
    },
    approveAmountFooterBalance: {
      fontSize: 15,
      lineHeight: 18,
      textAlign: 'right',
      textDecorationLine: 'underline',
      color: colors['neutral-body'],
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
    addonText: {
      fontSize: 13,
      lineHeight: 16,
      color: colors['neutral-foot'],
    },
    inputText: {
      fontSize: 15,
      color: colors['neutral-title-1'],
      flex: 1,
    },
    container: {
      paddingHorizontal: 20,
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
      snapPoints={[300]}>
      <BottomSheetView style={styles.mainView}>
        <AppBottomSheetModalTitle
          title={t('page.signTx.tokenApprove.amountPopupTitle')}
        />

        <View style={styles.container}>
          <BottomSheetInput
            value={customAmount}
            onChange={e => handleChange(e.nativeEvent.text)}
            // autoFocus
            customStyle={styles.inputText}
            addonAfter={
              <Text style={styles.addonText}>
                ≈{' '}
                {ellipsisOverflowedText(
                  formatPrice(new BigNumber(tokenPrice).toFixed()),
                  18,
                  true,
                )}
              </Text>
            }
            addonBefore={
              token.logo_url ? (
                <Image
                  source={{ uri: token.logo_url }}
                  style={StyleSheet.flatten({
                    width: 20,
                    height: 20,
                    marginRight: 8,
                  })}
                />
              ) : (
                <RcIconUnknownToken
                  width={20}
                  height={20}
                  style={StyleSheet.flatten({
                    marginRight: 8,
                  })}
                />
              )
            }
          />
          <View style={styles.approveAmountFooter}>
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
        </View>

        <FooterButtonGroup onCancel={onCancel} onConfirm={handleSubmit} />
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

  const tokenApproveBalanceRef = useRef(null);
  const tokenApproveAddressRef = useRef(null);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle itemsCenter>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.tokenApprove.approveToken')}
            </Text>
          </Row>
          <Row>
            <View ref={tokenApproveBalanceRef}>
              <TokenAmountItem
                amount={approveAmount}
                logoUrl={actionData.token.logo_url}
                onEdit={() => setEditApproveModalVisible(true)}
                balance={tokenBalance}
              />
            </View>
          </Row>
        </Col>

        <SubTable target={tokenApproveBalanceRef}>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.subRowTitleText}>
                {t('page.signTx.tokenApprove.myBalance')}
              </Text>
            </SubRow>
            <SubRow>
              <TouchableOpacity onPress={handleClickTokenBalance}>
                <Text
                  style={StyleSheet.flatten([
                    commonStyle.subRowText,
                    new BigNumber(approveAmount).gt(tokenBalance)
                      ? {
                          color: colors['blue-default'],
                          textDecorationLine: 'underline',
                        }
                      : {},
                  ])}>
                  {formatAmount(tokenBalance)}{' '}
                  {ellipsisTokenSymbol(getTokenSymbol(actionData.token))}
                </Text>
              </TouchableOpacity>
            </SubRow>
          </SubCol>
        </SubTable>

        <Col>
          <Row isTitle itemsCenter>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.tokenApprove.approveTo')}
            </Text>
          </Row>
          <Row>
            <ViewMore
              type="spender"
              data={{
                ...requireData,
                spender: actionData.spender,
                chain,
              }}>
              <View ref={tokenApproveAddressRef}>
                <Values.Address address={actionData.spender} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={tokenApproveAddressRef}>
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
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.hasInteraction')}
              </Text>
            </SubRow>
            <SubRow>
              <Values.Interacted value={requireData.hasInteraction} />
            </SubRow>
          </SubCol>

          <SecurityListItem
            id="1022"
            engineResult={engineResultMap['1022']}
            dangerText={t('page.signTx.tokenApprove.eoaAddress')}
            title={t('page.signTx.addressTypeTitle')}
          />

          <SecurityListItem
            tip={t('page.signTx.tokenApprove.contractTrustValueTip')}
            id="1150"
            engineResult={engineResultMap['1150']}
            warningText={'$0'}
            title={t('page.signTx.trustValueTitle')}
          />

          <SecurityListItem
            id="1024"
            engineResult={engineResultMap['1024']}
            warningText={t('page.signTx.tokenApprove.deployTimeLessThan', {
              value: '3',
            })}
            title={t('page.signTx.deployTimeTitle')}
          />

          <SecurityListItem
            id="1029"
            engineResult={engineResultMap['1029']}
            title={t('page.signTx.tokenApprove.flagByRabby')}
            dangerText={t('page.signTx.yes')}
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
        </SubTable>
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
