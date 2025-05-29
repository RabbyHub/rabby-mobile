export class MiniApprovalError extends Error {
  constructor(
    message: string,
    args: {
      cause?: MiniApprovalError | Error | undefined;
      name?: string | undefined;
    } = {},
  ) {
    // @ts-ignore
    super(message, args.cause ? { cause: args.cause } : undefined);

    this.name = args.name || 'MiniApprovalError';
  }
}
