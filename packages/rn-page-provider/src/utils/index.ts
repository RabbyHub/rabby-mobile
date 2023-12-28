import { keyBy } from "lodash";
import browser from "webextension-polyfill";
import { ledgerUSBVendorId } from "@ledgerhq/devices";

import BroadcastChannelMessage from "./message/broadcastChannelMessage";
import PortMessage from "./message/portMessage";

const Message = {
  BroadcastChannelMessage,
  PortMessage,
};

declare global {
  const langLocales: Record<string, Record<"message", string>>;
}

const t = (name) => browser.i18n.getMessage(name);

const format = (str, ...args) => {
  return args.reduce((m, n) => m.replace("_s_", n), str);
};

export { Message, t, format };

export const hasConnectedLedgerDevice = async () => {
  // const devices = await navigator.hid.getDevices();
  // return (
  //   devices.filter((device) => device.vendorId === ledgerUSBVendorId).length > 0
  // );
};
