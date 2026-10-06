import Modal from "./Modal";
import Button from "../common/Button";

/**
 * Confirmation dialog for destructive or irreversible actions
 * (delete, reject, deactivate). Always route these actions through here
 * instead of acting immediately on click. `children` renders under the
 * description (e.g. an optional note field); `error` shows a failed confirm
 * without closing the dialog.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  error,
  children,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="bg-status-errorBg border border-red-200 text-status-error text-body rounded-md px-3 py-2"
          >
            {error}
          </div>
        )}
        <p className="text-body text-ink-secondary">{description}</p>
        {children}
      </div>
    </Modal>
  );
}
