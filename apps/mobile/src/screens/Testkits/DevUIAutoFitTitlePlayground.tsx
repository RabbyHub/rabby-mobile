import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AutoFitHeaderTitle } from '@/components/AutoFitHeaderTitle';
import { Text } from '@/components/Typography';
import { HeaderBackButton } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import i18n, { addResourceBundle, SupportedLang } from '@/utils/i18n';

// Languages the app ships; the playground previews any of them without
// touching the app language.
const LANGS: SupportedLang[] = [
  SupportedLang['zh-CN'],
  SupportedLang['en-US'],
  SupportedLang['de-DE'],
  SupportedLang['pt-PT'],
  SupportedLang['fr-FR'],
];
type Lang = SupportedLang;

const HEADER_ROW_HEIGHT = 48;
const MIN_CHARS = 8;
const MAX_CHARS = 120;
const CHAR_STEP = 8;

const DEFAULT_LENGTHS = {
  header: 48,
  full: 64,
  narrow: 32,
  tiny: 16,
};

function buildSampleText(base: string, chars: number) {
  let result = base.trim();
  if (!result) {
    result = 'Header title';
  }
  while (result.length < chars) {
    result += ` ${base.trim()}`;
  }
  return result.slice(0, chars);
}

export default function DevUIAutoFitTitlePlayground() {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const insets = useSafeAreaInsets();

  const [lang, setLang] = React.useState<Lang>(SupportedLang['pt-PT']);
  const [lengths, setLengths] = React.useState(DEFAULT_LENGTHS);
  const [measureInfo, setMeasureInfo] = React.useState<{
    stage: string;
    lineCount: number;
    firstLineWidth?: number;
  } | null>(null);

  const baseTitle = React.useMemo(() => {
    // Locale bundles are loaded on demand; make sure the previewed language is
    // available before translating with it.
    addResourceBundle(lang);
    const tFor = i18n.getFixedT(lang);
    const translated = tFor('screens.addressStackTitle.ImportMethods');
    return translated === 'screens.addressStackTitle.ImportMethods'
      ? 'Select import method'
      : translated;
  }, [lang]);

  const headerText = buildSampleText(baseTitle, lengths.header);
  const fullText = buildSampleText(baseTitle, lengths.full);
  const narrowText = buildSampleText(baseTitle, lengths.narrow);
  const tinyText = buildSampleText(baseTitle, lengths.tiny);

  const stepLength = React.useCallback(
    (key: keyof typeof DEFAULT_LENGTHS, direction: 1 | -1) => {
      setLengths(prev => {
        const next = Math.min(
          MAX_CHARS,
          Math.max(MIN_CHARS, prev[key] + direction * CHAR_STEP),
        );
        return { ...prev, [key]: next };
      });
    },
    [],
  );

  const renderStepper = (key: keyof typeof DEFAULT_LENGTHS, label: string) => (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable
        style={styles.stepButton}
        onPress={() => stepLength(key, -1)}
        hitSlop={8}>
        <Text style={styles.stepButtonText}>-</Text>
      </Pressable>
      <Text style={styles.stepValue}>{lengths[key]}</Text>
      <Pressable
        style={styles.stepButton}
        onPress={() => stepLength(key, 1)}
        hitSlop={8}>
        <Text style={styles.stepButtonText}>+</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* Page header: the same auto-fit title component used in production
          headers. The row height is fixed, so a longer title only changes the
          glyphs inside it. */}
      <View style={[styles.headerOuter, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <View style={styles.backSlot}>
            <HeaderBackButton
              style={styles.backButtonTouch}
              tintColor={colors2024['neutral-title-1']}
            />
          </View>
          <View style={styles.headerCenter}>
            <AutoFitHeaderTitle
              text={headerText}
              textStyle={styles.headerTitle}
              onMeasure={setMeasureInfo}
            />
          </View>
          <View style={styles.rightSlot} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>LANGUAGE</Text>
        <View style={styles.chipRow}>
          {LANGS.map(item => (
            <Pressable
              key={item}
              onPress={() => setLang(item)}
              style={[styles.chip, lang === item && styles.chipActive]}>
              <Text
                style={[
                  styles.chipText,
                  lang === item && styles.chipTextActive,
                ]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>LENGTH (CHARACTERS)</Text>
        <Text style={styles.previewLabel}>
          {measureInfo
            ? `last measure: stage=${measureInfo.stage} lines=${
                measureInfo.lineCount
              } lineWidth=${Math.round(measureInfo.firstLineWidth ?? 0)}`
            : 'last measure: (waiting)'}
        </Text>
        {renderStepper('header', 'header')}
        {renderStepper('full', 'page full')}
        {renderStepper('narrow', 'page narrow')}
        {renderStepper('tiny', 'page tiny')}

        <Text style={styles.sectionTitle}>IN PAGE</Text>
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>full width</Text>
          <View style={styles.previewRow}>
            <AutoFitHeaderTitle
              text={fullText}
              textStyle={styles.previewTitle}
            />
          </View>
        </View>
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>narrow slot (160)</Text>
          <View style={[styles.previewRow, styles.previewRowNarrow]}>
            <AutoFitHeaderTitle
              text={narrowText}
              textStyle={styles.previewTitle}
            />
          </View>
        </View>
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>tiny slot (96)</Text>
          <View style={[styles.previewRow, styles.previewRowTiny]}>
            <AutoFitHeaderTitle
              text={tinyText}
              textStyle={styles.previewTitle}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  headerOuter: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  headerRow: {
    height: HEADER_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backSlot: {
    width: 44,
    height: HEADER_ROW_HEIGHT,
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexShrink: 0,
  },
  backButtonTouch: {
    width: '100%',
    height: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  rightSlot: {
    width: 44,
    height: HEADER_ROW_HEIGHT,
    flexShrink: 0,
  },
  headerTitle: {
    color: colors2024['neutral-title-1'],
  },
  content: {
    padding: 16,
    paddingBottom: 64,
  },
  sectionTitle: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  chipActive: {
    borderColor: colors2024['brand-default'],
    backgroundColor: colors2024['brand-light-1'],
  },
  chipText: {
    color: colors2024['neutral-body'],
    fontSize: 13,
  },
  chipTextActive: {
    color: colors2024['brand-default'],
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  stepperLabel: {
    color: colors2024['neutral-title-1'],
    fontSize: 14,
  },
  stepButton: {
    width: 36,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
  },
  stepButtonText: {
    color: colors2024['neutral-title-1'],
    fontSize: 18,
    fontWeight: '600',
  },
  stepValue: {
    minWidth: 40,
    textAlign: 'center',
    color: colors2024['neutral-title-1'],
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  previewCard: {
    marginBottom: 12,
  },
  previewLabel: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    marginBottom: 6,
  },
  // Fixed height: the auto-fit title changes only inside this box, so the page
  // below never moves.
  previewRow: {
    height: HEADER_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  previewRowNarrow: {
    width: 160,
  },
  previewRowTiny: {
    width: 96,
  },
  previewTitle: {
    color: colors2024['neutral-title-1'],
  },
}));
