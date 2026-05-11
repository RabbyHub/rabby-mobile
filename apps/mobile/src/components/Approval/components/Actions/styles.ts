import { createGetStyles2024 } from '@/utils/styles';

export const getActionsStyle = createGetStyles2024(
  ({ colors, colors2024 }) => ({
    signTitle: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 15,
    },
    signTitleText: {
      color: colors['neutral-title-1'],
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 19,
    },
    leftContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    leftText: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 18,
    },
    speedUpIcon: {
      width: 16,
      marginRight: 4,
    },
    rightText: {
      fontSize: 14,
      lineHeight: 16,
      color: '#999999',
    },
    actionWrapper: {
      gap: 12,
    },
    actionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    decodeTooltip: {
      maxWidth: 358,
    },
    isUnknown: {},
    isUnknownText: {
      // color: colors['neutral-foot'],
    },
    container: {
      paddingHorizontal: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    containerLeft: {
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 19,
      color: '#222222',
    },
    containerRight: {
      fontSize: 14,
      lineHeight: 16,
      color: '#999999',
    },
    viewRawText: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 20,
    },
    signTitleRight: {
      flexDirection: 'row',
      alignItems: 'center',
      float: 'right',
    },
    tipContent: {
      maxWidth: 358,
      padding: 12,
      alignItems: 'center',
      flexDirection: 'row',
    },
    tipContentIcon: {
      width: 12,
      height: 12,
      marginRight: 4,
    },
    actionHeaderRight: {
      fontSize: 14,
      lineHeight: 16,
      position: 'relative',
    },
    icon: {
      width: 20,
      height: 20,
      marginRight: 2,
      marginTop: 2,
      color: colors2024['neutral-info'],
    },
    signTitleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    chainInfo: {
      flexDirection: 'row',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    rpcBadge: {
      top: -2,
      right: -2,
      width: 8,
      height: 8,
    },
  }),
);
