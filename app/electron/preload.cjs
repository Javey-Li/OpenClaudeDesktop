const { contextBridge, ipcRenderer, webUtils } = require("electron");
// First-paint appearance ({theme, mode}) read once, synchronously, before the
// renderer's first frame; main.cjs answers from the saved preference and
// nativeTheme. A failure leaves the renderer on its media-query fallback.
let appearance = null;
try { appearance = ipcRenderer.sendSync("desktop:appearance") ?? null; } catch {}
contextBridge.exposeInMainWorld("desktop", {
  call: (action, params) => ipcRenderer.invoke("desktop:call", action, params),
  appearance,
  // Finder drops arrive as File objects; only the main process may stat them.
  pathForFile: (file) => { try { return webUtils.getPathForFile(file) || ""; } catch { return ""; } },
  onEvent: (handler) => {
    const listener = (_e, event) => handler(event);
    ipcRenderer.on("desktop:event", listener);
    return () => ipcRenderer.removeListener("desktop:event", listener);
  },
});
