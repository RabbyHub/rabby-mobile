import React from 'react';
import { Text, View } from 'react-native';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import IconCloseCC from '@/assets2024/icons/common/close-cc.svg';
import { Tip } from '@/components';

export const DisableBorrowTip = ({
  children,
  showTip,
}: {
  children: React.ReactNode;
  showTip: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  if (!showTip) {
    return children;
  }
  return (
    <Tip
      contentStyle={styles.contentStyle}
      parentWrapperStyle={styles.parentWrapperStyle}
      content={
        <View style={styles.hfTipsContent}>
          <Text style={styles.hfTipsContentText}>
            {t('page.Lending.disableBorrowTip.desc')}
          </Text>
          <IconCloseCC
            width={20}
            height={20}
            color={colors2024['neutral-secondary']}
          />
        </View>
      }>
      {children}
    </Tip>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    paddingTop: 0,
    paddingBottom: 16,
  },
  topSection: {
    paddingHorizontal: 0,
    paddingVertical: 12,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  rowCompact: {
    justifyContent: 'flex-start',
  },
  metricItem: {
    flex: 1,
    paddingHorizontal: 7,
    gap: 6,
  },
  metricItemCompact: {
    flex: 0,
    width: '33.33%',
  },
  hidden: {
    display: 'none',
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  metricValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'left',
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  healthValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  healthTag: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors2024['green-light-1'],
  },
  healthTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  netApyValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'left',
  },
  divider: {
    height: 1,
    backgroundColor: colors2024['neutral-bg-5'],
    marginTop: 0,
    marginHorizontal: 0,
  },
  bottomSection: {
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  healthFactorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sectionHeader: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'SF Pro Rounded',
  },
  hfTipsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  hfTipsContentText: {
    width: '80%',
    height: '100%',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-InvertHighlight'],
  },
  moreContainer: {
    height: 14,
  },
  moreText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
  },
  closeButton: {},
  parentWrapperStyle: {
    width: '100%',
  },
  contentStyle: {
    paddingHorizontal: 12,
    paddingRight: 19,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
}));
