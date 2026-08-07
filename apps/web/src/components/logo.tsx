/** Orbit mark — filled circle + rotated ellipse ring + satellite dot (lifted from the prototype). */
export function OrbitLogo({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <ellipse
        cx="16"
        cy="16"
        rx="13.5"
        ry="7.2"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.7"
        opacity="0.5"
        transform="rotate(-24 16 16)"
      />
      <circle cx="16" cy="16" r="5.6" fill="var(--primary)" />
      <circle cx="26.6" cy="9.4" r="2.6" fill="var(--primary)" />
    </svg>
  );
}
