import React, { useEffect, useRef, useState } from "react";
import animationData from "../public/reference/clawd-laptop.json";
import "./source-composer.css";

let playerPromise;
const loadPlayer = () => playerPromise ??= import("../public/reference/lottie-player.js").then((module) => module.default);

// Original ClawdLaptopInner: exact animation data, player, 80px geometry and replay.
export function SourcePet({ replayToken, listeningLoop = false, className = "" }) {
  const container = useRef(null);
  const animation = useRef(null);
  const previousToken = useRef(replayToken);
  const [ready, setReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.localMotion === "reduce");

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduceMotion(media.matches || document.documentElement.dataset.localMotion === "reduce");
    change();
    window.addEventListener("local-motion-change", change);
    media.addEventListener("change", change);
    return () => { media.removeEventListener("change", change); window.removeEventListener("local-motion-change", change); };
  }, []);

  useEffect(() => {
    let canceled = false;
    let instance;
    setReady(false);
    loadPlayer().then((player) => {
      if (canceled || !container.current) return;
      instance = player.loadAnimation({
        container: container.current,
        renderer: "svg",
        loop: listeningLoop && !reduceMotion,
        autoplay: !reduceMotion,
        animationData: structuredClone(animationData),
      });
      animation.current = instance;
      const onReady = () => {
        if (canceled) return;
        if (reduceMotion) instance.goToAndStop(Math.max(instance.totalFrames - 1, 0), true);
        setReady(true);
      };
      instance.addEventListener("DOMLoaded", onReady);
      if (instance.isLoaded) onReady();
    }).catch(() => { /* Keep the decorative slot empty if the asset cannot load. */ });
    return () => {
      canceled = true;
      instance?.destroy();
      if (animation.current === instance) animation.current = null;
    };
  }, [reduceMotion]);

  useEffect(() => {
    const instance = animation.current;
    if (!instance) return;
    instance.loop = listeningLoop && !reduceMotion;
    if (instance.loop && instance.isPaused) instance.goToAndPlay(0, true);
  }, [listeningLoop, reduceMotion, ready]);

  useEffect(() => {
    if (previousToken.current === replayToken) return;
    previousToken.current = replayToken;
    if (!reduceMotion) animation.current?.goToAndPlay(0, true);
  }, [replayToken, reduceMotion]);

  return (
    <div className={`sc-pet-slot ${className}`} aria-hidden="true">
      <button className="sc-pet" type="button" tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => { if (!reduceMotion) animation.current?.goToAndPlay(0, true); }}>
        <span className="sc-pet-animation" ref={container} data-ready={ready || undefined} />
      </button>
    </div>
  );
}
