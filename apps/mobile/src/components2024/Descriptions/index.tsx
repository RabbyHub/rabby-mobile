import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, Text } from 'react-native';

export const Descriptions: React.FC<{
  title?: string;
  sections: Array<{
    title?: string;
    description?: string;
  }>;
  onNext: () => void;
}> = ({ title, sections }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.container}>
      {!!title && <Text style={styles.title}>{title}</Text>}
      {sections.map(section => (
        <View style={styles.section}>
          {!!section.title && (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          {!!section.description && (
            <Text style={styles.sectionDesc}>{section.description}</Text>
          )}
        </View>
      ))}
    </View>
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
