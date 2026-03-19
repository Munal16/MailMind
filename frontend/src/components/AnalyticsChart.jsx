import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--success))", "hsl(var(--secondary))", "hsl(var(--urgent))"];

function baseAxisStyle() {
  return {
    tick: { fill: "hsl(var(--muted-foreground))", fontSize: 12 },
    axisLine: { stroke: "hsl(var(--border))" },
    tickLine: { stroke: "hsl(var(--border))" },
  };
}

export default function AnalyticsChart({ type = "bar", data = [], xKey = "name", series = [], title }) {
  const axis = baseAxisStyle();

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-card-hover">
      <div className="mb-4 text-sm font-semibold text-card-foreground">{title}</div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {type === "pie" ? (
            <PieChart>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {data.map((entry, index) => (
                  <Cell key={entry.name || index} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          ) : type === "line" ? (
            <LineChart data={data}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xKey} {...axis} />
              <YAxis {...axis} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((item, index) => (
                <Line key={item.key} type="monotone" dataKey={item.key} stroke={item.color || COLORS[index % COLORS.length]} strokeWidth={3} dot={{ r: 4 }} />
              ))}
            </LineChart>
          ) : type === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xKey} {...axis} />
              <YAxis {...axis} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((item, index) => (
                <Area key={item.key} type="monotone" dataKey={item.key} stroke={item.color || COLORS[index % COLORS.length]} fill={item.fill || item.color || COLORS[index % COLORS.length]} fillOpacity={0.12} strokeWidth={3} />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xKey} {...axis} />
              <YAxis {...axis} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((item, index) => (
                <Bar key={item.key} dataKey={item.key} fill={item.color || COLORS[index % COLORS.length]} radius={[8, 8, 0, 0]} stackId={item.stackId} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
