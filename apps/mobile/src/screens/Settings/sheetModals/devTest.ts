export const makeNoop = () => () => {};

type GenerateNodeCtx = {};
export type DevTestItem = {
  disabled?: boolean;
  visible?: boolean;
  label: string;
  icon?: /* ((ctx: GenerateNodeCtx) => React.ReactNode) |  */ React.ReactNode;
  rightNode?: React.ReactNode | ((ctx?: GenerateNodeCtx) => React.ReactNode);
  onPress?: () => void;
};
