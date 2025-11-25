export function HoodtopiaLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background */}
      <rect width="32" height="32" rx="8" className="fill-primary" />

      {/* Hoodie shape */}
      <path
        d="M16 6C12 6 9 8 8 11L6 18V24C6 25.1 6.9 26 8 26H24C25.1 26 26 25.1 26 24V18L24 11C23 8 20 6 16 6Z"
        className="fill-primary-foreground/90"
      />

      {/* Hood */}
      <path
        d="M16 6C13 6 10.5 7.5 9.5 10C10.5 9 13 8 16 8C19 8 21.5 9 22.5 10C21.5 7.5 19 6 16 6Z"
        className="fill-primary-foreground"
      />

      {/* Hood opening / face area */}
      <ellipse
        cx="16"
        cy="14"
        rx="4"
        ry="4.5"
        className="fill-primary/80"
      />

      {/* Kangaroo pocket */}
      <path
        d="M11 19H21V22C21 23 20 24 19 24H13C12 24 11 23 11 22V19Z"
        className="fill-primary/40"
      />

      {/* Sparkle - AI element */}
      <path
        d="M24 7L24.5 8.5L26 9L24.5 9.5L24 11L23.5 9.5L22 9L23.5 8.5L24 7Z"
        className="fill-primary-foreground"
      />
    </svg>
  );
}

export function HoodtopiaIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Hoodie outline */}
      <path
        d="M12 3C8 3 5 5.5 4 9L2 16V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V16L20 9C19 5.5 16 3 12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Hood */}
      <path
        d="M8 9C9 7.5 10.5 6.5 12 6.5C13.5 6.5 15 7.5 16 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Face hole */}
      <ellipse
        cx="12"
        cy="11"
        rx="3"
        ry="3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />

      {/* Pocket */}
      <path
        d="M8 16H16V18C16 19 15 20 14 20H10C9 20 8 19 8 18V16Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
