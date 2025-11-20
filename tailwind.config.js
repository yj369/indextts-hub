// tailwind.config.js (项目根目录)
/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}", // 确保扫描到所有前端文件
    ],
    theme: {
    	extend: {
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		    colors: {
    		    	// Core Palette - Dark Mode Defaults
    		    	darkBg: '#050505',
    		    	darkText: '#FFFFFF',
    		    	darkTextSecondary: '#A0A0A0', // gray-400
    		    	darkBorder: 'rgba(255, 255, 255, 0.1)', // border-white/10
    		
    		    	// Core Palette - Light Mode Defaults
    		    	lightBg: '#F9FAFB', // gray-50
    		    	lightText: '#000000',
    		    	lightTextSecondary: '#4B5563', // gray-600
    		    	lightBorder: 'rgba(0, 0, 0, 0.05)', // border-black/5
    		
    		    	// Accent Colors
    		    	neonPurple: {
    		    		DEFAULT: '#8B5CF6', // purple-500
    		    		dark: '#7C3AED' // purple-600
    		    	},
    		    	tealCyan: '#2DD4BF', // teal-400
    		    	functionalGreen: '#22C55E', // A standard green for status indicators
    		    	functionalRed: '#EF4444', // A standard red for error indicators
    		    	functionalWarning: '#F59E0B', // A standard yellow/orange for warnings
    		
    		    	// Semantic colors using CSS variables for dual-mode
    		    	background: 'var(--background)',
    		    	foreground: 'var(--foreground)',
    		    	primary: {
    		    		DEFAULT: 'var(--primary)',
    		    		foreground: 'var(--primary-foreground)'
    		    	},
    		    	secondary: {
    		    		DEFAULT: 'var(--secondary)',
    		    		foreground: 'var(--secondary-foreground)'
    		    	},
    		    	accent: {
    		    		DEFAULT: 'var(--accent)',
    		    		foreground: 'var(--accent-foreground)'
    		    	},
    		    	destructive: {
    		    		DEFAULT: 'var(--destructive)',
    		    		foreground: 'var(--destructive-foreground)'
    		    	},
    		    	info: 'var(--info)',
    		    	success: 'var(--success)',
    		    	warning: 'var(--warning)',
    		    	error: 'var(--error)',
    		    	border: 'var(--border)',
    		    	input: 'var(--input)',
    		    	ring: 'var(--ring)',
                        card: {
                            DEFAULT: 'var(--card)',
                            foreground: 'var(--card-foreground)'
                        }
    		    }    	}
    },
    plugins: [require("tailwindcss-animate")],
}