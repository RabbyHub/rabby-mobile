import IconRabby from "../../assets/rabby.svg";
import IconWarning from "../../assets/warning.svg";
import IconArrow from "../../assets/arrow.svg";
import notice from "../notice";
import { isInSameOriginIframe } from "../../utils/iframe";

let instance: ReturnType<typeof notice> | null;

interface Chain {
  [key: string]: any;
  id: number;
  name: string;
  isTestnet: boolean;
}

export const switchChainNotice = (
  chain: Chain & {
    prev?: Chain;
  }
) => {
  if (isInSameOriginIframe()) {
    return;
  }
  if (instance) {
    instance.hide();
    instance = null;
  }
  const isSwitchToMainnet =
    chain?.prev && chain?.prev?.isTestnet && !chain?.isTestnet;
  const isSwitchToTestnet =
    chain?.prev && !chain?.prev?.isTestnet && chain?.isTestnet;

  const rawContent = `<img style="width: 20px; margin-right: 8px;" src="${IconRabby}"/>Switched to <span class="rabby-strong" style="margin: 0 8px;">${chain?.name}</span> for the current Dapp`;
  let content = rawContent;
  if (isSwitchToMainnet || isSwitchToTestnet) {
    content = `
    <div>
      <div style="display: flex; align-items: center; justify-content: center;">
        ${rawContent}
      </div>
      <div style="display: flex;align-items:center;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid #d3d8e0;border-top-width:0.5px;">
        <img style="width: 14px;" src="${IconWarning}"/>
        ${
          isSwitchToMainnet
            ? `Testnet <img style="width: 14px;" src="${IconArrow}"/> Mainnet`
            : ""
        }
        ${
          isSwitchToTestnet
            ? `Mainnet <img style="width: 14px;" src="${IconArrow}"/> Testnet`
            : ""
        }
      </div>
    </div>
    `;
  }

  instance = notice({
    timeout: 3000,
    content,
  });
};
