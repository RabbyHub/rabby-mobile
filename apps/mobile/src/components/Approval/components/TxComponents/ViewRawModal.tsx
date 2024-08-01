import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { createGlobalBottomSheetModal } from '@/components/GlobalBottomSheetModal';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { ExplainTxResponse } from '@rabby-wallet/rabby-api/dist/types';
import { Tab, TabView } from '@rneui/themed';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import AutoLockView from '@/components/AutoLockView';

interface ContentProps {
  abi?: ExplainTxResponse['abi_str'];
  raw: Record<string, string | number>;
}

const stringify = (val: any) => {
  try {
    return JSON.stringify(val, null, 4);
  } catch (e) {
    console.error(e);
  }
};
const ViewRawModal = () => {
  return null;
};

ViewRawModal.open = ({ raw, abi }: ContentProps) => {
  createGlobalBottomSheetModal({
    name: MODAL_NAMES.VIEW_RAW_DETAILS,
    props: {
      raw,
      abi,
    },
  });
};

export default ViewRawModal;

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    popupView: {
      padding: 15,
      flex: 1,
      backgroundColor: colors['neutral-bg2'],
    },
    indicator: {
      backgroundColor: 'transparent',
    },
    indicatorText: {
      fontSize: 13,
      fontWeight: '500',
      padding: 0,
    },
    tabView: {
      overflow: 'hidden',
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
    },
    tabContainerView: {
      padding: 12,
    },
    tab: {
      backgroundColor: colors['neutral-line'],
      borderRadius: 6,
      marginBottom: 12,
    },
    tabContainer: {
      margin: 2,
      borderRadius: 4,
      color: colors['blue-default'],
    },
    tabContentText: {
      color: colors['neutral-title1'],
    },
  });

export const ViewRawDetail = ({
  props: { abi, raw },
}: {
  props: ContentProps;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [index, setIndex] = React.useState(0);
  const hasRaw = !!raw;
  const hasAbi = !!abi;
  const hasHex = !!(raw?.data && raw?.data !== '0x');
  const num = Number(hasRaw) + Number(hasAbi) + Number(hasHex);

  return (
    <AutoLockView as="BottomSheetView" style={styles.popupView}>
      <Tab
        value={index}
        onChange={setIndex}
        dense
        style={StyleSheet.flatten([
          styles.tab,
          {
            width: num * 72,
          },
        ])}
        indicatorStyle={styles.indicator}
        containerStyle={active => ({
          ...styles.tabContainer,
          backgroundColor: active
            ? colors['neutral-bg1']
            : colors['neutral-line'],
        })}
        titleStyle={active => ({
          ...styles.indicatorText,
          color: active ? colors['blue-default'] : colors['neutral-body'],
        })}>
        {hasRaw && <Tab.Item title="DATA" />}
        {hasAbi && <Tab.Item title="ABI" />}
        {hasHex && <Tab.Item title="HEX" />}
      </Tab>
      <TabView
        containerStyle={styles.tabView}
        value={index}
        onChange={setIndex}>
        {hasRaw && (
          <TabView.Item style={styles.tabContainerView}>
            <Text style={styles.tabContentText}>{stringify(raw)}</Text>
          </TabView.Item>
        )}
        {hasAbi && (
          <TabView.Item style={styles.tabContainerView}>
            <Text style={styles.tabContentText}>{abi}</Text>
          </TabView.Item>
        )}
        {hasHex && (
          <TabView.Item style={styles.tabContainerView}>
            <Text style={styles.tabContentText}>{raw?.data}</Text>
          </TabView.Item>
        )}
      </TabView>
    </AutoLockView>
  );
};
