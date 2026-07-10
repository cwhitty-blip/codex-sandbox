(function () {
  const DOCUMENT_BUCKET = "job-documents";
  const config = window.SERVICE_PORTAL_CONFIG;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey || !window.supabase?.createClient) return;
  if (new URLSearchParams(window.location.search).get("portal")) return;

  const backend = {
    client: window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
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
  let resetCooldownUntil = 0;
  let recoveryActive = false;

  function isRecoveryUrl() {
    return /type=recovery|password_recovery/i.test(`${window.location.search}${window.location.hash}`);
  }

  function hasAuthCode() {
    return /[?&#]code=|[?&#]access_token=/i.test(`${window.location.search}${window.location.hash}`);
  }

  function ensureAuthSupportUi() {
    if (!document.getElementById("forgotPassword")) {
      const forgot = document.createElement("button");
      forgot.id = "forgotPassword";
      forgot.className = "text-button";
      forgot.type = "button";
      forgot.textContent = "Send password reset email";
      document.getElementById("authForm").after(forgot);
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
    panel: document.getElementById("authPanel"),
    form: document.getElementById("authForm"),
    email: document.getElementById("authEmail"),
    password: document.getElementById("authPassword"),
    company: document.getElementById("authCompany"),
    promoCode: document.getElementById("authPromoCode"),
    submit: document.getElementById("authSubmit"),
    create: document.getElementById("authCreate"),
    forgot: document.getElementById("forgotPassword"),
    recoveryForm: null,
    recoveryPassword: null,
    recoverySubmit: null,
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

  function publicError(error, fallback = "Could not complete. Please try again.") {
    const message = String(error?.message || error || "");
    if (/already|exists|registered/i.test(message)) return "That email may already have an account.";
    if (/invalid login|credentials/i.test(message)) return "Email or password did not match.";
    if (/rate limit/i.test(message)) return "Too many attempts. Please wait a few minutes and try again.";
    if (/network|fetch/i.test(message)) return "Connection issue. Please try again.";
    return fallback;
  }

  function renderAuth() {
    if (recoveryActive) {
      authEls.panel.hidden = false;
      showRecoveryMode();
      return;
    }
    if (backend.live) {
      document.body.classList.add("service-portal-signed-in");
      setStatus(backend.company?.name || "Live workspace", `Signed in as ${backend.user.email}. Jobs are syncing.`);
      authEls.panel.hidden = true;
      authEls.form.hidden = true;
      authEls.forgot.hidden = true;
      if (authEls.recoveryForm) authEls.recoveryForm.hidden = true;
      authEls.signOut.hidden = true;
      return;
    }
    authEls.panel.hidden = false;
    document.body.classList.remove("service-portal-signed-in");
    setStatus("Contractor sign in", "Create an account for the private beta, or sign in with your contractor password.");
    authEls.form.hidden = false;
    authEls.forgot.hidden = false;
    if (authEls.recoveryForm) authEls.recoveryForm.hidden = true;
    authEls.signOut.hidden = true;
  }

  function showRecoveryMode() {
    recoveryActive = true;
    window.SERVICE_PORTAL_RECOVERY_MODE = true;
    ensureRecoveryForm();
    authEls.panel.hidden = false;
    setStatus("Choose a new password", "Enter a new contractor password, then sign in normally.");
    authEls.form.hidden = true;
    authEls.forgot.hidden = true;
    authEls.recoveryForm.hidden = false;
    authEls.signOut.hidden = true;
    window.setTimeout(() => {
      if (!recoveryActive) return;
      setStatus("Choose a new password", "Enter a new contractor password, then sign in normally.");
      authEls.form.hidden = true;
      authEls.forgot.hidden = true;
      authEls.recoveryForm.hidden = false;
      authEls.signOut.hidden = true;
    }, 250);
  }

  function ensureRecoveryForm() {
    if (authEls.recoveryForm) return;
    const recovery = document.createElement("form");
    recovery.id = "recoveryForm";
    recovery.className = "auth-form";
    recovery.hidden = true;
    recovery.innerHTML = `
      <input id="recoveryPassword" type="password" placeholder="New password" autocomplete="new-password" />
      <button id="recoverySubmit" class="primary-button" type="submit">Save new password</button>
    `;
    authEls.forgot.after(recovery);
    authEls.recoveryForm = recovery;
    authEls.recoveryPassword = document.getElementById("recoveryPassword");
    authEls.recoverySubmit = document.getElementById("recoverySubmit");
    authEls.recoveryForm.addEventListener("submit", saveRecoveryPassword, true);
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
    billingEls.status.textContent = "Beta";
    billingEls.promoCode.value = state.settings.promoCode || "";
    billingEls.summary.innerHTML = `
      <span>
        <strong>Free private beta</strong>
        <small>No payment is collected in this version.</small>
      </span>
      <small>Stripe billing, trials, and promo codes should be connected after the customer portal is fully operational.</small>
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
      storagePath: doc.storage_file_id || "",
      previewUrl: doc.storage_url || doc.preview_url || "",
      stored: Boolean(doc.storage_file_id || doc.storage_url || doc.preview_url),
    };
  }

  function mapDbJob(job) {
    const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
    const latestDecision = [...(job.estimate_acceptances || [])]
      .sort((a, b) => new Date(b.decided_at || b.accepted_at || 0) - new Date(a.decided_at || a.accepted_at || 0))[0];
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
      timeline: ["Loaded from workspace"],
      estimateAcceptedAt: latestDecision?.decision_status === "accept" ? latestDecision.accepted_at : null,
      acceptedEstimate: latestDecision?.decision_status === "accept" ? {
        id: latestDecision.document_id,
        name: "",
        version: 1,
        acceptedAt: latestDecision.accepted_at,
      } : null,
      estimateDecision: latestDecision && latestDecision.decision_status !== "accept" ? {
        documentId: latestDecision.document_id,
        name: "",
        version: 1,
        status: latestDecision.decision_status,
        notes: latestDecision.notes || "",
        decidedAt: latestDecision.decided_at || latestDecision.accepted_at,
      } : null,
      viewedEstimateId: null,
      magicLinkLastSent: null,
    };
  }

  async function ensureCompany() {
    const companyName = authEls.company?.value.trim() || "Service Company";
    let { data, error } = await backend.client.rpc("bootstrap_company", {
      company_name: companyName,
      promo_code: null,
    });
    if (error && /bootstrap_company|schema cache|function/i.test(error.message || "")) {
      ({ data, error } = await backend.client.rpc("bootstrap_company", {
        company_name: companyName,
      }));
    }
    if (error) throw error;
    backend.company = Array.isArray(data) ? data[0] : data;
  }

  async function loadLiveState() {
    const companyId = backend.company.id;
    const [companyResult, fieldsResult, jobsResult] = await Promise.all([
      backend.client.from("companies").select("*").eq("id", companyId).single(),
      backend.client.from("custom_fields").select("*").eq("company_id", companyId).order("created_at"),
      backend.client.from("jobs").select("*, customers(*), documents(*), estimate_acceptances(*)").eq("company_id", companyId).order("created_at", { ascending: false }),
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
    await hydrateDocumentUrls();
    selectedJobId = state.jobs[0]?.id || null;
    state.portalAccess.jobId = selectedJobId;
  }

  async function hydrateDocumentUrls() {
    const documents = state.jobs.flatMap((job) => job.documents || []).filter((doc) => doc.storagePath);
    await Promise.all(documents.map(async (doc) => {
      const { data, error } = await backend.client.storage.from(DOCUMENT_BUCKET).createSignedUrl(doc.storagePath, 60 * 60);
      if (!error && data?.signedUrl) {
        doc.previewUrl = data.signedUrl;
        doc.stored = true;
      }
    }));
  }

  async function handleSession(session) {
    backend.user = session?.user || null;
    backend.live = false;
    if (!backend.user) {
      document.body.classList.remove("service-portal-signed-in");
      renderAuth();
      return;
    }
    try {
      setStatus("Connecting", "Loading your workspace...");
      await ensureCompany();
      await loadLiveState();
      backend.live = true;
      document.body.classList.add("service-portal-signed-in");
      renderAuth();
      renderLive();
    } catch (error) {
      console.warn("Live workspace setup failed.", error);
      backend.company = null;
      backend.live = false;
      document.body.classList.remove("service-portal-signed-in");
      authEls.panel.hidden = false;
      authEls.form.hidden = false;
      authEls.forgot.hidden = true;
      authEls.signOut.hidden = true;
      setStatus("Setup needed", "Could not load the workspace. Please try again.");
      renderAuth();
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
      industry: "general",
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
    if (error) {
      console.warn("Magic email failed", error);
      job.timeline.push("Customer email could not be sent");
    } else {
      job.timeline.push(`Magic email sent to ${job.customerEmail}`);
    }
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

  function safeStorageName(name) {
    return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
  }

  function isDuplicateDocument(job, file, uploadedBy, docType) {
    return (job.documents || []).some((doc) =>
      doc.status !== "Archived"
      && doc.name === file.name
      && Number(doc.size || 0) === Number(file.size || 0)
      && doc.type === docType
      && doc.uploadedBy === uploadedBy
    );
  }

  async function uploadLiveDocumentFile(job, file) {
    const storagePath = `${backend.company.id}/${job.id}/${crypto.randomUUID()}-${safeStorageName(file.name)}`;
    const { error } = await backend.client.storage.from(DOCUMENT_BUCKET).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw error;
    const { data } = await backend.client.storage.from(DOCUMENT_BUCKET).createSignedUrl(storagePath, 60 * 60);
    return { storagePath, previewUrl: data?.signedUrl || "" };
  }

  async function addLiveDocuments(event) {
    if (!backend.live) return;
    const uploadedBy = els.documentPicker.dataset.uploadedBy || "Contractor";
    const job = uploadedBy === "Customer" ? customerJob() : selectedJob();
    const files = Array.from(els.documentPicker.files || []);
    if (!job || !files.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const docType = els.documentPicker.dataset.docType || "Other";
    const uniqueFiles = files.filter((file) => !isDuplicateDocument(job, file, uploadedBy, docType));
    if (!uniqueFiles.length) {
      els.documentPicker.value = "";
      setStatus("Duplicate skipped", "That file is already uploaded for this job.");
      return;
    }
    let estimateVersion = docType === "Estimate" ? nextEstimateVersion(job) : null;
    const uploadedFiles = await Promise.all(uniqueFiles.map((file) => uploadLiveDocumentFile(job, file)));
    const { error } = await backend.client.from("documents").insert(uniqueFiles.map((file, index) => ({
      company_id: backend.company.id,
      job_id: job.id,
      name: file.name,
      document_type: docType,
      uploaded_by: uploadedBy,
      visibility: uploadedBy === "Customer" ? "Staff Only" : "Customer Visible",
      status: uploadedBy === "Customer" ? "New" : "Reviewed",
      storage_provider: "supabase",
      storage_file_id: uploadedFiles[index].storagePath,
      storage_url: null,
      version: docType === "Estimate" ? estimateVersion++ : null,
      size_bytes: file.size,
    })));
    els.documentPicker.value = "";
    if (error) throw error;
    await loadLiveState();
    renderLive();
  }

  function catchAsync(handler) {
    return (event) => handler(event).catch((error) => setStatus("Could not complete", publicError(error)));
  }

  function showSignInMode() {
    authEls.submit.disabled = false;
    authEls.create.disabled = false;
    authEls.form.hidden = false;
    authEls.forgot.hidden = false;
    if (authEls.recoveryForm) authEls.recoveryForm.hidden = true;
  }

  function withTimeout(promise, ms = 6000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  }

  async function sendPasswordSetupEmail(email) {
    return backend.client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href.split("#")[0],
    });
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
    showSignInMode();
    setStatus(mode === "signup" ? "Creating account" : "Signing in", "One moment...");
    try {
      const { data, error } = mode === "signup"
        ? await withTimeout(backend.client.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: window.location.href.split("#")[0],
            },
          }))
        : await withTimeout(backend.client.auth.signInWithPassword({ email, password }));
      if (error?.message === "Invalid login credentials") {
        setStatus(
          "Sign-in failed",
          "Email or password did not match.",
        );
        return;
      }
      if (!error && mode === "signup" && !data?.session) {
        setStatus(
          "Account created",
          "Check your email if account confirmation is requested, then sign in.",
        );
        return;
      }
      setStatus(
        error ? "Sign-in failed" : mode === "signup" ? "Account created" : "Signed in",
        error ? publicError(error, "Could not complete sign in.") : "Loading your workspace.",
      );
    } catch (error) {
      setStatus("Could not complete", publicError(error));
    } finally {
      showSignInMode();
    }
  }, true);

  authEls.submit.addEventListener("click", () => {
    showSignInMode();
    setStatus("Contractor sign in", "Enter your contractor email and password.");
  }, true);

  authEls.forgot.addEventListener("click", async () => {
    const email = authEls.email.value.trim();
    if (!email) {
      setStatus("Email needed", "Enter your contractor email first, then click password reset.");
      return;
    }
    const secondsLeft = Math.ceil((resetCooldownUntil - Date.now()) / 1000);
    if (secondsLeft > 0) {
      setStatus("Reset already sent", `Please wait about ${secondsLeft} seconds before trying again.`);
      return;
    }
    resetCooldownUntil = Date.now() + 60_000;
    authEls.forgot.disabled = true;
    setStatus("Sending reset email", "Check your inbox after this finishes.");
    try {
      const { error } = await withTimeout(sendPasswordSetupEmail(email));
      if (!error) {
        window.localStorage.setItem("servicePortalPasswordResetPending", "true");
      }
      setStatus(
        error ? "Reset failed" : "Reset email sent",
        error ? publicError(error, "Could not send reset email.") : "Open the reset link in your email.",
      );
    } catch (error) {
      setStatus("Reset failed", publicError(error, "Could not send reset email."));
    } finally {
      window.setTimeout(() => {
        authEls.forgot.disabled = false;
      }, Math.max(0, resetCooldownUntil - Date.now()));
    }
  });

  async function saveRecoveryPassword(event) {
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
      setStatus("Password update failed", publicError(error, "Could not save password."));
      return;
    }
    authEls.recoveryPassword.value = "";
    setStatus("Password saved", "You can sign in with the new password now.");
    recoveryActive = false;
    window.SERVICE_PORTAL_RECOVERY_MODE = false;
    window.localStorage.removeItem("servicePortalPasswordResetPending");
    window.history.replaceState({}, document.title, window.location.pathname);
    backend.live = false;
    authEls.form.hidden = false;
    authEls.forgot.hidden = false;
    authEls.recoveryForm.hidden = true;
  }

  authEls.signOut.addEventListener("click", () => backend.client.auth.signOut());
  billingEls.promoForm.addEventListener("submit", catchAsync(async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const code = normalizePromoCode(billingEls.promoCode.value);
    const percent = promoPercentFor(code);
    if (code && !percent) {
      window.alert("That promo code is not active yet.");
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
    window.alert("Billing is off for the private beta. Add Stripe checkout after the customer portal is fully operational.");
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
    if (isRecoveryUrl() || (hasAuthCode() && window.localStorage.getItem("servicePortalPasswordResetPending") === "true")) {
      showRecoveryMode();
      return;
    }
    window.localStorage.removeItem("servicePortalPasswordResetPending");
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
      document.body.classList.remove("service-portal-signed-in");
      renderAuth();
    }
  });
  renderAuth();
})(); 
