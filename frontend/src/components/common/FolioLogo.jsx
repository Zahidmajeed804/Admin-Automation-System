import { useEffect, useId, useRef, useState } from "react";

// Ported from the user's Claude Design project ("Folio3 Animated Logo" / Logo Loader.dc.html,
// loader.jsx + animations-v3.jsx). Only the actual choreography and easing math is kept - the
// rest of animations-v3.jsx (CompositionStage, the editor's playback bar, video export, the
// watercolor kit, tweaks-panel.jsx's tuning UI) is Claude Design's own authoring tooling and has
// no place in a production loading screen, so none of it is ported. `T` (seconds into the loop)
// replaces animations-v3.jsx's useComposition() clock; everything else renders as a pure
// function of T, exactly like the original.
//
// Used only via LogoLoader, for the one-shot post-login welcome moment - ordinary loading
// states (index.html's pre-React bootstrap, PageLoader) show the static /folio3-logo.png mark
// instead, no animation.

const COLORS = { red: "#DC3237", yellow: "#E8C04B", blue: "#5B83EC" };

// Authored scene timing from the original OM_SCENES: Assemble 1.8s, Pulse 2.4s, Exit 0.7s.
export const FOLIO_CUES = { Assemble: 0, Pulse: 1.8, Exit: 4.2 };
export const FOLIO_TOTAL = 4.9;

const Easing = {
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeInCubic: (t) => t * t * t,
};

function animate({ from, to, start, end, ease }) {
  return (t) => {
    if (t <= start) return from;
    if (t >= end) return to;
    const local = (t - start) / (end - start);
    return from + (to - from) * ease(local);
  };
}

const MOTION = {
  pop: (s, e, from, to) => animate({ from, to, start: s, end: e, ease: Easing.easeOutBack }),
  sweep: (s, e, from, to) => animate({ from, to, start: s, end: e, ease: Easing.easeInOutSine }),
  exit: (s, e, from, to) => animate({ from, to, start: s, end: e, ease: Easing.easeInCubic }),
};

// Smooth 0 -> 1 -> 0 bump between s and e (the "ripple" pulse during the Pulse scene).
const bump = (T, s, e) => (T <= s || T >= e ? 0 : Math.sin((Math.PI * (T - s)) / (e - s)) ** 2);

const LETTERS = [
  {
    k: "f",
    el: (
      <g>
        <path d="M424,1255 V990 C424,935 448,917 512,917" fill="none" stroke={COLORS.red} strokeWidth="74" />
        <rect x="348" y="1000" width="164" height="62" rx="6" fill={COLORS.red} />
      </g>
    ),
  },
  { k: "o1", el: <circle cx="662" cy="1125" r="104" fill="none" stroke={COLORS.red} strokeWidth="76" /> },
  { k: "l", el: <rect x="838" y="885" width="76" height="370" rx="8" fill={COLORS.red} /> },
  { k: "i", el: <rect x="964" y="990" width="74" height="265" rx="8" fill={COLORS.red} /> },
  { k: "o2", el: <circle cx="1215" cy="1125" r="104" fill="none" stroke={COLORS.red} strokeWidth="76" /> },
  {
    k: "3",
    el: (
      <path
        d="M1385,930 C1440,905 1535,905 1537,990 C1537,1050 1487,1070 1410,1070 C1497,1070 1545,1100 1545,1160 C1545,1230 1450,1235 1385,1210"
        fill="none"
        stroke={COLORS.red}
        strokeWidth="74"
      />
    ),
  },
];

/**
 * Pure function of `T` (seconds elapsed into one 4.9s loop) - the Folio3 wordmark assembling
 * letter by letter, the i-dot dropping in, two bubbles popping out and pulsing, then everything
 * sinking away to loop (or hold at the last frame, for a one-shot play - see FolioLogoStage).
 * `pulse` scales the ripple/pulse amplitude (1 = the authored default).
 */
export function FolioLogo({ T, pulse = 1, width = 320 }) {
  const uid = useId();
  const biteY = `folio-bite-y-${uid}`;
  const biteB = `folio-bite-b-${uid}`;
  const A = FOLIO_CUES.Assemble, P = FOLIO_CUES.Pulse, X = FOLIO_CUES.Exit;
  const amp = pulse;
  const tb = (tr) => ({ transformBox: "fill-box", transformOrigin: "50% 50%", transform: tr });

  const letters = LETTERS.map((L, i) => {
    const s = A + 0.1 + i * 0.09;
    const xs = X + 0.05 + i * 0.05;
    const y = MOTION.pop(s, s + 0.55, 90, 0)(T) + MOTION.exit(xs, xs + 0.35, 0, 60)(T);
    const sc = MOTION.pop(s, s + 0.55, 0.5, 1)(T);
    const op = MOTION.sweep(s, s + 0.2, 0, 1)(T) * MOTION.exit(xs, xs + 0.35, 1, 0)(T);
    let wave = 0;
    for (let c = 0; c < 2; c++) wave += bump(T, P + c * 1.2 + i * 0.07, P + c * 1.2 + i * 0.07 + 0.6);
    return (
      <g
        key={L.k}
        style={{ ...tb(`translateY(${y - wave * 10 * amp}px) scale(${sc})`), transformOrigin: "50% 100%", opacity: op }}
      >
        {L.el}
      </g>
    );
  });

  const bubble = (i, start, exitAt) => {
    let wave = 0;
    for (let c = 0; c < 2; c++) wave += bump(T, P + 0.3 + c * 1.2 + i * 0.14, P + 0.3 + c * 1.2 + i * 0.14 + 0.55);
    return MOTION.pop(start, start + 0.45, 0, 1)(T) * MOTION.exit(exitAt, exitAt + 0.3, 1, 0)(T) * (1 + 0.14 * amp * wave);
  };

  const dotY = MOTION.pop(A + 0.75, A + 1.2, -260, 0)(T);
  const dotOp = MOTION.sweep(A + 0.75, A + 0.9, 0, 1)(T) * MOTION.exit(X + 0.35, X + 0.6, 1, 0)(T);
  const dotS = bubble(0, A + 0.75, X + 0.35) || 0;
  const yS = bubble(1, A + 1.1, X + 0.2);
  const bS = bubble(2, A + 1.3, X);

  return (
    <svg viewBox="320 640 1300 660" style={{ width, height: "auto", overflow: "visible", display: "block" }} aria-hidden="true">
      <defs>
        <mask id={biteY} maskUnits="userSpaceOnUse" x="0" y="0" width="2000" height="2000">
          <rect width="2000" height="2000" fill="#fff" />
          <circle cx="1002" cy="910" r="64" fill="#000" />
        </mask>
        <mask id={biteB} maskUnits="userSpaceOnUse" x="0" y="0" width="2000" height="2000">
          <rect width="2000" height="2000" fill="#fff" />
          <circle cx="1076" cy="810" r="104" fill="#000" />
        </mask>
      </defs>
      {letters}
      <g mask={`url(#${biteB})`}>
        <circle cx="1258" cy="772" r="100" fill={COLORS.blue} style={tb(`scale(${bS})`)} />
      </g>
      <g mask={`url(#${biteY})`}>
        <circle cx="1076" cy="810" r="84" fill={COLORS.yellow} style={tb(`scale(${yS})`)} />
      </g>
      <circle
        cx="1002"
        cy="910"
        r="44"
        fill={COLORS.red}
        style={{ ...tb(`translateY(${dotY}px) scale(${Math.max(dotS, 0.001)})`), opacity: dotOp }}
      />
    </svg>
  );
}

/**
 * Drives FolioLogo's `T` with requestAnimationFrame. `loop` (default) repeats forever - use for
 * an indefinite loading state. Pass `loop={false}` for a one-shot play (e.g. a post-login
 * welcome moment): it holds on the final (fully exited) frame and calls `onComplete` once,
 * exactly when the authored animation finishes.
 */
export function FolioLogoStage({ loop = true, pulse = 1, width = 320, onComplete }) {
  const [T, setT] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    startRef.current = null;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setT(FOLIO_TOTAL); // hold on the settled final frame — no motion, still shows the mark
      if (!loop) {
        const timer = setTimeout(() => onComplete?.(), 400);
        return () => clearTimeout(timer);
      }
      return;
    }

    const step = (ts) => {
      if (startRef.current == null) startRef.current = ts;
      const elapsed = (ts - startRef.current) / 1000;
      if (elapsed >= FOLIO_TOTAL) {
        if (loop) {
          setT(elapsed % FOLIO_TOTAL);
          rafRef.current = requestAnimationFrame(step);
        } else {
          setT(FOLIO_TOTAL);
          if (!doneRef.current) {
            doneRef.current = true;
            onComplete?.();
          }
        }
        return;
      }
      setT(elapsed);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop]);

  return <FolioLogo T={T} pulse={pulse} width={width} />;
}
