import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, Text } from 'react-native';
import { Button, ButtonProps } from '../Button';
import AutoLockView from '@/components/AutoLockView';

export const Descriptions: React.FC<{
  title?: string;
  sections: Array<{
    title?: string;
    description?: string;
  }>;
  nextButtonProps?: ButtonProps;
}> = ({ title, sections, nextButtonProps }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      {!!title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.sectionContainer}>
        {sections.map((section, idx) => (
          <View key={`section-${section.title}-${idx}`} style={styles.section}>
            {!!section.title && (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
            {!!section.description && (
              <Text style={styles.sectionDesc}>{section.description}</Text>
            )}
          </View>
        ))}
      </View>
      {nextButtonProps && <Button {...nextButtonProps} />}
    </AutoLockView>
  );
};
const getStyles = createGetStyles2024(ctx => ({
  container: {
    paddingHorizontal: 25,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 25,
  },
  sectionContainer: {
    paddingBottom: 32,
  },
  section: {
    marginTop: 28,
    lineHeight: 24,
  },
  sectionTitle: {
    marginBottom: 5,
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 24,
    color: ctx.colors2024['neutral-title-1'],
  },
  sectionDesc: {
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: ctx.colors2024['neutral-foot'],
  },
}));
