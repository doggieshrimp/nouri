import { useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { exportBackup, importBackup, parseBackup } from "./db";
import { todayKey } from "./lib/dates";

export default function BackupControls() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-log-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${backup.entries.length} entries.`);
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const count = await importBackup(parseBackup(JSON.parse(await file.text())));
      setMessage(`Imported ${count} entries.`);
    } catch (err) {
      setMessage(err instanceof SyntaxError ? "That file isn't valid JSON." : (err as Error).message);
    }
  }

  return (
    <div className="mt-10 pt-3 text-xs" style={{ borderTop: "1px solid #DDD6C4" }}>
      <div className="flex items-center gap-4 opacity-70">
        <span className="uppercase tracking-wide font-bold">Backup</span>
        <button type="button" onClick={handleExport} className="flex items-center gap-1 underline">
          <Download size={14} /> Export
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex items-center gap-1 underline"
        >
          <Upload size={14} /> Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          className="hidden"
        />
      </div>
      {message && (
        <div role="status" className="mt-2 opacity-70">
          {message}
        </div>
      )}
      <p className="mt-2 opacity-50">
        Your log is stored only on this device. Export a backup now and then so you don&rsquo;t lose it.
      </p>
    </div>
  );
}
