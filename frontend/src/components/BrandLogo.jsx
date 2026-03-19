import { useId } from "react";
import { cn } from "../lib/utils";

const sizeMap = {
  xs: {
    gap: "gap-2",
    mark: "h-8 w-[4rem]",
    wordmark: "text-xl",
  },
  sm: {
    gap: "gap-2.5",
    mark: "h-10 w-[4.9rem]",
    wordmark: "text-2xl",
  },
  md: {
    gap: "gap-3",
    mark: "h-12 w-[5.8rem]",
    wordmark: "text-[2rem]",
  },
  lg: {
    gap: "gap-3.5",
    mark: "h-16 w-[7.5rem]",
    wordmark: "text-[2.85rem]",
  },
  xl: {
    gap: "gap-4",
    mark: "h-20 w-[9rem]",
    wordmark: "text-[3.5rem]",
  },
};

export default function BrandLogo({
  size = "md",
  showWordmark = true,
  className,
  markClassName,
  wordmarkClassName,
}) {
  const styles = sizeMap[size] ?? sizeMap.md;
  const id = useId().replace(/:/g, "");

  return (
    <div className={cn("inline-flex items-center", styles.gap, className)} aria-label="MailMind">
      <div className={cn("relative shrink-0", styles.mark, markClassName)}>
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_28%_52%,hsl(var(--primary)/0.33),transparent_48%),radial-gradient(circle_at_76%_52%,hsl(var(--secondary)/0.30),transparent_44%),radial-gradient(circle_at_54%_48%,hsl(var(--card)/0.92),transparent_22%)] blur-xl" />

        <svg
          viewBox="0 0 168 96"
          className="relative h-full w-full overflow-visible drop-shadow-[0_0_26px_hsl(var(--primary)/0.24)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`brand-stroke-${id}`} x1="12" y1="18" x2="138" y2="82" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--primary))" />
              <stop offset="1" stopColor="hsl(var(--secondary))" />
            </linearGradient>
            <linearGradient id={`brand-fade-${id}`} x1="0" y1="48" x2="64" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--primary) / 0)" />
              <stop offset="0.55" stopColor="hsl(var(--primary) / 0.75)" />
              <stop offset="1" stopColor="hsl(var(--primary) / 0.95)" />
            </linearGradient>
            <linearGradient id={`brand-glow-${id}`} x1="60" y1="22" x2="118" y2="54" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--primary) / 0.72)" />
              <stop offset="1" stopColor="hsl(var(--secondary) / 0.78)" />
            </linearGradient>
          </defs>

          <g strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 40H41C48 40 54 37 58 31" stroke={`url(#brand-fade-${id})`} strokeWidth="2.1" />
            <path d="M0 49H35C43 49 49 46 54 42" stroke={`url(#brand-fade-${id})`} strokeWidth="2.1" />
            <path d="M10 58H38C45 58 50 56 55 51" stroke={`url(#brand-fade-${id})`} strokeWidth="2.1" />
            <path d="M18 67H43C49 67 54 64 58 59" stroke={`url(#brand-fade-${id})`} strokeWidth="1.9" />

            <path
              d="M54 31.5H121.5C124.4 31.5 126.8 33.9 126.8 36.8V70.1C126.8 73 124.4 75.4 121.5 75.4H54C51.1 75.4 48.7 73 48.7 70.1V36.8C48.7 33.9 51.1 31.5 54 31.5Z"
              stroke={`url(#brand-stroke-${id})`}
              strokeWidth="2.35"
            />
            <path d="M51.8 37.4L87.9 59.6L123.9 37.4" stroke={`url(#brand-stroke-${id})`} strokeWidth="2.2" />
            <path d="M50.9 70.2L79.8 49.8" stroke={`url(#brand-stroke-${id})`} strokeWidth="2" />
            <path d="M124.5 70.2L96 49.8" stroke={`url(#brand-stroke-${id})`} strokeWidth="2" />

            <path d="M67.5 34.8L77.8 28.5L88.7 25.6L100.5 28.4L110.8 34.6L106.2 42.5L96.6 38.7L86.5 38L76.8 41.3L69.6 45.8" stroke={`url(#brand-glow-${id})`} strokeWidth="1.5" />
            <path d="M76.6 28.6L75.2 41.4L86.5 38.1L88.7 25.8L97 38.7L100.6 28.4L105.8 42.1" stroke={`url(#brand-glow-${id})`} strokeWidth="1.2" opacity="0.9" />
          </g>

          {[
            [70.4, 35.8],
            [78.3, 28.6],
            [89.2, 25.8],
            [100.8, 28.6],
            [109.4, 35.6],
            [74.8, 42.8],
            [86.4, 38.3],
            [96.7, 38.7],
            [106.2, 42.6],
            [89.8, 46.2],
          ].map(([cx, cy], index) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r={index === 2 || index === 3 || index === 9 ? "2.15" : "1.75"}
              fill="hsl(var(--card))"
              stroke="hsl(var(--primary) / 0.42)"
              strokeWidth="0.45"
            />
          ))}
        </svg>
      </div>

      {showWordmark ? (
        <div
          className={cn(
            "whitespace-nowrap text-left font-black italic leading-none tracking-[-0.065em]",
            styles.wordmark,
            wordmarkClassName
          )}
        >
          <span className="text-foreground [text-shadow:0_0_18px_hsl(var(--card)/0.9)]">Mail</span>
          <span className="bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--secondary))_100%)] bg-clip-text text-transparent [filter:drop-shadow(0_0_14px_hsl(var(--primary)/0.24))]">
            Mind
          </span>
        </div>
      ) : null}
    </div>
  );
}
