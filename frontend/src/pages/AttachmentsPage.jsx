import { useEffect, useMemo, useState } from "react";
import AttachmentCard from "../components/AttachmentCard";
import api from "../api/client";

export default function AttachmentsPage() {
  const [view, setView] = useState("grid");
  const [type, setType] = useState("All");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const inboxRes = await api.get("/api/gmail/inbox/?limit=50");
        const emails = inboxRes.data.emails || [];
        const details = await Promise.all(
          emails.slice(0, 20).map(async (e) => {
            try {
              const d = await api.get(`/api/gmail/message/${e.gmail_id}/`);
              return d.data;
            } catch {
              return null;
            }
          })
        );
        const flat = [];
        details.filter(Boolean).forEach((d) => {
          (d.attachments || []).forEach((a) => {
            flat.push({
              id: `${d.gmail_id}-${a.attachment_id}`,
              emailId: d.gmail_id,
              attachmentId: a.attachment_id,
              name: a.filename,
              sender: d.from || "Unknown",
              type: a.mime_type?.includes("pdf")
                ? "PDF"
                : a.mime_type?.includes("sheet") || a.mime_type?.includes("excel")
                ? "Spreadsheet"
                : a.mime_type?.includes("image")
                ? "Image"
                : "File",
              project: "General",
              date: d.date || "",
            });
          });
        });
        setItems(flat);
      } catch (err) {
        setError(JSON.stringify(err.response?.data || err.message));
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => items.filter((a) => type === "All" || a.type === type), [items, type]);

  const download = async (item) => {
    const token = localStorage.getItem("access_token");
    const url =
      `${import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"}/api/gmail/attachment/${item.emailId}/${item.attachmentId}/` +
      `?filename=${encodeURIComponent(item.name)}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const aTag = document.createElement("a");
    aTag.href = URL.createObjectURL(blob);
    aTag.download = item.name;
    document.body.appendChild(aTag);
    aTag.click();
    aTag.remove();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Attachment Organizer</h1>
        <div className="flex gap-2">
          <select className="rounded-lg border border-slate-300/20 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950" value={type} onChange={(e) => setType(e.target.value)}>
            {["All", "PDF", "Spreadsheet", "Image", "File"].map((x) => <option key={x}>{x}</option>)}
          </select>
          <button onClick={() => setView("grid")} className="rounded-lg border border-slate-300/20 px-3 py-1 text-xs dark:border-slate-700">Grid</button>
          <button onClick={() => setView("table")} className="rounded-lg border border-slate-300/20 px-3 py-1 text-xs dark:border-slate-700">Table</button>
        </div>
      </div>

      {!!error && <div className="rounded-lg border border-red-300/40 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">{error}</div>}

      {view === "grid" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <button key={a.id} onClick={() => download(a)} className="text-left">
              <AttachmentCard item={a} />
            </button>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-300/20 bg-white/80 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/80 dark:bg-slate-800/80">
              <tr>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Sender</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-slate-300/20 dark:border-slate-700">
                  <td className="px-4 py-3">{a.name}</td>
                  <td className="px-4 py-3">{a.sender}</td>
                  <td className="px-4 py-3">{a.type}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => download(a)} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
