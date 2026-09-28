import { FolioLogoStage } from "./FolioLogo";

/**
 * Full-screen post-login welcome: plays the animated Folio3 wordmark once (~5s), then calls
 * `onComplete` — LoginPage uses this to navigate on once the animation finishes. Reuses the
 * `.aas-bootloader`/`.aas-bootloader-label` classes defined inline in index.html's <head> so it
 * matches the plain static loader's shell.
 *
 * This is the only place the animation plays — ordinary loading states (initial session
 * resolution) use PageLoader (static) instead.
 */
export default function LogoLoader({ label = "Welcome!", subtitle, onComplete }) {
  return (
    <div className="aas-bootloader">
      <FolioLogoStage loop={false} onComplete={onComplete} />
      <div className="flex flex-col items-center gap-1.5 text-center px-6">
        <p className="aas-bootloader-label" role="status" aria-live="polite">
          {label}
        </p>
        {subtitle && <p className="text-helper text-ink-muted max-w-xs">{subtitle}</p>}
      </div>
    </div>
  );
}
