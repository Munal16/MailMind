import { useEffect, useState } from "react";
import api from "../api/client";

export default function AiAdmin() {
  const [metrics, setMetrics] = useState(null);
  const [retrainResult, setRetrainResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [datasetStatus, setDatasetStatus] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  const loadMetrics = async () => {
    const res = await api.get("/api/ai/admin/metrics/");
    setMetrics(res.data);
  };

  const loadDatasetStatus = async () => {
    const res = await api.get("/api/ai/dataset/status/");
    setDatasetStatus(res.data);
  };

  const uploadDataset = async () => {
    if (!selectedFile) {
      setUploadResult({ error: "Please choose a CSV file first." });
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await api.post("/api/ai/dataset/upload/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setUploadResult(res.data);
      await loadDatasetStatus();
    } catch (err) {
      setUploadResult(err.response?.data || { error: "Upload failed" });
    }
  };

  const retrain = async () => {
    setLoading(true);
    setRetrainResult(null);
    try {
      const res = await api.post("/api/ai/admin/retrain/");
      setRetrainResult(res.data);
      await loadMetrics();
      await loadDatasetStatus();
    } catch (err) {
      setRetrainResult(err.response?.data || { error: "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    loadDatasetStatus();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Model Ops</div>
          <div className="text-2xl font-bold text-white">AI Model Admin</div>
          <div className="text-sm text-slate-300">
            View evaluation metrics and retrain MailMind models
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadMetrics}
            className="rounded-xl border border-slate-500/35 bg-[#223250] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-[#2c3f62]"
          >
            Refresh Metrics
          </button>

          <button
            onClick={retrain}
            disabled={loading}
            className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-60"
          >
            {loading ? "Retraining..." : "Retrain Models"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-500/25 bg-[#121d31]/90 p-4">
          <div className="text-sm font-semibold text-white">Urgency Model</div>
          <div className="mt-3 text-sm text-slate-300">
            Accuracy: {metrics?.urgency?.accuracy ?? "N/A"}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Train size: {metrics?.urgency?.train_size ?? "N/A"} | Test size: {metrics?.urgency?.test_size ?? "N/A"}
          </div>
          <pre className="mt-4 max-h-[380px] overflow-auto rounded-xl border border-slate-500/25 bg-[#0e1626] p-3 text-xs text-slate-200">
            {JSON.stringify(metrics?.urgency?.classification_report || {}, null, 2)}
          </pre>
        </div>

        <div className="rounded-2xl border border-slate-500/25 bg-[#121d31]/90 p-4">
          <div className="text-sm font-semibold text-white">Intent Model</div>
          <div className="mt-3 text-sm text-slate-300">
            Accuracy: {metrics?.intent?.accuracy ?? "N/A"}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Train size: {metrics?.intent?.train_size ?? "N/A"} | Test size: {metrics?.intent?.test_size ?? "N/A"}
          </div>
          <pre className="mt-4 max-h-[380px] overflow-auto rounded-xl border border-slate-500/25 bg-[#0e1626] p-3 text-xs text-slate-200">
            {JSON.stringify(metrics?.intent?.classification_report || {}, null, 2)}
          </pre>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-500/25 bg-[#121d31]/90 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Dataset Management</div>
            <div className="text-xs text-slate-400">
              Upload labeled CSV for MailMind model training
            </div>
          </div>

          <button
            onClick={loadDatasetStatus}
            className="rounded-xl border border-slate-500/35 bg-[#223250] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-[#2c3f62]"
          >
            Refresh Dataset Status
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-500/25 bg-[#0e1626] p-3 text-sm text-slate-200">
          <div><b>Exists:</b> {String(datasetStatus?.exists ?? false)}</div>
          <div><b>Rows:</b> {datasetStatus?.rows ?? 0}</div>
          <div><b>Columns:</b> {(datasetStatus?.columns || []).join(", ") || "None"}</div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="block text-sm text-slate-200"
          />

          <button
            onClick={uploadDataset}
            className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300"
          >
            Upload Dataset
          </button>
        </div>

        <pre className="mt-4 max-h-[260px] overflow-auto rounded-xl border border-slate-500/25 bg-[#0e1626] p-3 text-xs text-slate-200">
          {JSON.stringify(uploadResult || {}, null, 2)}
        </pre>
      </div>

      <div className="rounded-2xl border border-slate-500/25 bg-[#121d31]/90 p-4">
        <div className="text-sm font-semibold text-white">Retraining Output</div>
        <pre className="mt-4 max-h-[360px] overflow-auto rounded-xl border border-slate-500/25 bg-[#0e1626] p-3 text-xs text-slate-200">
          {JSON.stringify(retrainResult || {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
