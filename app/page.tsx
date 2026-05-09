import { LofiDropGame } from "@/components/LofiDropGame";

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 text-center py-6 px-4">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
          Lofi Drop
        </h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          Merge tokens to grow • Reach the Lofi Whale 🐋
        </p>
      </header>

      {/* Game */}
      <div className="relative z-10 flex-1 flex items-start justify-center pb-8">
        <LofiDropGame />
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4 text-xs text-muted-foreground/50">
        A cozy arcade experience
      </footer>
    </main>
  );
}
