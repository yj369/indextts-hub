// src/components/MagicCard.tsx
import React, { useRef, useState, MouseEvent, ReactNode } from 'react';
import { cn } from '../lib/utils'; // Assuming cn is a utility for class names

interface MagicCardProps {
    children: ReactNode;
    className?: string;
    onClick?: (event: MouseEvent<HTMLDivElement>) => void; // Add onClick prop
}

const MagicCard: React.FC<MagicCardProps> = ({ children, className, onClick }) => { // Destructure onClick
    const cardRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number, y: number } | null>(null);

    const handleMouseMove = (e: MouseEvent) => {
        if (!cardRef.current) return;

        // Spotlight effect
        const rect = cardRef.current.getBoundingClientRect();
        setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleMouseLeave = () => {
        setMousePosition(null);
    };

    const cardStyle: React.CSSProperties = {
        '--mouse-x': mousePosition ? `${mousePosition.x}px` : '0px',
        '--mouse-y': mousePosition ? `${mousePosition.y}px` : '0px',
    } as React.CSSProperties; // Type assertion needed for custom CSS variables

    return (
        <div
            ref={cardRef}
            className={cn(
                "magic-card relative z-0 overflow-hidden rounded-lg border border-border bg-background transition-all duration-300 ease-out",
                mousePosition !== null && "before:opacity-100 after:opacity-100", // Only show spotlight if mouse is over
                className
            )}
            style={cardStyle}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onClick} // Pass onClick to the div
        >
            {children}
        </div>
    );
};

export default MagicCard;
