(function () {
  const config = window.SERVICE_PORTAL_CONFIG;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey || !window.supabase?.createClient) return;

  const backend = {
    client: window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey),
    user: null,
    company: null,
    live: false,
  };

  const authEls = {
    form: document.getElementById("authForm"),
    email: document.getElementById("authEmail"),
    company: document.getElementById("authCompany"),
    submit: document.getElementById("authSubmit"),
    status: document.getElementById("authStatus"),
    backendStatus: document.getElementById("backendStatus"),
    signOut: document.getElementById("signOut"),
  };

  function setStatus(title, detail) {
    authEls.status.textContent = title;
    authEls.backendStatus.textContent = detail;
  }

  function renderAuth() {
    if (backend.live) {
      setStatus(backend.company?.name || "Live workspace", `Signed in as ${backend.user.email}. Jobs are syncing to Supabase.`);
      authEls.form.hidden = true;
      authEls.signOut.hidden = false;
      return;
    }
    setStatus("Sign in for live beta", "Enter your contractor email. Supabase will email you a sign-in link.");
    authEls.form.hidden = false;
    authEls.signOut.hidden = true;
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
    const { data, error } = await backend.client.rpc("bootstrap_company", { company_name: companyName });
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
      render();
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
    render();
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
    render();
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
    render();
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
    render();
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
    render();
  }

  async function deleteLiveJob(event) {
    if (!backend.live) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const { error } = await backend.client.from("jobs").delete().eq("id", els.jobId.value);
    if (error) throw error;
    els.jobDialog.close();
    await loadLiveState();
    render();
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
    render();
  }

  function catchAsync(handler) {
    return (event) => handler(event).catch((error) => setStatus("Action failed", error.message));
  }

  authEls.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = authEls.email.value.trim();
    if (!email) return;
    authEls.submit.disabled = true;
    setStatus("Sending sign-in email", "Check your inbox after this finishes.");
    const { error } = await backend.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href.split("#")[0] },
    });
    authEls.submit.disabled = false;
    setStatus(error ? "Sign-in failed" : "Check your email", error ? error.message : "Open the Supabase sign-in link to activate live beta mode.");
  });

  authEls.signOut.addEventListener("click", () => backend.client.auth.signOut());
  els.jobForm.addEventListener("submit", catchAsync(saveLiveJob), true);
  els.jobDetail.addEventListener("click", catchAsync(sendLiveMagicEmail), true);
  els.billingForm.addEventListener("submit", catchAsync(saveLiveBilling), true);
  els.fieldForm.addEventListener("submit", catchAsync(addLiveField), true);
  els.customFieldList.addEventListener("click", catchAsync(removeLiveField), true);
  els.deleteJob.addEventListener("click", catchAsync(deleteLiveJob), true);
  els.documentPicker.addEventListener("change", catchAsync(addLiveDocuments), true);

  backend.client.auth.getSession().then(({ data }) => handleSession(data.session));
  backend.client.auth.onAuthStateChange((event, session) => {
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
