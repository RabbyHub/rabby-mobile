const mockCreateGlobalBottomSheetModal = jest.fn();
const mockRemoveGlobalBottomSheetModal = jest.fn();

jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: mockCreateGlobalBottomSheetModal,
  removeGlobalBottomSheetModal2024: mockRemoveGlobalBottomSheetModal,
}));
jest.mock('@/components2024/GlobalBottomSheetModal/types', () => ({
  MODAL_NAMES: {
    IMPORT_MORE_ADDRESS: 'IMPORT_MORE_ADDRESS',
  },
}));

describe('useShowImportMoreAddressPopup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateGlobalBottomSheetModal.mockReturnValue(
      'IMPORT_MORE_ADDRESS_test',
    );
    mockRemoveGlobalBottomSheetModal.mockResolvedValue(
      'IMPORT_MORE_ADDRESS_test',
    );
  });

  it('waits for the native dismiss lifecycle when closing the modal', async () => {
    const { dismissImportMoreAddressPopup } =
      require('./useShowImportMoreAddressPopup') as typeof import('./useShowImportMoreAddressPopup');

    await dismissImportMoreAddressPopup('IMPORT_MORE_ADDRESS_test');

    expect(mockRemoveGlobalBottomSheetModal).toHaveBeenCalledWith(
      'IMPORT_MORE_ADDRESS_test',
      { waitForDismiss: true },
    );
  });
});
