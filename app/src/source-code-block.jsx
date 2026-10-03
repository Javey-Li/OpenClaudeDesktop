import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { SourceTooltip } from "./source-tooltip";
import { createPlainCodeScheduler } from "./plain-code-scheduler.mjs";
import { createClipboardFeedback } from "./clipboard-feedback.mjs";
import { useSettledHighlight } from "./use-settled-highlight.mjs";
import { useStreamHighlight } from "./use-stream-highlight.mjs";
import { normalizeLanguage, tokenCSS } from "./highlight-model.mjs";
import { detectSecrets, maskSecrets } from "./secret-redaction-model.mjs";
import { SourceAnsiText } from "./source-ansi-text.jsx";
import { useTripleClickSelect } from "./use-triple-click-select.js";
import "./source-code-block.css";
import "./highlight-tokens.css";
import { t, tn } from "../electron/i18n/index.mjs";

// code-block-current.js:1317 Wr: a growing ANSI fence is styled only up to 20000 code units.
const ANSI_STREAM_LIMIT = 20_000;
function PlainCodeText({text,isFrontier,ansi=false}) {
  const [displayed,setDisplayed]=useState(text),scheduler=useRef(null);
  useLayoutEffect(()=>{
    const owner=createPlainCodeScheduler({initialText:text,onCommit:setDisplayed});scheduler.current=owner;
    return()=>{owner.dispose();scheduler.current=null;};
  },[]);
  useEffect(()=>{scheduler.current?.update(text,isFrontier);},[text,isFrontier]);
  const value=isFrontier?displayed:text;
  // :1566 (Pe = a !== "ansi"): an ansi fence renders its SGR colors, never escape bytes.
  return ansi&&(!isFrontier||value.length<=ANSI_STREAM_LIMIT)?<SourceAnsiText text={value}/>:value;
}

// code-block-current.js:1185-1215 Pr: the fence's ghost Eye/EyeSlash toggle,
// pressed while revealed (Nr: fill-control background, primary text).
function SecretToggle({ revealed, count, onToggle }) {
  return <button type="button" className="scb-copy scb-reveal" aria-pressed={revealed}
    aria-label={revealed ? tn(count, "Hide secret", "Hide secrets") : tn(count, "Reveal secret", "Reveal secrets")}
    onMouseDown={(event) => event.preventDefault()} onClick={onToggle}>
    <Icon name={revealed ? "EyeSlash" : "Eye"} size={16} />
  </button>;
}

// Limited settled highlighting; language never becomes a header or executable input.
// isFrontier means this particular block can still grow, not the entire message.
export function SourceCodeBlock({ text = "", language = "text", isFrontier = false, languageSettled = true, scopeKey }) {
  const [copyState, setCopyState] = useState("idle");
  const [revealed, setRevealed] = useState(false);
  const controller = useRef(null);
  const codeRef = useRef(null);
  const bodyRef = useTripleClickSelect("code");
  // code-block-current.js:1036-1042 Er and :1515-1518 (R, he, V): secrets are
  // looked for only once the fence stops growing; while masked, the displayed,
  // highlighted, copied and data-code-text text is the bullet-masked one.
  const secrets = useMemo(() => {
    if (isFrontier || !languageSettled) return null;
    const matches = detectSecrets(text);
    return matches.length ? matches : null;
  }, [text, isFrontier, languageSettled]);
  const masked = !!secrets && !revealed;
  const shown = useMemo(() => masked ? maskSecrets(text, secrets) : text, [text, secrets, masked]);
  const ansi = normalizeLanguage(language) === "ansi";
  // Stream tokens while the fence grows (and retained afterwards, official Le);
  // the settled Code palette only when no successful stream result remains.
  const stream = useStreamHighlight({ text: shown, language, isFrontier, languageSettled, scopeKey });
  const settled = useSettledHighlight({ text: shown, language, isFrontier, languageSettled, scopeKey, held: stream.retained, isHeld: stream.isHeld }, codeRef);
  const tokens = stream.tokens ?? (stream.retained ? null : settled);
  const source = stream.tokens ? "stream" : tokens ? "settled" : "plain";
  const trailing = stream.tokens ? shown.slice(stream.coveredText.length) : "";
  const statusId = useId();
  useLayoutEffect(() => {
    const feedback = createClipboardFeedback({
      writeText: (value) => {
        if (typeof navigator === "undefined" || !navigator.clipboard?.writeText)
          return Promise.reject(new Error("Clipboard unavailable"));
        return navigator.clipboard.writeText(value);
      },
      onState: setCopyState,
    });
    controller.current = feedback;
    return () => { controller.current = null; feedback.dispose(); };
  }, []);
  useLayoutEffect(() => {
    controller.current?.setText(shown);
  }, [shown, isFrontier, languageSettled]);

  const copied = copyState === "copied";
  const failed = copyState === "error";
  const singleLine = !/[\r\n]/.test(text.trimEnd()); // Geometry only; never the copy payload.
  const message = copied ? t("Copied") : failed ? t("Couldn’t copy to the clipboard. Try again.") : "";
  return <div className="scb-flow" data-not-prose="">
    {!languageSettled ? <pre className="scb-language-placeholder" aria-hidden="true" /> :
      <div className="scb-block" data-language={language} data-frontier={isFrontier || undefined}
        data-secrets={secrets ? (masked ? "masked" : "revealed") : undefined}>
        <div ref={bodyRef} className="scb-body" data-code-text={!isFrontier ? shown : undefined}>
          <pre className="scb-pre"><code ref={codeRef} className="scb-code" data-highlight-source={source}>{tokens
            ? [...tokens.map((token, index) => <span key={index} data-code-token="" style={tokenCSS(token)}>{token.text}</span>), trailing || null]
            : <PlainCodeText key={scopeKey} text={shown} isFrontier={isFrontier} ansi={ansi}/>}</code></pre>
        </div>
        {!isFrontier && <div className="scb-actions-track">
          <div className={`scb-actions${singleLine ? " scb-single-line" : ""}`}>
            {secrets && <SecretToggle revealed={revealed} count={secrets.length} onToggle={() => setRevealed((value) => !value)} />}
            <SourceTooltip content={message || t("Copy code")} automatic={true} hoverable={false}>
            <button type="button" className="scb-copy" aria-label={copied ? t("Copied") : t("Copy code")}
              aria-busy={copyState === "pending" || undefined} aria-describedby={failed ? statusId : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { void controller.current?.copy(); }}>
              <Icon name={copied ? "Check" : "Copy"} size={16} />
            </button>
            </SourceTooltip>
          </div>
        </div>}
      </div>}
    <span id={statusId} className="scb-status" role="status" aria-live="polite">{message}</span>
  </div>;
}
