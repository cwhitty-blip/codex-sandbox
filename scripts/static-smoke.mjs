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
const emailEdge = read("supabase/functions/send-magic-link/index.ts");
const workspaceEdge = read("supabase/functions/workspace-settings/index.ts");
const brandingMigration = read("supabase/migrations/20260719090000_company_branding_and_job_notifications.sql");
const mileageMigration = read("supabase/migrations/20260719120000_mileage_tracking.sql");
const atomicJobMigration = read("supabase/migrations/20260719183000_atomic_job_save.sql");
const subscriptionMigration = read("supabase/migrations/20260802090000_subscription_access_and_trial.sql");
const schedulingMigration = read("supabase/migrations/20260802130000_scheduling_foundation.sql");
const waveEdge = read("supabase/functions/wave-webhook/index.ts");
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
assert(/const trialDays = 14;/.test(app), "Contractor trials must last 14 days");
assert(app.includes('rpc("get_my_company_entitlement")'), "The browser must load server-calculated subscription access");
assert(html.includes('id="workspaceAccessNotice"'), "Expired workspaces must show a read-only notice");
assert(app.includes("function requireWorkspaceWriteAccess"), "Browser mutations must have a read-only guard");
assert(subscriptionMigration.includes("now() + interval '14 days'"), "New company trials must last 14 days in the database");
assert(subscriptionMigration.includes("public.company_member_can_write"), "Database writes must enforce membership and subscription access");
assert(subscriptionMigration.includes("create or replace function public.apply_billing_promo_code"), "Promo codes must be validated server-side");
assert(edge.includes("companyCanWrite"), "Customer portal writes must enforce subscription access");
assert(emailEdge.includes("companyCanWrite"), "Customer email writes must enforce subscription access");
assert(workspaceEdge.includes("companyCanWrite"), "Workspace profile writes must enforce subscription access");
assert(waveEdge.includes('Deno.env.get("WAVE_BUSINESS_ID")'), "Wave events must be scoped to the configured business");
assert(waveEdge.includes('Deno.env.get("WAVE_ACCESS_TOKEN")'), "Wave renewals must support customer reconciliation");
assert(waveEdge.includes("verifyWaveSignature"), "Wave callbacks must verify their signatures");
assert(waveEdge.includes('["processed", "ignored", "unmatched"]'), "Completed Wave events must be idempotent while failed events remain retryable");
assert(/\[functions\.customer-portal\][\s\S]*?verify_jwt\s*=\s*false/.test(supabaseConfig), "Customer portal token function must allow public invocation");
assert(/\[functions\.wave-webhook\][\s\S]*?verify_jwt\s*=\s*false/.test(supabaseConfig), "Wave webhook must allow provider callbacks");

const customerSafeStart = edge.indexOf("async function customerSafeJob");
const customerSafeEnd = edge.indexOf("serve(async", customerSafeStart);
const customerSafeBlock = edge.slice(customerSafeStart, customerSafeEnd);
for (const privateField of ["internal_notes", "custom_values", "customerEmail", "customerPhone", "mileage_entries"]) {
  assert(!customerSafeBlock.includes(privateField), `Customer response exposes private field: ${privateField}`);
}
assert(customerSafeBlock.includes("invoice_url"), "Customer response must include the invoice URL when configured");
assert(!app.includes("Loaded from workspace"), "Internal workspace status must not appear in the UI");
assert(!app.includes("copy-portal-link"), "Manual portal-link control must not be exposed");
assert(!app.includes("Wave subscription infrastructure"), "Internal billing implementation details must not appear in the UI");
assert(app.includes("portalMode.active ?"), "Customer mutation controls must be limited to secure portal mode");
assert(html.includes('id="workspaceLogo"'), "Company profile must include a logo picker");
assert(html.includes('id="portalCompanyLogo"'), "Customer portal must include contractor branding");
assert(app.includes('emailType: "job_update"'), "Contractor job changes must request customer update emails");
assert(emailEdge.includes("Your job has been updated."), "Update email must use the approved customer wording");
assert(emailEdge.includes("text: `${message}"), "Customer email must include a plain-text alternative");
assert(emailEdge.includes('message_type: messageType'), "Customer email records must identify the message type");
assert(edge.includes("customerSafeCompany"), "Customer portal must return safe company branding");
assert(workspaceEdge.includes("logo_path"), "Workspace settings must save the company logo path server-side");
assert(brandingMigration.includes("'company-branding'"), "Branding migration must create the company logo bucket");
assert(brandingMigration.includes("2097152"), "Company logo storage must enforce the 2 MB limit");
assert(html.includes('id="mileageTrackingEnabled"'), "Settings must include the global mileage switch");
assert(app.includes('.from("mileage_entries")'), "Contractor app must persist mileage records");
assert(app.includes('if (!state.settings.mileageTrackingEnabled) return ""'), "Mileage controls must respect the global setting");
assert(mileageMigration.includes("mileage_tracking_enabled boolean not null default false"), "Mileage tracking must default off for existing companies");
assert(mileageMigration.includes("alter table public.mileage_entries enable row level security"), "Mileage records must have row-level security");
assert(mileageMigration.includes("public.job_belongs_to_company(job_id, company_id)"), "Mileage records must remain scoped to company jobs");

const mileageMutationStart = app.indexOf("async function addMileageEntry");
const mileageMutationEnd = app.indexOf("function viewEstimate", mileageMutationStart);
assert(mileageMutationStart >= 0 && mileageMutationEnd > mileageMutationStart, "Mileage mutation helpers must exist");
assert(!app.slice(mileageMutationStart, mileageMutationEnd).includes("notifyCustomerOfJobUpdate"), "Private mileage changes must not email customers");
assert(app.includes('rpc("save_scheduled_job_record"'), "Job saves must use the atomic scheduling database function");
assert(app.includes("input_customer_name: payload.customerName"), "Job save arguments must match the database function");
assert(atomicJobMigration.includes("security definer"), "Atomic job save must run through a reviewed security boundary");
assert(atomicJobMigration.includes("user_id = auth.uid()"), "Atomic job save must verify company membership");
assert(atomicJobMigration.includes("input_job_status text"), "Atomic job save parameters must remain unambiguous");
assert(app.includes("uploadLiveDocumentFiles"), "Multi-file uploads must use the rollback-aware uploader");
assert(app.includes("removeLiveDocumentFiles(docs.map"), "Failed document records must clean up uploaded files");
assert(app.includes("if (jobSaveBusy) return"), "Job saves must guard against duplicate submission");
assert(app.includes("A custom field with that name already exists."), "Custom fields must reject duplicate names");
assert(html.includes('id="attentionQueue"'), "Dashboard must include the needs-attention queue");
assert(html.includes('id="jobSearch"'), "Dashboard must include job search");
assert(html.includes('id="jobStatusFilter"'), "Dashboard must include job filtering");
assert(app.includes("attentionCategoriesForJob"), "Attention categories must be derived from job data");
assert(app.includes('doc.uploadedBy === "Customer" && doc.status === "New"'), "New customer uploads must appear in the attention queue");
assert(app.includes('jobStatusFilter === "attention"'), "Job filtering must support the attention queue");
assert(app.includes('${count ? "" : "disabled"}'), "Empty attention categories must not act like filters");
assert(html.includes('id="upcomingSchedule"'), "Dashboard must include the upcoming schedule");
assert(html.includes('id="scheduleSettingsForm"'), "Settings must include company availability");
assert(app.includes("function createDemoSchedule"), "The review demo must keep sample visits in the future");
assert(/function demoMode\(\)\s*{\s*return new URLSearchParams/.test(app), "The published review link must support demo mode");
assert(/function loadState\(\)\s*{\s*if \(demoMode\(\)\)/.test(app), "The review demo must not reuse stale browser data");
assert(app.includes("function suggestNextAvailableSlot"), "Scheduling must provide next-available suggestions");
assert(app.includes("function occurrencesForJob"), "Scheduling must expand recurring jobs");
assert(app.includes('.from("schedule_exceptions").upsert'), "Recurring visits must support per-visit changes");
assert(schedulingMigration.includes("alter table public.schedule_exceptions enable row level security"), "Schedule exceptions must have row-level security");
assert(schedulingMigration.includes("public.job_belongs_to_company(job_id, company_id)"), "Schedule exceptions must remain scoped to company jobs");
assert(schedulingMigration.includes("save_scheduled_job_record"), "Scheduled job saves must use a reviewed database boundary");
assert(schedulingMigration.includes("public.company_member_can_write(target_company_id)"), "Scheduled job saves must enforce subscription access");
assert(schedulingMigration.includes("Members can read schedule exceptions"), "Read-only workspaces must retain schedule visibility");

console.log("Static smoke checks passed.");
