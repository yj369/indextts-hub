import './globals.css';
import Wizard from './pages/Wizard';
import { ThemeProvider } from './context/ThemeContext';

const AppShell: React.FC = () => {
  return (
    <div className={`relative min-h-screen w-full overflow-hidden bg-background text-foreground`}>
      <div className="pointer-events-none absolute inset-0 retro-grid opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#8b5cf61a,transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10" />

      <main className="relative z-10 flex min-h-screen items-center justify-center p-[10px] box-border">
        <div className="w-full max-w-3xl">
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
