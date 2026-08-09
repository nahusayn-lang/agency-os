"use client";

import ColorBends from "@/components/color-bends";

/**
 * Site-wide animated background layer.
 * Fixed to the viewport, sits at -z-10 so it paints behind normal page
 * content. Header / sidebar / cards already use solid backgrounds, so
 * they naturally cover this layer wherever they render — no extra
 * exclusion logic needed for the nav.
 */
export default function AppBackground() {
  return (
    <div className="fixed inset-0 -z-10" aria-hidden="true">
      <ColorBends
        colors={["#1a0b2e", "#7f14e3", "#c084fc"]}
        rotation={90}
        speed={0.2}
        scale={1}
        frequency={1}
        warpStrength={1}
        mouseInfluence={1}
        noise={0.15}
        parallax={0.5}
        iterations={1}
        intensity={1.5}
        bandWidth={6}
        transparent
        autoRotate={0}
      />
    </div>
  );
}