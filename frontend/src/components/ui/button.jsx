/* eslint-disable react-refresh/only-export-components */
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:-translate-y-0.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-95 shadow-card",
        outline: "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "text-foreground hover:bg-accent/40 hover:text-accent-foreground",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        hero: "gradient-primary text-white shadow-glow hover:opacity-90",
        'hero-outline': "border-2 border-primary bg-transparent text-primary hover:bg-accent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export function buttonClassName({ variant, size, className } = {}) {
  return cn(buttonVariants({ variant, size, className }));
}

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? "span" : "button";
  return <Comp className={buttonClassName({ variant, size, className })} {...props} />;
}
