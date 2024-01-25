// keep isMetaMask and remove isRabby
const impersonateMetamaskWhitelist = [
  // layerzero
  "bitcoinbridge.network",
  "bridge.liquidswap.com",
  "theaptosbridge.com",
  "app.actafi.org",

  "bridge.linea.build",
  "bridge.coredao.org",

  // rainbow
  "telx.network",
];

// keep isRabby and remove isMetaMask
const rabbyHostList: string[] = [];

/**
 * Detect current host is includes target host
 * @param current
 * @param target
 * @returns
 */
const isIncludesHost = (current: string, target: string) => {
  return current === target || current.endsWith(`.${target}`);
};

const isInHostList = (list: string[], host: string) => {
  return list.some((target) => isIncludesHost(host, target));
};

// generates a hash value for a sting
// same as djb2 hash function
const djb2 = (str: string) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
};

const rootDomainList = [
  "eth.limo",
  "eth.link",
  "github.com",
  "github.io",
  "ipfs.io",
  "linktr.ee",
  "surge.sh",
  "vercel.com",
];

const getRootDomain = (host: string) => {
  return host.split(".").slice(-2).join(".");
};

export const calcIsGray = (host: string, ratio: number) => {
  let domain = getRootDomain(host);
  if (isInHostList(rootDomainList, host)) {
    domain = host;
  }
  return (djb2(domain) % 100) / 100 <= ratio;
};

type Mode = "metamask" | "rabby" | "default";

export const getProviderMode = (host: string): Mode => {
  if (isInHostList(impersonateMetamaskWhitelist, host)) {
    return "metamask";
  }
  if (isInHostList(rabbyHostList, host)) {
    return "rabby";
  }
  return "default";
};

export const patchProvider = (provider: any) => {
  const mode = getProviderMode(window.location.hostname);
  try {
    if (mode === "metamask") {
      delete provider.isRabby;
      provider.isMetaMask = true;
      return;
    }
    if (mode === "rabby") {
      delete provider.isMetaMask;
      provider.isRabby = true;
      return;
    }
    if (mode === "default") {
      provider.isMetaMask = true;
      provider.isRabby = true;
      return;
    }
  } catch (e) {
    console.error(e);
  }
};
