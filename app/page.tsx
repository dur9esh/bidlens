import { EngineeringNotes } from "./_components/engineering-notes";
import { LandingHero } from "./_components/landing-hero";
import { NavHub } from "./_components/nav-hub";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <LandingHero />
      <NavHub />
      <EngineeringNotes />
      <footer className="border-t border-slate-200/70">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-6 flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-serif text-base text-slate-700">BidLens</p>
          <p className="text-xs text-slate-500">
            v1.0 · Prototype for Accellor Senior AI PM evaluation
          </p>
        </div>
      </footer>
    </main>
  );
}
