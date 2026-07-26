"use client";
import { useEffect, useMemo, useState } from "react";
import {
  loadTemplates, Template, Clause, VAR_LABELS, AUTO_VARS,
  autoValues, renderContract, varsOf,
} from "@/lib/contractTpl";

const fa = (n: any) => String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);

/**
 * کتابخانه قالب قرارداد
 * انتخاب قالب → پر شدن خودکار جاهای خالی از مشخصات قرارداد →
 * افزودن/حذف/جابه‌جایی بندها → درج در «متن قرارداد»
 */
export default function ContractTemplatePicker({ contract, projectName, onApply, onClose }: any) {
  const [tpls, setTpls] = useState<Template[] | null>(null);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Template | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"pick" | "edit">("pick");
  const [addFrom, setAddFrom] = useState("");

  useEffect(() => { loadTemplates().then(setTpls).catch(() => setTpls([])); }, []);

  const cats = useMemo(() => [...new Set((tpls || []).map(t => t.cat))], [tpls]);
  const list = useMemo(() => (tpls || []).filter(t =>
    (!cat || t.cat === cat) && (!q || (t.name + t.title).includes(q))), [tpls, cat, q]);

  const choose = (t: Template) => {
    setSel(t);
    setClauses(t.clauses.map(c => ({ ...c })));
    setVals({ ...autoValues(contract, projectName) });
    setStep("edit");
  };

  const needed = useMemo(() => varsOf(clauses), [clauses]);
  const preview = useMemo(() => renderContract(sel?.title || "", clauses, vals), [sel, clauses, vals]);

  const move = (i: number, d: number) => {
    const a = [...clauses]; const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; setClauses(a);
  };
  const del = (i: number) => setClauses(clauses.filter((_, x) => x !== i));
  const addBlank = () => setClauses([...clauses, { no: "", title: "بند جدید", body: "" }]);
  const edit = (i: number, k: "title" | "body", v: string) => {
    const a = [...clauses]; (a[i] as any)[k] = v; setClauses(a);
  };
  // افزودن بند از قالبی دیگر
  const addFromTpl = (id: string) => {
    const t = (tpls || []).find(x => x.id === id);
    if (!t) return;
    setClauses([...clauses, ...t.clauses.map(c => ({ ...c }))]);
    setAddFrom("");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-3" onClick={onClose}>
      <div className="card flex max-h-[92vh] w-full max-w-6xl flex-col" onClick={e => e.stopPropagation()}>
        {/* ---------- سربرگ ---------- */}
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-black">
            {step === "pick" ? "کتابخانه نمونه قراردادها" : `ویرایش بندها — ${sel?.name}`}
          </h2>
          {step === "edit" && (
            <button className="btn-ghost py-1 text-xs" onClick={() => setStep("pick")}>→ انتخاب قالب دیگر</button>
          )}
          <button className="btn-ghost mr-auto py-1 text-xs" onClick={onClose}>بستن ✕</button>
        </div>

        {/* ══════════ گام ۱: انتخاب قالب ══════════ */}
        {step === "pick" && (
          <div className="flex-1 overflow-auto">
            {!tpls && <p className="p-6 text-center text-sm text-ink/40">در حال بارگذاری قالب‌ها…</p>}
            {tpls && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <input className="input w-56" placeholder="جستجو در قالب‌ها…" value={q} onChange={e => setQ(e.target.value)} />
                  <button className={`chip ${!cat ? "chip-on" : "border border-line"}`} onClick={() => setCat("")}>
                    همه ({fa(tpls.length)})
                  </button>
                  {cats.map(c => (
                    <button key={c} className={`chip ${cat === c ? "chip-on" : "border border-line"}`} onClick={() => setCat(c)}>
                      {c} ({fa(tpls.filter(t => t.cat === c).length)})
                    </button>
                  ))}
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {list.map(t => (
                    <button key={t.id} onClick={() => choose(t)}
                      className="card p-3 text-right transition hover:border-blueprint">
                      <div className="font-bold">{t.name}</div>
                      <div className="mt-1 text-[11px] text-ink/50">{t.cat}</div>
                      <div className="mt-2 flex gap-2">
                        <span className="chip bg-surface text-[10px]">{fa(t.clauses.length)} ماده</span>
                        {t.vars.length > 0 && <span className="chip bg-crane/15 text-[10px]">{fa(t.vars.length)} جای خالی</span>}
                      </div>
                    </button>
                  ))}
                  {list.length === 0 && <p className="text-sm text-ink/40">قالبی یافت نشد.</p>}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════ گام ۲: ویرایش بندها و متغیرها ══════════ */}
        {step === "edit" && sel && (
          <div className="grid flex-1 gap-3 overflow-hidden lg:grid-cols-2">
            {/* ستون راست: بندها */}
            <div className="flex flex-col overflow-hidden">
              {/* متغیرها */}
              <div className="mb-2 rounded-xl border border-line bg-surface/50 p-2">
                <div className="mb-1 text-xs font-bold">پر کردن جاهای خالی</div>
                <div className="grid grid-cols-2 gap-1">
                  {needed.map(v => (
                    <label key={v} className="flex items-center gap-1 text-[11px]">
                      <span className="w-24 shrink-0 text-ink/50">{VAR_LABELS[v] || v}</span>
                      <input className="input flex-1 py-0.5 text-[11px]" value={vals[v] || ""}
                        placeholder={AUTO_VARS.includes(v) ? "خودکار" : "دستی"}
                        onChange={e => setVals({ ...vals, [v]: e.target.value })} />
                    </label>
                  ))}
                  {needed.length === 0 && <p className="text-[11px] text-ink/40">این قالب جای خالی ندارد.</p>}
                </div>
                <p className="mt-1 text-[10px] text-ink/40">
                  مقادیر مشخص‌شده با «خودکار» از مشخصات همین قرارداد (پیمانکار، مبلغ، تاریخ‌ها) پر شده‌اند.
                </p>
              </div>

              {/* فهرست بندها */}
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-bold">بندهای قرارداد ({fa(clauses.length)})</span>
                <button className="btn-ghost py-0.5 text-[11px]" onClick={addBlank}>+ بند خالی</button>
                <select className="input mr-auto w-40 py-0.5 text-[11px]" value={addFrom}
                  onChange={e => { setAddFrom(e.target.value); addFromTpl(e.target.value); }}>
                  <option value="">+ افزودن بند از قالب دیگر…</option>
                  {(tpls || []).filter(t => t.id !== sel.id).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 space-y-1 overflow-auto pl-1">
                {clauses.map((c, i) => (
                  <div key={i} className="rounded-lg border border-line p-2">
                    <div className="flex items-center gap-1">
                      <span className="chip bg-surface text-[10px]">ماده {fa(i + 1)}</span>
                      <input className="input flex-1 py-0.5 text-xs font-bold" value={c.title}
                        onChange={e => edit(i, "title", e.target.value)} placeholder="عنوان ماده" />
                      <button className="btn-ghost px-1 py-0 text-[11px]" onClick={() => move(i, -1)} title="بالا">▲</button>
                      <button className="btn-ghost px-1 py-0 text-[11px]" onClick={() => move(i, 1)} title="پایین">▼</button>
                      <button className="px-1 text-[11px] text-danger" onClick={() => del(i)} title="حذف">✕</button>
                    </div>
                    <textarea className="input mt-1 w-full py-1 text-[11px]" rows={Math.min(6, (c.body.split("\n").length || 1) + 1)}
                      value={c.body} onChange={e => edit(i, "body", e.target.value)} placeholder="متن ماده…" />
                  </div>
                ))}
              </div>
            </div>

            {/* ستون چپ: پیش‌نمایش */}
            <div className="flex flex-col overflow-hidden">
              <div className="mb-1 text-xs font-bold">پیش‌نمایش متن نهایی</div>
              <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-card p-3 text-[11px] leading-7">
                {preview}
              </pre>
              <div className="mt-2 flex gap-2">
                <button className="btn-primary" onClick={() => { onApply(preview); onClose(); }}>
                  درج در متن قرارداد
                </button>
                <button className="btn-ghost" onClick={() => { onApply(preview, true); onClose(); }}
                  title="به انتهای متن فعلی اضافه می‌شود">افزودن به انتهای متن فعلی</button>
                <span className="mr-auto self-center text-[10px] text-ink/40">
                  جاهای خالی پرنشده به شکل ……… باقی می‌مانند
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
