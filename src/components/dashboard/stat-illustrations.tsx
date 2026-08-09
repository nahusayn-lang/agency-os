// Decorative corner illustrations for dashboard stat cards.
// Colors sampled directly (pixel-picked) from the reference screenshot —
// not approximated. Purely visual (aria-hidden), no effect on data/logic.

type IllustrationProps = {
  className?: string;
};

// Exact hex values picked from the reference image's illustrations.
const LIGHT = "#eaeafe"; // pale lilac fill
const MID = "#8a81f9"; // mid purple (bodies, icons)
const DARK = "#5b4de0"; // dark purple (headers, accents)
const SKIN = "#fac2a8"; // hand/skin tone
const GOLD = "#fcbd4a"; // coins

function Base({ className, children }: IllustrationProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 100 90" fill="none" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export function AttendanceIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <rect x="24" y="20" width="46" height="42" rx="5" fill={LIGHT} />
      <rect x="24" y="20" width="46" height="12" rx="5" fill={DARK} />
      <rect x="32" y="14" width="4" height="10" rx="2" fill={MID} />
      <rect x="58" y="14" width="4" height="10" rx="2" fill={MID} />
      <g stroke={MID} strokeWidth="2">
        <line x1="31" y1="40" x2="63" y2="40" />
        <line x1="31" y1="48" x2="63" y2="48" />
        <line x1="31" y1="56" x2="50" y2="56" />
      </g>
      <circle cx="66" cy="62" r="16" fill={LIGHT} stroke={MID} strokeWidth="2" />
      <path d="M66 53v9l7 4" stroke={DARK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Base>
  );
}

export function TasksIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <rect x="34" y="14" width="30" height="46" rx="4" fill={LIGHT} />
      <rect x="41" y="10" width="16" height="8" rx="2" fill={DARK} />
      <g stroke={MID} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M40 32l3.5 3.5L50 29" />
        <path d="M40 44l3.5 3.5L50 41" />
      </g>
      <line x1="53" y1="33" x2="60" y2="33" stroke={MID} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="53" y1="45" x2="60" y2="45" stroke={MID} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="26" cy="52" r="14" fill={SKIN} />
      <rect x="10" y="64" width="32" height="20" rx="10" fill={MID} />
    </Base>
  );
}

export function ColdCallsIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <rect x="22" y="46" width="34" height="22" rx="3" fill={LIGHT} />
      <rect x="26" y="50" width="26" height="14" rx="2" fill={DARK} />
      <path d="M20 46l6-6h32l-6 6" fill={MID} />
      <circle cx="66" cy="36" r="16" fill={SKIN} />
      <rect x="58" y="46" width="16" height="18" rx="8" fill={MID} />
      <path d="M58 36a8 8 0 0 1 16 0v5" stroke={DARK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <rect x="56" y="36" width="5" height="8" rx="2.4" fill={DARK} />
      <rect x="71" y="36" width="5" height="8" rx="2.4" fill={DARK} />
    </Base>
  );
}

export function FinesIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <rect x="20" y="34" width="52" height="34" rx="6" fill={LIGHT} />
      <rect x="20" y="34" width="52" height="10" rx="6" fill={DARK} />
      <circle cx="70" cy="52" r="8" fill={MID} />
      <circle cx="70" cy="52" r="3" fill={LIGHT} />
      <circle cx="62" cy="24" r="7" fill={GOLD} />
      <circle cx="74" cy="26" r="9" fill={GOLD} />
      <circle cx="68" cy="16" r="6" fill={GOLD} />
    </Base>
  );
}

export function FunnelIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <g fill={MID}>
        <circle cx="32" cy="16" r="7" />
        <circle cx="50" cy="12" r="7" />
        <circle cx="68" cy="16" r="7" />
      </g>
      <path d="M22 26h56l-18 22v14l-20 7V48z" fill={DARK} />
      <circle cx="74" cy="64" r="14" fill={LIGHT} stroke={MID} strokeWidth="2" />
      <path d="M68 64l4 4 8-9" stroke={DARK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Base>
  );
}

export function TargetIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <circle cx="46" cy="48" r="26" fill={LIGHT} />
      <circle cx="46" cy="48" r="18" fill={MID} />
      <circle cx="46" cy="48" r="10" fill={LIGHT} />
      <circle cx="46" cy="48" r="3.5" fill={DARK} />
      <path d="M54 40l20-20m0 0h-11m11 0v11" stroke={DARK} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}

export function HandshakeIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <path d="M14 44l16-11 12 8 8-5 22 15-9 13-13-9-9 7-14-9z" fill={SKIN} />
      <path d="M14 44l16-11v14l-9 7z" fill={MID} />
      <path d="M62 41l22 15-9 13-13-9z" fill={MID} />
      <path d="M22 48l10 8 8-6" stroke={DARK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Base>
  );
}

export function RevenueIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <path d="M40 20c-6 6-10 12-10 20 0 15 11 20 11 28H35a3 3 0 0 1-3-3c0-12 9-16 9-28 0-7 3-13 8-17z" fill={MID} />
      <path d="M46 18c4 5 6 10 6 17 0 14-9 19-9 30h18a3 3 0 0 0 3-3c0-13-9-17-9-30 0-6-2-11-5-15z" fill={DARK} />
      <circle cx="68" cy="62" r="15" fill={GOLD} />
      <path d="M68 55v14M63 59h6.5a3 3 0 0 1 0 6H63" stroke="#7a4a06" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Base>
  );
}

export function LostDealsIllustration({ className }: IllustrationProps) {
  return (
    <Base className={className}>
      <path d="M16 32l16 16 10-10 20 20" stroke={MID} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M50 38h12v12" stroke={MID} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="26" cy="64" r="13" fill={LIGHT} stroke={DARK} strokeWidth="2" />
      <path d="M26 58v7M26 69h.01" stroke={DARK} strokeWidth="2.6" strokeLinecap="round" />
    </Base>
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