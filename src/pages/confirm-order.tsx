import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { CheckCircle2, Loader2, Mail, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type Order = {
  order_code: string;
  status: "pending" | "sending" | "confirmed";
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  requested_at: string;
  payment_method: string;
  store_payment_method: string | null;
  items: Array<{ name: string; preparation?: string; unit: string; unitPrice: number; quantity: number }>;
  total_czk: number;
  fulfillment_method: "pickup" | "delivery";
  pickup_store: string | null;
  delivery_address: string | null;
  delivery_distance: "within_10km" | "over_10km" | null;
  delivery_fee_czk: number;
  note: string | null;
  confirmation_expires_at: string;
};

const money = (value: number) => new Intl.NumberFormat("cs-CZ").format(value);

export default function ConfirmOrder() {
  const [, params] = useRoute("/potvrdit-objednavku/:token");
  const token = params?.token;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}api/order-confirmation/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { order?: Order; error?: string };
        if (!response.ok) throw new Error(data.error || "Objednávku se nepodařilo načíst.");
        setOrder(data.order ?? null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Objednávku se nepodařilo načíst.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [token]);

  async function sendConfirmation() {
    if (!token) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/order-confirmation/${encodeURIComponent(token)}/confirm`, { method: "POST" });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "E-mail se nepodařilo odeslat.");
      setSent(true);
      setOrder((current) => current ? { ...current, status: "confirmed" } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "E-mail se nepodařilo odeslat.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:py-16">
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-9">
        <p className="font-serif text-lg font-semibold text-primary">Prima Lahůdky</p>
        {loading ? (
          <div className="flex items-center gap-3 py-12 text-foreground/60"><Loader2 className="animate-spin" /> Načítám objednávku…</div>
        ) : error && !order ? (
          <div className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-800"><TriangleAlert className="mb-2" size={20} />{error}</div>
        ) : order ? (
          <>
            <h1 className="mt-8 font-serif text-3xl font-bold text-primary">Potvrzení objednávky</h1>
            <p className="mt-2 text-sm text-foreground/60">Objednávka {order.order_code}</p>
            <div className="mt-6 space-y-2 rounded-xl bg-muted/40 p-4 text-sm">
              <p><strong>Zákazník:</strong> {order.customer_name}</p>
              <p><strong>Telefon:</strong> {order.customer_phone}</p>
              <p><strong>E-mail:</strong> {order.customer_email}</p>
              <p><strong>Termín:</strong> {new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", dateStyle: "full", timeStyle: "short" }).format(new Date(order.requested_at))}</p>
              <p><strong>Platba:</strong> Bankovní převod (variabilní symbol {order.order_code.replace("LP-", "")})</p>
              {order.fulfillment_method === "pickup" ? <p><strong>Vyzvednutí:</strong> {order.pickup_store === "nove-lazne" ? "U Nových lázní — U Nových lázní 1593/16, 415 01 Teplice" : "Masarykova třída — Masarykova třída 429/26, 415 01 Teplice"}</p> : <><p><strong>Výchozí prodejna:</strong> {order.pickup_store === "nove-lazne" ? "U Nových lázní" : "Masarykova třída"}</p><p><strong>Dovoz:</strong> {order.delivery_address} ({order.delivery_distance === "within_10km" ? "do 10 km" : "nad 10 km"})</p></>}
            </div>
            <div className="mt-5 divide-y divide-border rounded-xl border border-border px-4">
              {order.items.map((item, index) => <div key={`${item.name}-${index}`} className="flex justify-between gap-4 py-3 text-sm"><span>{item.name}{item.preparation ? ` · ${item.preparation}` : ""} × {item.quantity}</span><span className="whitespace-nowrap">{money(item.unitPrice * item.quantity)} Kč</span></div>)}
              {order.delivery_fee_czk > 0 && <div className="flex justify-between py-3 text-sm"><span>Doprava</span><span>{money(order.delivery_fee_czk)} Kč</span></div>}
              <div className="flex justify-between py-3 font-bold"><span>Celkem</span><span>{money(order.total_czk)} Kč</span></div>
            </div>
            {order.note && <p className="mt-4 text-sm text-foreground/70"><strong>Poznámka:</strong> {order.note}</p>}
            {order.status === "confirmed" || sent ? (
              <div className="mt-6 flex items-start gap-3 rounded-xl bg-primary/10 p-4 text-primary"><CheckCircle2 className="mt-0.5 shrink-0" /><p className="text-sm font-medium">Potvrzovací e-mail byl odeslán na {order.customer_email}.</p></div>
            ) : order.status === "sending" ? (
              <div className="mt-6 rounded-xl bg-muted/50 p-4 text-sm">Odeslání potvrzení se právě zpracovává. Chvilku počkejte a zkontrolujte e-mail.</div>
            ) : (
              <>
                <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">Nejdřív ověřte připsání platby na bankovním účtu. Kliknutím odešlete zákazníkovi potvrzení přijetí platby i objednávky.</p>
                {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
                <Button onClick={sendConfirmation} disabled={sending} className="mt-5 h-12 w-full rounded-full bg-primary text-white hover:bg-primary/90">
                  {sending ? <><Loader2 size={16} className="mr-2 animate-spin" /> Odesílám e-mail…</> : <><Mail size={16} className="mr-2" /> Odeslat potvrzení zákazníkovi</>}
                </Button>
              </>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
