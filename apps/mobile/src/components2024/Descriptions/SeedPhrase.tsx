import React from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

export const SeedPhrase: React.FC<{
  onNext: () => void;
}> = ({ onNext }) => {
  const { t } = useTranslation();

  return <Text>SeedPhrase</Text>;
};
