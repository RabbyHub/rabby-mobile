export const JS_LOAD_V_CONSOLE = `
(function() {
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
