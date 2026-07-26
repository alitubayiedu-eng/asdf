"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { loadCbsOptions, CbsOption } from "@/lib/costlink";
import { fmt } from "@/lib/constants";

/**
 * فیلد مشترک «کد هزینه + فاز» — در همه فرم‌هایی که هزینه ایجاد می‌کنند
 *
 * <CostCodeField projectId={id} value={{ code, phase }} onChange={setCost} />
 *
 * کاربر می‌تواند کد موجود را انتخاب کند یا کد جدید تایپ کند؛
 * کد جدید هنگام ذخیره خودکار در CBS ساخته می‌شود.
 */
export default function CostCodeField({
  projectId, value, onChange, compact, showPhase = true, label = "کد هزینه",
}: {
  projectId: string;
  value: { code?: string; phase?: string };
  onChange: (v: { code: string; phase: string }) => void;
  compact?: boolean;
  showPhase?: boolean;
  label?: string;
}) {
  const [opts, setOpts] = useState<CbsOption[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    loadCbsOptions(projectId).then(setOpts);
    supabase.from("phases").select("id, name").eq("project_id", projectId).order("sort")
      .then(({ data }: any) => setPhases(data || []));
  }, [projectId]);

  const code = value?.code || "";
  const phase = value?.phase || "";
  const hit = opts.find(o => o.cost_code === code);
  // اگر کد وارد‌شده در فهرست نیست، یعنی کد جدید است
  const isNew = !!code && !hit;

  const pick = (c: string) => {
    const o = opts.find(x => x.cost_code === c);
    onChange({ code: c, phase: o?.phase_name || phase });
  };

  return (
    <div className={compact ? "contents" : "space-y-1"}>
      {!compact && <label className="label">{label}</label>}
      <div className={compact ? "contents" : "flex flex-wrap gap-1.5"}>
        {manual || opts.length === 0 ? (
          <input
            className="input" placeholder="کد هزینه جدید (مثلاً 06-02-01)"
            value={code} dir="ltr"
            onChange={e => onChange({ code: e.target.value, phase })}
          />
        ) : (
          <select className="input" value={hit ? code : ""} onChange={e => pick(e.target.value)}>
            <option value="">بدون کد هزینه</option>
            {opts.map(o => (
              <option key={o.id} value={o.cost_code}>
                {o.cost_code} — {(o.item_name || "").slice(0, 40)}
                {o.planned > 0 ? ` (${fmt(Math.round(o.planned))})` : ""}
              </option>
            ))}
          </select>
        )}

        {showPhase && phases.length > 0 && (
          <select className="input" value={phase} onChange={e => onChange({ code, phase: e.target.value })}>
            <option value="">بدون فاز</option>
            {phases.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        )}

        {opts.length > 0 && (
          <button type="button" className="btn-ghost shrink-0 px-2 py-1 text-[11px]"
            title={manual ? "انتخاب از کدهای موجود" : "ثبت کد جدید به‌صورت دستی"}
            onClick={() => setManual(!manual)}>
            {manual ? "↩ فهرست" : "+ کد جدید"}
          </button>
        )}
      </div>

      {isNew && (
        <p className={`text-[10px] text-crane ${compact ? "col-span-full" : ""}`}>
          کد «{code}» جدید است — هنگام ذخیره خودکار در CBS ساخته می‌شود.
        </p>
      )}
      {hit && hit.planned > 0 && !compact && (
        <p className="text-[10px] text-ink/45">
          بودجه این کد: {fmt(Math.round(hit.planned))} ریال
          {hit.phase_name ? ` · فاز ${hit.phase_name}` : ""}
        </p>
      )}
    </div>
  );
}
