/**
 * Full-screen static loading state — the static Folio3 mark + a spinner, no animation. Reuses
 * the `.aas-bootloader`/`.aas-bootloader-logo`/`.aas-spinner` classes defined inline in
 * index.html's <head> (index.html can't depend on this component - or any JS - having loaded
 * yet), so the pre-React bootstrap and this component look identical and there's no flash when
 * one replaces the other.
 *
 * The full animated wordmark (FolioLogoStage, via LogoLoader) is reserved for the one-time
 * post-login welcome moment — ordinary loading states (this one) stay a plain static mark.
 */
export default function PageLoader({ label = "Loading Admin Automation…" }) {
  return (
    <div className="aas-bootloader">
      <img className="aas-bootloader-logo" src="/folio3-logo.png" alt="Folio3" />
      <div className="aas-spinner" aria-hidden="true" />
      <p className="aas-bootloader-label" role="status" aria-live="polite">
        {label}
      </p>
    </div>
  );
}
