interface BrandMarkProps {
  className?: string
}

export default function BrandMark({ className = 'brand-mark' }: BrandMarkProps) {
  return <span className={className} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" focusable="false">
      <path d="M7 19V5h6.2a4.2 4.2 0 0 1 0 8.4H7m5.1 0L18 19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
}
