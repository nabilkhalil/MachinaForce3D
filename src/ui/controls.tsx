import { useState, type ReactNode } from 'react';
import { useApp } from '../state/store';
import { PARAM_HELP } from '../content/learning';

export function Section({ title, children, defaultOpen = true, right }: { title: string; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-800">
      <button className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className="flex items-center gap-2">{right}<span className="text-slate-600">{open ? '−' : '+'}</span></span>
      </button>
      {open && <div className="space-y-2.5 px-3 pb-3">{children}</div>}
    </div>
  );
}

export function Help({ k }: { k: string }) {
  const learn = useApp((s) => s.view.learn);
  if (!learn || !PARAM_HELP[k]) return null;
  return <p className="mt-1 rounded bg-cyan-950/40 px-2 py-1 text-[11px] leading-snug text-cyan-100/90 ring-1 ring-cyan-900">{PARAM_HELP[k]}</p>;
}

export function SliderField({
  label, unit, value, min, max, step, onChange, help, digits = 2, symbol,
}: {
  label: string; unit?: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; help?: string; digits?: number; symbol?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs text-slate-300">
          {label} {symbol && <span className="italic text-slate-500">{symbol}</span>}
        </label>
        <div className="flex items-baseline gap-1">
          <input
            type="number" value={Number(value.toFixed(digits))} min={min} max={max} step={step}
            onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v))); }}
            className="w-20 rounded bg-slate-800 px-1.5 py-0.5 text-right text-xs text-slate-100 tabular ring-1 ring-slate-700 focus:outline-none focus:ring-cyan-500"
          />
          {unit && <span className="w-12 text-[10px] text-slate-500">{unit}</span>}
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full" aria-label={label} />
      {help && <Help k={help} />}
    </div>
  );
}

export function SelectField<T extends string | number>({ label, value, options, onChange, help }: {
  label: string; value: T; options: { value: T; label: string; disabled?: boolean }[]; onChange: (v: T) => void; help?: string;
}) {
  return (
    <div>
      <label className="text-xs text-slate-300">{label}</label>
      <select
        aria-label={label}
        value={String(value)}
        onChange={(e) => { const o = options.find((x) => String(x.value) === e.target.value); if (o) onChange(o.value); }}
        className="mt-1 w-full rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 ring-1 ring-slate-700 focus:outline-none focus:ring-cyan-500"
      >
        {options.map((o) => <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>{o.label}</option>)}
      </select>
      {help && <Help k={help} />}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-cyan-400" />
      {label}
    </label>
  );
}

export type Badge = 'estimate' | 'validated' | 'assumption' | 'warn' | 'ok' | 'fail';
export function Tag({ kind, children }: { kind: Badge; children: ReactNode }) {
  const c: Record<Badge, string> = {
    estimate: 'bg-amber-900/50 text-amber-200 ring-amber-700',
    validated: 'bg-emerald-900/50 text-emerald-200 ring-emerald-700',
    assumption: 'bg-slate-800 text-slate-300 ring-slate-600',
    warn: 'bg-orange-900/50 text-orange-200 ring-orange-700',
    ok: 'bg-emerald-900/60 text-emerald-200 ring-emerald-600',
    fail: 'bg-rose-900/60 text-rose-200 ring-rose-600',
  };
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${c[kind]}`}>{children}</span>;
}

export function Metric({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: string; tone?: 'ok' | 'bad' | 'warn' }) {
  const col = tone === 'ok' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-300' : 'text-slate-100';
  return (
    <div className="rounded bg-slate-900 px-2 py-1.5 ring-1 ring-slate-800">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`tabular text-sm font-semibold ${col}`}>{value}{unit && <span className="ml-1 text-[10px] font-normal text-slate-500">{unit}</span>}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-slate-900 p-5 text-sm text-slate-200 shadow-2xl ring-1 ring-slate-700 scroll-thin" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-50">{title}</h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Btn({ children, onClick, kind = 'default', title, disabled }: { children: ReactNode; onClick?: () => void; kind?: 'default' | 'primary' | 'ghost'; title?: string; disabled?: boolean }) {
  const c = kind === 'primary' ? 'bg-cyan-600 text-white hover:bg-cyan-500' : kind === 'ghost' ? 'text-slate-300 hover:bg-slate-800' : 'bg-slate-800 text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700';
  return <button title={title} disabled={disabled} onClick={onClick} className={`rounded px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${c}`}>{children}</button>;
}
