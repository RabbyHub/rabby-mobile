import {
  useGasAccountInfo,
  useGasAccountInfoV2,
} from '@/screens/GasAccount/hooks';

export const useGasAccountBalance = (gasAccountAddress: string) => {
  const { value: gasAccountInfo } = useGasAccountInfo();
  const fallbackGasAccountInfo = useGasAccountInfoV2({
    address: !gasAccountInfo?.account ? gasAccountAddress : undefined,
  });

  return (
    gasAccountInfo?.account.balance ||
    fallbackGasAccountInfo?.data?.account?.balance ||
    0
  );
};
