// Original command matching, including physical-key versus character rules.
const Wo = () =>
    typeof navigator !== "undefined" && /Mac/.test(navigator.platform),
  yc = () =>
    typeof navigator !== "undefined" && /Linux/.test(navigator.platform);
const d6 = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const f6 = [...d6, "0"].flatMap((e) => {
  let t = e === "0" ? "newPreset" : `selectPreset${e}`,
    n = `Digit${e}`;
  return [
    {
      command: t,
      key: `cmd+alt+${e}`,
      code: n,
      mac: !0,
      gate: "sessionPresets",
    },
    {
      command: t,
      key: `alt+${e}`,
      code: n,
      mac: !1,
      when: "isClaudeApp || !isLinux",
      gate: "sessionPresets",
    },
  ];
});
const p6 = d6.map((e) => ({
  command: `selectBrowserTab${e}`,
  key: `cmd+${e}`,
  code: `Digit${e}`,
  when: "isClaudeApp",
  gate: "browserTabStrip",
}));
const m6 = [
  {
    command: "togglePreview",
    key: "cmd+shift+b",
    code: "KeyB",
    when: "isClaudeApp",
    gate: "externalPreviewAvailable",
  },
  {
    command: "togglePreview",
    key: "cmd+shift+p",
    code: "KeyP",
    when: "isClaudeApp",
  },
  {
    command: "togglePreview",
    key: "cmd+alt+p",
    code: "KeyP",
    when: "!isClaudeApp",
  },
  {
    command: "toggleDiff",
    key: "cmd+shift+d",
    code: "KeyD",
    when: "isClaudeApp",
  },
  {
    command: "toggleDiff",
    key: "ctrl+shift+d",
    code: "KeyD",
    when: "!isClaudeApp",
  },
  {
    command: "toggleTerminal",
    key: "cmd+j",
    code: "KeyJ",
    matchBy: "char",
    when: "isClaudeApp",
    mac: !0,
  },
  { command: "toggleTerminal", key: "ctrl+`", code: "Backquote" },
  { command: "toggleBrowser", key: "cmd+shift+f", code: "KeyF" },
  { command: "closePane", key: "cmd+\\", code: "Backslash" },
  { command: "toggleExpandPane", key: "cmd+shift+\\", code: "Backslash" },
  { command: "cycleTranscriptMode", key: "ctrl+o", code: "KeyO" },
  { command: "backgroundTasks", key: "ctrl+b", code: "KeyB", matchBy: "key" },
  {
    command: "openModeMenu",
    key: "cmd+shift+m",
    code: "KeyM",
    when: "isClaudeApp",
  },
  { command: "openModeMenu", key: "cmd+alt+m", code: "KeyM" },
  { command: "openModelMenu", key: "cmd+shift+i", code: "KeyI" },
  { command: "openEffortMenu", key: "cmd+shift+e", code: "KeyE" },
  { command: "toggleFastMode", key: "cmd+alt+f", code: "KeyF" },
  { command: "toggleSelectionMode", key: "cmd+shift+s", code: "KeyS" },
  {
    command: "toggleSketchMode",
    key: "cmd+shift+x",
    code: "KeyX",
    when: "isClaudeApp",
  },
  {
    command: "jumpPrevPrompt",
    key: "cmd+alt+up",
    code: "ArrowUp",
    mac: !0,
    gate: "promptJump",
  },
  {
    command: "jumpPrevPrompt",
    key: "alt+up",
    code: "ArrowUp",
    mac: !1,
    gate: "promptJump",
  },
  {
    command: "jumpNextPrompt",
    key: "cmd+alt+down",
    code: "ArrowDown",
    mac: !0,
    gate: "promptJump",
  },
  {
    command: "jumpNextPrompt",
    key: "alt+down",
    code: "ArrowDown",
    mac: !1,
    gate: "promptJump",
  },
  { command: "sketchDeleteSelection", key: "backspace", code: "Backspace" },
  { command: "sketchDeleteSelection", key: "delete", code: "Delete" },
  { command: "sketchDeselect", key: "esc", code: "Escape" },
  { command: "nextDiffChange", key: "alt+f5", code: "F5", when: "!isLinux" },
  { command: "nextDiffChange", key: "f7", code: "F7" },
  {
    command: "prevDiffChange",
    key: "shift+alt+f5",
    code: "F5",
    when: "!isLinux",
  },
  { command: "prevDiffChange", key: "shift+f7", code: "F7" },
  ...f6,
  ...p6,
  {
    command: "toggleSideChat",
    key: "cmd+;",
    code: "Semicolon",
    matchBy: "char",
  },
  {
    command: "newPreviewTab",
    key: "cmd+t",
    code: "KeyT",
    matchBy: "char",
    when: "isClaudeApp",
  },
  {
    command: "toggleDiffFileList",
    key: "cmd+shift+y",
    code: "KeyY",
    matchBy: "char",
    when: "isClaudeApp",
  },
  {
    command: "toggleDiffFileList",
    key: "ctrl+shift+y",
    code: "KeyY",
    matchBy: "char",
    when: "!isClaudeApp",
  },
  {
    command: "reopenClosed",
    key: "cmd+shift+t",
    code: "KeyT",
    matchBy: "char",
    when: "isClaudeApp",
  },
  { command: "goToDiffFile", key: "cmd+p", code: "KeyP", matchBy: "char" },
  { command: "saveFile", key: "cmd+s", code: "KeyS", matchBy: "char" },
  { command: "findInFile", key: "cmd+f", code: "KeyF", matchBy: "char" },
  {
    command: "attachTerminalOutput",
    key: "cmd+shift+l",
    code: "KeyL",
    matchBy: "char",
  },
  { command: "sketchUndo", key: "cmd+z", code: "KeyZ", matchBy: "char" },
  { command: "sketchRedo", key: "cmd+shift+z", code: "KeyZ", matchBy: "char" },
  {
    command: "sketchRedo",
    key: "ctrl+y",
    code: "KeyY",
    matchBy: "char",
    mac: !1,
  },
];
function h6(e) {
  let t = e.split("+");
  return {
    cmd: t.includes("cmd"),
    ctrl: t.includes("ctrl"),
    shift: t.includes("shift"),
    alt: t.includes("alt"),
  };
}
function g6(e, t, n) {
  let r = n && t.cmd,
    i = t.ctrl || (!n && t.cmd);
  return (
    e.metaKey === r &&
    e.ctrlKey === i &&
    e.shiftKey === t.shift &&
    e.altKey === t.alt
  );
}
function _6(e, t, n) {
  return e === "isClaudeApp"
    ? t
    : e === "!isClaudeApp"
      ? !t
      : e === "isClaudeApp || !isLinux"
        ? t || !n
        : e !== "!isLinux" || !n;
}
function v6(e, t) {
  return e === "externalPreviewAvailable"
    ? !!t.externalPreviewAvailable
    : e === "promptJump"
      ? !!t.promptJump
      : e === "sessionPresets"
        ? !!t.sessionEnvironments
        : e !== "browserTabStrip" || !!t.browserTabStrip;
}
function y6(e, t) {
  if (typeof e.key != "string") return null;
  let n = t.mac ?? Wo(),
    r = t.linux ?? yc();
  for (let i of m6)
    if (!(t.commands !== void 0 && !t.commands.includes(i.command))) {
      if (i.matchBy === "key") {
        if (e.key.toLowerCase() !== i.key.split("+").at(-1)) continue;
      } else if (i.matchBy === "char") {
        if (!x6(e, i.key.split("+").at(-1), i.code)) continue;
      } else if (!b6(e, i.code)) continue;
      if (
        _6(i.when, t.isClaudeApp, r) &&
        (i.mac === void 0 || i.mac === n) &&
        v6(i.gate, t) &&
        g6(e, h6(i.key), n)
      )
        return i.command;
    }
  return null;
}
function b6(e, t) {
  return [...e.key].length > 1 &&
    e.key !== "Dead" &&
    e.key !== "Unidentified" &&
    /^(Key[A-Z]|Digit\d)$/.test(e.code)
    ? e.key === t
    : e.code === t;
}
function x6(e, t, n) {
  return /^[ -~]$/.test(e.key) ? e.key.toLowerCase() === t : b6(e, n);
}
function C6(e, t, n) {
  return w6(e, t, n)[0];
}
function w6(e, t, n) {
  let r = n?.mac ?? Wo(),
    i = n?.linux ?? yc(),
    a = [];
  for (let o of m6)
    o.command === e &&
      _6(o.when, t, i) &&
      (o.mac === void 0 || o.mac === r) &&
      v6(o.gate, n ?? {}) &&
      a.push(o.key);
  return a;
}
export { y6 as matchSketchCommand, C6 as sketchShortcut };
