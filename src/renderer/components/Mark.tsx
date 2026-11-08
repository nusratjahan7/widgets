interface MarkProps {
  className?: string;
}

/** The orbit/arc brand mark shared by the system widget and the tray icon. */
export function Mark({ className = '' }: MarkProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} fill="none" aria-hidden="true">
      <circle cx="48" cy="48" r="45.5" stroke="currentColor" strokeWidth="1.3" opacity="0.4" />
      <path
        d="M75.4 59.4 A29 29 0 1 1 75.4 36.6"
        stroke="currentColor"
        strokeWidth="10.5"
        strokeLinecap="round"
      />
      <circle cx="48" cy="48" r="8.4" fill="currentColor" />
      <path d="M68 48h15" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
