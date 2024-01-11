import { Button } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export interface Props {
  onClick: () => void;
  text: string;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    buttonStyle: {
      backgroundColor: colors['blue-default'],
      height: 40,
      width: 180,
    },
    buttonTitleStyle: {
      color: colors['neutral-title-2'],
    },
  });

export const FooterButton: React.FC<Props> = ({ onClick, text }) => {
  const [loading, setLoading] = React.useState(false);
  const handleClick = React.useCallback(() => {
    onClick();
    setLoading(true);
  }, []);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View>
      <Button
        // className={clsx('w-[180px] h-[40px]', 'active:before:bg-[#00000033]')}
        buttonStyle={styles.buttonStyle}
        titleStyle={styles.buttonTitleStyle}
        type="primary"
        onPress={handleClick}
        loading={loading}
        title={text}
      />
    </View>
  );
};
