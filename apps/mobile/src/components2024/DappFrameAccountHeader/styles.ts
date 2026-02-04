import { createGetStyles2024 } from '@/utils/styles';

export const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },

  addressContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walletIcon: {},
  address: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    color: colors2024['neutral-foot'],
  },
  reverseCaret: {
    transform: [{ rotate: '180deg' }],
  },

  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 14,
    height: 14,
    transform: [{ rotate: '180deg' }],
  },
  marketPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: 'rgba(22, 82, 240, 0.06)',
  },
  marketIcon: {
    width: 20,
    height: 20,
    borderRadius: 20,
  },
  marketTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  marketText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
  marketCaret: {
    width: 10,
    height: 8,
    transform: [
      {
        rotate: '-90deg',
      },
    ],
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetContainer: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 8,
  },
  sheetTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    marginBottom: 20,
  },
  sheetList: {
    gap: 8,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  sheetItemActive: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-light-2'],
  },
  sheetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sheetItemIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
  },
  sheetItemTextGroup: {
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  sheetItemTitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
  sheetItemSubtitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  sheetItemMeta: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  sheetItemRight: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
    marginLeft: 12,
  },

  perpsDappRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  perpsDappBalance: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  perpsDappPositions: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
}));
