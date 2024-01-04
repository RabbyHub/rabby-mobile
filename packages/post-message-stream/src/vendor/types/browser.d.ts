// eslint-disable-next-line import/unambiguous
declare namespace browser.runtime {
  export function sendMessage<Response>(message: any): Promise<Response>;

  export const onMessage: {
    addListener(listener: (message: any) => void): void;
    removeListener(listener: (message: any) => void): void;
  };
}
