import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

export const EntryScriptVConsole = {
  entryScriptVConsole: null as string | null,
  // Cache vconsole.min.js so that it is immediately available
  async init() {
    const fileContent =
      Platform.OS === 'ios'
        ? await RNFS.readFile(`${RNFS.MainBundlePath}/vconsole.min.js`, 'utf8')
        : await RNFS.readFileAssets('custom/vconsole.min.js');

    this.entryScriptVConsole = [
      fileContent,
      `
      ;(function() {
        function setVConsoleSwithXY(x, y) {
          localStorage.setItem('vConsole_switch_x', window.innerWidth - x + '');
          localStorage.setItem('vConsole_switch_y', window.innerHeight - y + '');
        }

        function initVConsole() {
          setVConsoleSwithXY(50, 50);
          if (window.VConsole) {
            new window.VConsole();
          } else {
            console.error("VConsole is not loaded properly.");
          }
        }

        initVConsole();
      })()`,
    ].join('\n');
    return this.entryScriptVConsole;
  },
  async get() {
    // Return from cache
    if (this.entryScriptVConsole) {
      return this.entryScriptVConsole;
    }

    // If for some reason it is not available, get it again
    return await this.init();
  },
};

/**
 * @deprecated
 */
export const JS_LOAD_V_CONSOLE = `
;(function() {
  function setVConsoleSwithXY(x, y) {
    localStorage.setItem('vConsole_switch_x', window.innerWidth - x + '');
    localStorage.setItem('vConsole_switch_y', window.innerHeight - y + '');
  }

  function loadScript(url, callback) {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url;
    script.onload = callback;
    document.head.appendChild(script);
  }

  function initVConsole() {
    setVConsoleSwithXY(50, 50);
    if (window.VConsole) {
      new window.VConsole();
    } else {
      console.error("VConsole is not loaded properly.");
    }
  }

  loadScript("https://unpkg.com/vconsole@latest/dist/vconsole.min.js", initVConsole);
})();
`;
