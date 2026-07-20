"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Plus, Users } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import type { Agency, AgencyClient } from "@/lib/agency";

const inputCls =
  "w-full rounded-lg border border-border bg-card/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-cyan-electric";

export function AgencyConsole({ agency, clients }: { agency: Agency | null; clients: AgencyClient[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/portal/agency", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) router.refresh();
    } catch {
      /* ignore */
    }
    setBusy(false);
  }

  if (!agency) {
    return (
      <PageLayout>
        <div className="container max-w-lg pb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">For agencies</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Run Wardvale for your clients.</h1>
          <p className="mt-1 text-muted-foreground">
            Manage every client&rsquo;s agents, approvals, and ROI from one place — under your brand.
          </p>
          <CreateForm busy={busy} onCreate={(name, brandColor) => post({ action: "create", name, brandColor })} />
        </div>
      </PageLayout>
    );
  }

  const totalRealized = clients.reduce((s, c) => s + c.realized, 0);
  const totalPending = clients.reduce((s, c) => s + c.pending, 0);

  return (
    <PageLayout>
      <div className="container pb-16">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ backgroundColor: `${agency.brandColor}22`, color: agency.brandColor }}>
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold">{agency.name}</h1>
            <p className="text-sm text-muted-foreground">
              {clients.length} clients · {totalPending} pending approvals · ${totalRealized.toLocaleString()} realized
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card/40 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-border px-6 py-4 font-display font-semibold">
            <Users className="h-4 w-4 text-cyan-electric" /> Clients
          </div>
          {clients.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No clients yet — add your first below.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 text-left font-medium">Client</th>
                    <th className="px-4 py-3 text-left font-medium">Plan</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Pending</th>
                    <th className="px-4 py-3 text-right font-medium">Realized</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0">
                      <td className="px-6 py-3">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{c.plan}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${c.status === "active" ? "text-emerald-300" : "text-yellow-300"}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.pending}</td>
                      <td className="px-4 py-3 text-right font-display font-semibold tabular-nums text-cyan-electric">${c.realized.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <AddClientForm busy={busy} onAdd={(clientEmail, clientName) => post({ action: "add-client", clientEmail, clientName })} />
      </div>
    </PageLayout>
  );
}

function CreateForm({ busy, onCreate }: { busy: boolean; onCreate: (name: string, brandColor: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#22d3ee");
  return (
    <div className="mt-6 rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Agency name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Automation Co." className={inputCls} />
      </label>
      <label className="mt-4 flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">Brand color</span>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 rounded border border-border bg-transparent" />
      </label>
      <Button className="mt-5" onClick={() => name && onCreate(name, color)} disabled={busy || !name}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />} Create agency
      </Button>
    </div>
  );
}

function AddClientForm({ busy, onAdd }: { busy: boolean; onAdd: (email: string, name: string) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-border bg-card/30 p-6">
      <h2 className="flex items-center gap-2 font-display font-semibold">
        <Plus className="h-4 w-4 text-cyan-electric" /> Add a client
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Provisions a fully set-up client (agents + profile) under your agency.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client business name" className={inputCls} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@client.com" className={inputCls} />
      </div>
      <Button className="mt-4" size="sm" onClick={() => email && onAdd(email, name)} disabled={busy || !email}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add client
      </Button>
    </div>
  );
}
