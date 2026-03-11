import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Filler
);

export default function AnalyticsChart({ type = "bar", data, title }) {
  const common = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: "#94a3b8",
        },
      },
    },
    scales: {
      x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.12)" } },
      y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.12)" } },
    },
  };

  return (
    <div className="rounded-2xl border border-slate-300/20 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="mb-3 text-sm font-semibold">{title}</div>
      {type === "pie" && <Doughnut data={data} />}
      {type === "line" && <Line options={common} data={data} />}
      {type === "bar" && <Bar options={common} data={data} />}
    </div>
  );
}
