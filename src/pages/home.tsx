import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, Clock, MapPin, Menu, Phone, X } from "lucide-react";
import { SiFacebook, SiInstagram } from "react-icons/si";
import heroImage from "@/assets/hero.png";
import cateringImage from "@/assets/catering-bg.png";
import giftImage from "@/assets/product-basket.png";
import { Button } from "@/components/ui/button";

const offers = [
  { title: "Catering & rauty", image: cateringImage, text: "Pohoštění pro svatby, oslavy i firemní akce." },
  { title: "Dárkové koše a výroba na míru", image: giftImage, text: "Tematické mísy a dobroty připravené podle vašich představ." },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-hidden bg-[#faf9f6] text-[#302922]">
      <header className="sticky top-0 z-40 border-b border-[#e9e4dc] bg-[#faf9f6]/95 backdrop-blur">
        <div className="container mx-auto flex h-[68px] items-center justify-between px-5 md:px-10">
          <Link href="/" className="font-serif text-xl font-bold tracking-tight text-[#2f684f] sm:text-2xl">Prima Lahůdky</Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-[#5f554c] md:flex" aria-label="Hlavní navigace">
            <a href="#nabidka" className="transition hover:text-[#2f684f]">Naše nabídka</a>
            <a href="#prodejny" className="transition hover:text-[#2f684f]">Prodejny</a>
            <Link href="/kontakt" className="transition hover:text-[#2f684f]">Kontakt</Link>
            <Link href="/eshop"><Button className="rounded-full bg-[#2f684f] px-5 text-white hover:bg-[#25543f]">E-shop <ArrowRight size={15} /></Button></Link>
          </nav>
          <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "Zavřít menu" : "Otevřít menu"} aria-expanded={menuOpen} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#302922] hover:bg-[#eeeae3] md:hidden">
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        {menuOpen && (
          <nav className="border-t border-[#e9e4dc] bg-[#faf9f6] px-5 py-3 shadow-lg md:hidden" aria-label="Mobilní navigace">
            <div className="container mx-auto flex flex-col">
              <a href="#nabidka" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-[#f0ede7]">Naše nabídka</a>
              <a href="#prodejny" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-[#f0ede7]">Prodejny</a>
              <Link href="/kontakt" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-[#f0ede7]">Kontakt a poptávka</Link>
              <Link href="/eshop" onClick={() => setMenuOpen(false)} className="mt-2"><Button className="w-full rounded-full bg-[#2f684f] text-white hover:bg-[#25543f]">Přejít do e-shopu <ArrowRight size={15} /></Button></Link>
            </div>
          </nav>
        )}
      </header>

      <main>
        <section className="relative isolate flex min-h-[560px] items-center overflow-hidden sm:min-h-[630px]">
          <img src={heroImage} alt="Chlebíčky a pohoštění Prima Lahůdky" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/50 to-black/15" />
          <div className="container mx-auto w-full px-5 py-20 md:px-10 md:py-28">
            <div className="max-w-3xl text-center text-white md:text-left">
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[#ed9d16] sm:text-sm">Tradice a chuť od roku 2003</p>
              <h1 className="font-serif text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">Poctivá lahůdkářská výroba z Teplic</h1>
              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-xl md:mx-0">Čerstvé chlebíčky, rauty a catering pro každou příležitost.</p>
              <div className="mx-auto mt-9 flex max-w-md flex-col gap-3 sm:flex-row md:mx-0">
                <a href="/kontakt#poptavka" className="flex-1"><Button className="h-12 w-full rounded-full border border-white/80 bg-[#2f684f] text-base font-semibold text-white hover:bg-[#25543f]">Objednat catering <ArrowRight size={17} /></Button></a>
                <Link href="/eshop" className="flex-1"><Button variant="outline" className="h-12 w-full rounded-full border-white/80 bg-black/15 text-base font-semibold text-white hover:bg-white hover:text-[#302922]">Zobrazit nabídku</Button></Link>
              </div>
            </div>
          </div>
          <a href="#nabidka" aria-label="Přejít na nabídku" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 rounded-full border border-white/45 px-4 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10 sm:block">Objevte naši nabídku ↓</a>
        </section>

        <section id="nabidka" className="container mx-auto px-5 py-14 md:px-10 md:py-20">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#b27616]">Naše nabídka</p>
              <h2 className="font-serif text-3xl font-bold sm:text-4xl">Dobré jídlo spojuje</h2>
            </div>
            <Link href="/eshop" className="inline-flex items-center gap-2 text-sm font-semibold text-[#2f684f] hover:underline">Prohlédnout e-shop <ArrowRight size={16} /></Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {offers.map((offer) => (
              <a key={offer.title} href="/kontakt#poptavka" className="group relative isolate flex min-h-[300px] items-end overflow-hidden rounded-2xl sm:min-h-[380px]">
                <img src={offer.image} alt={offer.title} loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                <div className="flex w-full items-end justify-between gap-4 p-6 text-white sm:p-8">
                  <div><h3 className="font-serif text-2xl font-bold sm:text-3xl">{offer.title}</h3><p className="mt-2 max-w-md text-sm text-white/80">{offer.text}</p></div>
                  <span className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/60 transition group-hover:bg-white group-hover:text-[#302922]"><ArrowUpRight size={19} /></span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section id="prodejny" className="container mx-auto px-5 py-14 md:px-10 md:py-18">
          <div className="mb-7 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b27616]">Navštivte nás</p>
            <h2 className="mt-1 font-serif text-3xl font-bold">Dvě prodejny v Teplicích</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "U Nových lázní", address: "U Nových lázní 1593/16, 415 01 Teplice", map: "https://mapy.com/cs/?q=U%20Nov%C3%BDch%20l%C3%A1zn%C3%AD%201593%2F16%2C%20Teplice" },
              { title: "Masarykova třída", address: "Masarykova třída 429/26, 415 01 Teplice", map: "https://mapy.com/cs/?q=Masarykova%20t%C5%99%C3%ADda%20429%2F26%2C%20Teplice" },
            ].map((store) => (
              <article key={store.title} className="rounded-2xl border border-[#e4e0d8] bg-white p-6 shadow-sm sm:p-7">
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e6ece7] text-[#2f684f]"><MapPin size={21} /></span>
                <h3 className="font-serif text-xl font-bold">{store.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#766b60]">{store.address}</p>
                <a href={store.map} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2f684f] hover:underline">Navigovat <ArrowUpRight size={15} /></a>
              </article>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-[#e4e0d8] bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6ece7] text-[#2f684f]"><Clock size={19} /></span>
              <div><h3 className="font-serif text-xl font-bold">Otevírací doba obou prodejen</h3><p className="text-sm text-[#766b60]">Vyzvednutí objednávek je možné pouze v této době.</p></div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              {["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"].map((day) => <div key={day} className="flex justify-between gap-2"><span className="text-[#766b60]">{day}</span><span className="font-semibold">6:30–17:00</span></div>)}
              <div className="flex justify-between gap-2"><span className="text-[#766b60]">Sobota</span><span className="font-semibold">9:00–9:30</span></div>
              <div className="flex justify-between gap-2"><span className="text-[#766b60]">Neděle</span><span className="font-semibold">Zavřeno</span></div>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-[#766b60]">Konkrétní vyzvednutí objednávky prosím domluvte předem.</p>
        </section>

      </main>

      <footer className="bg-[#173b2e] py-8 text-white">
        <div className="container mx-auto flex flex-col gap-5 px-5 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <div><p className="font-serif text-xl font-bold">Prima Lahůdky</p><p className="mt-1 text-sm text-white/65">Poctivá lahůdkářská výroba z Teplic</p></div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/75"><a href="tel:+420724708277" className="hover:text-white">+420 724 708 277</a><a href="mailto:lahudkyprima.dupakova@seznam.cz" className="hover:text-white">Napsat e-mail</a><Link href="/kontakt" className="hover:text-white">Kontakt</Link><Link href="/eshop" className="hover:text-white">E-shop</Link></div>
          <div className="flex gap-3"><a href="https://www.instagram.com/lahudky_prima/" target="_blank" rel="noreferrer" aria-label="Instagram Prima Lahůdky" className="rounded-full bg-white/10 p-2 hover:bg-white/20"><SiInstagram /></a><a href="#" aria-label="Facebook Prima Lahůdky" className="rounded-full bg-white/10 p-2 hover:bg-white/20"><SiFacebook /></a></div>
        </div>
      </footer>

      <a href="tel:+420724708277" aria-label="Zavolat Prima Lahůdky" className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#e89a08] text-white shadow-xl transition hover:scale-105 hover:bg-[#d68b05] md:bottom-8 md:right-8"><Phone size={20} /></a>
    </div>
  );
}
