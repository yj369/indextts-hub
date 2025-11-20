import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-95",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] border border-primary/50",
                destructive:
                    "bg-destructive/10 text-destructive border border-destructive/50 hover:bg-destructive/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]",
                outline:
                    "border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-foreground backdrop-blur-sm",
                secondary:
                    "bg-secondary/10 text-secondary border border-secondary/50 hover:bg-secondary/20 shadow-[0_0_15px_rgba(45,212,191,0.1)]",
                ghost: "hover:bg-white/10 hover:text-white",
                link: "text-primary underline-offset-4 hover:underline",
                cyber: "bg-black border border-white/20 text-white hover:bg-white/10 hover:border-primary hover:text-primary shadow-[0_0_10px_rgba(0,0,0,0.5)] uppercase tracking-widest",
            },
            size: {
                default: "h-10 px-6 py-2",
                sm: "h-8 rounded-md px-3 text-xs",
                lg: "h-12 rounded-md px-8 text-base",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }