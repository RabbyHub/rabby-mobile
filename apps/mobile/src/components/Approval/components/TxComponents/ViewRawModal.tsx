import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { createGlobalBottomSheetModal } from '@/components/GlobalBottomSheetModal';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { ExplainTxResponse } from '@rabby-wallet/rabby-api/dist/types';
import { Tab, TabView } from '@rneui/themed';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

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
    },
    indicator: {
      backgroundColor: colors['blue-default'],
      color: colors['blue-default'],
    },
    indicatorText: {
      color: colors['blue-default'],
    },
    tabView: {
      overflow: 'hidden',
      backgroundColor: colors['neutral-card-3'],
    },
    tabContainerView: {
      padding: 15,
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
  return (
    <BottomSheetView style={styles.popupView}>
      <Tab
        value={index}
        onChange={setIndex}
        dense
        indicatorStyle={styles.indicator}
        titleStyle={styles.indicatorText}>
        {raw && <Tab.Item title="DATA" />}
        {abi && <Tab.Item title="ABI" />}
        {raw?.data && raw?.data !== '0x' && <Tab.Item title="HEX" />}
      </Tab>
      <TabView
        containerStyle={styles.tabView}
        value={index}
        onChange={setIndex}>
        {raw && (
          <TabView.Item style={styles.tabContainerView}>
            <Text>{stringify(raw)}</Text>
          </TabView.Item>
        )}
        {abi && (
          <TabView.Item style={styles.tabContainerView}>
            <Text>{abi}</Text>
          </TabView.Item>
        )}
        {raw?.data && raw?.data !== '0x' && (
          <TabView.Item style={styles.tabContainerView}>
            <Text>{raw?.data}</Text>
          </TabView.Item>
        )}
      </TabView>
    </BottomSheetView>
  );
};
