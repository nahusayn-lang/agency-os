"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/**
 * Full-screen splash shown once per browser session when the app boots.
 *  0.00s-2.00s  logo zooms in from small, centered
 *  2.00s-4.00s  logo shrinks (100px -> 60px), still centered
 *  4.00s-5.80s  "zuhrainfo.in" types out in a monospace/coding font at the bottom, blinking cursor
 *  6.60s-8.40s  terminal-style "initializing..." replaces the loading spinner
 *  8.40s-8.80s  everything fades out, app is revealed
 */
const BRAND_TEXT = "zuhrainfo.in";
const LOGO_START_PX = 100;
const LOGO_END_PX = 60;
const TYPE_INTERVAL_MS = 150;

export function AppSplash() {
  const [mounted, setMounted] = useState(false);
  const [logoIn, setLogoIn] = useState(false);
  const [shrink, setShrink] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [showLoader, setShowLoader] = useState(false);
  const [loaderDots, setLoaderDots] = useState("");
  const [exiting, setExiting] = useState(false);
  const typeIndex = useRef(0);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("agencyos-splash-shown");
    if (alreadyShown) return;

    setMounted(true);
    const raf = requestAnimationFrame(() => setLogoIn(true));

    const tShrink = setTimeout(() => setShrink(true), 2000);

    let typeTimer: ReturnType<typeof setInterval>;
    const tTypeStart = setTimeout(() => {
      typeTimer = setInterval(() => {
        typeIndex.current += 1;
        setDisplayedText(BRAND_TEXT.slice(0, typeIndex.current));
        if (typeIndex.current >= BRAND_TEXT.length) {
          clearInterval(typeTimer);
        }
      }, TYPE_INTERVAL_MS);
    }, 4000);

    const typingDuration = BRAND_TEXT.length * TYPE_INTERVAL_MS;
    let dotsTimer: ReturnType<typeof setInterval>;
    const tLoader = setTimeout(() => {
      setShowLoader(true);
      let dotCount = 0;
      dotsTimer = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        setLoaderDots(".".repeat(dotCount));
      }, 300);
    }, 4000 + typingDuration + 800);
    const tExit = setTimeout(() => setExiting(true), 4000 + typingDuration + 800 + 1800);
    const tUnmount = setTimeout(() => {
      setMounted(false);
      sessionStorage.setItem("agencyos-splash-shown", "1");
    }, 4000 + typingDuration + 800 + 1800 + 400);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tShrink);
      clearTimeout(tTypeStart);
      clearInterval(typeTimer);
      clearTimeout(tLoader);
      clearInterval(dotsTimer);
      clearTimeout(tExit);
      clearTimeout(tUnmount);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div className="app-splash" data-exit={exiting} aria-hidden="true">
      <div className="app-splash__logo-wrap" data-in={logoIn}>
        <Image
          src="/N2.png"
          alt=""
          width={LOGO_START_PX}
          height={LOGO_START_PX}
          priority
          className="app-splash__logo"
          data-shrink={shrink}
        />
      </div>

      <div className="app-splash__bottom">
        <span className="app-splash__brand-text">
          {displayedText}
          <span className="app-splash__cursor" data-blink={!showLoader}>
            _
          </span>
        </span>

        {showLoader && (
          <span className="app-splash__terminal">
            initializing<span className="app-splash__dots">{loaderDots}</span>
          </span>
        )}
      </div>

      <style jsx>{`
        .app-splash {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #05020d;
          opacity: 1;
          transition: opacity 0.4s ease-in;
        }
        .app-splash[data-exit="true"] {
          opacity: 0;
        }

        .app-splash__logo-wrap {
          opacity: 0;
          transform: scale(0.4);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .app-splash__logo-wrap[data-in="true"] {
          opacity: 1;
          transform: scale(1);
        }

        .app-splash__logo {
          width: ${LOGO_START_PX}px;
          height: ${LOGO_START_PX}px;
          transition: width 2s ease-in-out, height 2s ease-in-out;
          filter: drop-shadow(0 0 10px rgba(199, 125, 255, 0.55))
            drop-shadow(0 0 26px rgba(157, 78, 221, 0.4));
        }
        .app-splash__logo[data-shrink="true"] {
          width: ${LOGO_END_PX}px;
          height: ${LOGO_END_PX}px;
        }

        .app-splash__bottom {
          position: absolute;
          left: 50%;
          bottom: 12%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
        }

        .app-splash__brand-text {
          font-family: ui-monospace, "SF Mono", "JetBrains Mono", "Fira Code",
            Menlo, Consolas, monospace;
          font-weight: 400;
          font-size: 11px;
          letter-spacing: 0.15em;
          color: #ffffff;
          text-shadow: 0 0 8px rgba(255, 255, 255, 0.35);
          white-space: nowrap;
          min-height: 16px;
        }

        .app-splash__cursor {
          display: inline-block;
          margin-left: 1px;
          opacity: 0;
        }
        .app-splash__cursor[data-blink="true"] {
          animation: cursor-blink 1s step-end infinite;
        }
        @keyframes cursor-blink {
          0%,
          100% {
            opacity: 0;
          }
          50% {
            opacity: 0.8;
          }
        }

        .app-splash__terminal {
          font-family: ui-monospace, "SF Mono", "JetBrains Mono", "Fira Code",
            Menlo, Consolas, monospace;
          font-size: 11px;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.5);
          animation: loader-fade-in 0.5s ease-out forwards;
        }
        @keyframes loader-fade-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .app-splash__dots {
          display: inline-block;
          width: 1.2em;
          text-align: left;
        }
      `}</style>
    </div>
  );
}