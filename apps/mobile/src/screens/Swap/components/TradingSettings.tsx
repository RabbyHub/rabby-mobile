import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ImageSourcePropType,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { CEX, DEX } from '@/constant/swap';
import {
  useSwapSettings,
  useSwapSettingsVisible,
  useSwapSupportedDexList,
} from '../hooks';
import { CHAINS_ENUM } from '@debank/common';
import { Radio } from '@/components/Radio';
import { useThemeColors } from '@/hooks/theme';
import { AppBottomSheetModal, AppSwitch, Button } from '@/components';
import { createGetStyles } from '@/utils/styles';
import { SwapModal } from './Modal';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { colord } from 'colord';
// import { ModalLayouts } from '@/constant/layout';

const list = [...Object.values(DEX), ...Object.values(CEX)] as {
  id: keyof typeof DEX | keyof typeof CEX;
  logo: ImageSourcePropType;
  name: string;
  chains: CHAINS_ENUM[];
}[];

export const TradingSettings = () => {
  const bottomRef = useRef<BottomSheetModalMethods>(null);
  const { visible, setVisible } = useSwapSettingsVisible();
  const [supportedDexList] = useSwapSupportedDexList();

  const { height: screenHeight } = useWindowDimensions();

  const height = useMemo(() => {
    const min = 340;
    const max = Math.min(500, screenHeight * 0.9);

    const h = 162 + supportedDexList.length * 68;

    if (h < min) {
      return min;
    }
    if (h > max) {
      return max;
    }
    return h;
  }, [supportedDexList.length, screenHeight]);

  const snapPoints = useMemo(() => [height], [height]);

  const onDismiss = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  useEffect(() => {
    if (visible) {
      bottomRef.current?.present();
    }
  }, [visible]);
  return (
    <AppBottomSheetModal
      ref={bottomRef}
      snapPoints={snapPoints}
      onDismiss={onDismiss}
      enableDismissOnClose>
      <TradingSettingsInner onClose={onDismiss} />
    </AppBottomSheetModal>
  );
};

const TradingSettingsInner = ({ onClose }: { onClose: () => void }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { bottom } = useSafeAreaInsets();

  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState<Parameters<typeof setSwapTrade>[0]>();

  const { swapViewList, swapTradeList, setSwapView, setSwapTrade } =
    useSwapSettings();

  const [supportedDEXList] = useSwapSupportedDexList();

  const onConfirm = () => {
    if (id) {
      setSwapTrade(id, true);
      setOpen(false);
      onClose();
    }
  };

  const onCancel = () => {
    setOpen(false);
  };

  return (
    <BottomSheetScrollView style={[styles.container]}>
      <View>
        <Text style={styles.headerTitle}>
          {t('page.swap.enable-exchanges')}
        </Text>
      </View>
      <View style={styles.header}>
        <Text style={[styles.label, styles.first, styles.firstLabel]}>
          {t('page.swap.exchanges')}
        </Text>
        <Text style={[styles.label, styles.second]}>
          {t('page.swap.view-quotes')}
        </Text>
        <Text style={[styles.label, styles.lastLabel, styles.last]}>
          {t('page.swap.trade')}
        </Text>
      </View>

      <View style={{ paddingBottom: 20 + bottom }}>
        {list.map(item => {
          if (!supportedDEXList.includes(item.id)) {
            return null;
          }
          return (
            <View key={item.name} style={styles.itemContainer}>
              <View style={[styles.item, styles.first]}>
                <Image source={item.logo} style={styles.logo} />
                <Text style={styles.name}>{item.name}</Text>
                {/* <Text style={styles.type}>
                {item?.chains ? t('page.swap.dex') : t('page.swap.cex')}
              </Text> */}
              </View>
              <View style={styles.second}>
                <AppSwitch
                  backgroundActive={colors['green-default']}
                  circleBorderActiveColor={colors['green-default']}
                  changeValueImmediately={false}
                  value={swapViewList?.[item.id] ?? true}
                  onValueChange={checked => {
                    setSwapView(item.id, checked);
                    if (!checked && DEX[item.id]) {
                      setSwapTrade(item.id, checked);
                    }
                  }}
                />
              </View>
              <View style={styles.last}>
                <AppSwitch
                  backgroundActive={colors['green-default']}
                  circleBorderActiveColor={colors['green-default']}
                  changeValueImmediately={false}
                  onValueChange={checked => {
                    if (checked) {
                      setId(item.id);
                      setOpen(true);
                    } else {
                      setSwapTrade(item.id, checked);
                    }
                  }}
                  value={!!swapTradeList?.[item.id]}
                  disabled={swapViewList?.[item.id] === false || !!CEX[item.id]}
                  containerStyle={{
                    opacity:
                      swapViewList?.[item.id] === false || !!CEX[item.id]
                        ? 0.5
                        : 1,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>

      <SwapModal visible={open} onCancel={onCancel}>
        <EnableTrading onConfirm={onConfirm} onCancel={onCancel} />
      </SwapModal>
    </BottomSheetScrollView>
  );
};

function EnableTrading({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.modal}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('page.swap.enable-trading')}</Text>
        <Text style={styles.text}>{t('page.swap.tradingSettingTip1')}</Text>
        <Text style={styles.text}>{t('page.swap.tradingSettingTip2')}</Text>
        <View>
          <Radio
            checked={checked}
            onPress={() => setChecked(!checked)}
            title={t('page.swap.i-understand-and-accept-it')}
            wrapperStyle={styles.checkboxContainer}
            textStyle={styles.checkboxLabel}
          />
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <Button
          title={t('Cancel')}
          containerStyle={styles.btnC}
          buttonStyle={styles.cancelStyle}
          titleStyle={styles.cancelTitleStyle}
          onPress={onCancel}
        />
        <View style={styles.btnGap} />

        <Button
          disabled={!checked}
          title={t('page.swap.confirm')}
          containerStyle={styles.btnC}
          buttonStyle={styles.confirmStyle}
          titleStyle={styles.confirmTitleStyle}
          onPress={onConfirm}
        />
      </View>
    </View>
  );
}

const getStyles = createGetStyles(colors => ({
  container: {
    flex: 1,
    backgroundColor: colors['neutral-bg-1'],
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    // justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    color: colors['neutral-title-1'],
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    paddingBottom: 20,
  },
  label: {
    color: colors['neutral-foot'],
    fontSize: 13,
    fontWeight: '400',
    marginLeft: 'auto',
  },
  firstLabel: {
    paddingLeft: 16,
  },

  lastLabel: {
    paddingRight: 8,
  },
  first: {
    flex: 1,
  },
  second: {
    width: 80,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    textAlign: 'left',
  },
  last: {
    width: 72,
    textAlign: 'right',
    alignItems: 'flex-end',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors['neutral-card-2'],
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
  type: {
    fontSize: 12,
    color: colors['neutral-foot'],
    marginLeft: 8,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 4,
    borderColor: colors['neutral-line'],
    paddingHorizontal: 4,
    paddingVertical: 1,
    width: 'auto',
  },

  modal: {
    marginHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors['neutral-bg-1'],
  },
  content: {
    width: '100%',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
    color: colors['neutral-title-1'],
  },
  text: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'left',
    color: colors['neutral-body'],
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  checkboxLabel: {
    fontSize: 13,
    color: colors['neutral-body'],
    fontWeight: '400',
  },

  buttonContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    marginTop: 20,
  },

  btnC: {
    flex: 1,
  },

  cancelStyle: {
    backgroundColor: colors['neutral-card-1'],
    borderColor: colors['blue-default'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 8,
    height: 48,
    width: '100%',
  },
  cancelTitleStyle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors['blue-default'],
    flex: 1,
  },
  btnGap: {
    width: 13,
  },
  confirmStyle: {
    backgroundColor: colors['blue-default'],
    borderRadius: 8,
    width: '100%',
  },
  confirmTitleStyle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors['neutral-title2'],
    flex: 1,
  },
}));
