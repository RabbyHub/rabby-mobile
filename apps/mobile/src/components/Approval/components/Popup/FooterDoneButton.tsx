import { Button } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { useInterval } from 'ahooks';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export interface Props {
  onDone: () => void;
  hide?: boolean;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    buttonStyle: {
      backgroundColor: colors['green-default'],
      borderColor: colors['green-default'],
      height: 40,
      width: 180,
    },
    buttonTitleStyle: {
      color: colors['neutral-title-2'],
    },
  });

export const FooterDoneButton: React.FC<Props> = ({ onDone, hide }) => {
  const [counter, setCounter] = React.useState(0.5);
  const { visible } = useCommonPopupView();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  useInterval(() => {
    setCounter(counter - 1);
  }, 500);

  React.useEffect(() => {
    if (counter <= 0) {
      onDone();
    }
  }, [counter]);

  React.useEffect(() => {
    if (!visible) {
      onDone();
    }
  }, [visible]);

  if (hide) {
    return null;
  }

  return (
    <View>
      <Button
        buttonStyle={styles.buttonStyle}
        titleStyle={styles.buttonTitleStyle}
        type="primary"
        onPress={onDone}
        title={`Done ${counter < 0 ? '' : `(${counter}s)`}`}
      />
    </View>
  );
};
