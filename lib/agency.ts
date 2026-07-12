import { getServiceClient } from "@/lib/supabase-server";

// White-label: an agency runs FlowForge for many clients under its own brand.
// This turns competing automation agencies into a distribution channel.

export type Agency = { id: string; name: string; brandColor: string };
export type AgencyClient = {
  id: string;
  name: string;
  email: string | null;
  plan: string;
  status: string;
  pending: number;
  realized: number;
};

export async function getAgencyFor(email: string): Promise<Agency | null> {
  const svc = getServiceClient();
  if (!svc) return null;
  const { data } = await svc
    .from("agencies")
    .select("id, name, brand_color")
    .eq("owner_email", email.toLowerCase())
    .maybeSingle();
  return data ? { id: data.id, name: data.name, brandColor: data.brand_color } : null;
}

export async function listAgencyClients(agencyId: string): Promise<AgencyClient[]> {
  const svc = getServiceClient();
  if (!svc) return [];
  const { data: clients } = await svc
    .from("clients")
    .select("id, name, email, plan, status")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: true });

  const out: AgencyClient[] = [];
  for (const c of ((clients ?? []) as { id: string; name: string; email: string | null; plan: string; status: string }[])) {
    const [{ count: pending }, { data: outs }] = await Promise.all([
      svc.from("approvals").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("status", "pending"),
      svc.from("outcomes").select("value").eq("client_id", c.id).eq("status", "won"),
    ]);
    const realized = ((outs ?? []) as { value: number }[]).reduce((s, o) => s + (Number(o.value) || 0), 0);
    out.push({ id: c.id, name: c.name, email: c.email, plan: c.plan, status: c.status, pending: pending ?? 0, realized: Math.round(realized) });
  }
  return out;
}
