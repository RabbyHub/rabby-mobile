import React from 'react';
import { act, render } from '@testing-library/react-native';

const mockSetHDPathType = jest.fn();
const mockSetSetting = jest.fn();
let mockMainContainerProps:
  | {
      onConfirm: (value: { hdPath: string; startNumber: number }) => void;
    }
  | undefined;

const mockSettingAtom = {};
const mockIsLoadedAtom = {};

jest.mock('@/core/apis', () => ({
  apiTrezor: {
    setHDPathType: (...args: unknown[]) => mockSetHDPathType(...args),
  },
}));

jest.mock('jotai', () => ({
  useAtom: (atom: unknown) =>
    atom === mockSettingAtom
      ? [{ hdPath: 'LedgerLive', startNumber: 1 }, mockSetSetting]
      : [true, jest.fn()],
}));

jest.mock('./MainContainer', () => ({
  settingAtom: mockSettingAtom,
  isLoadedAtom: mockIsLoadedAtom,
  MainContainer: (props: typeof mockMainContainerProps) => {
    mockMainContainerProps = props;
    return null;
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@rabby-wallet/eth-keyring-ledger/dist/utils', () => ({
  LedgerHDPathType: {
    LedgerLive: 'LedgerLive',
    BIP44: 'BIP44',
    Legacy: 'Legacy',
  },
}));

const { SettingTrezor } =
  require('./SettingTrezor') as typeof import('./SettingTrezor');

describe('SettingTrezor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMainContainerProps = undefined;
  });

  it('does not publish an unapplied setting when the device update fails', async () => {
    const onDone = jest.fn();
    const nextSetting = { hdPath: 'BIP44', startNumber: 12 };
    mockSetHDPathType.mockRejectedValueOnce(new Error('Trezor disconnected'));

    render(<SettingTrezor onDone={onDone} />);

    await act(async () => {
      await mockMainContainerProps?.onConfirm(nextSetting);
    });

    expect(mockSetSetting).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith();
    expect(onDone).not.toHaveBeenCalledWith(nextSetting);
  });
});
