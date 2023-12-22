export function getTokenSymbol(token?: {
  optimized_symbol?: string | null;
  display_symbol?: string | null;
  symbol?: string | null;
}) {
  return (
    token?.optimized_symbol || token?.display_symbol || token?.symbol || ''
  );
}
