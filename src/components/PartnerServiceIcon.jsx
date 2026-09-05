const ICON_PATHS = {
  key:(
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 9 9M16 16l3-3M18 18l3-3" />
    </>
  ),
  home:(
    <>
      <path d="m3 10 9-7 9 7M5 9v12h14V9" />
      <path d="M9 21v-8h6v8" />
    </>
  ),
  documents:(
    <>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" />
      <path d="M14 3v5h5M8 12h8M8 16h6" />
    </>
  ),
  health:(
    <>
      <path d="M12 3.5 5.5 6v5.25c0 4.15 2.7 7.45 6.5 9.25 3.8-1.8 6.5-5.1 6.5-9.25V6L12 3.5Z" />
      <path d="M12 8v6M9 11h6" />
    </>
  ),
  pillar:(
    <>
      <path d="M5 19V9M12 19V5M19 19v-7" />
      <path d="M3.5 19.5h17" />
      <path d="m5 7 5-3 4 3 5-4" />
    </>
  ),
  course:(
    <>
      <path d="m3 9 9-4 9 4-9 4-9-4Z" />
      <path d="M7 11v4.5c2.7 2 7.3 2 10 0V11" />
      <path d="M21 9v5" />
    </>
  ),
}

export default function PartnerServiceIcon({ type, size = 24, color = 'currentColor' }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[type] || ICON_PATHS.health}
    </svg>
  )
}
