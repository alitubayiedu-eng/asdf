"use client";
import { useEffect, useRef, useState } from "react";
import {
  FA_MONTHS, FA_DAYS, isoToJalali, jalaliToIso, jalaliMonthDays,
  jalaliFirstWeekday, todayJalali, fmtJalali, parseJalaliInput,
} from "@/lib/jalali";

const fa = (n: any) => String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);

/**
 * انتخاب تاریخ شمسی — جایگزین فیلد تاریخ میلادی مرورگر
 * مقدار ورودی و خروجی همیشه ISO میلادی است (برای پایگاه‌داده)،
 * ولی کاربر فقط تقویم و اعداد شمسی می‌بیند.
 *
 * DateInput value={f.start_date} onChange={v => setF({ ...f, start_date: v })}
 */
export default function DateInput({ value, onChange, className = "", placeholder = "انتخاب تاریخ", title, disabled }: any) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const t0 = todayJalali();
  const cur = isoToJalali(value);
  const [vy, setVy] = useState(cur?.y ?? t0.y);
  const [vm, setVm] = useState(cur?.m ?? t0.m);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const j = isoToJalali(value);
    setText(j ? `${j.y}/${String(j.m).padStart(2, "0")}/${String(j.d).padStart(2, "0")}` : "");
    if (j) { setVy(j.y); setVm(j.m); }
  }, [value]);

  useEffect(() => {
    const h = (e: any) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = (d: number) => { onChange(jalaliToIso(vy, vm, d)); setOpen(false); };
  const move = (delta: number) => {
    let m = vm + delta, y = vy;
    if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; }
    setVm(m); setVy(y);
  };

  // نوشتن دستی: ۱۴۰۵/۴/۲۶
  const commitText = () => {
    if (!text.trim()) { onChange(null); return; }
    const iso = parseJalaliInput(text);
    if (iso) onChange(iso);
    else { const j = isoToJalali(value); setText(j ? `${j.y}/${String(j.m).padStart(2, "0")}/${String(j.d).padStart(2, "0")}` : ""); }
  };

  const days = jalaliMonthDays(vy, vm);
  const first = jalaliFirstWeekday(vy, vm);
  const sel = isoToJalali(value);
  const isToday = (d: number) => t0.y === vy && t0.m === vm && t0.d === d;
  const isSel = (d: number) => sel && sel.y === vy && sel.m === vm && sel.d === d;

  return (
    <div className="relative" ref={box}>
      <div className={`input flex cursor-pointer items-center gap-1 ${className}`} title={title}
        onClick={() => !disabled && setOpen(!open)}>
        <input
          className="w-full bg-transparent text-center outline-none"
          dir="ltr" placeholder={placeholder} disabled={disabled}
          value={fa(text)}
          onChange={e => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitText(); setOpen(false); } }}
          onClick={e => e.stopPropagation()}
        />
        <span className="shrink-0 text-xs text-ink/40">▾</span>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-64 rounded-xl border border-line bg-card p-2 shadow-xl">
          {/* سرصفحه: ماه و سال */}
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="btn-ghost px-2 py-0.5 text-xs" onClick={() => move(-1)}>‹</button>
            <div className="flex items-center gap-1">
              <select className="input px-1 py-0.5 text-xs" value={vm} onChange={e => setVm(+e.target.value)}>
                {FA_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select className="input px-1 py-0.5 text-xs" value={vy} onChange={e => setVy(+e.target.value)}>
                {Array.from({ length: 31 }, (_, i) => t0.y - 15 + i).map(y => (
                  <option key={y} value={y}>{fa(y)}</option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-ghost px-2 py-0.5 text-xs" onClick={() => move(1)}>›</button>
          </div>

          {/* روزهای هفته */}
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-ink/40">
            {FA_DAYS.map(d => <div key={d} className="py-1 font-bold">{d}</div>)}
          </div>

          {/* روزها */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: first }, (_, i) => <div key={"e" + i} />)}
            {Array.from({ length: days }, (_, i) => i + 1).map(d => (
              <button key={d} type="button" onClick={() => pick(d)}
                className={`rounded-md py-1 text-xs transition
                  ${isSel(d) ? "accent-solid font-black"
                    : isToday(d) ? "border border-crane font-bold text-crane"
                    : "hover:bg-surface"}`}>
                {fa(d)}
              </button>
            ))}
          </div>

          {/* پابرگ */}
          <div className="mt-2 flex justify-between border-t border-line pt-2">
            <button type="button" className="text-[11px] text-blueprint hover:underline"
              onClick={() => { onChange(jalaliToIso(t0.y, t0.m, t0.d)); setOpen(false); }}>امروز</button>
            <button type="button" className="text-[11px] text-danger hover:underline"
              onClick={() => { onChange(null); setText(""); setOpen(false); }}>پاک کردن</button>
          </div>
        </div>
      )}
    </div>
  );
}
