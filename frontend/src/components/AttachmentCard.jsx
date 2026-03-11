import { Download, FileSpreadsheet, FileText, Image as ImageIcon } from "lucide-react";

const typeIcon = {
  PDF: FileText,
  Spreadsheet: FileSpreadsheet,
  Image: ImageIcon,
};

export default function AttachmentCard({ item }) {
  const Icon = typeIcon[item.type] || FileText;

  return (
    <div className="rounded-xl border border-slate-300/20 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-indigo-500" />
          <div className="text-sm font-semibold">{item.name}</div>
        </div>
        <button className="rounded-lg border border-slate-300/20 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
          <Download className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {item.sender} • {item.type} • {item.project}
      </div>
    </div>
  );
}
