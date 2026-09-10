import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Keyboard, TouchableWithoutFeedback, View } from 'react-native';

import { RcIconScannerCC } from '@/assets/icons/address';
import { Text } from '@/components/Typography';
import TouchableView from '@/components/Touchable/TouchableView';
import { NextInput } from '@/components2024/Form/Input';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { toast } from '@/components2024/Toast';
import { RootNames } from '@/constant/layout';
import {
  importHighCardinalityWatchAddressFixtureFromUrl,
  normalizeHighCardinalityWatchAddressFixtureUrl,
} from '@/devtools/highCardinalityWatchAddressImport.nonprod';
import { useTheme2024 } from '@/hooks/theme';
import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { useScanner } from '../Scanner/ScannerScreen';

export default function DevWatchAddressFixtureImport() {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const scanner = useScanner();
  const [fixtureUrl, setFixtureUrl] = useState('');
  const [validationError, setValidationError] = useState<string>();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{
    completedCount: number;
    totalCount: number;
  }>();

  const updateFixtureUrl = useCallback((value: string) => {
    setFixtureUrl(value);
    setValidationError(undefined);
  }, []);

  useEffect(() => {
    if (!scanner.text) {
      return;
    }
    updateFixtureUrl(scanner.text.trim());
    scanner.clear();
  }, [scanner, updateFixtureUrl]);

  const importFixture = useCallback(async (url: string) => {
    setIsImporting(true);
    setProgress(undefined);
    try {
      const result = await importHighCardinalityWatchAddressFixtureFromUrl(
        url,
        { onProgress: setProgress },
      );
      const summary =
        `Imported ${result.importedCount}; existing ${result.existingCount}; ` +
        `missing ${result.missingCount}.`;
      if (result.failedCount || result.missingCount) {
        toast.error(`Benchmark address import is incomplete. ${summary}`);
      } else {
        toast.success(`Benchmark addresses are ready. ${summary}`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Benchmark import failed';
      setValidationError(message);
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  }, []);

  const confirmImport = useCallback(() => {
    let url: string;
    try {
      url = normalizeHighCardinalityWatchAddressFixtureUrl(fixtureUrl);
      setFixtureUrl(url);
      setValidationError(undefined);
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : 'Benchmark link is invalid',
      );
      return;
    }

    Keyboard.dismiss();
    Alert.alert(
      'Import benchmark addresses',
      'Download this JSON fixture and add its missing Watch addresses?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: () => {
            importFixture(url).catch(() => undefined);
          },
        },
      ],
    );
  }, [fixtureUrl, importFixture]);

  return (
    <FooterButtonScreenContainer
      as="View"
      style={styles.screen}
      footerBottomOffset={32}
      footerContainerStyle={styles.footer}
      buttonProps={{
        title: 'Import Watch addresses',
        onPress: confirmImport,
        disabled: !fixtureUrl.trim() || isImporting,
        loading: isImporting,
      }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <Text style={styles.label}>Fixture JSON link</Text>
          <NextInput.TextArea
            style={styles.inputContainer}
            inputStyle={styles.input}
            tipText={validationError}
            hasError={!!validationError}
            inputProps={{
              placeholder: 'https://…/watch-addresses.json',
              value: fixtureUrl,
              autoCapitalize: 'none',
              autoCorrect: false,
              keyboardType: 'url',
              onChangeText: updateFixtureUrl,
            }}
            // eslint-disable-next-line react/no-unstable-nested-components
            customIcon={ctx => (
              <TouchableView
                style={ctx.wrapperStyle}
                onPress={() => {
                  scanner.clear();
                  navigateDeprecated(RootNames.Scanner);
                }}>
                <RcIconScannerCC
                  style={ctx.iconStyle}
                  color={colors2024['neutral-title-1']}
                />
              </TouchableView>
            )}
          />
          {isImporting ? (
            <Text style={styles.progress}>
              {progress
                ? `${progress.completedCount}/${progress.totalCount}`
                : 'Downloading JSON…'}
            </Text>
          ) : null}
        </View>
      </TouchableWithoutFeedback>
    </FooterButtonScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  screen: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  inputContainer: {
    width: '100%',
  },
  label: {
    marginBottom: 8,
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    minHeight: 112,
    paddingRight: 44,
  },
  progress: {
    marginTop: 12,
    color: ctx.colors2024['neutral-foot'],
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: 20,
  },
}));
