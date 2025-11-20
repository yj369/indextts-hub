import React, { useRef, useState, MouseEvent, ReactNode } from 'react';
import { cn } from '../lib/utils';

interface MagicCardProps {
    children: ReactNode;
    className?: string;
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
    gradientColor?: string;
}

const MagicCard: React.FC<MagicCardProps> = ({
                                                 children,
                                                 className,
                                                 onClick,
                                                 gradientColor = "rgba(139, 92, 246, 0.15)" // Default to Purple
                                             }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number, y: number } | null>(null);

    const handleMouseMove = (e: MouseEvent) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleMouseLeave = () => {
        setMousePosition(null);
    };

    return (
        <div
            ref={cardRef}
            className={cn(
                "group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] transition-all duration-300",
                "hover:border-white/20 hover:shadow-2xl hover:translate-y-[-2px]",
                className
            )}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
        >
            {/* Spotlight Gradient */}
            <div
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
                style={{
                    background: mousePosition
                        ? `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, ${gradientColor}, transparent 40%)`
                        : '',
                }}
            />

            {/* Content */}
            <div className="relative z-10 h-full">
                {children}
            </div>
        </div>
    );
};

export default MagicCard;