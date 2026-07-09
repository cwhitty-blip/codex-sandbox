(function () {
  const config = window.SERVICE_PORTAL_CONFIG;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey || !window.supabase?.createClient) return;

  const backend = {
    client: window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey),
    user: null,
    company: null,
    live: false,
  };
  const monthlyPlanCents = 1299;
  const trialDays = 7;
  const promoCodes = {
    "20off": 20,
    "30off": 30,
  };

  function ensureAuthSupportUi() {
    if (!document.getElementById("forgotPassword")) {
      const forgot = document.createElement("button");
      forgot.id = "forgotPassword";
      forgot.className = "text-button";
      forgot.type = "button";
      forgot.textContent = "Send password reset email";
      document.getElementById("authForm").after(forgot);
    }
    if (!document.getElementById("recoveryForm")) {
      const recovery = document.createElement("form");
      recovery.id = "recoveryForm";
      recovery.className = "auth-form";
      recovery.hidden = true;
      recovery.innerHTML = `
        <input id="recoveryPassword" type="password" placeholder="New password" autocomplete="new-password" />
        <button id="recoverySubmit" class="primary-button" type="submit">Save new password</button>
      `;
      document.getElementById("forgotPassword").after(recovery);
    }
    if (!document.getElementById("authRecoveryStyles")) {
      const style = document.createElement("style");
      style.id = "authRecoveryStyles";
      style.textContent = `
        .text-button {
          justify-self: start;
          min-height: auto;
          border: 0;
          padding: 4px 0;
          background: transparent;
          color: var(--accent);
          font: inherit;
          font-weight: 850;
          text-align: left;
        }
      `;
      document.head.append(style);
    }
  }

  ensureAuthSupportUi();

  const authEls = {
    form: document.getElementById("authForm"),
    email: document.getElementById("authEmail"),
    password: document.getElementById("authPassword"),
    company: document.getElementById("authCompany"),
    promoCode: document.getElementById("authPromoCode"),
    submit: document.getElementById("authSubmit"),
    create: document.getElementById("authCreate"),
    forgot: document.getElementById("forgotPassword"),
    recoveryForm: document.getElementById("recoveryForm"),
    recoveryPassword: document.getElementById("recoveryPassword"),
    recoverySubmit: document.getElementById("recoverySubmit"),
    status: document.getElementById("authStatus"),
    backendStatus: document.getElementById("backendStatus"),
    signOut: document.getElementById("signOut"),
  };
  const billingEls = {
    status: document.getElementById("subscriptionStatus"),
    summary: document.getElementById("subscriptionSummary"),
    promoForm: document.getElementById("promoForm"),
    promoCode: document.getElementById("promoCode"),
    checkout: document.getElementById("checkoutButton"),
  };

  function setStatus(title, detail) {
    authEls.status.textContent = title;
    authEls.backendStatus.textContent = detail;
  }

  function renderAuth() {
    if (backend.live) {
      setStatus(backend.company?.name || "Live workspace", `Signed in as ${backend.user.email}. Jobs are syncing to Supabase.`);
      authEls.form.hidden = true;
      authEls.forgot.hidden = true;
      authEls.recoveryForm.hidden = true;
      authEls.signOut.hidden = false;
      return;
    }
    setStatus("Contractor sign in", "Create an account for a 7-day trial, or sign in with your contractor password.");
    authEls.form.hidden = false;
    authEls.forgot.hidden = false;
    authEls.recoveryForm.hidden = true;
    authEls.signOut.hidden = true;
  }

  function showRecoveryMode() {
    setStatus("Choose a new password", "Enter a new contractor password, then sign in normally.");
    authEls.form.hidden = true;
    authEls.forgot.hidden = true;
    authEls.recoveryForm.hidden = false;
    authEls.signOut.hidden = true;
  }

  function normalizePromoCode(value) {
    return (value || "").trim().toLowerCase();
  }

  function promoPercentFor(value) {
    return promoCodes[normalizePromoCode(value)] || 0;
  }

  function formatMoney(cents) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function trialDaysLeft() {
    if (!state.settings.trialEndsAt) return trialDays;
    const ms = new Date(state.settings.trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  }

  function renderSubscription() {
    if (!billingEls.summary) return;
    const status = state.settings.subscriptionStatus || "trialing";
    const percent = Number(state.settings.promoPercentOff || 0);
    const price = Number(state.settings.planPriceCents || monthlyPlanCents);
    const discounted = Math.round(price * (100 - percent) / 100);
    const daysLeft = trialDaysLeft();
    billingEls.status.textContent = status === "active" ? "Active" : status === "past_due" ? "Payment needed" : "Trial";
    billingEls.promoCode.value = state.settings.promoCode || "";
    billingEls.summary.innerHTML = `
      <span>
        <strong>${status === "trialing" ? `${daysLeft} trial ${daysLeft === 1 ? "day" : "days"} left` : "Monthly plan"}</strong>
        <small>7 days free, then <span class="subscription-price">${formatMoney(discounted)}</span> / month.</small>
      </span>
      <small>${percent ? `${percent}% promo applied (${state.settings.promoCode}). Standard price is ${formatMoney(price)} / month.` : "No promo code applied."}</small>
    `;
  }

  function renderLive() {
    render();
    renderSubscription();
  }

  function mapDbDocument(doc) {
    return {
      id: doc.id,
      name: doc.name,
      type: doc.document_type,
      uploadedBy: doc.uploaded_by,
      visibility: doc.visibility,
      status: doc.status,
      createdAt: doc.created_at,
      version: doc.version,
      size: doc.size_bytes,
      stored: Boolean(doc.storage_file_id || doc.storage_url),
    };
  }

  function mapDbJob(job) {
    const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
    return {
      id: job.id,
      customerId: job.customer_id,
      industry: job.industry,
      name: job.name,
      customerName: customer?.name || "",
      customerEmail: customer?.email || "",
      customerPhone: customer?.phone || "",
      serviceAddress: job.service_address || "",
      jobStatus: job.job_status,
      materialStatus: job.material_status,
      projectedDate: job.projected_date || "",
      invoiceUrl: job.invoice_url || "",
      nextAction: job.next_action || "",
      internalNotes: job.internal_notes || "",
      customValues: job.custom_values || {},
      documents: (job.documents || []).map(mapDbDocument),
      timeline: ["Loaded from Supabase"],
      estimateAcceptedAt: null,
      acceptedEstimate: null,
      viewedEstimateId: null,
      magicLinkLastSent: null,
    };
  }

  async function ensureCompany() {
    const companyName = authEls.company.value.trim() || "Service Company";
    const { data, error } = await backend.client.rpc("bootstrap_company", {
      company_name: companyName,
      promo_code: normalizePromoCode(authEls.promoCode.value),
    });
    if (error) throw error;
    backend.company = Array.isArray(data) ? data[0] : data;
  }

  async function loadLiveState() {
    const companyId = backend.company.id;
    const [companyResult, fieldsResult, jobsResult] = await Promise.all([
      backend.client.from("companies").select("*").eq("id", companyId).single(),
      backend.client.from("custom_fields").select("*").eq("company_id", companyId).order("created_at"),
      backend.client.from("jobs").select("*, customers(*), documents(*)").eq("company_id", companyId).order("created_at", { ascending: false }),
    ]);
    if (companyResult.error) throw companyResult.error;
    if (fieldsResult.error) throw fieldsResult.error;
    if (jobsResult.error) throw jobsResult.error;

    backend.company = companyResult.data;
    state.settings = {
      billingProvider: backend.company.billing_provider || "QuickBooks Online",
      billingAccount: backend.company.billing_account || backend.company.name || "",
      billingSync: backend.company.billing_sync || "Invoice links only",
      billingConnected: Boolean(backend.company.billing_provider),
      subscriptionStatus: backend.company.subscription_status || "trialing",
      trialStartedAt: backend.company.trial_started_at || backend.company.created_at,
      trialEndsAt: backend.company.trial_ends_at || "",
      planPriceCents: backend.company.plan_price_cents || 1299,
      promoCode: backend.company.promo_code || "",
      promoPercentOff: backend.company.promo_percent_off || 0,
      customFields: (fieldsResult.data || []).map((field) => ({
        id: field.id,
        label: field.label,
        type: field.field_type,
        options: Array.isArray(field.options) ? field.options : [],
      })),
    };
    state.jobs = (jobsResult.data || []).map(mapDbJob);
    selectedJobId = state.jobs[0]?.id || null;
    state.portalAccess.jobId = selectedJobId;
  }

  async function handleSession(session) {
    backend.user = session?.user || null;
    backend.live = false;
    if (!backend.user) {
      renderAuth();
      return;
    }
    try {
      setStatus("Connecting", "Loading your Supabase workspace...");
      await ensureCompany();
      await loadLiveState();
      backend.live = true;
      renderAuth();
      renderLive();
    } catch (error) {
      setStatus("Setup needed", error.message || "Supabase could not load.");
    }
  }

  function customValuesFromForm() {
    const values = {};
    document.querySelectorAll("[data-custom-field]").forEach((input) => {
      values[input.dataset.customField] = input.value;
    });
    return values;
  }

  function jobPayloadFromForm(customerId) {
    return {
      company_id: backend.company.id,
      customer_id: customerId,
      industry: els.jobIndustry.value,
      name: els.jobName.value,
      service_address: els.serviceAddress.value,
      job_status: els.jobStatus.value,
      material_status: els.materialStatus.value,
      projected_date: els.projectedDate.value || null,
      invoice_url: els.invoiceUrl.value || null,
      next_action: els.nextAction.value,
      internal_notes: els.internalNotes.value,
      custom_values: customValuesFromForm(),
    };
  }

  async function saveLiveJob(event) {
    if (!backend.live) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const existing = state.jobs.find((job) => job.id === els.jobId.value);
    const customerPayload = {
      company_id: backend.company.id,
      name: els.customerName.value,
      email: els.customerEmail.value,
      phone: els.customerPhone.value || null,
    };

    let customerId = existing?.customerId;
    if (customerId) {
      const { error } = await backend.client.from("customers").update(customerPayload).eq("id", customerId);
      if (error) throw error;
    } else {
      const { data, error } = await backend.client.from("customers").insert(customerPayload).select("id").single();
      if (error) throw error;
      customerId = data.id;
    }

    const jobPayload = jobPayloadFromForm(customerId);
    if (existing) {
      const { error } = await backend.client.from("jobs").update(jobPayload).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { data, error } = await backend.client.from("jobs").insert(jobPayload).select("id").single();
      if (error) throw error;
      selectedJobId = data.id;
    }

    els.jobDialog.close();
    await loadLiveState();
    renderLive();
  }

  async function sendLiveMagicEmail(event) {
    if (!backend.live || event.target.dataset.action !== "send-email") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const job = selectedJob();
    if (!job) return;
    const { error } = await backend.client.functions.invoke("send-magic-link", { body: { jobId: job.id } });
    job.magicLinkLastSent = new Date().toISOString();
    job.timeline.push(error ? `Magic email failed: ${error.message}` : `Magic email sent to ${job.customerEmail}`);
    renderLive();
  }

  async function saveLiveBilling(event) {
    if (!backend.live) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const { error } = await backend.client.from("companies").update({
      billing_provider: els.billingProvider.value,
      billing_account: els.billingAccount.value,
      billing_sync: els.billingSync.value,
    }).eq("id", backend.company.id);
    if (error) throw error;
    await loadLiveState();
    renderLive();
  }

  async function addLiveField(event) {
    if (!backend.live) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const label = els.fieldLabel.value.trim();
    if (!label) return;
    const { error } = await backend.client.from("custom_fields").insert({
      company_id: backend.company.id,
      label,
      field_type: els.fieldType.value,
      options: els.fieldOptions.value.split(",").map((option) => option.trim()).filter(Boolean),
    });
    if (error) throw error;
    els.fieldForm.reset();
    await loadLiveState();
    renderLive();
  }

  async function removeLiveField(event) {
    if (!backend.live) return;
    const button = event.target.closest("[data-field-id]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const { error } = await backend.client.from("custom_fields").delete().eq("id", button.dataset.fieldId);
    if (error) throw error;
    await loadLiveState();
    renderLive();
  }

  async function deleteLiveJob(event) {
    if (!backend.live) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const { error } = await backend.client.from("jobs").delete().eq("id", els.jobId.value);
    if (error) throw error;
    els.jobDialog.close();
    await loadLiveState();
    renderLive();
  }

  async function addLiveDocuments(event) {
    if (!backend.live || els.documentPicker.dataset.uploadedBy === "Customer") return;
    const job = selectedJob();
    const files = Array.from(els.documentPicker.files || []);
    if (!job || !files.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const docType = els.documentPicker.dataset.docType || "Other";
    let estimateVersion = docType === "Estimate" ? nextEstimateVersion(job) : null;
    const { error } = await backend.client.from("documents").insert(files.map((file) => ({
      company_id: backend.company.id,
      job_id: job.id,
      name: file.name,
      document_type: docType,
      uploaded_by: "Contractor",
      visibility: "Customer Visible",
      status: "Reviewed",
      version: docType === "Estimate" ? estimateVersion++ : null,
      size_bytes: file.size,
    })));
    els.documentPicker.value = "";
    if (error) throw error;
    await loadLiveState();
    renderLive();
  }

  function catchAsync(handler) {
    return (event) => handler(event).catch((error) => setStatus("Action failed", error.message));
  }

  authEls.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const email = authEls.email.value.trim();
    const password = authEls.password.value;
    if (!email || !password) {
      setStatus("Missing info", "Enter your contractor email and password.");
      return;
    }
    if (password.length < 6) {
      setStatus("Password too short", "Use at least 6 characters for the password.");
      return;
    }
    const mode = event.submitter?.value || "signin";
    authEls.submit.disabled = true;
    authEls.create.disabled = true;
    setStatus(mode === "signup" ? "Creating account" : "Signing in", "One moment...");
    const { data, error } = mode === "signup"
      ? await backend.client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.href.split("#")[0],
            data: {
              company_name: authEls.company.value.trim(),
              promo_code: normalizePromoCode(authEls.promoCode.value),
            },
          },
        })
      : await backend.client.auth.signInWithPassword({ email, password });
    authEls.submit.disabled = false;
    authEls.create.disabled = false;
    if (error?.message === "Invalid login credentials") {
      setStatus(
        "Sign-in failed",
        "That usually means the password is wrong, the email is not confirmed yet, or this email was used before without a password. Check your email or send a password reset.",
      );
      return;
    }
    setStatus(
      error ? "Sign-in failed" : mode === "signup" ? "Account created" : "Signed in",
      error
        ? error.message
        : mode === "signup" && !data?.session
          ? "Check your email and confirm the account. If you used this email before, send a password reset instead."
          : "Loading your workspace.",
    );
  }, true);

  authEls.forgot.addEventListener("click", async () => {
    const email = authEls.email.value.trim();
    if (!email) {
      setStatus("Email needed", "Enter your contractor email first, then click password reset.");
      return;
    }
    authEls.forgot.disabled = true;
    setStatus("Sending reset email", "Check your inbox after this finishes.");
    const { error } = await backend.client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href.split("#")[0],
    });
    authEls.forgot.disabled = false;
    setStatus(
      error ? "Reset failed" : "Reset email sent",
      error ? error.message : "Open the reset link, then choose a new password here.",
    );
  });

  authEls.recoveryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const password = authEls.recoveryPassword.value;
    if (password.length < 6) {
      setStatus("Password too short", "Use at least 6 characters for the password.");
      return;
    }
    authEls.recoverySubmit.disabled = true;
    const { error } = await backend.client.auth.updateUser({ password });
    authEls.recoverySubmit.disabled = false;
    if (error) {
      setStatus("Password update failed", error.message);
      return;
    }
    authEls.recoveryPassword.value = "";
    setStatus("Password saved", "You can sign in with the new password now.");
    authEls.form.hidden = false;
    authEls.forgot.hidden = false;
    authEls.recoveryForm.hidden = true;
  }, true);

  authEls.signOut.addEventListener("click", () => backend.client.auth.signOut());
  billingEls.promoForm.addEventListener("submit", catchAsync(async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const code = normalizePromoCode(billingEls.promoCode.value);
    const percent = promoPercentFor(code);
    if (code && !percent) {
      window.alert("That promo code is not active yet. Try 20off or 30off.");
      return;
    }
    if (backend.live) {
      const { error } = await backend.client
        .from("companies")
        .update({ promo_code: code || null, promo_percent_off: percent })
        .eq("id", backend.company.id);
      if (error) throw error;
      await loadLiveState();
    } else {
      state.settings.promoCode = code;
      state.settings.promoPercentOff = percent;
    }
    renderLive();
  }), true);
  billingEls.checkout.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.alert("Next step: connect Stripe Checkout. The app already knows the trial, price, and promo code to send to Stripe.");
  }, true);
  els.jobForm.addEventListener("submit", catchAsync(saveLiveJob), true);
  els.jobDetail.addEventListener("click", catchAsync(sendLiveMagicEmail), true);
  els.billingForm.addEventListener("submit", catchAsync(saveLiveBilling), true);
  els.fieldForm.addEventListener("submit", catchAsync(addLiveField), true);
  els.customFieldList.addEventListener("click", catchAsync(removeLiveField), true);
  els.deleteJob.addEventListener("click", catchAsync(deleteLiveJob), true);
  els.documentPicker.addEventListener("change", catchAsync(addLiveDocuments), true);

  backend.client.auth.getSession().then(({ data }) => {
    renderSubscription();
    handleSession(data.session);
  });
  backend.client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      showRecoveryMode();
      return;
    }
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") handleSession(session);
    if (event === "SIGNED_OUT") {
      backend.user = null;
      backend.company = null;
      backend.live = false;
      renderAuth();
    }
  });
  renderAuth();
})(); 
