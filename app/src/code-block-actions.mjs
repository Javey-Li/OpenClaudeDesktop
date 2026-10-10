// What a transcript code block can do beyond Copy, from the session that shows it (main.jsx provides it around the
// transcript): runInTerminal(command) types a shell block into a new tab of that side's terminal pane (2.2553.1
// cbd5abfdb code block "Run in terminal"). null where there is no terminal (a session without a local folder).
import React from "react";

export const CodeBlockActionsContext = React.createContext(null);

// Fence languages that hold shell commands (the official Play button shows for these only).
const SHELL_LANGUAGES = new Set(["bash", "sh", "shell", "zsh", "console", "shellsession", "sh-session"]);
export const isShellLanguage = (language) => SHELL_LANGUAGES.has(String(language ?? "").trim().toLowerCase());

/**
 * The text a shell block types into the terminal: a console transcript's "$ " prompts dropped (lines without one are
 * its output, left out), line endings as Enter presses, and a final Enter.
 */
export function terminalCommandText(text, language) {
  let lines = String(text ?? "").replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  if (["console", "shellsession", "sh-session"].includes(String(language ?? "").toLowerCase()) && lines.some((line) => /^\s*[$%#] /.test(line)))
    lines = lines.filter((line) => /^\s*[$%#] /.test(line)).map((line) => line.replace(/^\s*[$%#] /, ""));
  const body = lines.join("\r").trim();
  return body ? `${body}\r` : "";
}
