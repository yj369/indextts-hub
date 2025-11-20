import './globals.css';
import Wizard from './pages/Wizard';
import { ThemeProvider } from './context/ThemeContext';

const AppShell: React.FC = () => {
    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground font-sans selection:bg-primary/30 selection:text-white">

            {/* Dynamic Background Layers */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                {/* Grainy Noise */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>

                {/* Retro Grid */}
                <div
                    className="absolute inset-[-100%] bg-[size:50px_50px] opacity-20"
                    style={{
                        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
                        transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)',
                        maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)'
                    }}
                />

                {/* Ambient Glows */}
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-900/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }}></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-900/20 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }}></div>
            </div>

            {/* Content Layer */}
            <main className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
                <div className="w-full max-w-4xl animate-slide-up-fade">
                    <Wizard />
                </div>
            </main>
        </div>
    );
};

function App() {
    return (
        <ThemeProvider>
            <AppShell />
        </ThemeProvider>
    );
}

export default App;