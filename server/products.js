// Zdroj pravdy pro produkty a ceny - NAČÍTÁ SE ze sdíleného souboru ../shared/products.json,
// který používá i frontend (src/data/products.ts). Uprav ceny/produkty JEN v tom JSON souboru,
// tady se nic needituje.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const productsPath = join(__dirname, "..", "shared", "products.json");

export const products = JSON.parse(readFileSync(productsPath, "utf-8"));

export function getProductById(id) {
  return products.find((p) => p.id === id);
}
