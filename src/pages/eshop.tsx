import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, startOfDay } from "date-fns";
import { cs } from "date-fns/locale";
import {
  ShoppingCart, X, Plus, Minus, ArrowLeft, Phone, Clock, MapPin, Truck,
  ChevronRight, ShoppingBag, User, MessageSquare, CheckCircle2, Loader2, Search, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

import catalogProducts from "../../shared/products.json";

type Product = {
  id: string;
  name: string;
  price: number;
  unit: string;
  category: string;
};

const products = catalogProducts as Product[];
type ProductGroup = { id: string; title: string; products: Product[] };

function groupInfo(product: Product): { id: string; title: string } {
  const id = product.id;
  if (id.startsWith("chlebicek-")) return { id: "chlebicky-standard", title: "Chlebíčky" };
  if (id.startsWith("bageta-")) return { id: "bagety-standard", title: "Bagety" };
  if (id.startsWith("fr-bageta-")) return { id: "bagety-francouzske", title: "Francouzské bagety" };
  if (id.startsWith("cerealni-bageta-")) return { id: "bagety-cerealni", title: "Cereální bagety" };
  if (id.startsWith("zitny-chleb-")) return { id: "chleby-zitne", title: "Žitné chleby" };
  if (id.startsWith("tortilla-")) return { id: "tortilly", title: "Tortilly" };
  if (id.startsWith("palacinka-")) return { id: "palacinky", title: "Palačinky" };
  if (id.startsWith("croissant-")) return { id: "croissanty", title: "Croissanty" };
  if (id.startsWith("chleb-")) return { id: "chleby-oblozene", title: "Obložené chleby" };
  if (id.startsWith("sendvic-")) return { id: "sendvice", title: "Sendviče" };
  if (id.startsWith("houska-") || id.startsWith("cerealni-houska-")) return { id: "housky", title: "Housky" };
  if (id.startsWith("pomazanka-")) return { id: "pomazanky", title: "Pomazánky" };
  if (id.startsWith("salat-")) return { id: "salaty", title: "Saláty" };
  if (id.startsWith("miska-")) return { id: "oblozene-misy", title: "Obložené mísy" };
  return { id, title: product.name };
}

const groupedProducts = products.reduce<ProductGroup[]>((groups, product) => {
  const info = groupInfo(product);
  const group = groups.find((candidate) => candidate.id === info.id);
  if (group) group.products.push(product);
  else groups.push({ ...info, products: [product] });
  return groups;
}, []);

const categoryNames: Record<string, string> = {
  bagety: "Bagety a svačiny",
  chlebicky: "Chlebíčky",
  obkladane: "Obložené pečivo",
  pomazanky: "Pomazánky",
  salaty: "Saláty",
  smazene: "Smažené speciality",
};
const productImageUrl = (id: string) => `${import.meta.env.BASE_URL}products/${id}.webp`;
const categories = ["Vše", ...Array.from(new Set(products.map((product) => product.category)))];
const categoryCards = categories
  .filter((category) => category !== "Vše")
  .map((category) => ({ category, products: products.filter((product) => product.category === category) }))
  .filter((card) => card.products.length > 0);
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("cs");
const formatPrice = (price: number) => new Intl.NumberFormat("cs-CZ").format(price);
const minimumLeadTime = 48 * 60 * 60 * 1000;
const getPickupTimes = (date: Date, earliest = Date.now() + minimumLeadTime) => {
  const weekday = date.getDay();
  const minutes = weekday === 6 ? [9 * 60] : weekday === 0 ? [] : Array.from({ length: 21 }, (_, index) => 6 * 60 + 30 + index * 30);
  return minutes.flatMap((minuteOfDay) => {
    const pickup = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minuteOfDay / 60), minuteOfDay % 60);
    return pickup.getTime() >= earliest ? [format(pickup, "HH:mm")] : [];
  });
};
const getFirstPickupDateTime = () => {
  const earliest = Date.now() + minimumLeadTime;
  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(earliest);
    date.setDate(date.getDate() + offset);
    const firstTime = getPickupTimes(date, earliest)[0];
    if (firstTime) return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(firstTime.slice(0, 2)), Number(firstTime.slice(3)));
  }
  return new Date(earliest);
};

type CartItem = Product & { quantity: number; preparation?: "namazany" | "se-salatem" };

const pickupLocations = [
  { id: "nove-lazne", label: "U Nových lázní", address: "U Nových lázní 1593/16, 415 01 Teplice" },
  { id: "masarykova", label: "Masarykova třída", address: "Masarykova třída 429/26, 415 01 Teplice" },
] as const;
const isChlebicek = (product: Product) => product.category === "chlebicky" && product.id.includes("chlebicek");
const cartItemKey = (item: Pick<CartItem, "id" | "preparation">) => `${item.id}:${item.preparation ?? ""}`;

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Jméno musí mít alespoň 2 znaky").max(120, "Jméno je příliš dlouhé"),
  customerPhone: z.string().trim().min(9, "Neplatné telefonní číslo").max(40, "Telefonní číslo je příliš dlouhé"),
  customerEmail: z.string().trim().email("Zadejte platnou e-mailovou adresu").max(254, "E-mailová adresa je příliš dlouhá"),
  requestedDate: z.string().min(1, "Vyberte datum převzetí nebo doručení"),
  requestedTime: z.string().min(1, "Vyberte čas vyzvednutí"),
  paymentMethod: z.enum(["bank_transfer", "store"], { error: "Vyberte způsob platby" }),
  storePaymentMethod: z.enum(["card"]).optional(),
  fulfillmentMethod: z.enum(["pickup", "delivery"], { error: "Vyberte vyzvednutí nebo dovoz." }),
  pickupStore: z.string().optional(),
  deliveryAddress: z.string().trim().max(250, "Adresa může mít nejvýše 250 znaků").optional(),
  deliveryDistance: z.enum(["within_10km", "over_10km"]).optional(),
  note: z.string().max(1000, "Poznámka může mít nejvýše 1000 znaků").optional(),
}).superRefine((values, context) => {
  const date = new Date(`${values.requestedDate}T12:00:00`);
  const allowedTimes = Number.isFinite(date.getTime()) ? getPickupTimes(date) : [];
  if (!allowedTimes.includes(values.requestedTime)) {
    context.addIssue({ code: "custom", path: ["requestedTime"], message: "Vyberte čas během otevírací doby, nejdříve 48 hodin předem." });
  }
  if (values.paymentMethod === "store" && !values.storePaymentMethod) {
    context.addIssue({ code: "custom", path: ["storePaymentMethod"], message: "Vyberte platbu kartou." });
  }
  if (!pickupLocations.some((location) => location.id === values.pickupStore)) {
    context.addIssue({ code: "custom", path: ["pickupStore"], message: "Vyberte prodejnu pro vyzvednutí." });
  }
  if (values.fulfillmentMethod === "delivery" && !values.deliveryAddress?.trim()) {
    context.addIssue({ code: "custom", path: ["deliveryAddress"], message: "Zadejte adresu doručení." });
  }
  if (values.fulfillmentMethod === "delivery" && values.paymentMethod === "store") {
    context.addIssue({ code: "custom", path: ["paymentMethod"], message: "Dovoz lze zatím zaplatit pouze bankovním převodem." });
  }
  if (values.fulfillmentMethod === "delivery" && !values.deliveryDistance) {
    context.addIssue({ code: "custom", path: ["deliveryDistance"], message: "Vyberte cenové pásmo dopravy." });
  }
});
type CheckoutForm = z.infer<typeof checkoutSchema>;

type CartView = "items" | "checkout" | "success";

export default function Eshop() {
  const { toast } = useToast();
  const requestedCategory = new URLSearchParams(window.location.search).get("category");
  const [activeCategory, setActiveCategory] = useState(() => {
    return requestedCategory && categories.includes(requestedCategory) ? requestedCategory : "Vše";
  });
  const [showCategoryMenu, setShowCategoryMenu] = useState(() =>
    !(requestedCategory && categories.includes(requestedCategory) && requestedCategory !== "Vše")
  );
  const [pickupCalendarOpen, setPickupCalendarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [chlebicekPreparations, setChlebicekPreparations] = useState<Record<string, "namazany" | "se-salatem">>({});
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartView, setCartView] = useState<CartView>("items");
  const [isSending, setIsSending] = useState(false);
  const [confirmedOrderAt, setConfirmedOrderAt] = useState<string | null>(null);
  const [confirmedOrderReference, setConfirmedOrderReference] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<{ product: Product; quantity: number; token: number } | null>(null);
  const [addToken, setAddToken] = useState(0);
  const [categoryImageStep, setCategoryImageStep] = useState(0);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (!showCategoryMenu || reduceMotion || !categoryCards.some((card) => card.products.length > 1)) return;
    let cancelled = false;
    let timeout: number | undefined;
    const nextStep = categoryImageStep + 1;
    const nextImages = categoryCards.map((card, index) => card.products[(nextStep + index) % card.products.length]);
    Promise.all(nextImages.map((product) => new Promise<void>((resolve) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => resolve();
      image.src = productImageUrl(product.id);
      if (image.complete) resolve();
    }))).then(() => {
      if (!cancelled) timeout = window.setTimeout(() => setCategoryImageStep(nextStep), 6500);
    });
    return () => {
      cancelled = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [categoryImageStep, reduceMotion, showCategoryMenu]);

  useEffect(() => {
    if (!lastAdded) return;
    const timeout = window.setTimeout(() => setLastAdded(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [lastAdded]);

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { customerName: "", customerPhone: "", customerEmail: "", requestedDate: "", requestedTime: "", paymentMethod: undefined, storePaymentMethod: undefined, fulfillmentMethod: "pickup", pickupStore: "", deliveryAddress: "", deliveryDistance: undefined, note: "" },
  });

  const filtered = useMemo(() => {
    const query = normalize(search.trim());
    if (query) return products
      .filter((product) => (activeCategory === "Vše" || product.category === activeCategory) && normalize(`${product.name} ${product.category} ${product.unit}`).includes(query))
      .map((product) => ({ id: product.id, title: product.name, products: [product] }));
    return groupedProducts.filter((group) => activeCategory === "Vše" || group.products.some((product) => product.category === activeCategory));
  }, [activeCategory, search]);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const fulfillmentMethod = form.watch("fulfillmentMethod");
  const deliveryDistance = form.watch("deliveryDistance");
  const deliveryFee = fulfillmentMethod === "delivery" ? (deliveryDistance === "within_10km" ? 150 : deliveryDistance === "over_10km" ? 200 : 0) : 0;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const requestedDate = form.watch("requestedDate");
  const requestedDateObject = requestedDate ? new Date(`${requestedDate}T12:00:00`) : undefined;
  const availablePickupTimes = requestedDateObject ? getPickupTimes(requestedDateObject) : [];
  const firstPickupDateTime = getFirstPickupDateTime();

  function addToCart(product: Product, quantity: number, preparation?: "namazany" | "se-salatem") {
    const identity = cartItemKey({ id: product.id, preparation });
    setCart((prev) => {
      const existing = prev.find((item) => cartItemKey(item) === identity);
      const nextQuantity = Math.min(99, (existing?.quantity ?? 0) + quantity);
      if (existing) return prev.map((item) => cartItemKey(item) === identity ? { ...item, quantity: nextQuantity } : item);
      return [...prev, { ...product, preparation, quantity: Math.min(99, quantity) }];
    });
    setCartView("items");
    setCartOpen(true);
    setAddToken((token) => token + 1);
    setLastAdded({ product, quantity, token: addToken + 1 });
    setOrderQuantities((current) => ({ ...current, [identity]: 1 }));
  }

  function changeOrderQuantity(id: string, delta: number) {
    setOrderQuantities((current) => ({ ...current, [id]: Math.min(99, Math.max(1, (current[id] ?? 1) + delta)) }));
  }

  function changeQty(identity: string, delta: number) {
    setCart((prev) =>
      prev.map((item) => cartItemKey(item) === identity ? { ...item, quantity: Math.min(99, item.quantity + delta) } : item).filter((item) => item.quantity > 0)
    );
  }

  function openCart() {
    setCartView("items");
    setCartOpen(true);
  }

  function closeCart() {
    setCartOpen(false);
    setTimeout(() => setCartView("items"), 300);
  }

  // Úspěch zobrazíme až po ověření Checkout Session na serveru, ne podle URL samotné.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");

    if (sessionId) {
      fetch(`${import.meta.env.BASE_URL}api/checkout-session/${encodeURIComponent(sessionId)}`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Stav platby se nepodařilo ověřit.");
          return res.json() as Promise<{ paymentStatus: string; requestedAt: string | null }>;
        })
        .then((data) => {
          if (data.paymentStatus === "paid") {
            setCart([]);
            setConfirmedOrderAt(data.requestedAt);
            setCartView("success");
            setCartOpen(true);
          } else {
            toast({ title: "Platba zatím není potvrzená", description: "Zkontrolujte prosím její stav později." });
          }
        })
        .catch(() => toast({ title: "Platbu se nepodařilo ověřit", description: "Pokud jste zaplatili, ozvěte se nám prosím telefonicky." }));
    } else if (payment === "cancelled") {
      toast({
        title: "Platba zrušena",
        description: "Objednávka nebyla dokončena, košík zůstal zachovaný.",
      });
    }

    if (payment || sessionId) {
      params.delete("payment");
      params.delete("session_id");
      const newSearch = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (newSearch ? `?${newSearch}` : "")
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmitOrder(values: CheckoutForm) {
    setIsSending(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/create-order-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: values.customerName,
          customerPhone: values.customerPhone,
          customerEmail: values.customerEmail,
          requestedAt: new Date(`${values.requestedDate}T${values.requestedTime}:00`).toISOString(),
          paymentMethod: values.paymentMethod,
          storePaymentMethod: values.storePaymentMethod,
          fulfillmentMethod: values.fulfillmentMethod,
          pickupStore: values.pickupStore,
          deliveryAddress: values.fulfillmentMethod === "delivery" ? values.deliveryAddress : undefined,
          deliveryDistance: values.fulfillmentMethod === "delivery" ? values.deliveryDistance : undefined,
          note: values.note,
          items: cart.map((i) => ({ id: i.id, quantity: i.quantity, ...(i.preparation ? { preparation: i.preparation } : {}) })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Chyba serveru");
      }

      const data = (await res.json()) as { orderCode: string; variableSymbol: string };
      setConfirmedOrderReference(data.variableSymbol);
      setCart([]);
      setConfirmedOrderAt(new Date(`${values.requestedDate}T${values.requestedTime}:00`).toISOString());
      setCartView("success");
    } catch (err) {
      toast({
        title: "Chyba odeslání",
        description: err instanceof Error ? err.message : "Nepodařilo se odeslat objednávku.",
        variant: "destructive",
      });
      setIsSending(false);
    }
  }

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 text-foreground backdrop-blur">
        <div className="container mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
          <Link href="/" data-testid="link-back-home">
            <button className="flex items-center gap-2 font-semibold text-primary transition-colors hover:text-primary/75">
              <ArrowLeft size={18} />
              <span className="font-serif text-lg">Prima Lahůdky</span>
            </button>
          </Link>

          <h1 className="hidden text-lg font-semibold tracking-wide text-foreground/70 sm:block">E-shop</h1>

          <button
            data-testid="button-open-cart"
            onClick={openCart}
            className="relative flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <ShoppingCart size={16} />
            <span>Košík</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* E-shop introduction */}
      <section className="overflow-hidden border-b border-border bg-[#edf2e8] px-6 py-8 text-foreground md:py-10">
        <div className="container mx-auto max-w-6xl text-center">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">
            Čerstvé lahůdky z Teplic
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
            className="mb-3 font-serif text-3xl font-bold text-foreground md:text-4xl">
            Objednejte si lahůdky online
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.2 } }}
            className="mx-auto max-w-xl text-foreground/70">
            Vyberte si z naší nabídky a odešlete poptávku. Potvrdíme dostupnost a domluvíme se na vyzvednutí nebo dovozu.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.3 } }}
            className="mt-4 inline-flex items-center gap-2 text-sm text-foreground/70">
            <Phone size={14} className="text-primary" />
            <span>Dotazy: <a href="tel:+420724708277" className="font-semibold text-primary hover:underline">+420 724 708 277</a></span>
          </motion.div>
          <p className="mx-auto mt-5 max-w-2xl rounded-lg border border-primary/15 bg-white/70 px-4 py-3 text-sm font-semibold text-foreground">
            Objednávku prosíme zadat nejméně 48 hodin před zvoleným termínem. Každou připravujeme čerstvě.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-xs text-foreground/55">
            Fotografie jsou ilustrační. Skutečný vzhled produktu se může mírně lišit.
          </p>
        </div>
      </section>

      {showCategoryMenu ? (
        <main className="container mx-auto px-6 py-8 md:px-12 md:py-10">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Naše nabídka</p>
              <h2 className="font-serif text-2xl font-bold text-foreground md:text-3xl">Vyberte si kategorii</h2>
              <p className="mt-2 text-sm text-foreground/65">Prohlédněte si čerstvé lahůdky podle toho, na co máte chuť.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveCategory("Vše");
                setShowCategoryMenu(false);
                window.history.replaceState({}, "", window.location.pathname);
              }}
              className="self-start rounded-full border border-primary/25 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5 sm:self-auto"
            >
              Zobrazit všechny produkty <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categoryCards.map(({ category, products: categoryProducts }, categoryIndex) => {
              const representative = categoryProducts[(categoryImageStep + categoryIndex) % categoryProducts.length];
              const count = groupedProducts.filter((group) => group.products.some((product) => product.category === category)).length;
              return (
                <button
                  key={category}
                  type="button"
                  data-testid={`button-category-menu-${category}`}
                  onClick={() => {
                    setActiveCategory(category);
                    setSearch("");
                    setShowCategoryMenu(false);
                    window.history.replaceState({}, "", `${window.location.pathname}?category=${encodeURIComponent(category)}`);
                  }}
                  className="group overflow-hidden rounded-xl border border-border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-white">
                    <AnimatePresence initial={false} mode="sync">
                      <motion.img
                        key={representative.id}
                        src={productImageUrl(representative.id)}
                        alt=""
                        loading={categoryImageStep === 0 ? "eager" : "lazy"}
                        decoding="async"
                        initial={reduceMotion ? false : { opacity: 0, scale: 1.06, filter: "blur(5px)", clipPath: "inset(10% 8% 12% 8% round 18%)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)", clipPath: "inset(0% 0% 0% 0% round 0%)" }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, filter: "blur(4px)" }}
                        transition={{ duration: reduceMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </AnimatePresence>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold leading-snug text-foreground">{categoryNames[category] ?? category}</h3>
                    <p className="mt-1 text-xs text-foreground/55">{count} {count === 1 ? "položka" : "položek"}<span className="float-right text-primary" aria-hidden="true">→</span></p>
                  </div>
                </button>
              );
            })}
          </div>
        </main>
      ) : (
        <>
      {/* Category filter */}
      <div className="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-6 md:px-12 py-3 flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              data-testid={`button-category-${cat}`}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === cat ? "bg-primary text-white" : "bg-muted text-foreground/70 hover:bg-muted/70"
              }`}
            >
              {cat === "Vše" ? "Vše" : categoryNames[cat] ?? cat}
              <span className={`ml-2 text-xs ${activeCategory === cat ? "text-white/70" : "text-foreground/40"}`}>
                {cat === "Vše" ? groupedProducts.length : groupedProducts.filter((group) => group.products.some((product) => product.category === cat)).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search and compact product list */}
      <main className="container mx-auto px-6 md:px-12 py-8 md:py-10">
        <button
          type="button"
          onClick={() => {
            setShowCategoryMenu(true);
            setActiveCategory("Vše");
            window.history.replaceState({}, "", window.location.pathname);
          }}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft size={16} /> Zpět na kategorie
        </button>
        <div className="max-w-xl mb-5">
          <label htmlFor="product-search" className="sr-only">Hledat produkt</label>
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              id="product-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Hledat v nabídce… třeba salát nebo bagetu"
              className="w-full rounded-lg border border-input bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>
        <p className="mb-4 text-sm text-foreground/50" aria-live="polite">
          {search || activeCategory !== "Vše" ? `Nalezeno ${filtered.length} položek` : `${groupedProducts.length} položek v nabídce`}
          {activeCategory !== "Vše" ? ` · ${categoryNames[activeCategory] ?? activeCategory}` : ""}
        </p>
        <motion.div
          key={`${activeCategory}-${search}`}
          initial="hidden" animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.015 } }, hidden: {} }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {filtered.map((group) => {
            const selectedProduct = group.products.find((product) => product.id === selectedVariants[group.id]) ?? group.products[0];
            const preparation = isChlebicek(selectedProduct) ? (chlebicekPreparations[selectedProduct.id] ?? "namazany") : undefined;
            const itemIdentity = cartItemKey({ id: selectedProduct.id, preparation });
            const selectedQuantity = cart.filter((item) => item.id === selectedProduct.id).reduce((total, item) => total + item.quantity, 0);
            const orderQuantity = orderQuantities[itemIdentity] ?? 1;
            return (
            <motion.div
              key={group.id}
              variants={fadeInUp}
              data-testid={`card-product-${group.id}`}
              className="overflow-hidden rounded-xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-square overflow-hidden bg-white">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.img
                    key={selectedProduct.id}
                    src={productImageUrl(selectedProduct.id)}
                    alt={`${selectedProduct.name} – ilustrační fotografie`}
                    loading="lazy"
                    initial={{ opacity: 0, scale: 1.035, filter: "blur(4px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.985 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </AnimatePresence>
              </div>
              <div className="p-3 sm:p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">{categoryNames[activeCategory === "Vše" ? selectedProduct.category : activeCategory] ?? selectedProduct.category}</p>
                <h3 className="min-h-10 text-sm font-semibold leading-snug text-foreground sm:text-base">{group.title}</h3>
                <div className="mt-2 min-h-[60px]">
                  {group.products.length > 1 ? (
                    <label className="block text-xs font-medium text-foreground/65">
                      Varianta
                      <select
                        value={selectedProduct.id}
                        onChange={(event) => setSelectedVariants((current) => ({ ...current, [group.id]: event.target.value }))}
                        aria-label={`Varianta: ${group.title}`}
                        className="mt-1 w-full rounded-md border border-input bg-white px-2 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                      >
                        {group.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatPrice(product.price)} Kč / {product.unit}</option>)}
                      </select>
                    </label>
                  ) : (
                    <div className="text-xs font-medium text-foreground/65">
                      <span>Varianta</span>
                      <div className="mt-1 flex min-h-[38px] items-center justify-between rounded-md border border-border bg-muted/30 px-3 text-sm text-foreground/60">
                        <span>Jediná varianta</span>
                        <CheckCircle2 size={15} className="text-primary/60" aria-hidden="true" />
                      </div>
                    </div>
                  )}
                </div>
                {preparation && <fieldset className="mt-2">
                  <legend className="text-xs font-medium text-foreground/65">Provedení chlebíčku</legend>
                  <div className="mt-1 grid grid-cols-2 gap-1.5 text-xs">
                    <label className="flex items-center gap-1.5 rounded-md border border-border px-2 py-2"><input type="radio" name={`prep-${selectedProduct.id}`} checked={preparation === "namazany"} onChange={() => setChlebicekPreparations((current) => ({ ...current, [selectedProduct.id]: "namazany" }))} /> Namazaný</label>
                    <label className="flex items-center gap-1.5 rounded-md border border-border px-2 py-2"><input type="radio" name={`prep-${selectedProduct.id}`} checked={preparation === "se-salatem"} onChange={() => setChlebicekPreparations((current) => ({ ...current, [selectedProduct.id]: "se-salatem" }))} /> Se salátem</label>
                  </div>
                </fieldset>}
                <p className="mt-2 text-sm font-bold text-primary">{formatPrice(selectedProduct.price)} Kč <span className="font-normal text-foreground/50">/ {selectedProduct.unit}</span></p>
                <p className="mt-1 text-xs font-medium text-foreground/60">Za {orderQuantity}×: {formatPrice(selectedProduct.price * orderQuantity)} Kč</p>
                {selectedQuantity > 0 && <p className="mt-2 text-xs text-foreground/55">V košíku: {selectedQuantity}×</p>}
                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground/55">Množství</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => changeOrderQuantity(itemIdentity, -1)} disabled={orderQuantity <= 1} aria-label={`Odebrat kus z množství ${selectedProduct.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground/70 hover:border-primary hover:text-primary disabled:opacity-30"><Minus size={15} /></button>
                      <span aria-live="polite" className="min-w-5 text-center text-sm font-semibold">{orderQuantity}</span>
                      <button type="button" onClick={() => changeOrderQuantity(itemIdentity, 1)} disabled={orderQuantity >= 99} aria-label={`Přidat kus do množství ${selectedProduct.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground/70 hover:border-primary hover:text-primary disabled:opacity-30"><Plus size={15} /></button>
                    </div>
                  </div>
                  <Button type="button" data-testid={`button-add-to-cart-${selectedProduct.id}`} onClick={() => addToCart(selectedProduct, orderQuantity, preparation)} className="h-9 w-full gap-2 rounded-full bg-primary text-white hover:bg-primary/90">
                    <ShoppingCart size={15} /> Přidat do košíku
                  </Button>
                </div>
              </div>
            </motion.div>
            );
          })}
        </motion.div>
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-foreground/55">
            Nic jsme nenašli. Zkus upravit hledaný výraz nebo vybrat jinou kategorii.
          </div>
        )}

        {/* Note */}
        <motion.div
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="mx-auto mt-16 max-w-2xl rounded-xl bg-primary p-8 text-center text-white"
        >
          <h3 className="mb-2 font-serif text-xl font-bold text-white">Potřebujete větší objednávku?</h3>
          <p className="mb-5 text-white/80">
            Pro catering, rauty nebo zakázkovou výrobu nás kontaktujte přímo — připravíme vám nabídku na míru.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="tel:+420724708277">
              <Button className="rounded-full bg-primary text-white gap-2 px-6">
                <Phone size={15} />
                Zavolat
              </Button>
            </a>
            <Link href="/#kontakt">
              <Button variant="outline" className="gap-2 rounded-full border-white text-white px-6 hover:bg-white hover:text-primary">
                Napsat poptávku
                <ChevronRight size={15} />
              </Button>
            </Link>
          </div>
        </motion.div>

      </main>
        </>
      )}

      {/* Cart sidebar */}
      <AnimatePresence>
        {cartOpen && (
          <div className="fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 bg-black/40 backdrop-blur-sm"
              onClick={closeCart}
            />
            <motion.aside
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="w-full max-w-md bg-background shadow-2xl flex flex-col"
            >
              {/* Cart: items view */}
              {cartView === "items" && (
                <>
                  <div className="flex items-center justify-between px-6 py-5 border-b border-border/40">
                    <h2 className="font-serif text-xl font-bold text-primary flex items-center gap-2">
                      <ShoppingCart size={20} />
                      Košík
                    </h2>
                    <button data-testid="button-close-cart" onClick={closeCart}
                      className="text-foreground/50 hover:text-foreground transition-colors">
                      <X size={22} />
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {lastAdded && (
                      <motion.div key={lastAdded.token} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                        className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                        <CheckCircle2 size={16} /> Přidáno {lastAdded.quantity}×: {lastAdded.product.name}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    {cart.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-foreground/40 py-16">
                        <ShoppingBag size={40} strokeWidth={1.5} />
                        <p className="font-medium">Košík je prázdný</p>
                        <p className="text-sm">Přidejte si produkty z nabídky</p>
                      </div>
                    ) : (
                      <motion.ul layout className="flex flex-col gap-4">
                        <AnimatePresence initial={false}>
                        {cart.map((item) => (
                          <motion.li key={cartItemKey(item)} layout initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            transition={{ type: "spring", stiffness: 420, damping: 30 }} data-testid={`cart-item-${cartItemKey(item)}`}
                            className={`flex gap-4 items-center rounded-xl p-3 transition-colors duration-300 ${lastAdded?.product.id === item.id ? "bg-primary/10 ring-1 ring-primary/25" : "bg-muted/40"}`}>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm leading-snug truncate">{item.name}{item.preparation ? ` · ${item.preparation === "namazany" ? "namazaný" : "se salátem"}` : ""}</p>
                              <p className="text-xs text-foreground/50 mt-0.5">{formatPrice(item.price)} Kč / {item.unit}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <button data-testid={`button-decrease-${cartItemKey(item)}`} onClick={() => changeQty(cartItemKey(item), -1)}
                                  className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                                  <Minus size={12} />
                                </button>
                                <motion.span key={item.quantity} initial={{ scale: 0.65, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="text-sm font-bold w-4 text-center">{item.quantity}</motion.span>
                                <button data-testid={`button-increase-${cartItemKey(item)}`} onClick={() => changeQty(cartItemKey(item), 1)}
                                  className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                            <p className="font-bold text-primary text-sm flex-shrink-0">
                              {formatPrice(item.price * item.quantity)} Kč
                            </p>
                          </motion.li>
                        ))}
                        </AnimatePresence>
                      </motion.ul>
                    )}
                  </div>

                  {cart.length > 0 && (
                    <div className="px-6 py-5 border-t border-border/40 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-foreground/60">Celkem</span>
                        <span className="text-2xl font-bold text-primary">{formatPrice(cartTotal)} Kč</span>
                      </div>
                      <Button
                        data-testid="button-proceed-checkout"
                        onClick={() => setCartView("checkout")}
                        className="w-full rounded-full bg-primary text-white hover:bg-primary/90 py-6 text-base font-semibold gap-2"
                      >
                        Pokračovat k objednávce
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* Cart: checkout form */}
              {cartView === "checkout" && (
                <>
                  <div className="flex items-center gap-3 px-6 py-5 border-b border-border/40">
                    <button onClick={() => setCartView("items")}
                      className="text-foreground/50 hover:text-foreground transition-colors">
                      <ArrowLeft size={20} />
                    </button>
                    <h2 className="font-serif text-xl font-bold text-primary">Vaše údaje</h2>
                    <button data-testid="button-close-cart-checkout" onClick={closeCart}
                      className="ml-auto text-foreground/50 hover:text-foreground transition-colors">
                      <X size={22} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    {/* Order summary */}
                    <div className="bg-muted/40 rounded-xl p-4 mb-6">
                      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-widest mb-3">Souhrn objednávky</p>
                      {cart.map((item) => (
                        <div key={cartItemKey(item)} className="flex justify-between text-sm py-1">
                          <span className="text-foreground/70">{item.name}{item.preparation ? ` · ${item.preparation === "namazany" ? "namazaný" : "se salátem"}` : ""} ×{item.quantity}</span>
                          <span className="font-semibold">{formatPrice(item.price * item.quantity)} Kč</span>
                        </div>
                      ))}
                      {deliveryFee > 0 && <div className="mt-3 flex justify-between border-t border-border/40 pt-3 text-sm"><span>Doprava</span><span>{formatPrice(deliveryFee)} Kč</span></div>}
                      <div className="flex justify-between font-bold text-primary mt-2">
                        <span>Celkem</span>
                        <span>{formatPrice(cartTotal + deliveryFee)} Kč</span>
                      </div>
                    </div>

                    <p className="mb-5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium leading-relaxed text-foreground">
                      Vyberte požadovaný termín převzetí nebo doručení. Nejdříve je možné zvolit čas za 48 hodin od vytvoření objednávky; termín vám následně potvrdíme.
                    </p>

                    {/* Form */}
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmitOrder)} className="space-y-4">
                        <FormField control={form.control} name="customerName" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-foreground/70">
                              <User size={14} /> Jméno a příjmení
                            </FormLabel>
                            <FormControl>
                              <Input data-testid="input-customer-name" placeholder="Jan Novák" {...field}
                                className="rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="customerPhone" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-foreground/70">
                              <Phone size={14} /> Telefonní číslo
                            </FormLabel>
                            <FormControl>
                              <Input data-testid="input-customer-phone" placeholder="+420 123 456 789"
                                type="tel" {...field} className="rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="customerEmail" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-foreground/70"><Mail size={14} /> E-mail pro potvrzení objednávky</FormLabel>
                            <FormControl><Input data-testid="input-customer-email" placeholder="vas@email.cz" type="email" autoComplete="email" {...field} className="rounded-xl" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="fulfillmentMethod" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-foreground/70"><Truck size={14} /> Způsob převzetí</FormLabel>
                            <FormControl><div className="grid grid-cols-2 gap-2">
                              <label className={`rounded-xl border px-3 py-3 text-sm ${field.value === "pickup" ? "border-primary bg-primary/5" : "border-border bg-white"}`}><input type="radio" name={field.name} checked={field.value === "pickup"} onChange={() => field.onChange("pickup")} /> <span className="ml-1 font-semibold">Vyzvednutí</span><span className="mt-1 block pl-5 text-xs text-foreground/60">Na jedné z prodejen</span></label>
                              <label className={`rounded-xl border px-3 py-3 text-sm ${field.value === "delivery" ? "border-primary bg-primary/5" : "border-border bg-white"}`}><input type="radio" name={field.name} checked={field.value === "delivery"} onChange={() => { field.onChange("delivery"); if (form.getValues("paymentMethod") === "store") form.setValue("paymentMethod", "bank_transfer"); form.setValue("storePaymentMethod", undefined); }} /> <span className="ml-1 font-semibold">Dovoz</span><span className="mt-1 block pl-5 text-xs text-foreground/60">150 Kč / 200 Kč podle vzdálenosti</span></label>
                            </div></FormControl><FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="pickupStore" render={({ field }) => (
                          <FormItem><FormLabel className="flex items-center gap-1.5 text-foreground/70"><MapPin size={14} /> {fulfillmentMethod === "pickup" ? "Prodejna pro vyzvednutí" : "Výchozí prodejna pro dovoz"}</FormLabel>
                            <FormControl><select {...field} className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm"><option value="">Vyberte prodejnu</option>{pickupLocations.map((location) => <option key={location.id} value={location.id}>{location.label} — {location.address}</option>)}</select></FormControl>
                            {fulfillmentMethod === "delivery" && <p className="text-xs text-foreground/55">Od této prodejny se počítá zvolené pásmo vzdálenosti.</p>}<FormMessage />
                          </FormItem>
                        )} />
                        {fulfillmentMethod === "delivery" && <>
                          <FormField control={form.control} name="deliveryAddress" render={({ field }) => (
                            <FormItem><FormLabel className="flex items-center gap-1.5 text-foreground/70"><MapPin size={14} /> Adresa doručení</FormLabel><FormControl><Input placeholder="Ulice, číslo popisné, město, PSČ" autoComplete="street-address" {...field} className="rounded-xl" /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="deliveryDistance" render={({ field }) => (
                            <FormItem><FormLabel>Cena dopravy podle vzdálenosti</FormLabel><FormControl><div className="space-y-2">
                              <label className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-sm"><span><input type="radio" name={field.name} checked={field.value === "within_10km"} onChange={() => field.onChange("within_10km")} /> <span className="ml-2">Do 10 km od prodejny</span></span><strong>150 Kč</strong></label>
                              <label className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-sm"><span><input type="radio" name={field.name} checked={field.value === "over_10km"} onChange={() => field.onChange("over_10km")} /> <span className="ml-2">Nad 10 km od prodejny</span></span><strong>200 Kč</strong></label>
                            </div></FormControl><p className="text-xs text-foreground/55">Vyberte pásmo podle vzdálenosti. Pásmo a cenu doručení v objednávce ještě potvrdíme.</p><FormMessage /></FormItem>
                          )} />
                        </>}
                        <FormField control={form.control} name="requestedDate" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-foreground/70">
                              <Clock size={14} /> Datum převzetí / doručení
                            </FormLabel>
                            <Popover open={pickupCalendarOpen} onOpenChange={setPickupCalendarOpen}>
                              <FormControl>
                                <PopoverTrigger asChild>
                                  <Button data-testid="input-requested-date" type="button" name={field.name} onBlur={field.onBlur} ref={field.ref} variant="outline" className="w-full justify-start rounded-xl bg-white text-left font-normal">
                                    {requestedDateObject ? format(requestedDateObject, "d. MMMM yyyy", { locale: cs }) : "Vyberte datum"}
                                  </Button>
                                </PopoverTrigger>
                              </FormControl>
                              <PopoverContent align="start" className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    locale={cs}
                                    selected={requestedDateObject}
                                    disabled={(date) => date < startOfDay(new Date()) || getPickupTimes(date).length === 0}
                                    onSelect={(date) => {
                                      if (!date) return;
                                      field.onChange(format(date, "yyyy-MM-dd"));
                                      form.setValue("requestedTime", "");
                                      form.clearErrors("requestedTime");
                                      setPickupCalendarOpen(false);
                                    }}
                                  />
                              </PopoverContent>
                            </Popover>
                            <p className="text-xs text-foreground/50">Nejdřívější možný termín: {format(firstPickupDateTime, "d. MMMM yyyy 'v' HH:mm", { locale: cs })}. V neděli je zavřeno.</p>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="requestedTime" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-foreground/70">
                              <Clock size={14} /> Čas převzetí / doručení
                            </FormLabel>
                            <FormControl>
                              <select
                                data-testid="input-requested-time"
                                {...field}
                                disabled={!requestedDateObject || availablePickupTimes.length === 0}
                                className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted/50"
                              >
                                <option value="">{requestedDateObject ? "Vyberte čas" : "Nejprve vyberte datum"}</option>
                                {availablePickupTimes.map((time) => <option key={time} value={time}>{time}</option>)}
                              </select>
                            </FormControl>
                        <p className="text-xs text-foreground/50">Po–Pá 6:30–17:00, sobota 9:00–9:30.</p>
                            <FormMessage />
                          </FormItem>
                        )} />

                    <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5 text-foreground/70"><ShoppingBag size={14} /> Způsob platby</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <div aria-disabled="true" className="rounded-xl border border-border bg-muted/40 px-4 py-3 opacity-55">
                              <div className="flex items-center justify-between text-sm font-semibold"><span>Platební karta online</span><span className="text-xs font-medium">Brzy dostupné</span></div>
                              <p className="mt-1 text-xs text-foreground/60">Online platby kartou připravujeme.</p>
                            </div>
                            <label className={`block cursor-pointer rounded-xl border px-4 py-3 text-sm transition ${field.value === "bank_transfer" ? "border-primary bg-primary/5" : "border-border bg-white"}`}>
                              <span className="flex items-center gap-2 font-semibold"><input type="radio" name={field.name} value="bank_transfer" checked={field.value === "bank_transfer"} onChange={() => { field.onChange("bank_transfer"); form.setValue("storePaymentMethod", undefined); }} /> Bankovní převod</span>
                              <span className="mt-1 block pl-6 text-xs text-foreground/60">Po odeslání objednávky vám e-mailem pošleme účet, přesnou částku, variabilní symbol a QR kód. Přijetí platby potvrdíme po její kontrole.</span>
                            </label>
                            {fulfillmentMethod === "pickup" && <label className={`block cursor-pointer rounded-xl border px-4 py-3 text-sm transition ${field.value === "store" ? "border-primary bg-primary/5" : "border-border bg-white"}`}>
                              <span className="flex items-center gap-2 font-semibold"><input type="radio" name={field.name} value="store" checked={field.value === "store"} onChange={() => { field.onChange("store"); form.setValue("storePaymentMethod", "card"); }} /> Kartou při převzetí na prodejně</span>
                            </label>}
                          </div>
                        </FormControl><FormMessage />
                      </FormItem>
                    )} />

                        <FormField control={form.control} name="note" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-foreground/70">
                              <MessageSquare size={14} /> Poznámka (nepovinné)
                            </FormLabel>
                            <FormControl>
                              <Textarea data-testid="input-note"
                                placeholder="Speciální požadavky k objednávce..."
                                {...field} className="rounded-xl resize-none" rows={3} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <p className="text-xs text-foreground/50 leading-relaxed pt-1">
                          O přijetí objednávky vás budeme informovat. U bankovního převodu vám platební údaje pošleme e-mailem hned po odeslání objednávky.
                        </p>

                        <Button
                          data-testid="button-submit-order"
                          type="submit"
                          disabled={isSending}
                          className="w-full rounded-full bg-primary text-white hover:bg-primary/90 py-6 text-base font-semibold gap-2"
                        >
                          {isSending ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              Odesílám objednávku...
                            </>
                          ) : (
                            <>
                              Odeslat objednávku
                              <ChevronRight size={16} />
                            </>
                          )}
                        </Button>
                      </form>
                    </Form>
                  </div>
                </>
              )}

              {/* Cart: success */}
              {cartView === "success" && (
                <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16 gap-5">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 size={40} className="text-primary" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-primary">Objednávka odeslána</h2>
                  <p className="text-foreground/60 leading-relaxed">
                    {form.getValues("paymentMethod") === "bank_transfer"
                      ? "Děkujeme! Platební údaje a QR kód jsme poslali e-mailem. Objednávku a přijetí platby potvrdíme po kontrole převodu."
                      : "Děkujeme! Brzy vám potvrdíme objednávku a domluvíme podrobnosti vyzvednutí."}
                  </p>
                  {confirmedOrderAt && <p className="rounded-lg bg-muted/60 px-4 py-3 text-sm font-semibold text-foreground">Požadovaný termín: {new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", dateStyle: "full", timeStyle: "short" }).format(new Date(confirmedOrderAt))}</p>}
                  {confirmedOrderReference && form.getValues("paymentMethod") === "bank_transfer" && <p className="rounded-lg bg-primary/5 px-4 py-3 text-sm text-foreground">Pro spárování platby uveďte variabilní symbol <strong>{confirmedOrderReference}</strong>. Účet a QR kód jsme poslali na váš e-mail; po kontrole platby vám přijde potvrzení objednávky.</p>}
                  <Button onClick={closeCart} className="mt-4 rounded-full bg-primary text-white px-8">
                    Zavřít
                  </Button>
                </div>
              )}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
