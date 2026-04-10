export const getIsGasAccountLoggedIn = ({
  sig,
  accountId,
}: {
  sig?: string;
  accountId?: string;
  gasAccountId?: string;
}) => {
  return Boolean(sig && accountId);
};
