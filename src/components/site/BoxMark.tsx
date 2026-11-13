export function BoxMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Логотип Тёплый бокс"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17 14.5c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5"
        fill="none"
        stroke="#B63A20"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <rect x="7" y="12.5" width="34" height="9" rx="3.5" fill="#F3E4CE" />
      <path d="M9 20.5h30l-2.6 18.2A4 4 0 0 1 32.4 42H15.6a4 4 0 0 1-4-3.3L9 20.5Z" fill="#E2542C" />
      <path d="M12.4 25.5h23.2l-.7 5.2H13.1l-.7-5.2Z" fill="#F6B94A" opacity=".9" />
      <ellipse cx="18.4" cy="34.2" rx="1.7" ry="2" fill="#251E17" />
      <ellipse cx="29.6" cy="34.2" rx="1.7" ry="2" fill="#251E17" />
      <circle cx="15.9" cy="31.2" r="1.7" fill="#F4A79A" opacity=".85" />
      <circle cx="32.1" cy="31.2" r="1.7" fill="#F4A79A" opacity=".85" />
      <path
        d="M21 37.2c1.9 1.5 4.1 1.5 6 0"
        fill="none"
        stroke="#251E17"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SteamMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 14c-1.6-2.1-1.6-4.6 0-6.7 1.3-1.7 1.5-3.4.7-5.3M12 15c-1.7-2.4-1.7-5.1 0-7.5 1.4-1.9 1.6-3.8.7-5.5M17 14c-1.6-2.1-1.6-4.6 0-6.7 1.3-1.7 1.5-3.4.7-5.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
