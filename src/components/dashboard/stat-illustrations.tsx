// Decorative corner illustrations for dashboard stat cards.
// Real illustrations (undraw.co) served from /public/illustrations.
//
// Sizing rules (baked in, no per-usage className needed):
//  - height: 100% of the CARD's full height (title + number both) —
//    positions relative to <Card>, which is now position:relative +
//    overflow-hidden (see components/ui/card.tsx). CardContent must
//    NOT have its own "relative" class or it'll shrink the reference box.
//  - width: ~45% of the card's width
//  - aspect ratio preserved (object-contain, never stretched)
//  - sits behind the card's text (z-0); numbers/labels must be z-10
//  - small padding so art doesn't touch the card edges

type IllustrationProps = {
  className?: string;
};

function Illustration({
  className,
  src,
  position = "bottom",
}: IllustrationProps & { src: string; position?: "full" | "bottom" }) {
  const posClasses =
    position === "bottom"
      ? "bottom-0 h-[65%]" // sits centered/low, never touches the card's top edge
      : "inset-y-0";
  return (
    <div
      aria-hidden="true"
      className={
        `pointer-events-none absolute ${posClasses} right-0 z-0 flex w-1/2 items-center justify-end py-3 pr-3` +
        (className ? ` ${className}` : "")
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="h-full max-h-full w-auto max-w-full object-contain"
      />
    </div>
  );
}

export function AttendanceIllustration({ className }: IllustrationProps) {
  return <Illustration className={className} src="/illustrations/attandance.svg" position="bottom" />;
}
// (kept explicit "bottom" above for clarity — it's also the default now)

export function TasksIllustration({ className }: IllustrationProps) {
  return <Illustration className={className} src="/illustrations/pending task.svg" />;
}

export function ColdCallsIllustration({ className }: IllustrationProps) {
  return <Illustration className={className} src="/illustrations/cold call.svg" />;
}

export function FinesIllustration({ className }: IllustrationProps) {
  return <Illustration className={className} src="/illustrations/total fines.svg" />;
}

export function FunnelIllustration({ className }: IllustrationProps) {
  return <Illustration className={className} src="/illustrations/total leads.svg" />;
}

export function TargetIllustration({ className }: IllustrationProps) {
  return <Illustration className={className} src="/illustrations/active leads.svg" />;
}

export function HandshakeIllustration({ className }: IllustrationProps) {
  return <Illustration className={className} src="/illustrations/deal closed.svg" />;
}

export function RevenueIllustration({ className }: IllustrationProps) {
  return <Illustration className={className} src="/illustrations/revenue.svg" />;
}

export function LostDealsIllustration({ className }: IllustrationProps) {
  return <Illustration className={className} src="/illustrations/deal lost.svg" />;
}

// No new asset supplied for these two — kept as the original hand-drawn SVGs,
// same sizing rules applied so they stay consistent with the rest.

const LIGHT = "#eaeafe";
const MID = "#8a81f9";
const DARK = "#5b4de0";

function Base({ className, children }: IllustrationProps & { children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className={
        "pointer-events-none absolute bottom-0 h-[65%] right-0 z-0 flex w-1/2 items-center justify-end py-3 pr-3" +
        (className ? ` ${className}` : "")
      }
    >
      <svg viewBox="0 0 100 90" fill="none" className="h-full max-h-full w-auto max-w-full">
        {children}
      </svg>
    </div>
  );
}

export function WeeklyTargetIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <path d="M20 58a30 22 0 0 1 60 0" stroke={LIGHT} strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M20 58a30 22 0 0 1 60 0" stroke={MID} strokeWidth="8" strokeLinecap="round" fill="none" strokeDasharray="70 100" />
      <circle cx="50" cy="58" r="4" fill={DARK} />
      <path d="M50 58l13-17" stroke={DARK} strokeWidth="3.4" strokeLinecap="round" />
    </Base>
  );
}

export function PerformanceIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <rect x="24" y="46" width="12" height="26" rx="3" fill={LIGHT} />
      <rect x="44" y="32" width="12" height="40" rx="3" fill={MID} />
      <rect x="64" y="18" width="12" height="54" rx="3" fill={DARK} />
      <path d="M26 40l18-12 20 8 12-16" stroke={DARK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Base>
  );
}