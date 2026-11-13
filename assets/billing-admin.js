const config = window.SERVICE_PORTAL_CONFIG || {};
const client = config.supabaseUrl && config.supabasePublishableKey && window.supabase
  ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const state = {
  dashboard: null,
  session: null,
  selectedAccount: null,
};

const els = Object.fromEntries([
  "authView", "accessDeniedView", "billingView", "signInForm", "signInEmail", "signInPassword",
  "signInMessage", "signOutButton", "themeToggle", "refreshDashboard", "downloadAccounts",
  "activeAccountsMetric", "monthlyRevenueMetric", "trialingAccountsMetric", "pastDueAccountsMetric",
  "compedAccountsMetric", "accountSearch", "accountStatusFilter", "accountsTableBody",
  "accountsMobileList", "accountsEmpty", "couponForm", "couponEmail", "couponPercent", "couponEndsAt",
  "couponNote", "couponFormMessage", "couponList", "planOptions", "paymentsTableBody",
  "paymentsMobileList", "paymentsEmpty", "accountDialog", "accountForm", "accountDialogTitle",
  "accountDialogEmail", "accountCompanyId", "accountStatus", "accountBillingEmail", "accountBillingMode",
  "accountProvider", "accountNextInvoice", "accountPeriodEnds", "accountGraceEnds", "accountWaveCustomer",
  "accountWaveContract", "accountInvoiceUrl", "accountNotes", "accountFormMessage", "closeAccountDialog",
  "cancelAccountDialog", "openPaymentDialog", "paymentDialog", "paymentForm", "paymentCompanyName",
  "paymentCompanyId", "paymentAmount", "paymentStatus", "paymentProvider", "paymentDate",
  "paymentExternalId", "paymentInvoiceId", "paymentInvoiceUrl", "paymentNotes", "paymentFormMessage",
  "closePaymentDialog", "cancelPaymentDialog", "toast",
].map((id) => [id, document.getElementById(id)]));

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents || 0) / 100);
}

function formatDate(value, fallback = "Not set") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function dateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function statusLabel(value) {
  return ({
    beta: "Early access",
    trialing: "Free trial",
    active: "Active",
    past_due: "Past due",
    cancelled: "Cancelled",
    pending: "Pending",
    paid: "Paid",
    failed: "Failed",
    refunded: "Refunded",
    void: "Void",
  })[value] || String(value || "Unknown").replaceAll("_", " ");
}

function showToast(message, tone = "info") {
  els.toast.textContent = message;
  els.toast.className = `toast visible${tone === "error" ? " error" : ""}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { els.toast.className = "toast"; }, 3200);
}

function setMessage(element, message = "", success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
}

function setButtonBusy(button, busy, busyLabel = "Saving...") {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.innerHTML;
    button.disabled = true;
    button.textContent = busyLabel;
  } else {
    button.disabled = false;
    if (button.dataset.originalLabel) button.innerHTML = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
    window.lucide?.createIcons();
  }
}

function showView(view) {
  els.authView.hidden = view !== "auth";
  els.accessDeniedView.hidden = view !== "denied";
  els.billingView.hidden = view !== "billing";
  els.signOutButton.hidden = view === "auth";
}

function currentAccounts() {
  return Array.isArray(state.dashboard?.accounts) ? state.dashboard.accounts : [];
}

function accountById(companyId) {
  return currentAccounts().find((account) => account.company_id === companyId) || null;
}

function accountNextDate(account) {
  if (account.status === "trialing") return account.trial_ends_at;
  if (account.status === "past_due") return account.grace_ends_at;
  return account.next_invoice_at || account.current_period_ends_at;
}

function accountWaveState(account) {
  if (account.plan_price_cents === 0) return "Not needed";
  if (account.external_customer_id || account.external_contract_id) return "Linked";
  return "Not linked";
}

function renderSummary() {
  const summary = state.dashboard?.summary || {};
  els.activeAccountsMetric.textContent = Number(summary.active_accounts || 0);
  els.monthlyRevenueMetric.textContent = `${formatMoney(summary.expected_monthly_cents)} monthly`;
  els.trialingAccountsMetric.textContent = Number(summary.trialing_accounts || 0);
  els.pastDueAccountsMetric.textContent = Number(summary.past_due_accounts || 0);
  els.compedAccountsMetric.textContent = Number(summary.comped_accounts || 0);
}

function filteredAccounts() {
  const search = els.accountSearch.value.trim().toLowerCase();
  const status = els.accountStatusFilter.value;
  return currentAccounts().filter((account) => {
    const matchesStatus = status === "all" || account.status === status;
    const haystack = `${account.company_name || ""} ${account.owner_email || ""} ${account.billing_email || ""}`.toLowerCase();
    return matchesStatus && (!search || haystack.includes(search));
  });
}

function renderAccounts() {
  const accounts = filteredAccounts();
  els.accountsEmpty.hidden = accounts.length > 0;
  els.accountsTableBody.innerHTML = accounts.map((account) => `
    <tr>
      <td><strong>${escapeHtml(account.company_name)}</strong><small>${escapeHtml(account.billing_email || account.owner_email || "No billing email")}</small></td>
      <td><span class="status-pill" data-status="${escapeHtml(account.status)}">${escapeHtml(statusLabel(account.status))}</span></td>
      <td><strong>${escapeHtml(formatMoney(account.plan_price_cents))}</strong><small>${account.promo_percent_off ? `${escapeHtml(account.promo_percent_off)}% discount` : "Standard plan"}</small></td>
      <td><strong>${escapeHtml(formatDate(accountNextDate(account)))}</strong><small>${account.status === "trialing" ? "Trial ends" : "Billing date"}</small></td>
      <td><strong>${escapeHtml(accountWaveState(account))}</strong><small>${escapeHtml(account.last_invoice_id || "No invoice reference")}</small></td>
      <td><button class="row-action" type="button" data-manage-account="${escapeHtml(account.company_id)}">Manage</button></td>
    </tr>
  `).join("");

  els.accountsMobileList.innerHTML = accounts.map((account) => `
    <article class="mobile-card">
      <div class="mobile-card-heading">
        <div><strong>${escapeHtml(account.company_name)}</strong><small>${escapeHtml(account.billing_email || account.owner_email || "No billing email")}</small></div>
        <span class="status-pill" data-status="${escapeHtml(account.status)}">${escapeHtml(statusLabel(account.status))}</span>
      </div>
      <div class="mobile-card-details">
        <div><span>Monthly</span><strong>${escapeHtml(formatMoney(account.plan_price_cents))}</strong></div>
        <div><span>Next date</span><strong>${escapeHtml(formatDate(accountNextDate(account)))}</strong></div>
        <div><span>Jobs</span><strong>${escapeHtml(account.job_count || 0)}</strong></div>
        <div><span>Wave</span><strong>${escapeHtml(accountWaveState(account))}</strong></div>
      </div>
      <button class="row-action" type="button" data-manage-account="${escapeHtml(account.company_id)}">Manage account</button>
    </article>
  `).join("");
}

function couponState(coupon) {
  if (!coupon.active) return "Inactive";
  if (coupon.redeemed_at) return "Used";
  if (coupon.ends_at && new Date(coupon.ends_at) < new Date()) return "Expired";
  return "Ready";
}

function renderCoupons() {
  const coupons = Array.isArray(state.dashboard?.coupons) ? state.dashboard.coupons : [];
  els.couponList.innerHTML = coupons.length ? coupons.map((coupon) => `
    <article class="coupon-row">
      <div><span class="coupon-code">${escapeHtml(String(coupon.code).toUpperCase())}</span><small>${escapeHtml(coupon.percent_off)}% off</small></div>
      <div><strong>${escapeHtml(coupon.assigned_company_name || coupon.assigned_email || "Unassigned")}</strong><small>${escapeHtml(coupon.assigned_company_name && coupon.assigned_email ? coupon.assigned_email : "Unique recipient")}</small></div>
      <div><strong>${escapeHtml(couponState(coupon))}</strong><small>${coupon.redeemed_at ? `Used ${escapeHtml(formatDate(coupon.redeemed_at))}` : `Use by ${escapeHtml(formatDate(coupon.ends_at, "No expiration"))}`}</small></div>
      <div><strong>${escapeHtml(coupon.redemption_count || 0)} of ${escapeHtml(coupon.max_redemptions || 1)}</strong><small>Redemptions</small></div>
      <button class="copy-button" type="button" data-copy-code="${escapeHtml(String(coupon.code).toUpperCase())}"><i data-lucide="copy"></i><span>Copy</span></button>
    </article>
  `).join("") : '<p class="empty-row">No unique codes have been created yet.</p>';
  window.lucide?.createIcons();
}

function renderPlanOptions() {
  const options = Array.isArray(state.dashboard?.plan_options) ? state.dashboard.plan_options : [];
  els.planOptions.innerHTML = options.map((option) => {
    const isFree = Number(option.percent_off) === 100;
    return `
      <form class="plan-row" data-plan-percent="${escapeHtml(option.percent_off)}">
        <div class="plan-price"><strong>${option.percent_off ? `${escapeHtml(option.percent_off)}% off` : "Standard"}</strong><small>${escapeHtml(formatMoney(option.monthly_price_cents))} per month</small></div>
        <label>Available<select name="active"><option value="true" ${option.active ? "selected" : ""}>On</option><option value="false" ${option.active ? "" : "selected"}>Off</option></select></label>
        <label>Wave recurring checkout URL<input name="checkout_url" type="url" value="${escapeHtml(option.checkout_url || "")}" ${isFree ? "disabled placeholder=\"No payment link needed\"" : "placeholder=\"https://checkout.waveapps.com/...\""} /></label>
        <label>Wave checkout ID<input name="external_checkout_id" type="text" value="${escapeHtml(option.external_checkout_id || "")}" ${isFree ? "disabled" : ""} /></label>
        <button class="primary-button" type="submit"><i data-lucide="save"></i><span>Save</span></button>
      </form>
    `;
  }).join("");
  window.lucide?.createIcons();
}

function renderPayments() {
  const payments = Array.isArray(state.dashboard?.payments) ? state.dashboard.payments : [];
  els.paymentsEmpty.hidden = payments.length > 0;
  els.paymentsTableBody.innerHTML = payments.map((payment) => `
    <tr>
      <td><strong>${escapeHtml(formatDate(payment.paid_at || payment.created_at))}</strong><small>${escapeHtml(payment.provider)}</small></td>
      <td><strong>${escapeHtml(payment.company_name)}</strong></td>
      <td><span class="status-pill" data-status="${escapeHtml(payment.status)}">${escapeHtml(statusLabel(payment.status))}</span></td>
      <td><strong>${escapeHtml(formatMoney(payment.amount_cents))}</strong><small>${escapeHtml(payment.currency_code)}</small></td>
      <td><strong>${escapeHtml(payment.external_invoice_id || payment.external_payment_id || "Manual record")}</strong></td>
    </tr>
  `).join("");

  els.paymentsMobileList.innerHTML = payments.map((payment) => `
    <article class="mobile-card">
      <div class="mobile-card-heading"><div><strong>${escapeHtml(payment.company_name)}</strong><small>${escapeHtml(formatDate(payment.paid_at || payment.created_at))}</small></div><span class="status-pill" data-status="${escapeHtml(payment.status)}">${escapeHtml(statusLabel(payment.status))}</span></div>
      <div class="mobile-card-details"><div><span>Amount</span><strong>${escapeHtml(formatMoney(payment.amount_cents))}</strong></div><div><span>Provider</span><strong>${escapeHtml(payment.provider)}</strong></div></div>
    </article>
  `).join("");
}

function renderDashboard() {
  renderSummary();
  renderAccounts();
  renderCoupons();
  renderPlanOptions();
  renderPayments();
  window.lucide?.createIcons();
}

async function loadDashboard() {
  if (!client) {
    showView("auth");
    setMessage(els.signInMessage, "Billing is not connected to the account database.");
    return;
  }
  const { data, error } = await client.rpc("get_billing_admin_dashboard");
  if (error) {
    console.warn("Billing dashboard unavailable", error);
    showView(error.message?.toLowerCase().includes("administrator") ? "denied" : "auth");
    if (!error.message?.toLowerCase().includes("administrator")) setMessage(els.signInMessage, "Could not load billing records. Please sign in again.");
    return;
  }
  state.dashboard = data || {};
  showView("billing");
  renderDashboard();
}

function openAccount(companyId) {
  const account = accountById(companyId);
  if (!account) return;
  state.selectedAccount = account;
  els.accountDialogTitle.textContent = account.company_name || "Manage account";
  els.accountDialogEmail.textContent = account.owner_email || "No account owner email";
  els.accountCompanyId.value = account.company_id;
  els.accountStatus.value = account.status || "trialing";
  els.accountBillingEmail.value = account.billing_email || account.owner_email || "";
  els.accountBillingMode.value = account.billing_mode || "off";
  els.accountProvider.value = account.provider || "none";
  els.accountNextInvoice.value = dateInputValue(account.next_invoice_at);
  els.accountPeriodEnds.value = dateInputValue(account.current_period_ends_at);
  els.accountGraceEnds.value = dateInputValue(account.grace_ends_at);
  els.accountWaveCustomer.value = account.external_customer_id || "";
  els.accountWaveContract.value = account.external_contract_id || "";
  els.accountInvoiceUrl.value = account.external_invoice_url || "";
  els.accountNotes.value = account.admin_notes || "";
  setMessage(els.accountFormMessage);
  els.accountDialog.showModal();
}

function openPayment(companyId) {
  const account = accountById(companyId);
  if (!account) return;
  els.accountDialog.close();
  els.paymentCompanyName.textContent = account.company_name || "Account";
  els.paymentCompanyId.value = account.company_id;
  els.paymentAmount.value = (Number(account.plan_price_cents || 0) / 100).toFixed(2);
  els.paymentStatus.value = "paid";
  els.paymentProvider.value = "wave";
  els.paymentDate.value = new Date().toISOString().slice(0, 10);
  els.paymentExternalId.value = "";
  els.paymentInvoiceId.value = "";
  els.paymentInvoiceUrl.value = "";
  els.paymentNotes.value = "";
  setMessage(els.paymentFormMessage);
  els.paymentDialog.showModal();
}

function csvValue(value) {
  const clean = String(value ?? "").replaceAll('"', '""');
  return `"${clean}"`;
}

function downloadAccountsCsv() {
  const rows = currentAccounts();
  const headers = [
    "Company", "Owner email", "Billing email", "Status", "Billing mode", "Provider", "Base monthly",
    "Discount percent", "Monthly after discount", "Promo code", "Trial ends", "Last paid", "Paid through",
    "Next invoice", "Grace ends", "Wave customer ID", "Wave recurring ID", "Last invoice ID", "Jobs",
    "Total paid", "Last reconciled", "Private notes",
  ];
  const body = rows.map((account) => [
    account.company_name, account.owner_email, account.billing_email, statusLabel(account.status), account.billing_mode,
    account.provider, (Number(account.base_plan_price_cents || 0) / 100).toFixed(2), account.promo_percent_off,
    (Number(account.plan_price_cents || 0) / 100).toFixed(2), account.promo_code ? String(account.promo_code).toUpperCase() : "",
    account.trial_ends_at, account.last_paid_at, account.current_period_ends_at, account.next_invoice_at,
    account.grace_ends_at, account.external_customer_id, account.external_contract_id, account.last_invoice_id,
    account.job_count, (Number(account.total_paid_cents || 0) / 100).toFixed(2), account.last_reconciled_at, account.admin_notes,
  ].map(csvValue).join(","));
  const csv = [headers.map(csvValue).join(","), ...body].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `contractor-billing-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Billing spreadsheet downloaded.");
}

async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    showToast(`${code} copied.`);
  } catch {
    showToast("Could not copy the code.", "error");
  }
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("servicePortal.theme", next); } catch (_) {}
}

els.signInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client) return;
  const button = event.submitter || els.signInForm.querySelector("button[type=submit]");
  setButtonBusy(button, true, "Signing in...");
  setMessage(els.signInMessage);
  const { data, error } = await client.auth.signInWithPassword({
    email: els.signInEmail.value.trim(),
    password: els.signInPassword.value,
  });
  els.signInPassword.value = "";
  setButtonBusy(button, false);
  if (error || !data.session) {
    setMessage(els.signInMessage, "Sign-in failed. Check the email and password, then try again.");
    return;
  }
  state.session = data.session;
  await loadDashboard();
});

els.signOutButton.addEventListener("click", async () => {
  await client?.auth.signOut();
  state.session = null;
  state.dashboard = null;
  els.signInPassword.value = "";
  showView("auth");
});

els.themeToggle.addEventListener("click", toggleTheme);
els.refreshDashboard.addEventListener("click", async () => {
  setButtonBusy(els.refreshDashboard, true, "...");
  await loadDashboard();
  setButtonBusy(els.refreshDashboard, false);
  showToast("Billing records refreshed.");
});
els.downloadAccounts.addEventListener("click", downloadAccountsCsv);
els.accountSearch.addEventListener("input", renderAccounts);
els.accountStatusFilter.addEventListener("change", renderAccounts);

document.addEventListener("click", (event) => {
  const manageButton = event.target.closest("[data-manage-account]");
  if (manageButton) openAccount(manageButton.dataset.manageAccount);
  const copyButton = event.target.closest("[data-copy-code]");
  if (copyButton) copyCode(copyButton.dataset.copyCode);
});

els.couponForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  setButtonBusy(button, true, "Creating...");
  setMessage(els.couponFormMessage);
  const endsAt = els.couponEndsAt.value ? new Date(`${els.couponEndsAt.value}T23:59:59`).toISOString() : null;
  const { data, error } = await client.rpc("billing_admin_create_coupon", {
    input_percent_off: Number(els.couponPercent.value),
    input_assigned_email: els.couponEmail.value.trim(),
    input_assigned_company_id: null,
    input_ends_at: endsAt,
    input_note: els.couponNote.value.trim() || null,
  });
  setButtonBusy(button, false);
  if (error) {
    console.warn("Coupon creation failed", error);
    setMessage(els.couponFormMessage, error.message || "Could not create the code.");
    return;
  }
  els.couponForm.reset();
  setMessage(els.couponFormMessage, `${data.code} created and ready to text.`, true);
  await loadDashboard();
  await copyCode(data.code);
});

els.planOptions.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target.closest("[data-plan-percent]");
  if (!form) return;
  const button = event.submitter;
  setButtonBusy(button, true);
  const percent = Number(form.dataset.planPercent);
  const checkoutField = form.elements.checkout_url;
  const idField = form.elements.external_checkout_id;
  const { error } = await client.rpc("billing_admin_set_plan_option", {
    input_percent_off: percent,
    input_checkout_url: checkoutField?.value.trim() || null,
    input_external_checkout_id: idField?.value.trim() || null,
    input_active: form.elements.active.value === "true",
  });
  setButtonBusy(button, false);
  if (error) {
    console.warn("Plan option save failed", error);
    showToast(error.message || "Could not save the Wave option.", "error");
    return;
  }
  await loadDashboard();
  showToast("Payment option saved.");
});

els.accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  setButtonBusy(button, true);
  setMessage(els.accountFormMessage);
  const changes = {
    status: els.accountStatus.value,
    billing_email: els.accountBillingEmail.value.trim(),
    billing_mode: els.accountBillingMode.value,
    provider: els.accountProvider.value,
    next_invoice_at: els.accountNextInvoice.value,
    current_period_ends_at: els.accountPeriodEnds.value,
    grace_ends_at: els.accountGraceEnds.value,
    external_customer_id: els.accountWaveCustomer.value.trim(),
    external_contract_id: els.accountWaveContract.value.trim(),
    external_invoice_url: els.accountInvoiceUrl.value.trim(),
    admin_notes: els.accountNotes.value.trim(),
  };
  const { error } = await client.rpc("billing_admin_update_account", {
    target_company_id: els.accountCompanyId.value,
    input_changes: changes,
  });
  setButtonBusy(button, false);
  if (error) {
    console.warn("Account save failed", error);
    setMessage(els.accountFormMessage, error.message || "Could not save the account.");
    return;
  }
  els.accountDialog.close();
  await loadDashboard();
  showToast("Account billing record saved.");
});

els.openPaymentDialog.addEventListener("click", () => openPayment(els.accountCompanyId.value));
els.closeAccountDialog.addEventListener("click", () => els.accountDialog.close());
els.cancelAccountDialog.addEventListener("click", () => els.accountDialog.close());

els.paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  setButtonBusy(button, true, "Recording...");
  setMessage(els.paymentFormMessage);
  const amountCents = Math.round(Number(els.paymentAmount.value) * 100);
  const { error } = await client.rpc("billing_admin_record_payment", {
    target_company_id: els.paymentCompanyId.value,
    input_payment: {
      amount_cents: amountCents,
      status: els.paymentStatus.value,
      provider: els.paymentProvider.value,
      paid_at: els.paymentDate.value,
      external_payment_id: els.paymentExternalId.value.trim(),
      external_invoice_id: els.paymentInvoiceId.value.trim(),
      external_invoice_url: els.paymentInvoiceUrl.value.trim(),
      notes: els.paymentNotes.value.trim(),
      currency_code: "USD",
    },
  });
  setButtonBusy(button, false);
  if (error) {
    console.warn("Payment save failed", error);
    setMessage(els.paymentFormMessage, error.message || "Could not record the payment.");
    return;
  }
  els.paymentDialog.close();
  await loadDashboard();
  showToast("Payment recorded in the independent ledger.");
});

els.closePaymentDialog.addEventListener("click", () => els.paymentDialog.close());
els.cancelPaymentDialog.addEventListener("click", () => els.paymentDialog.close());

async function initialize() {
  window.lucide?.createIcons();
  if (!client) {
    showView("auth");
    setMessage(els.signInMessage, "Billing is not connected to the account database.");
    return;
  }
  const { data } = await client.auth.getSession();
  state.session = data.session || null;
  if (!state.session) {
    showView("auth");
    return;
  }
  await loadDashboard();
}

initialize();
