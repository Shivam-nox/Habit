// constants/theme.ts
//
// Design language: "The Ledger"
// A premium expense-habit coach should feel like a well-kept physical
// account book, not a generic fintech dashboard. The signature element
// is the stitched register line (a dashed rule) that appears wherever
// a running balance is shown, echoing a checkbook register / bank
// passbook. Numbers are tabular and slightly larger than you'd expect —
// money is the hero, everything else is quiet.

export const COLORS = {
  // Base
  ink: '#12201C',        // near-black warm green-black — primary text
  ink70: 'rgba(18,32,28,0.7)',
  ink45: 'rgba(18,32,28,0.45)',
  ink12: 'rgba(18,32,28,0.10)',
  ink06: 'rgba(18,32,28,0.05)',

  paper: '#F6F3EC',       // warm ivory — app background
  paperDim: '#EFEBE0',    // slightly deeper ivory for recessed areas
  card: '#FFFDF8',        // card surface, warmer than pure white

  // Brand
  moss: '#1F5F52',        // deep moss green — primary
  mossDeep: '#123A32',    // gradient partner / pressed state
  mossFaint: 'rgba(31,95,82,0.10)',

  brass: '#B8873A',       // muted brass/gold — accent, never overused
  brassFaint: 'rgba(184,135,58,0.14)',

  rust: '#A63D2F',        // alerts / overspend
  rustFaint: 'rgba(166,61,47,0.10)',

  sage: '#4C7A5E',        // positive / income / savings
  sageFaint: 'rgba(76,122,94,0.12)',

  slate: '#5B6B63',       // muted secondary text (warm grey-green, not cold slate)

  line: 'rgba(18,32,28,0.14)', // hairline rules
  stitch: 'rgba(18,32,28,0.22)', // dashed register line
};

export const FONT = {
  // System-safe stacks. Display uses tighter tracking + heavier weight
  // to read like ledger typography; body stays plain and legible.
  displayWeight: '800' as const,
  numberWeight: '700' as const,
  bodyWeight: '500' as const,
};

export const RADIUS = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
};

export const SPACE = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const SHADOW_CARD = {
  shadowColor: '#12201C',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 16,
  elevation: 3,
};

export const SHADOW_SOFT = {
  shadowColor: '#12201C',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
  elevation: 1,
};

export const fmtINR = (n: number) => {
  const v = n || 0;
  const abs = Math.abs(v);
  if (abs >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
};

export const fmtINRFull = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

// The signature "stitched" divider — a dashed line used at register
// breakpoints (between a list and its total, above a balance, etc.)
export const stitchStyle = {
  borderStyle: 'dashed' as const,
  borderTopWidth: 1.5,
  borderColor: COLORS.stitch,
};