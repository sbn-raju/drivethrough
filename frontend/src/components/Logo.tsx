import { Link } from 'react-router';

/**
 * Primary horizontal logo. `public/brand/drivethrough-logo.png` is a trimmed, transparent-background
 * derivative of `public/DriveThrough_Road_Logo.png` (black wordmark — use on light surfaces).
 */
export function Logo({ className = 'h-8', linkTo = '/' }: { className?: string; linkTo?: string | null }) {
  const img = <img src="/brand/drivethrough-logo.png" alt="DriveThrough" className={`${className} w-auto select-none`} draggable={false} />;
  return linkTo ? (
    <Link to={linkTo} aria-label="DriveThrough home" className="inline-flex rounded-md focus-visible:outline-3 focus-visible:outline-brand-yellow/50">
      {img}
    </Link>
  ) : (
    img
  );
}
