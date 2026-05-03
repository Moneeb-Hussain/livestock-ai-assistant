export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="20" cy="20" r="18" fill="#dcfce7" stroke="#166534" strokeWidth="2" />
      <ellipse cx="20" cy="22" rx="10" ry="8" fill="#166534" />
      <circle cx="15" cy="17" r="2.5" fill="#14532d" />
      <circle cx="25" cy="17" r="2.5" fill="#14532d" />
      <path
        d="M8 14c-2-4 0-8 4-6M32 14c2-4 0-8-4-6"
        stroke="#166534"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
