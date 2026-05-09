import { SuitwoGame } from "@/components/SuitwoGame";

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-red-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 text-center py-6 px-4">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent">
          Suitwo
        </h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          Drop and merge to reach the top
        </p>
      </header>

      {/* Game */}
      <div className="relative z-10 flex-1 flex items-start justify-center pb-8">
        <SuitwoGame />
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4 text-xs text-muted-foreground/50">
        A drop and merge puzzle game
      </footer>
    </main>
  );
}
