import { getServiceClient } from "@/lib/supabase-server";

// Network effect: because we run agents across many businesses, we can tell each
// one how it compares to anonymized peers in its industry ("restaurants like you
// recover 18% of carts — you're at 12%"). A single-tenant tool or DIY Zapier can
// never offer this, and it strengthens with every customer. Only aggregates are
// ever returned — never another client's row — and only once the cohort is large
// enough to preserve anonymity.

export type PeerBenchmark = { label: string; you: number; peers: number; unit: "%" | "$" };
export type PeerBenchmarks = { industry: string; sampleSize: number; metrics: PeerBenchmark[] };

const MIN_PEERS = 3; // don't show a benchmark until the cohort is anonymizable

type Agg = { won: number; lost: number; realized: number };

export async function loadPeerBenchmarks(email: string): Promise<PeerBenchmarks | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data: client } = await supabase.from("clients").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!client) return null;
  const { data: prof } = await supabase.from("business_profile").select("industry").eq("client_id", client.id).maybeSingle();
  const industry = prof?.industry;
  if (!industry) return null;

  const { data: peerRows } = await supabase.from("business_profile").select("client_id").eq("industry", industry);
  const ids = ((peerRows ?? []) as { client_id: string }[]).map((p) => p.client_id);
  if (ids.length <= MIN_PEERS) return null; // need enough peers (excluding self)

  const { data: outs } = await supabase.from("outcomes").select("client_id, value, status").in("client_id", ids);
  const per = new Map<string, Agg>(ids.map((id) => [id, { won: 0, lost: 0, realized: 0 }]));
  for (const o of (outs ?? []) as { client_id: string; value: number; status: string }[]) {
    const a = per.get(o.client_id);
    if (!a) continue;
    if (o.status === "won") {
      a.won += 1;
      a.realized += Number(o.value) || 0;
    } else if (o.status === "lost") {
      a.lost += 1;
    }
  }

  const winRate = (a: Agg) => (a.won + a.lost ? (a.won / (a.won + a.lost)) * 100 : 0);
  const avg = (arr: Agg[], f: (a: Agg) => number) => (arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : 0);

  const you = per.get(client.id)!;
  const peers = ids.filter((id) => id !== client.id).map((id) => per.get(id)!);
  if (peers.length < MIN_PEERS) return null;

  const metrics: PeerBenchmark[] = [
    { label: "Win rate", you: Math.round(winRate(you)), peers: Math.round(avg(peers, winRate)), unit: "%" },
    { label: "Realized value", you: Math.round(you.realized), peers: Math.round(avg(peers, (a) => a.realized)), unit: "$" },
  ];
  return { industry, sampleSize: peers.length, metrics };
}
