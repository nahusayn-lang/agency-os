"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Full-screen splash shown once per browser session when the app boots
 * (cold load / PWA launch). Shows the logo with a fade + scale animation,
 * then fades out and unmounts itself.
 */
export function AppSplash() {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("agencyos-splash-shown");
    if (alreadyShown) return;

    setMounted(true);
    // trigger enter animation on next frame
    const showTimer = requestAnimationFrame(() => setVisible(true));

    const holdTimer = setTimeout(() => setFadingOut(true), 900);
    const removeTimer = setTimeout(() => {
      setMounted(false);
      sessionStorage.setItem("agencyos-splash-shown", "1");
    }, 1250);

    return () => {
      cancelAnimationFrame(showTimer);
      clearTimeout(holdTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#09090b] transition-opacity duration-300 ease-out"
      style={{ opacity: fadingOut ? 0 : 1 }}
      aria-hidden="true"
    >
      <div
        className="transition-all duration-500 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.85)",
        }}
      >
        <Image
          src="/N2.png"
          alt=""
          width={96}
          height={96}
          priority
          className="drop-shadow-[0_0_24px_rgba(124,58,237,0.35)]"
        />
      </div>
    </div>
  );
}