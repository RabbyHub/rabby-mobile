import { getTokenSymbol } from '@/utils/token';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import {
  AppBottomSheetModal,
  AssetAvatar,
  Button,
  Text,
  Tip,
} from '@/components';
import RcIconRightArrowCC from '@/assets/icons/gas-top-up/arrow-right-cc.svg';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import RcIconInfoCC from '@/assets/icons/gas-top-up/info-cc.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GasTopUpTokenSelectModal } from './GasTokenSelect';
interface ConfirmDrawerProps {
  visible: boolean;
  onClose: () => void;
  cost: string;
  list?: TokenItem[];
  token?: TokenItem;
  loading?: boolean;
  onChange: (t: TokenItem) => void;
  onConfirm: () => void;
  retry: () => void;
}

const ConfirmToken: React.FC<ConfirmDrawerProps> = ({
  cost,
  token,
  list = [],
  loading = false,
  onChange,
  onConfirm,
  retry,
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const { t } = useTranslation();
  const [tokenModalVisible, setTokenModalVisible] = useState(false);

  const { bottom } = useSafeAreaInsets();

  return (
    <View style={styles.flex1}>
      <Text style={styles.title}>{t('page.gasTopUp.payment')}</Text>
      <View style={styles.usdView}>
        <Text style={styles.usdText}>
          ${new BigNumber(cost).times(1.2).toString(10)}
        </Text>
        <View style={styles.costView}>
          <Text style={styles.costText}>
            {t('page.gasTopUp.Including-service-fee', {
              fee: new BigNumber(cost).times(0.2).toString(10),
            })}
          </Text>
          <Tip content={t('page.gasTopUp.service-fee-tip')}>
            <RcIconInfoCC
              width={18}
              height={18}
              color={colors['neutral-body']}
            />
          </Tip>
        </View>

        <TouchableOpacity
          style={styles.buttonWrapper}
          onPress={() => {
            retry();
            setTokenModalVisible(true);
          }}>
          <Text style={styles.buttonText}>
            {token
              ? t('page.gasTopUp.Payment-Token')
              : t('page.gasTopUp.Select-payment-token')}
          </Text>
          <View style={styles.right}>
            {token && (
              <>
                <AssetAvatar
                  size={32}
                  chain={token.chain}
                  logo={token.logo_url}
                  chainSize={16}
                  chainIconPosition="tr"
                />
                <Text style={styles.rightText}>{getTokenSymbol(token)}</Text>
              </>
            )}
            <RcIconRightArrowCC color={colors['neutral-body']} />
          </View>
        </TouchableOpacity>
      </View>
      <View style={[styles.footer, { paddingBottom: 20 + bottom }]}>
        <Button
          type="primary"
          onPress={onConfirm}
          disabled={!token}
          title={t('page.gasTopUp.Confirm')}
        />
      </View>

      <GasTopUpTokenSelectModal
        visible={tokenModalVisible}
        setTokenModalVisible={setTokenModalVisible}
        loading={loading}
        list={list}
        onChange={onChange}
        cost={cost}
      />
    </View>
  );
};

const TokenModal = (props: ConfirmDrawerProps) => {
  const bottomRef = useRef<BottomSheetModalMethods>(null);

  useEffect(() => {
    if (props.visible) {
      bottomRef.current?.present();
    } else {
      bottomRef.current?.dismiss();
    }
  }, [props.visible]);

  return (
    <AppBottomSheetModal
      snapPoints={[460]}
      ref={bottomRef}
      onDismiss={() => props.onClose()}
      enableDismissOnClose>
      <BottomSheetView style={{ flex: 1 }}>
        <ConfirmToken {...props} />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles(colors => ({
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors['neutral-bg-1'],
  },
  title: {
    paddingTop: 16,
    fontSize: 24,
    fontWeight: '500',
    textAlign: 'center',
    color: colors['neutral-title-1'],
  },
  usdView: {
    padding: 20,
    paddingTop: 40,
    flex: 1,
  },
  usdText: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 40,
    color: colors['neutral-title-1'],
  },
  costView: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  costText: {
    fontSize: 12,
    color: colors['neutral-body'],
    marginRight: 4,
  },

  buttonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors['neutral-card2'],
    height: 56,
    borderRadius: 6,
    paddingHorizontal: 16,
    marginTop: 32,
  },
  buttonText: {
    color: colors['neutral-title-1'],
    fontSize: 14,
  },

  right: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  rightText: {
    marginLeft: 12,
    marginRight: 18,
    color: colors['neutral-title-1'],
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    marginTop: 'auto',
    padding: 20,
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
}));

export default TokenModal;
