interface IsLpTokenProps {
  is_verified?: boolean;
  is_core?: boolean;
  protocol_id?: string;
}
export const isLpToken = (token: IsLpTokenProps) => {
  return !!token.is_verified && !token.is_core && !!token.protocol_id;
};

export const lpTokenFilter = (
  item: IsLpTokenProps,
  isLpTokenEnabled?: boolean,
) => (isLpTokenEnabled ? isLpToken(item) : !isLpToken(item));
