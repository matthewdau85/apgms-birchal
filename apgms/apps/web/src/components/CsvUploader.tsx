import { useState } from "react";
import { importBankLinesCsv } from "../api/client";

interface Props {
  orgId: string;
  onImported: () => void;
}

export default function CsvUploader({ orgId, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    try {
      setStatus("uploading");
      setError(null);
      await importBankLinesCsv(orgId, file);
      setStatus("success");
      setFile(null);
      onImported();
    } catch (err) {
      console.error(err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <section>
      <h2>Import CSV</h2>
      <form className="upload-area" onSubmit={handleSubmit}>
        <input
          type="file"
          accept="text/csv"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            if (selected) {
              setStatus("idle");
              setError(null);
            }
          }}
        />
        <button type="submit" disabled={!file || status === "uploading" || !orgId}>
          {status === "uploading" ? "Uploading..." : "Upload"}
        </button>
        {!orgId && <p className="status-message error">Enter an organisation ID to upload.</p>}
        {status === "success" && <p className="status-message success">Import complete.</p>}
        {status === "error" && error && <p className="status-message error">{error}</p>}
      </form>
    </section>
  );
}
