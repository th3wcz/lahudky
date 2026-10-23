import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Clock, Gift, Mail, MapPin, Menu, Phone, PartyPopper, Utensils, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Kontakt() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mailOpened, setMailOpened] = useState(false);

  function sendInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const message = [
      `Jméno: ${formData.get("name")}`,
      `Telefon: ${formData.get("phone")}`,
      formData.get("date") ? `Datum akce: ${formData.get("date")}` : "",
      formData.get("people") ? `Počet osob: ${formData.get("people")}` : "",
      "",
      `Představa / zpráva: ${formData.get("message")}`,
    ].filter(Boolean).join("\n");
    const subject = `Poptávka cateringu – ${formData.get("name")}`;
    window.location.href = `mailto:lahudkyprima.dupakova@seznam.cz?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    setMailOpened(true);
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#302922]">
      <header className="sticky top-0 z-40 border-b border-[#e9e4dc] bg-[#faf9f6]/95 backdrop-blur">
        <div className="container mx-auto flex h-[68px] items-center justify-between px-5 md:px-10">
          <Link href="/" className="font-serif text-xl font-bold tracking-tight text-[#2f684f] sm:text-2xl">Prima Lahůdky</Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-[#5f554c] md:flex" aria-label="Hlavní navigace">
            <a href="/#sluzby" className="transition hover:text-[#2f684f]">Služby</a>
            <a href="/#prodejny" className="transition hover:text-[#2f684f]">Prodejny</a>
            <a href="#poptavka" className="transition hover:text-[#2f684f]">Kontakt</a>
            <Link href="/eshop"><Button className="rounded-full bg-[#2f684f] px-5 text-white hover:bg-[#25543f]">E-shop <ArrowRight size={15} /></Button></Link>
          </nav>
          <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "Zavřít menu" : "Otevřít menu"} aria-expanded={menuOpen} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#302922] hover:bg-[#eeeae3] md:hidden">
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        {menuOpen && (
          <nav className="border-t border-[#e9e4dc] bg-[#faf9f6] px-5 py-3 shadow-lg md:hidden" aria-label="Mobilní navigace">
            <div className="container mx-auto flex flex-col">
              <a href="/#sluzby" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-[#f0ede7]">Služby</a>
              <a href="/#prodejny" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-[#f0ede7]">Prodejny</a>
              <Link href="/eshop" onClick={() => setMenuOpen(false)} className="mt-2"><Button className="w-full rounded-full bg-[#2f684f] text-white hover:bg-[#25543f]">Přejít do e-shopu <ArrowRight size={15} /></Button></Link>
            </div>
          </nav>
        )}
      </header>

      <main className="container mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <section className="pt-2">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#b27616]">Prima Lahůdky · Teplice</p>
            <h1 className="font-serif text-4xl font-bold leading-tight sm:text-5xl">Jsme tu pro vás</h1>
            <p className="mt-4 max-w-xl leading-relaxed text-[#766b60]">Máte speciální přání nebo se chcete jen na něco zeptat? Napište nám, rádi vám připravíme nabídku na míru.</p>
            <div className="mt-8 space-y-5">
              <a href="tel:+420724708277" className="flex min-w-0 items-center gap-4 rounded-xl transition hover:bg-[#f0ede7]">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e6ece7] text-[#2f684f]"><Phone size={20} /></span>
                <span><span className="block text-[11px] uppercase tracking-[0.14em] text-[#8a7c70]">Telefon</span><span className="mt-0.5 block font-semibold">+420 724 708 277</span></span>
              </a>
              <a href="mailto:lahudkyprima.dupakova@seznam.cz" className="flex min-w-0 items-center gap-4 rounded-xl transition hover:bg-[#f0ede7]">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e6ece7] text-[#2f684f]"><Mail size={20} /></span>
                <span className="min-w-0"><span className="block text-[11px] uppercase tracking-[0.14em] text-[#8a7c70]">E-mail</span><span className="mt-0.5 block break-all font-semibold sm:break-normal">lahudkyprima.dupakova@seznam.cz</span></span>
              </a>
              <div className="rounded-xl bg-[#f1f0e9] p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8a7c70]">Naše prodejny v Teplicích</p>
                <div className="space-y-3">
                  <a href="https://mapy.com/cs/?q=U%20Nov%C3%BDch%20l%C3%A1zn%C3%AD%201593%2F16%2C%20Teplice" target="_blank" rel="noreferrer" className="flex min-w-0 items-start gap-3 rounded-lg p-1 transition hover:text-[#2f684f]">
                    <MapPin size={17} className="mt-0.5 shrink-0 text-[#2f684f]" /><span className="min-w-0"><span className="block font-semibold">U Nových lázní</span><span className="block break-words text-sm text-[#766b60]">U Nových lázní 1593/16, Teplice</span></span>
                  </a>
                  <a href="https://mapy.com/cs/?q=Masarykova%20t%C5%99%C3%ADda%20429%2F26%2C%20Teplice" target="_blank" rel="noreferrer" className="flex min-w-0 items-start gap-3 rounded-lg p-1 transition hover:text-[#2f684f]">
                    <MapPin size={17} className="mt-0.5 shrink-0 text-[#2f684f]" /><span className="min-w-0"><span className="block font-semibold">Masarykova třída</span><span className="block break-words text-sm text-[#766b60]">Masarykova třída 429/26, Teplice</span></span>
                  </a>
                </div>
                <p className="mt-3 text-xs text-[#766b60]">Vyzvednutí objednávky domluvíme předem.</p>
              </div>
              <div className="flex items-center gap-4 rounded-xl">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e6ece7] text-[#2f684f]"><Clock size={20} /></span>
                <span><span className="block text-[11px] uppercase tracking-[0.14em] text-[#8a7c70]">Objednávky</span><span className="mt-0.5 block font-semibold">Nejméně 48 hodin předem</span><span className="block text-sm text-[#766b60]">Požadovaný čas spolu potvrdíme.</span></span>
              </div>
            </div>
          </section>

          <section id="poptavka" className="scroll-mt-24 rounded-2xl border border-[#e4e0d8] bg-white p-6 shadow-sm sm:p-9">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e6ece7] text-[#2f684f]"><PartyPopper size={21} /></span>
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b27616]">Catering a zakázková výroba</p><h2 className="font-serif text-2xl font-bold">Napište nám</h2></div>
            </div>
            <form onSubmit={sendInquiry} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">Jméno a příjmení<input name="name" required autoComplete="name" placeholder="Jan Novák" className="mt-1.5 h-11 w-full min-w-0 rounded-lg border border-[#ded8cf] bg-[#fffefa] px-3 text-sm outline-none transition placeholder:text-[#a99d91] focus:border-[#2f684f] focus:ring-2 focus:ring-[#2f684f]/15" /></label>
                <label className="block text-sm font-medium">Telefon<input name="phone" required type="tel" autoComplete="tel" placeholder="+420 123 456 789" className="mt-1.5 h-11 w-full min-w-0 rounded-lg border border-[#ded8cf] bg-[#fffefa] px-3 text-sm outline-none transition placeholder:text-[#a99d91] focus:border-[#2f684f] focus:ring-2 focus:ring-[#2f684f]/15" /></label>
                <label className="block text-sm font-medium">Datum akce <span className="font-normal text-[#8a7c70]">(nepovinné)</span><input name="date" type="date" className="mt-1.5 h-11 w-full min-w-0 rounded-lg border border-[#ded8cf] bg-[#fffefa] px-3 text-sm outline-none transition focus:border-[#2f684f] focus:ring-2 focus:ring-[#2f684f]/15" /></label>
                <label className="block text-sm font-medium">Počet osob <span className="font-normal text-[#8a7c70]">(nepovinné)</span><input name="people" type="number" min="1" max="10000" placeholder="Např. 50" className="mt-1.5 h-11 w-full min-w-0 rounded-lg border border-[#ded8cf] bg-[#fffefa] px-3 text-sm outline-none transition placeholder:text-[#a99d91] focus:border-[#2f684f] focus:ring-2 focus:ring-[#2f684f]/15" /></label>
              </div>
              <label className="block text-sm font-medium">Vaše představa / zpráva<textarea name="message" required rows={5} placeholder="Dobrý den, rádi bychom poptali catering pro naši firemní akci…" className="mt-1.5 w-full min-w-0 resize-y rounded-lg border border-[#ded8cf] bg-[#fffefa] px-3 py-3 text-sm leading-relaxed outline-none transition placeholder:text-[#a99d91] focus:border-[#2f684f] focus:ring-2 focus:ring-[#2f684f]/15" /></label>
              <Button type="submit" className="h-12 w-full rounded-full bg-[#2f684f] text-base font-semibold text-white hover:bg-[#25543f]">Odeslat poptávku <ArrowRight size={17} /></Button>
              <p className="text-xs leading-relaxed text-[#8a7c70]">Otevře se váš e-mailový program s předvyplněnou zprávou na lahudkyprima.dupakova@seznam.cz.</p>
              {mailOpened && <p role="status" className="text-sm font-medium text-[#2f684f]">Poptávka je připravená v e-mailovém programu. Stačí ji odeslat.</p>}
            </form>
          </section>
        </div>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl bg-[#f1f0e9] p-6"><Utensils className="mb-4 text-[#2f684f]" size={23} /><h2 className="font-serif text-xl font-bold">Catering &amp; rauty</h2><p className="mt-2 text-sm leading-relaxed text-[#766b60]">Kompletní pohoštění pro svatby, firemní akce a oslavy. Nabídku připravíme podle počtu hostů a vaší představy.</p></article>
          <article className="rounded-2xl bg-[#f1f0e9] p-6"><Gift className="mb-4 text-[#2f684f]" size={23} /><h2 className="font-serif text-xl font-bold">Zakázková výroba</h2><p className="mt-2 text-sm leading-relaxed text-[#766b60]">Dárkové koše, mísy a individuální objednávky připravíme po předchozí domluvě.</p></article>
        </section>
      </main>

      <footer className="mt-12 bg-[#173b2e] py-7 text-center text-sm text-white/75"><Link href="/" className="hover:text-white">← Zpět na úvodní stránku</Link><span className="mx-3">·</span><Link href="/eshop" className="hover:text-white">E-shop</Link></footer>
      <a href="tel:+420724708277" aria-label="Zavolat Prima Lahůdky" className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#e89a08] text-white shadow-xl transition hover:scale-105 hover:bg-[#d68b05] md:bottom-8 md:right-8"><Phone size={20} /></a>
    </div>
  );
}
