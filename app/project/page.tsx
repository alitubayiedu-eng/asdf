"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { tabsForKind, allowedTabs, editTabs, MANAGER_ROLES } from "@/lib/constants";
import PlanTab from "@/components/PlanTab";
import CbsTab from "@/components/CbsTab";
import WarehouseTab from "@/components/WarehouseTab";
import AccountingTab from "@/components/AccountingTab";
import AnalysisTab from "@/components/AnalysisTab";
import ArchitectureTab from "@/components/ArchitectureTab";
import NotesTab from "@/components/NotesTab";
import OrdersTab from "@/components/OrdersTab";
import MembersTab from "@/components/MembersTab";
import LogTab from "@/components/LogTab";
import ContractsTab from "@/components/ContractsTab";
import ProcurementTab from "@/components/ProcurementTab";
import SiteTab from "@/components/SiteTab";
import QualityTab from "@/components/QualityTab";
import CommsTab from "@/components/CommsTab";
import FactoryDashboardTab from "@/components/FactoryDashboardTab";
import ProductionTab from "@/components/ProductionTab";
import MaintenanceTab from "@/components/MaintenanceTab";
import QcTab from "@/components/QcTab";
import SalesTab from "@/components/SalesTab";
import CrmTab from "@/components/CrmTab";
import InvoicesTab from "@/components/InvoicesTab";
import ChequesTab from "@/components/ChequesTab";
import CostingTab from "@/components/CostingTab";
import EnergyTab from "@/components/EnergyTab";
import HrTab from "@/components/HrTab";
import ShareholdersTab from "@/components/ShareholdersTab";
import CustomSectionTab from "@/components/CustomSectionTab";
import HealthTab from "@/components/HealthTab";
import SolarDashboardTab from "@/components/SolarDashboardTab";
import SolarGenerationTab from "@/components/SolarGenerationTab";
import SolarAssetsTab from "@/components/SolarAssetsTab";
import SolarSalesTab from "@/components/SolarSalesTab";
import { SolarCleaningTab, SolarFaultsTab } from "@/components/SolarOpsTabs";
import ChpDashboardTab from "@/components/ChpDashboardTab";
import ChpUnitsTab from "@/components/ChpUnitsTab";
import ChpGenerationTab from "@/components/ChpGenerationTab";
import ChpSalesTab from "@/components/ChpSalesTab";
import ChpFaultsTab from "@/components/ChpFaultsTab";
import ChpServiceTab from "@/components/ChpServiceTab";
import ChpContractsTab from "@/components/ChpContractsTab";

function ProjectInner() {
  const sp = useSearchParams();
  const id = sp.get("id") || "";
  const { profile } = useSession();
  const [project, setProject] = useState<any>(null);
  const [myMember, setMyMember] = useState<any>(null);
  const [customSections, setCustomSections] = useState<any[]>([]);
  const [tab, setTab] = useState(sp.get("tab") || "");

  useEffect(() => {
    supabase.from("projects").select("*").eq("id", id).single().then(({ data }: any) => setProject(data));
  }, [id]);
  useEffect(() => {
    if (!profile) return;
    supabase.from("project_members").select("*").eq("project_id", id).eq("user_id", profile.id).single()
      .then(({ data }: any) => setMyMember(data || null));
  }, [id, profile]);
  const loadSections = () => supabase.from("custom_sections").select("*").eq("project_id", id).order("created_at")
    .then(({ data }: any) => setCustomSections(data || []));
  useEffect(() => { loadSections(); }, [id]);

  const addSection = async () => {
    const name = prompt("نام بخش جدید (مثلاً: امور حقوقی، R&D، صادرات):");
    if (!name?.trim()) return;
    await supabase.from("custom_sections").insert({ project_id: id, name: name.trim(), created_by_name: profile!.full_name });
    loadSections();
  };
  const removeSection = async (s: any) => {
    if (!confirm(`بخش «${s.name}» و محتوای آن حذف شود؟`)) return;
    await supabase.from("section_entries").delete().eq("section_id", s.id);
    await supabase.from("custom_sections").delete().eq("id", s.id);
    loadSections();
  };

  if (!project || !profile) return <Shell><p className="text-ink/40">در حال بارگذاری پروژه…</p></Shell>;

  const kind = project.kind || "construction";
  const canSeeLog = ["admin", "pm", "investor", "ceo", "board_member"].includes(profile.role);
  const isManager = MANAGER_ROLES.includes(profile.role) || profile.role === "investor";
  const viewable = allowedTabs(profile.role, myMember, kind);
  const editable = editTabs(profile.role, myMember, kind);
  const tabs: [string, string][] = [
    ...tabsForKind(kind).filter(([k]) => viewable.includes(k)),
    ...customSections.map(s => [`custom:${s.id}`, s.name] as [string, string]),
    ...(canSeeLog ? [["log", "گزارش تغییرات"] as [string, string]] : []),
  ];
  const active = tabs.some(([k]) => k === tab) ? tab : (tabs[0]?.[0] || "plan");
  const ce = (k: string) => editable.includes(k);
  const activeSection = active.startsWith("custom:") ? customSections.find(s => `custom:${s.id}` === active) : null;

  // ---------- تب‌های پروژه در سایدبار ----------
  const sideNav = (
    <>
      {tabs.map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)}
          className={`side-tab ${active === k ? "side-tab-active" : ""}`}>
          <span className="flex-1 truncate text-right">{l}</span>
          {k.startsWith("custom:") && isManager && (
            <span className="shrink-0 px-1 text-white/40 hover:text-danger"
              onClick={e => { e.stopPropagation(); removeSection(customSections.find(s => `custom:${s.id}` === k)); }}>×</span>
          )}
        </button>
      ))}
      {isManager && (
        <button className="side-tab mt-1 justify-center border border-dashed border-white/15 text-white/45 hover:text-white"
          onClick={addSection} title="افزودن بخش سفارشی">+ افزودن بخش</button>
      )}
    </>
  );

  return (
    <Shell sideNav={sideNav} sideTitle={project.name}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-black">{project.name}</h1>
        {project.code && <span className="code-chip">{project.code}</span>}
        <span className="text-xs text-ink/50">{project.location}</span>
        <span className="chip mr-auto bg-primary/10 text-primary">
          {tabs.find(([k]) => k === active)?.[1]}
        </span>
      </div>

      {/* نوار تب‌ها فقط در موبایل — سایدبار آنجا پنهان است */}
      <div className="mb-4 -mx-1 flex gap-1 overflow-x-auto pb-1 md:hidden">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`chip whitespace-nowrap ${active === k ? "chip-on" : "border border-line bg-card"}`}>{l}</button>
        ))}
        {isManager && <button className="chip whitespace-nowrap border border-dashed border-line" onClick={addSection}>+ بخش</button>}
      </div>
      {active === "plan" && <PlanTab projectId={id} profile={profile} canEdit={ce("plan")} />}
      {active === "cbs" && <CbsTab projectId={id} profile={profile} canEdit={ce("cbs")} />}
      {active === "analysis" && <AnalysisTab projectId={id} project={project} />}
      {active === "warehouse" && <WarehouseTab projectId={id} profile={profile} canEdit={ce("warehouse")} />}
      {active === "accounting" && <AccountingTab projectId={id} profile={profile} canEdit={ce("accounting")} />}
      {active === "architecture" && <ArchitectureTab projectId={id} profile={profile} canEdit={ce("architecture")} />}
      {active === "orders" && <OrdersTab projectId={id} profile={profile} projectName={project.name} canEdit={ce("orders")} />}
      {active === "notes" && <NotesTab projectId={id} profile={profile} canEdit={ce("notes")} />}
      {active === "contracts" && <ContractsTab projectId={id} profile={profile} canEdit={ce("contracts")} projectName={project.name} />}
      {active === "procurement" && <ProcurementTab projectId={id} profile={profile} canEdit={ce("procurement")} />}
      {active === "site" && <SiteTab projectId={id} profile={profile} canEdit={ce("site")} />}
      {active === "quality" && <QualityTab projectId={id} profile={profile} canEdit={ce("quality")} />}
      {active === "comms" && <CommsTab projectId={id} profile={profile} canEdit={ce("comms")} />}
      {active === "members" && <MembersTab projectId={id} profile={profile} kind={kind} />}
      {active === "fdash" && <FactoryDashboardTab projectId={id} />}
      {active === "production" && <ProductionTab projectId={id} profile={profile} canEdit={ce("production")} />}
      {active === "maintenance" && <MaintenanceTab projectId={id} profile={profile} canEdit={ce("maintenance")} />}
      {active === "qc" && <QcTab projectId={id} profile={profile} canEdit={ce("qc")} />}
      {active === "sales" && <SalesTab projectId={id} profile={profile} canEdit={ce("sales")} />}
      {active === "crm" && <CrmTab projectId={id} profile={profile} canEdit={ce("crm")} />}
      {active === "invoices" && <InvoicesTab projectId={id} profile={profile} canEdit={ce("invoices")} />}
      {active === "cheques" && <ChequesTab projectId={id} profile={profile} canEdit={ce("cheques")} />}
      {active === "costing" && <CostingTab projectId={id} profile={profile} canEdit={ce("costing")} />}
      {active === "energy" && <EnergyTab projectId={id} profile={profile} canEdit={ce("energy")} />}
      {active === "hr" && <HrTab projectId={id} profile={profile} canEdit={ce("hr")} />}
      {active === "sdash" && <SolarDashboardTab projectId={id} />}
      {active === "generation" && <SolarGenerationTab projectId={id} profile={profile} canEdit={ce("generation")} />}
      {active === "assets" && <SolarAssetsTab projectId={id} profile={profile} canEdit={ce("assets")} />}
      {active === "solarsales" && <SolarSalesTab projectId={id} profile={profile} canEdit={ce("solarsales")} />}
      {active === "cleaning" && <SolarCleaningTab projectId={id} profile={profile} canEdit={ce("cleaning")} />}
      {active === "faults" && <SolarFaultsTab projectId={id} profile={profile} canEdit={ce("faults")} />}
      {active === "cdash" && <ChpDashboardTab projectId={id} />}
      {active === "chpgen" && <ChpGenerationTab projectId={id} profile={profile} canEdit={ce("chpgen")} />}
      {active === "chpunits" && <ChpUnitsTab projectId={id} profile={profile} canEdit={ce("chpunits")} />}
      {active === "chpsales" && <ChpSalesTab projectId={id} profile={profile} canEdit={ce("chpsales")} />}
      {active === "chpfaults" && <ChpFaultsTab projectId={id} profile={profile} canEdit={ce("chpfaults")} />}
      {active === "chpservice" && <ChpServiceTab projectId={id} profile={profile} canEdit={ce("chpservice")} />}
      {active === "chpcontracts" && <ChpContractsTab projectId={id} profile={profile} canEdit={ce("chpcontracts")} />}
      {active === "health" && <HealthTab projectId={id} profile={profile} kind={kind} canEdit={isManager} />}
      {active === "shareholders" && <ShareholdersTab projectId={id} profile={profile} />}
      {activeSection && <CustomSectionTab projectId={id} profile={profile} section={activeSection} canEdit={true} />}
      {active === "log" && canSeeLog && <LogTab projectId={id} />}
    </Shell>
  );
}


export default function ProjectPage() {
  return <Suspense fallback={<Shell><p className="text-ink/40">در حال بارگذاری…</p></Shell>}><ProjectInner /></Suspense>;
}
