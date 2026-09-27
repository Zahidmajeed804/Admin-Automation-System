import { useRef, useState } from "react";
import { Download, Paperclip, Trash2, UploadCloud } from "lucide-react";
import Modal from "../../components/modals/Modal";
import ConfirmDialog from "../../components/modals/ConfirmDialog";
import Button from "../../components/common/Button";
import { generatorService } from "../../services/generatorService";
import { extractErrorMessage } from "./GeneratorForm";
import { formatDate } from "../../utils/formatDate";

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_MB = 5;

function formatBytes(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Saves the file the browser just fetched, the same way a normal link
// download would, without ever needing a real <a href> pointed at the API.
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Manages the one invoice a maintenance job can have: upload, replace,
 * download and remove. `canUpdate` hides upload/replace/remove for a user
 * who can only view (the backend enforces the same split — generator.update
 * for changes, generator.read for downloading).
 */
export default function GeneratorMaintenanceInvoice({ open, onClose, onChanged, job, canUpdate }) {
  const fileInputRef = useRef(null);
  const [invoice, setInvoice] = useState(job?.invoice ?? null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  if (!job) return null;

  const validateFile = (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) return "Invoice must be a PDF, JPG or PNG file.";
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `Invoice must be ${MAX_SIZE_MB}MB or smaller.`;
    return null;
  };

  const handleFileChosen = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // lets picking the same file again re-trigger onChange
    if (!file) return;

    const clientError = validateFile(file);
    if (clientError) {
      setError(clientError);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const updated = await generatorService.uploadInvoice(job._id, file);
      setInvoice(updated.invoice);
      onChanged?.(updated);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const { blob, filename } = await generatorService.downloadInvoice(job._id);
      saveBlob(blob, filename);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const updated = await generatorService.deleteInvoice(job._id);
      setInvoice(null);
      setConfirmDelete(false);
      onChanged?.(updated);
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Invoice" description={job.description} size="sm">
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-body text-status-error bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
        )}

        {invoice ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 bg-surface-subtle rounded-md px-3 py-2.5">
              <Paperclip className="h-4 w-4 text-ink-muted mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-body text-ink font-medium truncate">{invoice.fileName}</p>
                <p className="text-helper text-ink-muted">
                  {formatBytes(invoice.size)} · Uploaded {formatDate(invoice.uploadedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon={Download} loading={downloading} onClick={handleDownload}>
                Download
              </Button>
              {canUpdate && (
                <>
                  <Button variant="secondary" icon={UploadCloud} loading={uploading} onClick={() => fileInputRef.current?.click()}>
                    Replace
                  </Button>
                  <Button variant="ghost" size="sm" icon={Trash2} aria-label="Remove invoice" onClick={() => setConfirmDelete(true)} />
                </>
              )}
            </div>
          </div>
        ) : canUpdate ? (
          <div className="flex flex-col gap-2">
            <p className="text-body text-ink-muted">No invoice attached yet.</p>
            <Button icon={UploadCloud} loading={uploading} onClick={() => fileInputRef.current?.click()}>
              Upload Invoice
            </Button>
            <p className="text-helper text-ink-muted">PDF, JPG or PNG, up to {MAX_SIZE_MB}MB.</p>
          </div>
        ) : (
          <p className="text-body text-ink-muted">No invoice has been attached to this job.</p>
        )}

        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChosen} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Remove invoice?"
        description={deleteError || `This removes "${invoice?.fileName}" from ${job.description}. This cannot be undone.`}
      />
    </Modal>
  );
}
