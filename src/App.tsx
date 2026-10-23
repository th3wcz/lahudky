import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";

const Eshop = lazy(() => import("@/pages/eshop"));
const Kontakt = lazy(() => import("@/pages/kontakt"));
const ConfirmOrder = lazy(() => import("@/pages/confirm-order"));

function Router() {
  return (
    <Suspense fallback={<div role="status" className="min-h-screen bg-background"><span className="sr-only">Načítání stránky…</span></div>}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/eshop" component={Eshop} />
        <Route path="/kontakt" component={Kontakt} />
        <Route path="/potvrdit-objednavku/:token" component={ConfirmOrder} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
    </MotionConfig>
  );
}

export default App;
