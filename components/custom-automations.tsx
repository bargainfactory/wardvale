"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Pause, Play, Plus, Trash2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";

// Custom Automations composer (Growth+/Custom add-on): "New Automation" —
// name, instructions, real schedule (daily/weekly at an hour, client tz),
// notification preference. Runs land as REPORTS in the approval queue; the
// lane hardcodes that they can never send anything. Portal-only by design —
// the median owner never meets a blank box; this is the power-user escape hatch.

type Row = {
  id: string;
  name: string;
  instructions: string;
  schedule: "off" | "daily" | "weekly";
  run_hour: number;
  run_day: number | null;
  notify: "digest" | "instant";
  status: "active" | "paused";
  last_run_at: string | null;
};

const inputCls =
  "w-full rounded-lg border border-border bg-card/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-cyan-electric";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function CustomAutomations({ isDemo }: { isDemo: boolean }) {
  const { t } = useLocale();
  const [rows, setRows] = useState<Row[]>([]);
  const [gated, setGated] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", instructions: "", schedule: "daily", runHour: 9, runDay: 1, notify: "digest" });

  const load = useCallback(async () => {
    if (isDemo) return;
    try {
      const r = await fetch("/api/portal/automations");
      const d = await r.json();
      setRows(d.automations ?? []);
      setGated(Boolean(d.gated));
    } catch {
      /* ignore */
    }
  }, [isDemo]);
  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch("/api/portal/automations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          instructions: form.instructions,
          schedule: form.schedule,
          runHour: form.runHour,
          runDay: form.schedule === "weekly" ? form.runDay : null,
          notify: form.notify,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error === "plan_gated" ? t("prt.autoGated") : t("prt.autoErr"));
      else {
        setOpen(false);
        setForm({ name: "", instructions: "", schedule: "daily", runHour: 9, runDay: 1, notify: "digest" });
        await load();
      }
    } catch {
      setErr(t("prt.autoErr"));
    }
    setSaving(false);
  }

  async function toggle(row: Row) {
    await fetch("/api/portal/automations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: row.id, status: row.status === "active" ? "paused" : "active" }),
    }).catch(() => {});
    load();
  }
  async function remove(id: string) {
    await fetch("/api/portal/automations", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    load();
  }

  const days = [t("prt.daySun"), t("prt.dayMon"), t("prt.dayTue"), t("prt.dayWed"), t("prt.dayThu"), t("prt.dayFri"), t("prt.daySat")];
  const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

  return (
    <div className="mb-6 rounded-3xl border border-cyan-electric/20 bg-cyan-electric/[0.04] p-6 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display font-semibold">
            <Wand2 className="h-4 w-4 text-cyan-electric" /> {t("prt.autoTitle")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("prt.autoSub")}</p>
        </div>
        {!isDemo && !gated && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {t("prt.autoNew")}
          </Button>
        )}
      </div>

      {(isDemo || gated) && (
        <p className="mt-4 rounded-xl border border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          {isDemo ? t("prt.autoDemo") : t("prt.autoGated")}
        </p>
      )}

      {!isDemo && !gated && rows.length > 0 && (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{row.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.schedule === "weekly" ? `${days[row.run_day ?? 1]} · ` : ""}
                  {row.schedule !== "off" ? hourLabel(row.run_hour) : t("prt.autoOff")} · {row.notify === "instant" ? t("prt.autoInstant") : t("prt.autoDigest")}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${row.status === "active" ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-muted-foreground"}`}>
                {row.status === "active" ? t("prt.autoActive") : t("prt.autoPaused")}
              </span>
              <button type="button" onClick={() => toggle(row)} aria-label={row.status === "active" ? t("prt.autoPause") : t("prt.autoResume")} className="text-muted-foreground transition hover:text-foreground">
                {row.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => remove(row.id)} aria-label={t("prt.autoDelete")} className="text-muted-foreground transition hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-4 rounded-2xl border border-border bg-card/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-semibold">{t("prt.autoNew")}</h3>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("prt.autoClose")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("prt.autoNamePh")} className={inputCls} />
            <textarea
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              rows={3}
              placeholder={t("prt.autoInstrPh")}
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <select value={form.schedule} onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))} className={inputCls}>
                <option value="daily">{t("prt.autoDaily")}</option>
                <option value="weekly">{t("prt.autoWeekly")}</option>
              </select>
              {form.schedule === "weekly" && (
                <select value={form.runDay} onChange={(e) => setForm((f) => ({ ...f, runDay: Number(e.target.value) }))} className={inputCls}>
                  {days.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              )}
              <select value={form.runHour} onChange={(e) => setForm((f) => ({ ...f, runHour: Number(e.target.value) }))} className={inputCls}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>{hourLabel(h)}</option>
                ))}
              </select>
              <select value={form.notify} onChange={(e) => setForm((f) => ({ ...f, notify: e.target.value }))} className={inputCls}>
                <option value="digest">{t("prt.autoDigest")}</option>
                <option value="instant">{t("prt.autoInstant")}</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">{t("prt.autoSafety")}</p>
            {err && <p className="text-xs text-amber-500">{err}</p>}
            <div>
              <Button onClick={create} disabled={saving || !form.name.trim() || !form.instructions.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t("prt.autoCreate")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
