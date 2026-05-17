import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Optional right-aligned slot for actions, status pills, etc. */
  rightSlot?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  rightSlot,
}: PageHeaderProps) {
  return (
    <div className="relative overflow-hidden">
      {/* Subtle gradient bloom — quieter than the landing hero */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-100/40 blur-3xl" />
        <div className="absolute -top-12 right-1/4 h-48 w-48 rounded-full bg-amber-50/50 blur-3xl" />
      </div>
      <div className="pt-12 pb-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-serif">BidLens</span>
        </Link>
        <div className="mt-8 flex items-start justify-between gap-8 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="font-sans text-xs font-semibold tracking-[0.18em] text-indigo-700 uppercase">
              {eyebrow}
            </div>
            <h1 className="font-serif text-4xl lg:text-5xl leading-[1.1] tracking-tight text-slate-900 mt-3">
              {title}
            </h1>
            {subtitle && (
              <p className="font-sans text-base lg:text-lg text-slate-600 mt-4 max-w-2xl leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
        </div>
      </div>
    </div>
  );
}
