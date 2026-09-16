export const LogoMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="wo-mark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#2f6fe4" />
        <stop offset="1" stopColor="#2bb5b0" />
      </linearGradient>
    </defs>
    <rect width="28" height="28" rx="7" fill="url(#wo-mark)" />
    <path
      d="M7.5 10.5a1.5 1.5 0 0 1 1.5-1.5h3.2l1.6 1.8h5.7a1.5 1.5 0 0 1 1.5 1.5v6.2a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5z"
      fill="none"
      stroke="#fff"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M12.6 13.6l2 2-2 2" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
