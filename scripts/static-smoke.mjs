import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const fail = (message) => {
  throw new Error(message);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};

const html = read("index.html");
const app = read("assets/app.js");
const config = read("assets/config.js");
const edge = read("supabase/functions/customer-portal/index.ts");
const supabaseConfig = read("supabase/config.toml");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
assert(!duplicateIds.length, `Duplicate HTML ids: ${[...new Set(duplicateIds)].join(", ")}`);

const localScripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
  .map((match) => match[1].split("?")[0])
  .filter((src) => !/^https?:\/\//.test(src));
for (const script of localScripts) {
  assert(existsSync(resolve(root, script)), `Missing script referenced by index.html: ${script}`);
}

for (const obsolete of ["live.js", "authfix.js", "public-auth-guard.js"]) {
  assert(!html.includes(obsolete), `Obsolete script is still referenced: ${obsolete}`);
}

assert(html.includes('name="referrer" content="no-referrer"'), "Portal page must suppress referrer data");
assert(html.includes("@supabase/supabase-js@2.110.1"), "Supabase browser client must use the reviewed version");
assert(html.includes("lucide@1.24.0"), "Lucide icons must use the reviewed version");
assert(!html.includes("app-statusbar") && !html.includes("app-homebar"), "Prototype phone chrome must not ship");
assert(/billingMode:\s*"off"/.test(config), "Early-access billing must remain off");
assert(/waveCheckoutUrl:\s*""/.test(config), "Wave checkout URL must remain empty before launch");
assert(/\[functions\.customer-portal\][\s\S]*?verify_jwt\s*=\s*false/.test(supabaseConfig), "Customer portal token function must allow public invocation");
assert(/\[functions\.wave-webhook\][\s\S]*?verify_jwt\s*=\s*false/.test(supabaseConfig), "Wave webhook must allow provider callbacks");

const customerSafeStart = edge.indexOf("async function customerSafeJob");
const customerSafeEnd = edge.indexOf("serve(async", customerSafeStart);
const customerSafeBlock = edge.slice(customerSafeStart, customerSafeEnd);
for (const privateField of ["internal_notes", "custom_values", "customerEmail", "customerPhone"]) {
  assert(!customerSafeBlock.includes(privateField), `Customer response exposes private field: ${privateField}`);
}
assert(customerSafeBlock.includes("invoice_url"), "Customer response must include the invoice URL when configured");
assert(!app.includes("Loaded from workspace"), "Internal workspace status must not appear in the UI");
assert(!app.includes("copy-portal-link"), "Manual portal-link control must not be exposed");
assert(!app.includes("Wave subscription infrastructure"), "Internal billing implementation details must not appear in the UI");
assert(app.includes("portalMode.active ?"), "Customer mutation controls must be limited to secure portal mode");

console.log("Static smoke checks passed.");
