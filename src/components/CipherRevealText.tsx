// src/components/CipherRevealText.tsx
import React, { useState, useEffect } from 'react';

interface CipherRevealTextProps {
  text: string;
  className?: string;
  interval?: number; // Milliseconds per character reveal
  cipherChars?: string; // Characters to use for the "cipher" effect
}

const CipherRevealText: React.FC<CipherRevealTextProps> = ({
  text,
  className,
  interval = 50,
  cipherChars = '!@#$%^&*()_+-=[]{}|;:,.<>/?',
}) => {
  const [revealedText, setRevealedText] = useState('');


  useEffect(() => {
    if (!text) return;

    let currentIndex = 0;
    const revealInterval = setInterval(() => { // Renamed local variable to avoid conflict
      if (currentIndex < text.length) {
        let newRevealedText = '';
        for (let i = 0; i < text.length; i++) {
          if (i < currentIndex) {
            newRevealedText += text[i];
          } else {
            // Add a random cipher character or the actual character if it's the current one
            const char = text[i];
            if (char === ' ') { // Preserve spaces
              newRevealedText += ' ';
            } else if (i === currentIndex) {
              newRevealedText += char; // Gradually reveal character
            } else {
              newRevealedText += cipherChars[Math.floor(Math.random() * cipherChars.length)];
            }
          }
        }
        setRevealedText(newRevealedText);
        currentIndex++;
      } else {
        setRevealedText(text); // Ensure final text is exact

        clearInterval(revealInterval);
      }
    }, interval); // Use the prop 'interval' here

    return () => clearInterval(revealInterval);
  }, [text, interval, cipherChars]);

  return (
    <span className={className}>
      {revealedText}
    </span>
  );
};

export default CipherRevealText;