"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Full-screen splash shown once per browser session when the app boots.
 * Sequence (~1.4s total):
 *  0.00s-0.45s  bg fade-in + logo 3D swing-in reveal + glow ignites
 *  0.45s-0.55s  brand text fades in with upward drift
 *  0.55s-1.00s  gentle glow "breathing" pulse hold
 *  1.00s-1.35s  everything fades out
 */
export function AppSplash() {
  const [stage, setStage] = useState<"idle" | "enter" | "hold" | "exit">("idle");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("agencyos-splash-shown");
    if (alreadyShown) return;

    setMounted(true);
    const t1 = requestAnimationFrame(() => setStage("enter"));
    const t2 = setTimeout(() => setStage("hold"), 450);
    const t3 = setTimeout(() => setStage("exit"), 1000);
    const t4 = setTimeout(() => {
      setMounted(false);
      sessionStorage.setItem("agencyos-splash-shown", "1");
    }, 1350);

    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  if (!mounted) return null;

  const entered = stage === "enter" || stage === "hold" || stage === "exit";
  const textIn = stage === "hold" || stage === "exit";
  const exiting = stage === "exit";

  return (
    <div className="app-splash" data-exit={exiting} aria-hidden="true">
      <div className="app-splash__logo-wrap" data-in={entered} data-pulse={stage === "hold"}>
        <Image
          src="/N2.png"
          alt=""
          width={112}
          height={112}
          priority
          className="app-splash__logo"
        />
      </div>

      <div className="app-splash__brand" data-in={textIn}>
        zuhrainfo.in
      </div>

      <style jsx>{`
        .app-splash {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
          background: radial-gradient(circle at 50% 45%, #0b061a 0%, #05020d 70%);
          opacity: 1;
          transition: opacity 0.35s ease-out;
          perspective: 800px;
        }
        .app-splash[data-exit="true"] {
          opacity: 0;
        }

        .app-splash__logo-wrap {
          opacity: 0;
          transform: rotateY(70deg) scale(0.8);
          transform-style: preserve-3d;
          transition: opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .app-splash__logo-wrap[data-in="true"] {
          opacity: 1;
          transform: rotateY(0deg) scale(1);
        }
        .app-splash__logo-wrap[data-pulse="true"] {
          animation: glow-pulse 1.1s ease-in-out infinite;
        }

        .app-splash__logo {
          filter: drop-shadow(0 0 10px rgba(199, 125, 255, 0.55))
            drop-shadow(0 0 26px rgba(157, 78, 221, 0.4));
        }

        @keyframes glow-pulse {
          0%,
          100% {
            filter: drop-shadow(0 0 10px rgba(199, 125, 255, 0.5))
              drop-shadow(0 0 24px rgba(157, 78, 221, 0.35));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(224, 170, 255, 0.75))
              drop-shadow(0 0 34px rgba(157, 78, 221, 0.55));
          }
        }

        .app-splash__brand {
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.4s ease-out, transform 0.4s ease-out;
          font-family: var(--font-geist-sans, system-ui, sans-serif);
          font-weight: 500;
          font-size: 13px;
          letter-spacing: 0.2em;
          color: #ffffff;
          text-shadow: 0 0 12px rgba(157, 78, 221, 0.8);
        }
        .app-splash__brand[data-in="true"] {
          opacity: 0.9;
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}