const ICON_PATHS = {
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
