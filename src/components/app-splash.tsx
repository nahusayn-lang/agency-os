"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/**
 * Full-screen splash shown once per browser session when the app boots.
 *  0.00s-0.30s  logo fades in, centered
 *  0.30s-1.14s  "zuhrainfo.in" types out in a monospace/coding font at the bottom, blinking cursor
 *  1.14s-2.94s  terminal-style "initializing..." loader with animated dots
 *  2.94s-3.34s  everything fades out, app is revealed
 */
const BRAND_TEXT = "zuhrainfo.in";
const LOGO_PX = 72;
const TYPE_INTERVAL_MS = 70;

export function AppSplash() {
  const [mounted, setMounted] = useState(false);
  const [logoIn, setLogoIn] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [showLoader, setShowLoader] = useState(false);
  const [loaderDots, setLoaderDots] = useState("");
  const [exiting, setExiting] = useState(false);
  const typeIndex = useRef(0);

  useEffect(() => {
    // Whatever happens next, the anti-flash guard from layout.tsx has done
    // its job the moment we're here (React has hydrated) — release the
    // real app immediately. If we're skipping the splash below, the app
    // just appears normally; if we're not, AppSplash (z-index 9999) is
    // about to cover it anyway, so revealing #app-content underneath is
    // invisible to the user either way.
    document.documentElement.classList.remove("splash-pending");

    const alreadyShown = sessionStorage.getItem("agencyos-splash-shown");
    if (alreadyShown) return;

    setMounted(true);
    const raf = requestAnimationFrame(() => setLogoIn(true));

    let typeTimer: ReturnType<typeof setInterval>;
    const tTypeStart = setTimeout(() => {
      typeTimer = setInterval(() => {
        typeIndex.current += 1;
        setDisplayedText(BRAND_TEXT.slice(0, typeIndex.current));
        if (typeIndex.current >= BRAND_TEXT.length) {
          clearInterval(typeTimer);
        }
      }, TYPE_INTERVAL_MS);
    }, 300);

    const typingDuration = BRAND_TEXT.length * TYPE_INTERVAL_MS;
    let dotsTimer: ReturnType<typeof setInterval>;
    const tLoader = setTimeout(() => {
      setShowLoader(true);
      let dotCount = 0;
      dotsTimer = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        setLoaderDots(".".repeat(dotCount));
      }, 300);
    }, 300 + typingDuration);
    const tExit = setTimeout(() => setExiting(true), 300 + typingDuration + 1800);
    const tUnmount = setTimeout(() => {
      setMounted(false);
      sessionStorage.setItem("agencyos-splash-shown", "1");
    }, 300 + typingDuration + 1800 + 400);

    return () => {
      cancelAnimationFrame(raf);
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
          width={LOGO_PX}
          height={LOGO_PX}
          priority
          className="app-splash__logo"
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
          transition: opacity 0.3s ease-out;
        }
        .app-splash__logo-wrap[data-in="true"] {
          opacity: 1;
        }

        .app-splash__logo {
          width: ${LOGO_PX}px;
          height: ${LOGO_PX}px;
          filter: drop-shadow(0 0 10px rgba(199, 125, 255, 0.55))
            drop-shadow(0 0 26px rgba(157, 78, 221, 0.4));
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