// HALQA mark — the open study circle with three seats at the table.
// Same geometry as `public/icon.svg`, redrawn in currentColor so it inherits
// the surface it sits on (dark hero, paper footer, anywhere).
export default function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="256"
        cy="256"
        r="132"
        stroke="currentColor"
        strokeWidth="44"
        strokeLinecap="round"
        strokeDasharray="760 70"
        transform="rotate(-58 256 256)"
      />
      <circle cx="256" cy="256" r="34" fill="currentColor" />
      <circle cx="256" cy="140" r="22" fill="var(--gold)" />
      <circle cx="360" cy="316" r="22" fill="var(--gold)" />
      <circle cx="152" cy="316" r="22" fill="var(--gold)" />
    </svg>
  );
}
