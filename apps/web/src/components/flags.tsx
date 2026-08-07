import type { Locale } from '@orbit/shared';

/** Exact inline flag SVGs from the prototype (UK for English, HU, FR, NL). */

const flagStyle: React.CSSProperties = {
  borderRadius: 2.5,
  boxShadow: '0 0 0 1px var(--border)',
  flex: 'none',
};

function FlagEn() {
  return (
    <svg width="18" height="13" viewBox="0 0 20 14" style={flagStyle} aria-hidden="true">
      <rect width="20" height="14" fill="#012169" />
      <path d="M0 0L20 14M20 0L0 14" stroke="#ffffff" strokeWidth="2.6" />
      <path d="M0 0L20 14M20 0L0 14" stroke="#C8102E" strokeWidth="1.2" />
      <path d="M10 0V14M0 7H20" stroke="#ffffff" strokeWidth="4.4" />
      <path d="M10 0V14M0 7H20" stroke="#C8102E" strokeWidth="2.4" />
    </svg>
  );
}

function FlagHu() {
  return (
    <svg width="18" height="13" viewBox="0 0 20 14" style={flagStyle} aria-hidden="true">
      <rect width="20" height="4.67" y="0" fill="#CD2A3E" />
      <rect width="20" height="4.67" y="4.67" fill="#ffffff" />
      <rect width="20" height="4.66" y="9.34" fill="#436F4D" />
    </svg>
  );
}

function FlagFr() {
  return (
    <svg width="18" height="13" viewBox="0 0 20 14" style={flagStyle} aria-hidden="true">
      <rect width="6.67" height="14" x="0" fill="#002395" />
      <rect width="6.67" height="14" x="6.67" fill="#ffffff" />
      <rect width="6.66" height="14" x="13.34" fill="#ED2939" />
    </svg>
  );
}

function FlagNl() {
  return (
    <svg width="18" height="13" viewBox="0 0 20 14" style={flagStyle} aria-hidden="true">
      <rect width="20" height="4.67" y="0" fill="#AE1C28" />
      <rect width="20" height="4.67" y="4.67" fill="#ffffff" />
      <rect width="20" height="4.66" y="9.34" fill="#21468B" />
    </svg>
  );
}

export function Flag({ locale }: { locale: Locale }) {
  switch (locale) {
    case 'en':
      return <FlagEn />;
    case 'hu':
      return <FlagHu />;
    case 'fr':
      return <FlagFr />;
    case 'nl':
      return <FlagNl />;
  }
}
