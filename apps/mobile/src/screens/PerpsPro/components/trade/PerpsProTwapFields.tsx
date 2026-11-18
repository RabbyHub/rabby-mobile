import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import RcTooltipTail from '@/assets2024/icons/perps/PerpsProTpSlTooltipTail.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import type { PerpsProTradeController } from '../../scene/usePerpsProTrade';
import { PERPS_PRO_TWAP_DURATION_PRESETS } from '../../model/twapOrder';

export const PerpsProTwapHint = ({ children }: { children: string }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  return (
    <View
      accessible
      accessibilityRole="alert"
      pointerEvents="none"
      style={styles.hint}>
      <RcTooltipTail
        color={colors2024['neutral-black']}
        height={8}
        width={12}
        style={styles.arrow}
      />
      <Text style={styles.hintText}>{children}</Text>
    </View>
  );
};

export const PerpsProTwapFields = React.memo(
  ({
    controller,
    onSelectTime,
  }: {
    controller: PerpsProTradeController;
    onSelectTime: () => void;
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const value = controller.form.twapDuration;
    const totalMinutes = Number(value);
    const hours = Math.floor(totalMinutes / 60);
    const label = t('page.perps.pro.twap.durationFieldLabel');
    const displayValue = value
      ? t('page.perps.pro.twap.durationFieldValue', {
          hours: t(hours === 1 ? 'global.time.hour' : 'global.time.hours', {
            t: hours,
          }),
          minutes: t('page.perps.pro.twap.minuteValue', {
            count: totalMinutes % 60,
            t: totalMinutes % 60,
          }),
        })
      : '';
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={displayValue ? { text: displayValue } : undefined}
          onPress={onSelectTime}
          style={styles.field}>
          {value ? (
            <>
              <Text style={styles.label} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.value} numberOfLines={1}>
                {displayValue}
              </Text>
            </>
          ) : (
            <Text style={styles.placeholder} numberOfLines={1}>
              {label}
            </Text>
          )}
        </Pressable>
        <View style={styles.presets}>
          {PERPS_PRO_TWAP_DURATION_PRESETS.map(minutes => (
            <Pressable
              key={minutes}
              accessibilityRole="button"
              onPress={() =>
                controller.patchForm({ twapDuration: String(minutes) })
              }
              style={({ pressed }) => [
                styles.preset,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.presetText}>
                {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
              </Text>
            </Pressable>
          ))}
        </View>
      </>
    );
  },
);
PerpsProTwapFields.displayName = 'PerpsProTwapFields';
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  field: {
    height: 42,
    borderRadius: 6,
    backgroundColor: colors2024[isLight ? 'neutral-bg-0' : 'neutral-bg-5'],
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 2,
  },
  label: {
    fontFamily: 'SF Pro',
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 12,
    includeFontPadding: false,
    color: colors2024['neutral-secondary'],
  },
  value: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    color: colors2024['neutral-title-1'],
  },
  placeholder: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    color: colors2024['neutral-info'],
  },
  presets: { flexDirection: 'row', gap: 4 },
  preset: {
    flex: 1,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024[isLight ? 'neutral-bg-0' : 'neutral-bg-5'],
  },
  presetText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    color: colors2024['neutral-title-1'],
  },
  pressed: { opacity: 0.6 },
  hint: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 6,
    left: 0,
    right: 0,
    backgroundColor: colors2024['neutral-black'],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  hintText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    includeFontPadding: false,
    color: colors2024['neutral-InvertHighlight'],
  },
  arrow: {
    position: 'absolute',
    left: 17,
    bottom: -5.5,
    transform: [{ rotate: '180deg' }],
  },
}));
