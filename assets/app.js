const STORAGE_KEY = "serviceJobPortal.v1";
const DOCUMENT_BUCKET = "job-documents";
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const billingProviders = [
  "QuickBooks Online",
  "Stripe",
  "Wave",
  "JobNimbus",
  "Square",
  "Housecall Pro",
  "ServiceTitan",
  "Other",
];

const jobStatuses = ["Active", "Waiting on Customer", "Ready to Schedule", "Scheduled", "In Progress", "Complete", "On Hold"];
const materialStatuses = ["Not Ordered", "Ordered", "In Transit", "Arrived", "Not Required"];
const monthlyPlanCents = 1299;
const trialDays = 7;
const promoCodes = {
  "20off": 20,
  "30off": 30,
};

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const demoState = {
  settings: {
    billingProvider: "QuickBooks Online",
    billingAccount: "Demo Service Co.",
    billingSync: "Invoices and payment status",
    billingConnected: true,
    subscriptionStatus: "trialing",
    trialStartedAt: "2026-07-09T00:00:00.000Z",
    trialEndsAt: "2026-07-16T00:00:00.000Z",
    planPriceCents: monthlyPlanCents,
    promoCode: "",
    promoPercentOff: 0,
    customFields: [
      { id: createId(), label: "Claim number", type: "text", options: [] },
      { id: createId(), label: "Gate code", type: "text", options: [] },
      { id: createId(), label: "Permit required", type: "select", options: ["Yes", "No", "Unknown"] },
    ],
  },
  portalAccess: {
    token: "demo-garcia-access",
    jobId: null,
    channel: "email",
    lastSentTo: "elena.garcia@example.com",
    createdAt: "2026-07-03T17:20:00.000Z",
  },
  jobs: [
    {
      id: createId(),
      industry: "general",
      name: "Garcia service project",
      customerName: "Elena Garcia",
      customerEmail: "elena.garcia@example.com",
      customerPhone: "555-0174",
      serviceAddress: "4822 Redbud Lane, Tulsa, OK",
      jobStatus: "Waiting on Customer",
      materialStatus: "Ordered",
      projectedDate: "2026-07-18",
      invoiceUrl: "https://pay.example.com/invoice/garcia",
      nextAction: "Customer needs to upload insurance claim letter.",
      internalNotes: "Adjuster approved roof, gutters still pending.",
      customValues: { "Claim number": "CLM-10492", "Gate code": "2418", "Permit required": "Yes" },
      documents: [
        {
          id: createId(),
          name: "initial-estimate.pdf",
          type: "Estimate",
          uploadedBy: "Contractor",
          visibility: "Customer Visible",
          status: "Reviewed",
          createdAt: "2026-07-02T15:00:00.000Z",
          version: 1,
          size: 428000,
          stored: false,
        },
      ],
      timeline: [
        "Job started",
        "Customer access email sent",
        "Estimate shared with customer",
      ],
      estimateAcceptedAt: null,
      acceptedEstimate: null,
      estimateDecision: null,
      viewedEstimateId: null,
      magicLinkLastSent: "2026-07-03T17:20:00.000Z",
    },
    {
      id: createId(),
      industry: "general",
      name: "Miller service project",
      customerName: "Jordan Miller",
      customerEmail: "jordan.miller@example.com",
      customerPhone: "555-0190",
      serviceAddress: "77 Meadow Court, Bentonville, AR",
      jobStatus: "Scheduled",
      materialStatus: "Arrived",
      projectedDate: "2026-07-09",
      invoiceUrl: "",
      nextAction: "Crew scheduled for Thursday morning.",
      internalNotes: "Customer requested shoe covers and driveway parking.",
      customValues: { "Claim number": "", "Gate code": "", "Permit required": "No" },
      documents: [],
      timeline: ["Job started", "Equipment arrived", "Service date scheduled"],
      estimateAcceptedAt: null,
      acceptedEstimate: null,
      estimateDecision: null,
      viewedEstimateId: null,
      magicLinkLastSent: null,
    },
  ],
};

let state = backendConfigured()
  ? normalizeState({ settings: { customFields: [] }, portalAccess: {}, jobs: [] })
  : loadState();
let selectedJobId = state.jobs[0]?.id || null;
const archivedDocumentJobs = new Set();
if (!state.portalAccess.jobId && selectedJobId) {
  state.portalAccess.jobId = selectedJobId;
}

const backend = {
  client: null,
  session: null,
  user: null,
  company: null,
  live: false,
  loading: false,
  authMode: "signin",
  authBusy: false,
  authFeedback: null,
  recovery: false,
};

const portalMode = {
  active: false,
  token: "",
};

let toastTimer = null;

const els = {
  tabs: document.querySelectorAll(".nav-tab"),
  settingsGear: document.querySelector(".settings-gear"),
  views: {
    dashboard: document.getElementById("dashboardView"),
    customer: document.getElementById("customerView"),
    settings: document.getElementById("settingsView"),
  },
  viewTitle: document.getElementById("viewTitle"),
  activeJobCount: document.getElementById("activeJobCount"),
  billingProviderSummary: document.getElementById("billingProviderSummary"),
  resetDemo: document.getElementById("resetDemo"),
  startJob: document.getElementById("startJob"),
  quickStartJob: document.getElementById("quickStartJob"),
  quickUpdateJob: document.getElementById("quickUpdateJob"),
  jobList: document.getElementById("jobList"),
  detailTitle: document.getElementById("detailTitle"),
  detailStatus: document.getElementById("detailStatus"),
  jobDetail: document.getElementById("jobDetail"),
  customerAccessSummary: document.getElementById("customerAccessSummary"),
  customerJobList: document.getElementById("customerJobList"),
  customerPortal: document.getElementById("customerPortal"),
  billingStatus: document.getElementById("billingStatus"),
  billingForm: document.getElementById("billingForm"),
  billingProvider: document.getElementById("billingProvider"),
  billingAccount: document.getElementById("billingAccount"),
  billingSync: document.getElementById("billingSync"),
  fieldForm: document.getElementById("fieldForm"),
  fieldLabel: document.getElementById("fieldLabel"),
  fieldType: document.getElementById("fieldType"),
  fieldOptions: document.getElementById("fieldOptions"),
  fieldCount: document.getElementById("fieldCount"),
  customFieldList: document.getElementById("customFieldList"),
  jobDialog: document.getElementById("jobDialog"),
  jobForm: document.getElementById("jobForm"),
  jobDialogMode: document.getElementById("jobDialogMode"),
  jobDialogTitle: document.getElementById("jobDialogTitle"),
  jobId: document.getElementById("jobId"),
  jobName: document.getElementById("jobName"),
  customerName: document.getElementById("customerName"),
  customerEmail: document.getElementById("customerEmail"),
  customerPhone: document.getElementById("customerPhone"),
  serviceAddress: document.getElementById("serviceAddress"),
  jobStatus: document.getElementById("jobStatus"),
  materialStatus: document.getElementById("materialStatus"),
  projectedDate: document.getElementById("projectedDate"),
  invoiceUrl: document.getElementById("invoiceUrl"),
  customFieldInputs: document.getElementById("customFieldInputs"),
  nextAction: document.getElementById("nextAction"),
  internalNotes: document.getElementById("internalNotes"),
  deleteJob: document.getElementById("deleteJob"),
  closeJobDialog: document.getElementById("closeJobDialog"),
  cancelJobDialog: document.getElementById("cancelJobDialog"),
  estimateChangesDialog: document.getElementById("estimateChangesDialog"),
  estimateChangesForm: document.getElementById("estimateChangesForm"),
  estimateChangesDocId: document.getElementById("estimateChangesDocId"),
  estimateChangesText: document.getElementById("estimateChangesText"),
  closeEstimateChangesDialog: document.getElementById("closeEstimateChangesDialog"),
  cancelEstimateChangesDialog: document.getElementById("cancelEstimateChangesDialog"),
  documentPicker: document.getElementById("documentPicker"),
  authPanel: document.getElementById("authPanel"),
  authForm: document.getElementById("authForm"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authCompany: document.getElementById("authCompany"),
  authPromoCode: document.getElementById("authPromoCode"),
  authSubmit: document.getElementById("authSubmit"),
  authCreate: document.getElementById("authCreate"),
  authStatus: document.getElementById("authStatus"),
  backendStatus: document.getElementById("backendStatus"),
  forgotPassword: document.getElementById("forgotPassword"),
  recoveryForm: document.getElementById("recoveryForm"),
  recoveryPassword: document.getElementById("recoveryPassword"),
  recoverySubmit: document.getElementById("recoverySubmit"),
  signOut: document.getElementById("signOut"),
  workspaceForm: document.getElementById("workspaceForm"),
  workspaceName: document.getElementById("workspaceName"),
  workspaceEmail: document.getElementById("workspaceEmail"),
  workspaceStatus: document.getElementById("workspaceStatus"),
  subscriptionStatus: document.getElementById("subscriptionStatus"),
  subscriptionSummary: document.getElementById("subscriptionSummary"),
  promoForm: document.getElementById("promoForm"),
  promoCode: document.getElementById("promoCode"),
  checkoutButton: document.getElementById("checkoutButton"),
  toastRegion: document.getElementById("toastRegion"),
};

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return normalizeState(structuredClone(demoState));
  try {
    return normalizeState(JSON.parse(stored));
  } catch {
    return normalizeState(structuredClone(demoState));
  }
}

function normalizeState(nextState) {
  nextState.settings = { ...structuredClone(demoState.settings), ...(nextState.settings || {}) };
  nextState.portalAccess = { ...structuredClone(demoState.portalAccess), ...(nextState.portalAccess || {}) };
  nextState.settings.customFields = Array.isArray(nextState.settings.customFields) ? nextState.settings.customFields : [];
  nextState.jobs = Array.isArray(nextState.jobs) ? nextState.jobs : [];
  nextState.jobs.forEach((job) => {
    job.documents = Array.isArray(job.documents) ? job.documents : [];
    job.documents.forEach((doc, index) => {
      doc.version = doc.version || (doc.type === "Estimate" ? index + 1 : null);
      doc.size = doc.size || null;
      doc.stored = Boolean(doc.stored);
    });
    job.timeline = Array.isArray(job.timeline) ? job.timeline : ["Job started"];
    job.customValues = job.customValues || {};
    job.estimateAcceptedAt = job.estimateAcceptedAt || null;
    job.acceptedEstimate = job.acceptedEstimate || null;
    job.estimateDecision = job.estimateDecision || null;
    job.viewedEstimateId = job.viewedEstimateId || null;
    job.magicLinkLastSent = job.magicLinkLastSent || null;
    const acceptedFallback = estimateFor(job);
    if (job.estimateAcceptedAt && !job.acceptedEstimate && acceptedFallback) {
      job.acceptedEstimate = {
        id: acceptedFallback.id,
        name: acceptedFallback.name,
        version: acceptedFallback.version || 1,
        acceptedAt: job.estimateAcceptedAt,
      };
    }
  });
  if (!nextState.jobs.some((job) => job.id === nextState.portalAccess.jobId)) {
    nextState.portalAccess.jobId = nextState.jobs[0]?.id || null;
  }
  return nextState;
}

function saveState() {
  if (backend?.live || portalMode.active) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function backendConfigured() {
  if (localDemoMode()) return false;
  const config = window.SERVICE_PORTAL_CONFIG;
  return Boolean(config?.supabaseUrl && config?.supabasePublishableKey && window.supabase?.createClient);
}

function localDemoMode() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).has("demo");
}

function localAuthPreviewMode() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).has("authPreview");
}

function publicError(error, fallback = "Could not complete. Please try again.") {
  const message = String(error?.message || error || "");
  if (/already|exists|registered/i.test(message)) return "That email may already have an account.";
  if (/invalid login|credentials/i.test(message)) return "Email or password did not match.";
  if (/rate limit/i.test(message)) return "Too many attempts. Please wait a few minutes and try again.";
  if (/network|fetch|timeout/i.test(message)) return "Connection issue. Please try again.";
  return fallback;
}

function isRecoveryRequest() {
  const locationText = `${window.location.search}${window.location.hash}`;
  const hasAuthCode = new URLSearchParams(window.location.search).has("code");
  return /type=recovery|password_recovery/i.test(locationText)
    || (hasAuthCode && window.localStorage.getItem("servicePortalPasswordResetPending") === "true");
}

function setContractorLock(locked) {
  document.body.classList.toggle("contractor-locked", locked && !portalMode.active);
}

function renderAuth() {
  queueMicrotask(refreshIcons);
  if (portalMode.active) {
    document.body.classList.add("customer-portal-mode");
    setContractorLock(false);
    els.authPanel.hidden = true;
    els.authForm.hidden = true;
    els.signOut.hidden = true;
    return;
  }

  if (localDemoMode()) {
    document.body.classList.add("service-portal-signed-in");
    setContractorLock(false);
    els.authPanel.hidden = true;
    els.authForm.hidden = true;
    els.signOut.hidden = true;
    return;
  }

  if (!backendConfigured()) {
    setContractorLock(false);
    els.authStatus.textContent = "Account setup";
    els.backendStatus.textContent = "Account services are not available for this build.";
    els.authForm.hidden = true;
    els.signOut.hidden = true;
    return;
  }

  if (backend.loading) {
    setContractorLock(true);
    els.authStatus.textContent = "Connecting";
    els.backendStatus.textContent = "Checking your session...";
    els.authForm.hidden = true;
    els.signOut.hidden = true;
    return;
  }

  if (backend.live) {
    setContractorLock(false);
    document.body.classList.add("service-portal-signed-in");
    els.authStatus.textContent = backend.company?.name || "Live workspace";
    els.backendStatus.textContent = `Signed in as ${backend.user.email}. Jobs are syncing.`;
    els.authPanel.hidden = true;
    els.authForm.hidden = true;
    els.signOut.hidden = true;
    return;
  }

  setContractorLock(true);
  els.authPanel.hidden = false;
  document.body.classList.remove("service-portal-signed-in");
  els.authForm.hidden = backend.recovery;
  els.recoveryForm.hidden = !backend.recovery;
  els.forgotPassword.hidden = backend.recovery || backend.authMode === "signup";
  els.authSubmit.disabled = backend.authBusy;
  els.authCreate.disabled = backend.authBusy;
  els.recoverySubmit.disabled = backend.authBusy;
  if (backend.recovery) {
    els.authStatus.textContent = "Choose a new password";
    els.backendStatus.textContent = "Enter a new password for your contractor account.";
  } else if (backend.authMode === "signup") {
    els.authStatus.textContent = "Create contractor account";
    els.backendStatus.textContent = "Enter your email and choose a password.";
    setButtonLabel(els.authSubmit, "user-plus", "Create account");
    els.authSubmit.value = "signup";
    setButtonLabel(els.authCreate, "arrow-left", "Back to sign in");
    els.authPassword.autocomplete = "new-password";
  } else {
    els.authStatus.textContent = "Contractor sign in";
    els.backendStatus.textContent = "Enter your contractor email and password.";
    setButtonLabel(els.authSubmit, "log-in", "Sign in");
    els.authSubmit.value = "signin";
    setButtonLabel(els.authCreate, "user-plus", "Create account");
    els.authPassword.autocomplete = "current-password";
  }
  if (backend.authFeedback) {
    els.authStatus.textContent = backend.authFeedback.title;
    els.backendStatus.textContent = backend.authFeedback.message;
  }
  els.signOut.hidden = true;
}

async function initBackend() {
  if (localAuthPreviewMode()) {
    backend.loading = false;
    backend.live = false;
    backend.user = null;
    backend.company = null;
    renderAuth();
    return;
  }
  if (localDemoMode() && new URLSearchParams(window.location.search).has("portalPreview")) {
    portalMode.active = true;
    portalMode.token = "local-preview";
    activateCustomerPortalView();
    render();
    return;
  }
  if (!backendConfigured()) {
    renderAuth();
    return;
  }

  const config = window.SERVICE_PORTAL_CONFIG;
  backend.client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  backend.loading = true;
  backend.recovery = isRecoveryRequest();
  renderAuth();

  const portalToken = portalTokenFromUrl();
  if (portalToken) {
    backend.loading = false;
    await loadCustomerPortal(portalToken);
    return;
  }

  const { data } = await backend.client.auth.getSession();
  if (backend.recovery) {
    backend.session = data.session || null;
    backend.user = data.session?.user || null;
    backend.loading = false;
    renderAuth();
  } else {
    await handleSession(data.session);
  }
  backend.client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      backend.recovery = true;
      backend.session = session || null;
      backend.user = session?.user || null;
      backend.loading = false;
      renderAuth();
      return;
    }
    if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && !backend.recovery && !backend.authBusy) {
      handleSession(session);
    }
    if (event === "SIGNED_OUT") {
      backend.session = null;
      backend.user = null;
      backend.company = null;
      backend.live = false;
      backend.authFeedback = null;
      localStorage.removeItem(STORAGE_KEY);
      document.body.classList.remove("service-portal-signed-in");
      renderAuth();
      render();
    }
  });
}

async function performAuth(mode = backend.authMode) {
  if (!backend.client || backend.authBusy) return;
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) {
    els.backendStatus.textContent = "Enter your email and password.";
    return;
  }
  if (password.length < 6) {
    els.backendStatus.textContent = "Use at least 6 characters for the password.";
    return;
  }

  backend.authFeedback = null;
  backend.authBusy = true;
  renderAuth();
  els.backendStatus.textContent = mode === "signup" ? "Creating your account..." : "Signing in...";
  const result = mode === "signup"
    ? await backend.client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.SERVICE_PORTAL_CONFIG?.appBaseUrl || window.location.origin,
        },
      })
    : await backend.client.auth.signInWithPassword({ email, password });
  backend.authBusy = false;

  if (result.error) {
    backend.authFeedback = {
      title: mode === "signup" ? "Could not create account" : "Could not complete sign in",
      message: publicError(
        result.error,
        mode === "signup" ? "Could not create the account." : "Could not complete sign in.",
      ),
    };
    renderAuth();
    return;
  }

  if (mode === "signup" && !result.data.session) {
    backend.authMode = "signin";
    backend.authFeedback = {
      title: "Account created",
      message: "Check your email once to confirm it, then sign in.",
    };
    renderAuth();
    return;
  }

  await handleSession(result.data.session);
}

async function sendPasswordReset() {
  if (!backend.client || backend.authBusy) return;
  const email = els.authEmail.value.trim();
  if (!email) {
    els.backendStatus.textContent = "Enter your contractor email first.";
    return;
  }
  backend.authFeedback = null;
  backend.authBusy = true;
  renderAuth();
  els.backendStatus.textContent = "Sending password reset email...";
  const redirectTo = window.SERVICE_PORTAL_CONFIG?.appBaseUrl || window.location.href.split("#")[0];
  const { error } = await backend.client.auth.resetPasswordForEmail(email, { redirectTo });
  backend.authBusy = false;
  if (!error) window.localStorage.setItem("servicePortalPasswordResetPending", "true");
  backend.authFeedback = {
    title: error ? "Reset failed" : "Reset email sent",
    message: error
      ? publicError(error, "Could not send the reset email.")
      : "Open the link in that email to choose a new password.",
  };
  renderAuth();
}

async function saveRecoveryPassword() {
  if (!backend.client || backend.authBusy) return;
  const password = els.recoveryPassword.value;
  if (password.length < 6) {
    els.backendStatus.textContent = "Use at least 6 characters for the password.";
    return;
  }
  backend.authBusy = true;
  renderAuth();
  els.backendStatus.textContent = "Saving your new password...";
  const { error } = await backend.client.auth.updateUser({ password });
  backend.authBusy = false;
  if (error) {
    renderAuth();
    els.backendStatus.textContent = publicError(error, "Could not save the new password.");
    return;
  }
  backend.recovery = false;
  window.localStorage.removeItem("servicePortalPasswordResetPending");
  window.history.replaceState({}, document.title, window.location.pathname);
  els.recoveryPassword.value = "";
  await handleSession(backend.session);
}

async function handleSession(session) {
  backend.session = session || null;
  backend.user = session?.user || null;
  backend.live = false;
  if (!backend.user) {
    backend.loading = false;
    localStorage.removeItem(STORAGE_KEY);
    document.body.classList.remove("service-portal-signed-in");
    renderAuth();
    return;
  }

  try {
    await ensureCompany();
    await loadLiveState();
    backend.live = true;
    backend.authFeedback = null;
    localStorage.removeItem(STORAGE_KEY);
    document.body.classList.add("service-portal-signed-in");
  } catch (error) {
    console.warn("Live workspace setup failed.", error);
    backend.company = null;
    backend.live = false;
    backend.authFeedback = {
      title: "Could not complete sign in",
      message: "Could not finish setting up the workspace. Please try again.",
    };
    document.body.classList.remove("service-portal-signed-in");
  } finally {
    backend.loading = false;
    renderAuth();
    render();
  }
}

async function ensureCompany() {
  const companyName = els.authCompany.value.trim() || "Service Company";
  const { data, error } = await backend.client.rpc("bootstrap_company", {
    company_name: companyName,
    promo_code: normalizePromoCode(els.authPromoCode.value),
  });
  if (error) throw error;
  backend.company = Array.isArray(data) ? data[0] : data;
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
    stored: Boolean(doc.storage_file_id || doc.storage_url),
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
    timeline: [],
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

async function loadLiveState() {
  const previousSelectedJobId = selectedJobId;
  const previousPortalJobId = state.portalAccess.jobId;
  const companyId = backend.company.id;
  const [{ data: company, error: companyError }, { data: fields, error: fieldsError }, { data: jobs, error: jobsError }] =
    await Promise.all([
      backend.client.from("companies").select("*").eq("id", companyId).single(),
      backend.client.from("custom_fields").select("*").eq("company_id", companyId).order("created_at"),
      backend.client
        .from("jobs")
        .select("*, customers(*), documents(*), estimate_acceptances(*)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
    ]);

  if (companyError) throw companyError;
  if (fieldsError) throw fieldsError;
  if (jobsError) throw jobsError;

  backend.company = company;
  state.settings = {
    billingProvider: company.billing_provider || "QuickBooks Online",
    billingAccount: company.billing_account || company.name || "",
    billingSync: company.billing_sync || "Invoice links only",
    billingConnected: Boolean(company.billing_provider),
    subscriptionStatus: company.subscription_status || "trialing",
    trialStartedAt: company.trial_started_at || company.created_at,
    trialEndsAt: company.trial_ends_at || "",
    planPriceCents: company.plan_price_cents || monthlyPlanCents,
    promoCode: company.promo_code || "",
    promoPercentOff: company.promo_percent_off || 0,
    customFields: (fields || []).map((field) => ({
      id: field.id,
      label: field.label,
      type: field.field_type,
      options: Array.isArray(field.options) ? field.options : [],
    })),
  };
  state.jobs = (jobs || []).map(mapDbJob);
  await hydrateDocumentUrls();
  selectedJobId = state.jobs.some((job) => job.id === previousSelectedJobId)
    ? previousSelectedJobId
    : state.jobs[0]?.id || null;
  state.portalAccess.jobId = state.jobs.some((job) => job.id === previousPortalJobId)
    ? previousPortalJobId
    : selectedJobId;
}

async function hydrateDocumentUrls() {
  if (!backend.client) return;
  const documents = state.jobs.flatMap((job) => job.documents || []).filter((doc) => doc.storagePath);
  await Promise.all(documents.map(async (doc) => {
    const { data, error } = await backend.client.storage.from(DOCUMENT_BUCKET).createSignedUrl(doc.storagePath, 60 * 60);
    if (!error && data?.signedUrl) {
      doc.previewUrl = data.signedUrl;
      doc.stored = true;
    }
  }));
}

function portalTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("portal") || "";
}

function activateCustomerPortalView() {
  document.body.classList.add("customer-portal-mode");
  els.tabs.forEach((item) => item.classList.toggle("active", item.dataset.view === "customer"));
  Object.entries(els.views).forEach(([view, node]) => node.classList.toggle("active", view === "customer"));
  els.viewTitle.textContent = "Customer View";
}

function applyPortalJob(jobData) {
  const job = mapDbJob(jobData);
  state.jobs = [job];
  selectedJobId = job.id;
  state.portalAccess = {
    token: portalMode.token,
    jobId: job.id,
    channel: "email",
    lastSentTo: job.customerEmail,
    createdAt: new Date().toISOString(),
  };
}

async function loadCustomerPortal(token, actionPayload = { action: "payload" }) {
  portalMode.active = true;
  portalMode.token = token;
  activateCustomerPortalView();
  els.customerPortal.innerHTML = `<div class="empty-state">Loading your project...</div>`;
  const { data, error } = await backend.client.functions.invoke("customer-portal", {
    body: { token, ...actionPayload },
  });
  if (error || !data?.job) {
    els.customerPortal.innerHTML = `<div class="empty-state">This portal link is invalid or expired. Please ask the contractor to send a new link.</div>`;
    return;
  }
  applyPortalJob(data.job);
  render();
  activateCustomerPortalView();
}

function dbJobPayload(job, customerId) {
  return {
    company_id: backend.company.id,
    customer_id: customerId,
    industry: job.industry,
    name: job.name,
    service_address: job.serviceAddress,
    job_status: job.jobStatus,
    material_status: job.materialStatus,
    projected_date: job.projectedDate || null,
    invoice_url: job.invoiceUrl || null,
    next_action: job.nextAction,
    internal_notes: job.internalNotes,
    custom_values: job.customValues,
  };
}

function selectedJob() {
  return state.jobs.find((job) => job.id === selectedJobId) || state.jobs[0] || null;
}

function customerJob() {
  return state.jobs.find((job) => job.id === state.portalAccess.jobId) || null;
}

function estimateFor(job) {
  return (
    job?.documents
      .filter((doc) => doc.type === "Estimate" && doc.visibility === "Customer Visible" && doc.status !== "Archived")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  );
}

function estimateStatus(job) {
  if (!estimateFor(job)) return "No estimate";
  if (job.estimateDecision?.status === "changes") return "Changes requested";
  if (job.estimateDecision?.status === "reject") return "Not accepted";
  return job.acceptedEstimate?.id === estimateFor(job).id ? "Accepted" : "Needs acceptance";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function iconMarkup(name) {
  return `<i data-lucide="${escapeHtml(name)}" aria-hidden="true"></i>`;
}

function refreshIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

function setButtonLabel(button, icon, label) {
  button.innerHTML = `${iconMarkup(icon)}<span>${escapeHtml(label)}</span>`;
}

function showToast(message, tone = "info") {
  if (!els.toastRegion) return;
  window.clearTimeout(toastTimer);
  const icon = tone === "success" ? "check-circle-2" : tone === "error" ? "circle-alert" : "info";
  els.toastRegion.innerHTML = `
    <div class="toast ${escapeHtml(tone)}">
      ${iconMarkup(icon)}
      <span>${escapeHtml(message)}</span>
    </div>
  `;
  refreshIcons();
  toastTimer = window.setTimeout(() => {
    els.toastRegion.innerHTML = "";
  }, 4200);
}

function safeExternalUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "Not scheduled";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "Not sent";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatFileSize(bytes) {
  if (!bytes) return "Size unavailable";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function nextEstimateVersion(job) {
  const versions = job.documents.filter((doc) => doc.type === "Estimate").map((doc) => Number(doc.version || 0));
  return Math.max(0, ...versions) + 1;
}

function populateSelect(select, options, valueKey = null, labelKey = null) {
  select.innerHTML = "";
  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = valueKey ? option[valueKey] : option;
    node.textContent = labelKey ? option[labelKey] : option;
    select.append(node);
  });
}

function initStaticControls() {
  populateSelect(els.jobStatus, jobStatuses);
  populateSelect(els.materialStatus, materialStatuses);
  populateSelect(els.billingProvider, billingProviders);
}

function render() {
  saveState();
  renderAuth();
  renderMetrics();
  renderJobs();
  renderJobDetail();
  renderCustomerAccessSummary();
  renderCustomerPortal();
  renderSettings();
  refreshIcons();
}

function renderMetrics() {
  const active = state.jobs.filter((job) => job.jobStatus !== "Complete").length;
  els.activeJobCount.textContent = `${active} active ${active === 1 ? "job" : "jobs"}`;
  els.billingProviderSummary.textContent = "Early access";
}

function renderJobs() {
  const jobs = state.jobs;
  els.quickUpdateJob.disabled = jobs.length === 0;
  els.jobList.innerHTML = jobs
    .map(
      (job) => `
        <button class="job-row ${job.id === selectedJobId ? "active" : ""}" data-job-id="${job.id}" type="button" aria-pressed="${job.id === selectedJobId}">
          <span>
            <strong>${escapeHtml(job.name)}</strong>
            <small>${escapeHtml(job.customerName)}</small>
          </span>
          <em class="job-status" data-status="${escapeHtml(job.jobStatus)}">${escapeHtml(job.jobStatus)}</em>
        </button>
      `,
    )
    .join("");

  if (!jobs.length) {
    els.jobList.innerHTML = `<div class="empty-state">No jobs yet.</div>`;
  }
}

function renderJobDetail() {
  const job = selectedJob();
  if (!job) {
    els.detailTitle.textContent = "No jobs yet";
    els.detailStatus.textContent = "Empty";
    els.detailStatus.dataset.status = "Empty";
    els.jobDetail.classList.add("empty-state");
    els.jobDetail.innerHTML = "Start a job to create the first customer portal.";
    return;
  }

  const estimate = estimateFor(job);
  const activeDocuments = job.documents.filter((doc) => doc.status !== "Archived");
  const archivedDocuments = job.documents.filter((doc) => doc.status === "Archived");
  const visibleDocs = activeDocuments.filter((doc) => doc.visibility === "Customer Visible").length;
  const customerDocs = activeDocuments.filter((doc) => doc.uploadedBy === "Customer").length;
  const archivedDocs = job.documents.length - activeDocuments.length;
  const invoiceUrl = safeExternalUrl(job.invoiceUrl);
  const billingProvider = state.settings.billingConnected ? state.settings.billingProvider : "Billing not configured";
  els.detailTitle.textContent = job.name;
  els.detailStatus.textContent = job.jobStatus;
  els.detailStatus.dataset.status = job.jobStatus;
  els.jobDetail.classList.remove("empty-state");
  els.jobDetail.innerHTML = `
    <div class="detail-actions">
      <button class="primary-button" data-action="edit-job" type="button">${iconMarkup("pencil-line")}<span>Edit job</span></button>
      <button class="ghost-button" data-action="send-email" type="button">${iconMarkup("mail")}<span>Email customer</span></button>
      <button class="ghost-button" data-action="upload-estimate" type="button">${iconMarkup("file-up")}<span>Upload estimate</span></button>
      <button class="ghost-button" data-action="upload-staff-doc" type="button">${iconMarkup("paperclip")}<span>Add shared file</span></button>
    </div>
    ${job.actionMessage ? `<div class="action-feedback" role="status">${iconMarkup("info")}<span>${escapeHtml(job.actionMessage)}</span></div>` : ""}
    <div class="stat-grid">
      <div><span>Customer</span><strong>${escapeHtml(job.customerName)}</strong></div>
      <div><span>Projected service date</span><strong>${formatDate(job.projectedDate)}</strong></div>
      <div><span>Material or parts status</span><strong>${escapeHtml(job.materialStatus)}</strong></div>
      <div><span>Estimate</span><strong>${escapeHtml(estimateStatus(job))}</strong></div>
    </div>
    <section class="plain-section estimate-summary">
      <h3>Estimate</h3>
      ${renderContractorEstimateStatus(job, estimate)}
    </section>
    <section class="plain-section">
      <h3>Next action</h3>
      <p>${escapeHtml(job.nextAction || "No next action set.")}</p>
    </section>
    <section class="plain-section">
      <h3>Billing</h3>
      <p>${escapeHtml(billingProvider)} / ${invoiceUrl ? `<a href="${escapeHtml(invoiceUrl)}" target="_blank" rel="noopener noreferrer">Invoice link</a>` : "No invoice linked"}</p>
    </section>
    <section class="plain-section">
      <h3>Custom fields</h3>
      <div class="field-readout">${renderCustomValueReadout(job)}</div>
    </section>
    <section class="plain-section">
      <h3>Documents</h3>
      <div class="document-list">${renderDocumentList(activeDocuments)}</div>
      <p class="fine-print">${visibleDocs} shared document${visibleDocs === 1 ? "" : "s"}. ${customerDocs} customer upload${customerDocs === 1 ? "" : "s"} awaiting review.${archivedDocs ? ` ${archivedDocs} archived.` : ""}</p>
      ${archivedDocuments.length ? `
        <div class="archive-tools">
          <button class="text-button" data-action="toggle-archived" type="button">
            ${iconMarkup(archivedDocumentJobs.has(job.id) ? "archive-x" : "archive")}<span>${archivedDocumentJobs.has(job.id) ? "Hide" : "Show"} archived files (${archivedDocuments.length})</span>
          </button>
          ${archivedDocumentJobs.has(job.id) ? `<div class="document-list">${renderDocumentList(archivedDocuments, true)}</div>` : ""}
        </div>
      ` : ""}
    </section>
    <section class="plain-section internal-note">
      <h3>Internal notes</h3>
      <p>${escapeHtml(job.internalNotes || "No staff-only notes yet.")}</p>
    </section>
    ${job.timeline.length ? `
      <section class="plain-section">
        <h3>Activity</h3>
        <ol class="timeline">${job.timeline.map((event) => `<li>${escapeHtml(event)}</li>`).join("")}</ol>
      </section>
    ` : ""}
  `;
}

function renderContractorEstimateStatus(job, estimate) {
  if (!estimate) {
    return `
      <p>No estimate has been uploaded for this customer yet.</p>
      <p class="fine-print">Use the Upload estimate action above when the estimate is ready.</p>
    `;
  }
  const decision = job.estimateDecision;
  const decisionLabel = decision?.status === "changes"
    ? "Customer requested changes"
    : decision?.status === "reject"
      ? "Customer did not accept"
      : job.acceptedEstimate
        ? "Customer accepted"
        : "";
  return `
    <div class="estimate-status-card">
      <span>
        <strong>${escapeHtml(estimate.name)}</strong>
        <small>Version ${escapeHtml(estimate.version || 1)} / ${job.acceptedEstimate ? `Accepted ${formatDateTime(job.acceptedEstimate.acceptedAt)}` : "Waiting on customer acceptance"}</small>
      </span>
      <span class="document-row-actions">
        ${renderDocumentOpenAction(estimate, "Open estimate")}
        <em>${escapeHtml(estimateStatus(job))}</em>
      </span>
    </div>
    ${decisionLabel ? `
      <div class="customer-response-note">
        <strong>${escapeHtml(decisionLabel)}</strong>
        ${decision?.notes ? `<p>${escapeHtml(decision.notes)}</p>` : ""}
        <small>${formatDateTime(decision?.decidedAt || job.acceptedEstimate?.acceptedAt)}</small>
      </div>
    ` : ""}
  `;
}

function renderDocumentOpenAction(doc, label = "Open file") {
  const previewUrl = safeExternalUrl(doc.previewUrl);
  if (previewUrl) {
    return `<a class="document-open-link" href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener noreferrer">${iconMarkup("external-link")}<span>${escapeHtml(label)}</span></a>`;
  }
  if (!backend.live && doc.type === "Estimate" && /pdf/i.test(doc.mimeType || doc.name)) {
    return `<a class="document-open-link" href="assets/mock-estimate.pdf" target="_blank" rel="noopener">${iconMarkup("external-link")}<span>${escapeHtml(label)}</span></a>`;
  }
  if (doc.storagePath) {
    return `<span class="document-pending-link">Preparing file link</span>`;
  }
  return "";
}

function renderCustomValueReadout(job) {
  if (!state.settings.customFields.length) return `<p>No custom fields configured.</p>`;
  return state.settings.customFields
    .map((field) => {
      const value = job.customValues?.[field.label] || "Not set";
      return `<div><span>${escapeHtml(field.label)}</span><strong>${escapeHtml(value)}</strong></div>`;
    })
    .join("");
}

function renderDocumentList(documents, archived = false) {
  if (!documents.length) return `<div class="empty-state">No documents yet.</div>`;
  return documents
    .map(
      (doc) => {
        const fileAction = renderDocumentOpenAction(doc);
        return `
        <div class="document-row">
          <span>
            <strong>${escapeHtml(doc.name)}</strong>
            <small>${escapeHtml(doc.type)} / ${escapeHtml(doc.uploadedBy)} / ${escapeHtml(doc.visibility)}</small>
            <small>${escapeHtml(formatFileSize(doc.size))}</small>
          </span>
          <span class="document-row-actions">
            ${fileAction}
            <em>${escapeHtml(doc.status)}</em>
            <button class="text-button document-archive-button" data-action="${archived ? "restore-document" : "archive-document"}" data-doc-id="${escapeHtml(doc.id)}" type="button">${iconMarkup(archived ? "archive-restore" : "archive")}<span>${archived ? "Restore" : "Archive"}</span></button>
          </span>
        </div>
      `;
      },
    )
    .join("");
}

function renderCustomerDocumentList(documents) {
  if (!documents.length) return `<div class="empty-state">No documents have been shared yet.</div>`;
  return documents
    .map(
      (doc) => `
        <div class="document-row">
          <span>
            <strong>${escapeHtml(doc.name)}</strong>
            <small>${escapeHtml(doc.type)} / Shared ${formatDateTime(doc.createdAt)}</small>
            <small>${escapeHtml(formatFileSize(doc.size))}</small>
          </span>
          <span class="document-row-actions">
            ${renderDocumentOpenAction(doc)}
            <em>${escapeHtml(doc.status === "Reviewed" ? "Ready" : doc.status)}</em>
          </span>
        </div>
      `,
    )
    .join("");
}

function renderCustomerUploadList(documents) {
  if (!documents.length) return `<div class="empty-state">No insurance claim files uploaded yet.</div>`;
  return `
    <div class="document-list uploaded-document-list">
      ${documents
        .map((doc) => {
          const previewUrl = safeExternalUrl(doc.previewUrl);
          const openLink = previewUrl
            ? `<a class="document-open-link" href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener noreferrer">${iconMarkup("external-link")}<span>Open file</span></a>`
            : "";
          return `
            <div class="document-row">
              <span>
                <strong>${escapeHtml(doc.name)}</strong>
                <small>${escapeHtml(doc.type)} / Uploaded ${formatDateTime(doc.createdAt)}</small>
                <small>${escapeHtml(formatFileSize(doc.size))}</small>
              </span>
              <span class="document-row-actions">
                ${openLink}
                <em>${escapeHtml(doc.status)}</em>
              </span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function customerTimelineFor(job) {
  const items = ["Customer portal opened"];
  if (estimateFor(job)) items.push("Estimate ready for review");
  if (job.estimateDecision?.status === "changes") items.push("Estimate accepted with requested changes");
  if (job.estimateDecision?.status === "reject") items.push("Estimate not accepted");
  if (job.acceptedEstimate || job.estimateAcceptedAt) items.push("Estimate accepted");
  if (job.documents.some((doc) => doc.uploadedBy === "Customer")) items.push("Insurance claim uploaded");
  if (job.projectedDate) items.push(`Projected service date: ${formatDate(job.projectedDate)}`);
  return items;
}

function renderCustomerAccessSummary() {
  renderCustomerJobSelector();
  els.customerAccessSummary.hidden = true;
  els.customerAccessSummary.innerHTML = "";
}

function renderCustomerJobSelector() {
  if (!els.customerJobList) return;
  if (portalMode.active) {
    els.customerJobList.innerHTML = "";
    return;
  }
  els.customerJobList.innerHTML = state.jobs.length
    ? state.jobs
        .map(
          (job) => `
            <button class="job-row ${job.id === state.portalAccess.jobId ? "active" : ""}" data-customer-job-id="${escapeHtml(job.id)}" type="button" aria-pressed="${job.id === state.portalAccess.jobId}">
              <span>
                <strong>${escapeHtml(job.name)}</strong>
                <small>${escapeHtml(job.customerName)}</small>
              </span>
              <em class="job-status" data-status="${escapeHtml(job.jobStatus)}">${escapeHtml(job.jobStatus)}</em>
            </button>
          `,
        )
        .join("")
    : `<div class="empty-state">No jobs yet.</div>`;
}

function renderCustomerPortal() {
  const job = customerJob();
  if (!job) {
    els.customerPortal.innerHTML = `<div class="empty-state">No customer portal to preview yet.</div>`;
    return;
  }
  const activeDocuments = job.documents.filter((doc) => doc.status !== "Archived");
  const customerVisibleDocs = activeDocuments.filter((doc) => doc.visibility === "Customer Visible" && doc.type !== "Estimate");
  const customerUploads = activeDocuments.filter((doc) => doc.uploadedBy === "Customer");
  const estimate = estimateFor(job);
  const receivedUploads = customerUploads.length;
  const invoiceUrl = safeExternalUrl(job.invoiceUrl);
  els.customerPortal.innerHTML = `
    <div class="customer-hero">
      <div>
        <p class="eyebrow">Customer portal</p>
        <h2>${escapeHtml(job.name)}</h2>
        <p>${escapeHtml(job.serviceAddress)}</p>
      </div>
      <span class="status-pill" data-status="${escapeHtml(job.jobStatus)}">${escapeHtml(job.jobStatus)}</span>
    </div>
    <div class="stat-grid">
      <div><span>Material or parts status</span><strong>${escapeHtml(job.materialStatus)}</strong></div>
      <div><span>Projected service date</span><strong>${formatDate(job.projectedDate)}</strong></div>
      <div><span>Uploads received</span><strong>${receivedUploads}</strong></div>
    </div>
    ${invoiceUrl ? `
      <section class="plain-section">
        <h3>Billing</h3>
        <p>Your contractor has shared an invoice for this job.</p>
        <a class="primary-button" href="${escapeHtml(invoiceUrl)}" target="_blank" rel="noopener noreferrer">${iconMarkup("credit-card")}<span>Pay invoice</span></a>
      </section>
    ` : ""}
    <section class="plain-section">
      <h3>Insurance claim</h3>
      <p>Upload the insurance claim packet or letter for this job.</p>
      ${portalMode.active ? `
        <div class="customer-upload-actions">
          <button class="ghost-button" data-action="customer-upload" data-doc-type="Insurance Claim" type="button">${iconMarkup("upload")}<span>Upload insurance claim</span></button>
        </div>
      ` : `<p class="fine-print">Upload controls appear in the secure customer portal sent by email.</p>`}
      <div id="customerUploadStatus"></div>
      ${renderCustomerUploadList(customerUploads)}
      <p class="fine-print">The contractor can see uploaded claim documents in this job.</p>
    </section>
    <section class="plain-section estimate-acceptance">
      <h3>Estimate</h3>
      ${renderEstimateAcceptance(job, estimate)}
    </section>
    <section class="plain-section">
      <h3>Shared documents</h3>
      <div class="document-list">${renderCustomerDocumentList(customerVisibleDocs)}</div>
    </section>
    <section class="plain-section">
      <h3>Timeline</h3>
      <ol class="timeline">${customerTimelineFor(job).map((event) => `<li>${escapeHtml(event)}</li>`).join("")}</ol>
    </section>
  `;
}

function renderEstimateAcceptance(job, estimate) {
  if (!estimate) {
    return `<p>No estimate has been shared yet.</p>`;
  }
  if (job.acceptedEstimate?.id === estimate.id || job.estimateAcceptedAt) {
    return `
      <div class="acceptance-confirmed">
        <strong>Accepted version ${escapeHtml(job.acceptedEstimate?.version || estimate.version || 1)}</strong>
        <span>${formatDateTime(job.acceptedEstimate?.acceptedAt || job.estimateAcceptedAt)}</span>
      </div>
      <div class="accept-row">${renderDocumentOpenAction(estimate, "Open estimate")}</div>
    `;
  }
  if (job.estimateDecision?.documentId === estimate.id) {
    const label = job.estimateDecision.status === "changes"
      ? "Accepted with requested changes"
      : "Not accepted";
    return `
      <div class="acceptance-confirmed estimate-decision-${escapeHtml(job.estimateDecision.status)}">
        <strong>${escapeHtml(label)}</strong>
        <span>${formatDateTime(job.estimateDecision.decidedAt)}</span>
      </div>
      ${job.estimateDecision.notes ? `<p>${escapeHtml(job.estimateDecision.notes)}</p>` : ""}
      <div class="accept-row">${renderDocumentOpenAction(estimate, "Open estimate")}</div>
    `;
  }
  const viewed = job.viewedEstimateId === estimate.id;
  const isPdf = /pdf/i.test(estimate.mimeType || estimate.name);
  const pdfPreviewUrl = isPdf ? safeExternalUrl(estimate.previewUrl) || (!backend.live ? "assets/mock-estimate.pdf" : "") : "";
  const uploadedFileUrl = safeExternalUrl(estimate.previewUrl);
  return `
    <p>${escapeHtml(estimate.name)} version ${escapeHtml(estimate.version || 1)} is ready for review.</p>
    <button class="ghost-button" data-action="view-estimate" data-doc-id="${escapeHtml(estimate.id)}" type="button">${iconMarkup("eye")}<span>View estimate</span></button>
    ${
      viewed
        ? `
          <div class="estimate-preview">
            <strong>${escapeHtml(estimate.name)}</strong>
            <small>Version ${escapeHtml(estimate.version || 1)} / Shared ${formatDateTime(estimate.createdAt)}</small>
            ${
              pdfPreviewUrl
                ? `<iframe class="estimate-pdf-frame" src="${escapeHtml(pdfPreviewUrl)}" title="${escapeHtml(estimate.name)} preview"></iframe>`
                : uploadedFileUrl
                  ? `<a class="ghost-button" href="${escapeHtml(uploadedFileUrl)}" target="_blank" rel="noopener noreferrer">${iconMarkup("external-link")}<span>Open uploaded file</span></a>`
                  : `<small>Preview unavailable. Please contact the contractor for the estimate file.</small>`
            }
          </div>
        `
        : `<p class="fine-print">Open the estimate before accepting it.</p>`
    }
    ${portalMode.active ? `
      <div class="estimate-decision-actions">
        <button class="accept-button" data-action="estimate-decision" data-decision="accept" data-doc-id="${escapeHtml(estimate.id)}" type="button" ${viewed ? "" : "disabled"}>${iconMarkup("check")}<span>I accept</span></button>
        <button class="ghost-button" data-action="estimate-decision" data-decision="changes" data-doc-id="${escapeHtml(estimate.id)}" type="button" ${viewed ? "" : "disabled"}>${iconMarkup("message-square-text")}<span>Accept with changes</span></button>
        <button class="danger-button" data-action="estimate-decision" data-decision="reject" data-doc-id="${escapeHtml(estimate.id)}" type="button" ${viewed ? "" : "disabled"}>${iconMarkup("x-circle")}<span>Do not accept</span></button>
        <small>Your response will be saved with this estimate version.</small>
      </div>
    ` : `<p class="fine-print">Response controls appear in the secure customer portal sent by email.</p>`}
  `;
}

function renderSettings() {
  els.workspaceName.value = backend.company?.name || "";
  els.workspaceEmail.value = backend.user?.email || "";
  els.workspaceStatus.textContent = backend.live ? "Saved" : "Preview";
  els.billingProvider.value = state.settings.billingProvider;
  els.billingAccount.value = state.settings.billingAccount || "";
  els.billingSync.value = state.settings.billingSync;
  els.billingStatus.textContent = state.settings.billingConnected ? "Preference saved" : "Not connected";
  renderSubscriptionSettings();
  els.fieldCount.textContent = String(state.settings.customFields.length);
  els.customFieldList.innerHTML = state.settings.customFields.length
    ? state.settings.customFields
        .map(
          (field) => `
            <div class="custom-field-row">
              <span>
                <strong>${escapeHtml(field.label)}</strong>
                <small>${escapeHtml(field.type)}${field.options.length ? ` / ${escapeHtml(field.options.join(", "))}` : ""}</small>
              </span>
              <button class="ghost-button" data-field-id="${field.id}" type="button">${iconMarkup("trash-2")}<span>Remove</span></button>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">Add a field contractors can fill out on every job.</div>`;

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

function renderSubscriptionSettings() {
  els.subscriptionStatus.textContent = "Early access";
  els.promoCode.value = state.settings.promoCode || "";
  els.subscriptionSummary.innerHTML = `
    <span>
      <strong>Free early access</strong>
      <small>No payment is collected in this version.</small>
    </span>
    <small>We will give advance notice before any paid plan begins.</small>
  `;
}

function renderCustomFieldInputs(job = null) {
  els.customFieldInputs.innerHTML = state.settings.customFields
    .map((field) => {
      const value = job?.customValues?.[field.label] || "";
      if (field.type === "select") {
        return `
          <label>
            ${escapeHtml(field.label)}
            <select data-custom-field="${escapeHtml(field.label)}">
              <option value="">Not set</option>
              ${field.options.map((option) => `<option ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
            </select>
          </label>
        `;
      }
      return `
        <label>
          ${escapeHtml(field.label)}
          <input data-custom-field="${escapeHtml(field.label)}" type="${field.type === "date" ? "date" : "text"}" value="${escapeHtml(value)}" />
        </label>
      `;
    })
    .join("");
}

function openJobDialog(job = null) {
  const isEdit = Boolean(job);
  els.jobDialogMode.textContent = isEdit ? "Update" : "Start";
  els.jobDialogTitle.textContent = isEdit ? "Update a job" : "Start a job";
  els.deleteJob.hidden = !isEdit;
  els.jobId.value = job?.id || "";
  els.jobName.value = job?.name || "";
  els.customerName.value = job?.customerName || "";
  els.customerEmail.value = job?.customerEmail || "";
  els.customerPhone.value = job?.customerPhone || "";
  els.serviceAddress.value = job?.serviceAddress || "";
  els.jobStatus.value = job?.jobStatus || "Active";
  els.materialStatus.value = job?.materialStatus || "Not Ordered";
  els.projectedDate.value = job?.projectedDate || "";
  els.invoiceUrl.value = job?.invoiceUrl || "";
  els.nextAction.value = job?.nextAction || "";
  els.internalNotes.value = job?.internalNotes || "";
  renderCustomFieldInputs(job);
  els.jobDialog.showModal();
}

async function saveJobFromForm() {
  const id = els.jobId.value || createId();
  const existing = state.jobs.find((job) => job.id === id);
  const customValues = {};
  document.querySelectorAll("[data-custom-field]").forEach((input) => {
    customValues[input.dataset.customField] = input.value;
  });
  const payload = {
    id,
    industry: existing?.industry || "general",
    name: els.jobName.value,
    customerName: els.customerName.value,
    customerEmail: els.customerEmail.value,
    customerPhone: els.customerPhone.value,
    serviceAddress: els.serviceAddress.value,
    jobStatus: els.jobStatus.value,
    materialStatus: els.materialStatus.value,
    projectedDate: els.projectedDate.value,
    invoiceUrl: els.invoiceUrl.value,
    nextAction: els.nextAction.value,
    internalNotes: els.internalNotes.value,
    customValues,
    documents: existing?.documents || [],
    timeline: existing?.timeline || ["Job started"],
    estimateAcceptedAt: existing?.estimateAcceptedAt || null,
    acceptedEstimate: existing?.acceptedEstimate || null,
    estimateDecision: existing?.estimateDecision || null,
    viewedEstimateId: existing?.viewedEstimateId || null,
    magicLinkLastSent: existing?.magicLinkLastSent || null,
  };

  if (backend.live) {
    const customerPayload = {
      company_id: backend.company.id,
      name: payload.customerName,
      email: payload.customerEmail,
      phone: payload.customerPhone || null,
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

    const jobPayload = dbJobPayload(payload, customerId);
    if (existing) {
      const { error } = await backend.client.from("jobs").update(jobPayload).eq("id", id);
      if (error) throw error;
    } else {
      const { data, error } = await backend.client.from("jobs").insert(jobPayload).select("id").single();
      if (error) throw error;
      selectedJobId = data.id;
    }
    await loadLiveState();
    return;
  }

  if (existing) {
    Object.assign(existing, payload);
    existing.timeline.push("Job updated by contractor");
  } else {
    state.jobs.unshift(payload);
  }
  selectedJobId = id;
  render();
}

async function sendCustomerAccessEmail() {
  const job = selectedJob();
  if (!job) return;
  if (backend.live) {
    job.actionMessage = "Sending customer email...";
    render();
    const { error } = await backend.client.functions.invoke("send-magic-link", {
      body: { jobId: job.id },
    });
    if (error) {
      console.warn("Customer email failed", error);
      job.timeline.push("Customer email could not be sent");
      job.actionMessage = "Customer email could not be sent. Please wait a minute and try again.";
      showToast("Customer email could not be sent.", "error");
    } else {
      job.magicLinkLastSent = new Date().toISOString();
      job.timeline.push(`Customer access email sent to ${job.customerEmail}`);
      job.actionMessage = `Customer email sent to ${job.customerEmail}.`;
      showToast(`Customer email sent to ${job.customerEmail}.`, "success");
    }
    render();
    return;
  }
  activatePortalAccess(job, "email");
  job.timeline.push(`Customer access email prepared for ${job.customerEmail}`);
  showToast("Customer email prepared in preview mode.", "success");
  render();
}

function activatePortalAccess(job, channel = "email") {
  job.magicLinkLastSent = new Date().toISOString();
  state.portalAccess = {
    token: `${job.id.slice(0, 8)}-${Date.now().toString(36)}`,
    jobId: job.id,
    channel,
    lastSentTo: channel === "email" ? job.customerEmail : job.customerPhone || "customer phone",
    createdAt: job.magicLinkLastSent,
  };
}

function safeStorageName(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

function documentValidationError(file) {
  if (!file?.size) return "That file is empty.";
  if (file.size > MAX_DOCUMENT_BYTES) return "Files must be 10 MB or smaller.";
  if (file.type && !ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    return "Use a PDF, JPG, PNG, WebP, or HEIC file.";
  }
  return "";
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
  const storagePath = `${backend.company.id}/${job.id}/${createId()}-${safeStorageName(file.name)}`;
  const { error } = await backend.client.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;
  const { data } = await backend.client.storage.from(DOCUMENT_BUCKET).createSignedUrl(storagePath, 60 * 60);
  return {
    storagePath,
    previewUrl: data?.signedUrl || "",
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

async function uploadPortalDocument(file, docType) {
  const contentBase64 = await fileToBase64(file);
  const { data, error } = await backend.client.functions.invoke("customer-portal", {
    body: {
      token: portalMode.token,
      action: "upload",
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      contentBase64,
      documentType: docType,
    },
  });
  if (error || !data?.job) throw error || new Error("Upload failed");
  applyPortalJob(data.job);
  render();
  activateCustomerPortalView();
}

async function uploadPortalDocuments(files, docType) {
  const status = document.getElementById("customerUploadStatus");
  const job = customerJob();
  const sourceFiles = Array.from(files);
  const invalidFile = sourceFiles.find((file) => documentValidationError(file));
  if (invalidFile) {
    if (status) status.innerHTML = `<div class="empty-state">${escapeHtml(documentValidationError(invalidFile))}</div>`;
    return;
  }
  const uniqueFiles = sourceFiles.filter((file) => !isDuplicateDocument(job, file, "Customer", docType));
  if (status) {
    status.innerHTML = uniqueFiles.length
      ? `<div class="empty-state">Uploading ${uniqueFiles.length} file${uniqueFiles.length === 1 ? "" : "s"}...</div>`
      : `<div class="empty-state">That file is already uploaded for this job.</div>`;
  }
  if (!uniqueFiles.length) return;
  for (const file of uniqueFiles) {
    await uploadPortalDocument(file, docType);
  }
  const updatedStatus = document.getElementById("customerUploadStatus");
  if (updatedStatus) {
    updatedStatus.innerHTML = `<div class="empty-state">Upload complete.</div>`;
  }
}

async function addDocuments(files, uploadedBy, docType = "Other") {
  const job = uploadedBy === "Customer" ? customerJob() : selectedJob();
  if (!job || !files.length) return;
  if (portalMode.active && uploadedBy === "Customer") {
    await uploadPortalDocuments(Array.from(files), docType);
    return;
  }
  if (docType === "Estimate") {
    job.estimateAcceptedAt = null;
    job.acceptedEstimate = null;
    job.estimateDecision = null;
    job.viewedEstimateId = null;
  }
  const invalidFile = Array.from(files).find((file) => documentValidationError(file));
  if (invalidFile) {
    job.timeline.push(documentValidationError(invalidFile));
    showToast(documentValidationError(invalidFile), "error");
    render();
    return;
  }
  let estimateVersion = docType === "Estimate" ? nextEstimateVersion(job) : null;
  const sourceFiles = Array.from(files).filter((file) => !isDuplicateDocument(job, file, uploadedBy, docType));
  if (!sourceFiles.length) {
    job.timeline.push("Duplicate upload skipped");
    showToast("That file is already uploaded for this job.", "info");
    render();
    return;
  }
  const uploadedFiles = backend.live
    ? await Promise.all(sourceFiles.map((file) => uploadLiveDocumentFile(job, file)))
    : sourceFiles.map(() => ({ storagePath: "", previewUrl: "" }));
  const docs = sourceFiles.map((file, index) => ({
      id: createId(),
      name: file.name,
      mimeType: file.type || "",
      previewUrl: uploadedFiles[index].previewUrl || (typeof URL !== "undefined" ? URL.createObjectURL(file) : ""),
      storagePath: uploadedFiles[index].storagePath,
      type: docType,
      uploadedBy,
      visibility: uploadedBy === "Customer" ? "Staff Only" : "Customer Visible",
      status: uploadedBy === "Customer" ? "New" : "Reviewed",
      createdAt: new Date().toISOString(),
      version: docType === "Estimate" ? estimateVersion++ : null,
      size: file.size,
      stored: Boolean(uploadedFiles[index].storagePath),
    }));

  if (backend.live) {
    const { error } = await backend.client.from("documents").insert(
      docs.map((doc) => ({
        company_id: backend.company.id,
        job_id: job.id,
        name: doc.name,
        document_type: doc.type,
        uploaded_by: doc.uploadedBy,
        visibility: doc.visibility,
        status: doc.status,
        storage_provider: "supabase",
        storage_file_id: doc.storagePath,
        storage_url: null,
        version: doc.version,
        size_bytes: doc.size,
      })),
    );
    if (error) throw error;
    await loadLiveState();
    showToast(`${docs.length} file${docs.length === 1 ? "" : "s"} uploaded.`, "success");
    render();
    return;
  }

  docs.forEach((doc) => job.documents.unshift(doc));
  if (docType === "Estimate") {
    job.timeline.push("Estimate shared with customer");
  } else if (docType === "Insurance Claim" && uploadedBy === "Customer") {
    job.timeline.push("Customer uploaded insurance claim");
  } else {
    job.timeline.push(`${uploadedBy} uploaded ${files.length} document${files.length === 1 ? "" : "s"}`);
  }
  showToast(`${docs.length} file${docs.length === 1 ? "" : "s"} uploaded.`, "success");
  render();
}

async function setDocumentArchived(docId, archived) {
  const job = selectedJob();
  const doc = job?.documents.find((item) => item.id === docId);
  if (!job || !doc) return;
  const nextStatus = archived ? "Archived" : doc.type === "Estimate" || doc.uploadedBy === "Contractor" ? "Reviewed" : "New";
  if (backend.live) {
    const { error } = await backend.client.from("documents").update({ status: nextStatus }).eq("id", docId);
    if (error) throw error;
    await loadLiveState();
    showToast(`${archived ? "Archived" : "Restored"} ${doc.name}.`, "success");
    render();
    return;
  }
  doc.status = nextStatus;
  job.timeline.push(`${archived ? "Archived" : "Restored"} ${doc.name}`);
  showToast(`${archived ? "Archived" : "Restored"} ${doc.name}.`, "success");
  render();
}

function viewEstimate(docId) {
  const job = customerJob();
  const estimate = estimateFor(job);
  if (!job || !estimate || estimate.id !== docId) return;
  job.viewedEstimateId = docId;
  render();
}

async function acceptEstimate(docId) {
  const job = customerJob();
  const estimate = estimateFor(job);
  if (!job || !estimate || estimate.id !== docId || job.viewedEstimateId !== docId) return;
  if (portalMode.active) {
    await loadCustomerPortal(portalMode.token, {
      action: "decision",
      documentId: docId,
      decision: "accept",
      notes: "",
    });
    return;
  }
  if (backend.live) {
    const { error } = await backend.client.from("estimate_acceptances").insert({
      company_id: backend.company.id,
      job_id: job.id,
      document_id: estimate.id,
      customer_id: job.customerId,
      decision_status: "accept",
      notes: null,
      decided_at: new Date().toISOString(),
      user_agent: navigator.userAgent,
    });
    if (error) throw error;
    const { error: jobError } = await backend.client.from("jobs").update({ job_status: "Ready to Schedule" }).eq("id", job.id);
    if (jobError) throw jobError;
  }
  job.estimateAcceptedAt = new Date().toISOString();
  job.acceptedEstimate = {
    id: estimate.id,
    name: estimate.name,
    version: estimate.version || 1,
    acceptedAt: job.estimateAcceptedAt,
  };
  job.estimateDecision = null;
  job.jobStatus = "Ready to Schedule";
  job.timeline.push(`Customer accepted estimate version ${estimate.version || 1}`);
  render();
}

function openEstimateChangesDialog(docId) {
  els.estimateChangesDocId.value = docId;
  els.estimateChangesText.value = "";
  els.estimateChangesDialog.showModal();
  els.estimateChangesText.focus();
}

async function recordEstimateDecision(docId, decision, notes = "") {
  const job = customerJob();
  const estimate = estimateFor(job);
  if (!job || !estimate || estimate.id !== docId || job.viewedEstimateId !== docId) return;
  if (decision === "accept") {
    await acceptEstimate(docId);
    return;
  }
  const decidedAt = new Date().toISOString();
  if (portalMode.active) {
    await loadCustomerPortal(portalMode.token, {
      action: "decision",
      documentId: docId,
      decision,
      notes: notes.trim(),
    });
    return;
  }
  if (backend.live) {
    const { error } = await backend.client.from("estimate_acceptances").insert({
      company_id: backend.company.id,
      job_id: job.id,
      document_id: estimate.id,
      customer_id: job.customerId,
      decision_status: decision,
      notes: notes.trim() || null,
      decided_at: decidedAt,
      accepted_at: decidedAt,
      user_agent: navigator.userAgent,
    });
    if (error) throw error;
    const nextStatus = decision === "changes" ? "Waiting on Customer" : "On Hold";
    const { error: jobError } = await backend.client.from("jobs").update({ job_status: nextStatus }).eq("id", job.id);
    if (jobError) throw jobError;
  }
  job.estimateDecision = {
    documentId: estimate.id,
    name: estimate.name,
    version: estimate.version || 1,
    status: decision,
    notes: notes.trim(),
    decidedAt,
  };
  job.estimateAcceptedAt = null;
  job.acceptedEstimate = null;
  job.jobStatus = decision === "changes" ? "Waiting on Customer" : "On Hold";
  job.timeline.push(
    decision === "changes"
      ? `Customer accepted estimate version ${estimate.version || 1} with requested changes`
      : `Customer did not accept estimate version ${estimate.version || 1}`,
  );
  if (notes.trim()) {
    job.timeline.push(`Customer note: ${notes.trim()}`);
  }
  render();
}

function bindEvents() {
  function setView(viewName) {
    els.tabs.forEach((item) => {
      const active = item.dataset.view === viewName;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    els.settingsGear.classList.toggle("active", viewName === "settings");
    els.settingsGear.setAttribute("aria-pressed", String(viewName === "settings"));
    Object.entries(els.views).forEach(([view, node]) => node.classList.toggle("active", view === viewName));
    els.viewTitle.textContent = viewName === "dashboard" ? "Jobs" : viewName === "customer" ? "Customer View" : "Setup";
  }

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setView(tab.dataset.view);
    });
  });
  els.settingsGear.addEventListener("click", () => setView("settings"));

  els.customerJobList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-customer-job-id]");
    if (!button) return;
    const job = state.jobs.find((item) => item.id === button.dataset.customerJobId);
    if (!job) return;
    state.portalAccess.jobId = job.id;
    state.portalAccess.token = state.portalAccess.token || `${job.id.slice(0, 8)}-${Date.now().toString(36)}`;
    state.portalAccess.lastSentTo = job.customerEmail;
    state.portalAccess.channel = state.portalAccess.channel || "email";
    state.portalAccess.createdAt = state.portalAccess.createdAt || new Date().toISOString();
    render();
  });

  els.authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    performAuth().catch((error) => {
      backend.authBusy = false;
      renderAuth();
      els.backendStatus.textContent = publicError(error, "Could not complete sign in.");
    });
  });

  els.authSubmit.addEventListener("click", () => {
    performAuth().catch((error) => {
      backend.authBusy = false;
      renderAuth();
      els.backendStatus.textContent = publicError(error, "Could not complete sign in.");
    });
  });

  els.authCreate.addEventListener("click", () => {
    if (backend.authBusy) return;
    backend.authFeedback = null;
    backend.authMode = backend.authMode === "signup" ? "signin" : "signup";
    renderAuth();
  });

  els.forgotPassword.addEventListener("click", () => {
    sendPasswordReset().catch((error) => {
      backend.authBusy = false;
      renderAuth();
      els.backendStatus.textContent = publicError(error, "Could not send the reset email.");
    });
  });

  els.recoveryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveRecoveryPassword().catch((error) => {
      backend.authBusy = false;
      renderAuth();
      els.backendStatus.textContent = publicError(error, "Could not save the new password.");
    });
  });

  els.signOut.addEventListener("click", async () => {
    if (!backend.client) return;
    await backend.client.auth.signOut();
  });

  els.startJob?.addEventListener("click", () => openJobDialog());
  els.quickStartJob.addEventListener("click", () => openJobDialog());
  els.quickUpdateJob.addEventListener("click", () => openJobDialog(selectedJob()));
  els.resetDemo?.addEventListener("click", () => {
    state = normalizeState(structuredClone(demoState));
    selectedJobId = state.jobs[0]?.id || null;
    state.portalAccess.jobId = selectedJobId;
    render();
  });
  els.jobList.addEventListener("click", (event) => {
    const row = event.target.closest("[data-job-id]");
    if (!row) return;
    selectedJobId = row.dataset.jobId;
    render();
  });

  els.jobDetail.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    const action = actionTarget.dataset.action;
    if (action === "edit-job") openJobDialog(selectedJob());
    if (action === "send-email") sendCustomerAccessEmail().catch((error) => {
      console.warn("Customer email failed", error);
      selectedJob().timeline.push("Customer email could not be sent");
      showToast("Customer email could not be sent.", "error");
      render();
    });
    if (action === "toggle-archived") {
      const job = selectedJob();
      if (job) {
        if (archivedDocumentJobs.has(job.id)) archivedDocumentJobs.delete(job.id);
        else archivedDocumentJobs.add(job.id);
        render();
      }
    }
    if (action === "archive-document" || action === "restore-document") setDocumentArchived(
      actionTarget.dataset.docId,
      action === "archive-document",
    ).catch((error) => {
      console.warn("Document archive failed", error);
      const job = selectedJob();
      if (job) job.timeline.push("Document status could not be changed");
      showToast("Could not change the document status.", "error");
      render();
    });
    if (action === "upload-estimate") {
      els.documentPicker.dataset.uploadedBy = "Contractor";
      els.documentPicker.dataset.docType = "Estimate";
      els.documentPicker.click();
    }
    if (action === "upload-staff-doc") {
      els.documentPicker.dataset.uploadedBy = "Contractor";
      els.documentPicker.dataset.docType = "Other";
      els.documentPicker.click();
    }
  });

  els.customerPortal.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    if (actionTarget.dataset.action === "estimate-decision") {
      if (actionTarget.dataset.decision === "changes") {
        openEstimateChangesDialog(actionTarget.dataset.docId);
        return;
      }
      recordEstimateDecision(actionTarget.dataset.docId, actionTarget.dataset.decision).catch(() => {
        els.customerPortal.insertAdjacentHTML("afterbegin", `<div class="empty-state">Could not save the response. Please try again.</div>`);
      });
      return;
    }
    if (actionTarget.dataset.action === "view-estimate") {
      viewEstimate(actionTarget.dataset.docId);
      return;
    }
    if (actionTarget.dataset.action !== "customer-upload") return;
    els.documentPicker.dataset.uploadedBy = "Customer";
    els.documentPicker.dataset.docType = actionTarget.dataset.docType;
    els.documentPicker.click();
  });

  els.documentPicker.addEventListener("change", () => {
    addDocuments(els.documentPicker.files, els.documentPicker.dataset.uploadedBy, els.documentPicker.dataset.docType).catch((error) => {
      console.warn("Document upload failed", error);
      if (portalMode.active) {
        const status = document.getElementById("customerUploadStatus");
        if (status) status.innerHTML = `<div class="empty-state">Upload failed. Please try again, or send the file to the contractor directly.</div>`;
        return;
      }
      const job = selectedJob();
      if (job) job.timeline.push("Document upload failed");
      showToast(publicError(error, "Document upload failed. Please try again."), "error");
      render();
    });
    els.documentPicker.value = "";
  });

  els.workspaceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = els.workspaceName.value.trim();
    if (!name) return;
    if (!backend.live) {
      els.workspaceStatus.textContent = "Sign in required";
      showToast("Sign in to change the company profile.", "error");
      return;
    }
    els.workspaceStatus.textContent = "Saving";
    const { data, error } = await backend.client.functions.invoke("workspace-settings", { body: { name } });
    if (error || !data?.company) {
      console.warn("Workspace profile save failed", error);
      els.workspaceStatus.textContent = "Could not save";
      showToast("Could not save the company profile.", "error");
      return;
    }
    backend.company.name = data.company.name;
    els.workspaceStatus.textContent = "Saved";
    showToast("Company profile saved.", "success");
    render();
  });

  els.billingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (backend.live) {
      const { error } = await backend.client
        .from("companies")
        .update({
          billing_provider: els.billingProvider.value,
          billing_account: els.billingAccount.value,
          billing_sync: els.billingSync.value,
        })
        .eq("id", backend.company.id);
      if (error) {
        console.warn("Billing preference failed", error);
        showToast("Could not save the billing preference.", "error");
        return;
      }
      await loadLiveState();
      showToast("Billing preference saved.", "success");
      render();
      return;
    }
    state.settings.billingProvider = els.billingProvider.value;
    state.settings.billingAccount = els.billingAccount.value;
    state.settings.billingSync = els.billingSync.value;
    state.settings.billingConnected = true;
    showToast("Billing preference saved in preview mode.", "success");
    render();
  });

  els.promoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = normalizePromoCode(els.promoCode.value);
    const percent = promoPercentFor(code);
    if (code && !percent) {
      showToast("That promo code is not active yet.", "error");
      return;
    }
    if (backend.live) {
      const { error } = await backend.client
        .from("companies")
        .update({ promo_code: code || null, promo_percent_off: percent })
        .eq("id", backend.company.id);
      if (error) {
        console.warn("Promo save failed", error);
        showToast("Could not save the promo code.", "error");
        return;
      }
      await loadLiveState();
    } else {
      state.settings.promoCode = code;
      state.settings.promoPercentOff = percent;
    }
    showToast(code ? "Promo code saved." : "Promo code removed.", "success");
    render();
  });

  els.checkoutButton.addEventListener("click", () => {
    showToast("Billing is off during early access.", "info");
  });

  els.fieldForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const label = els.fieldLabel.value.trim();
    if (!label) return;
    const field = {
      id: createId(),
      label,
      type: els.fieldType.value,
      options: els.fieldOptions.value.split(",").map((option) => option.trim()).filter(Boolean),
    };
    if (backend.live) {
      const { error } = await backend.client.from("custom_fields").insert({
        company_id: backend.company.id,
        label: field.label,
        field_type: field.type,
        options: field.options,
      });
      if (error) {
        console.warn("Custom field save failed", error);
        showToast("Could not save the custom field.", "error");
        return;
      }
      els.fieldForm.reset();
      await loadLiveState();
      showToast("Custom field added.", "success");
      render();
      return;
    }
    state.settings.customFields.push({
      id: field.id,
      label: field.label,
      type: field.type,
      options: field.options,
    });
    els.fieldForm.reset();
    showToast("Custom field added in preview mode.", "success");
    render();
  });

  els.customFieldList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-field-id]");
    if (!button) return;
    if (backend.live) {
      const { error } = await backend.client.from("custom_fields").delete().eq("id", button.dataset.fieldId);
      if (error) {
        console.warn("Custom field delete failed", error);
        showToast("Could not remove the custom field.", "error");
        return;
      }
      await loadLiveState();
      showToast("Custom field removed.", "success");
      render();
      return;
    }
    state.settings.customFields = state.settings.customFields.filter((field) => field.id !== button.dataset.fieldId);
    showToast("Custom field removed in preview mode.", "success");
    render();
  });

  els.jobForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveJobFromForm();
      els.jobDialog.close();
      showToast("Job saved.", "success");
      render();
    } catch (error) {
      console.warn("Job save failed", error);
      showToast("Could not save the job.", "error");
    }
  });

  els.closeJobDialog.addEventListener("click", () => els.jobDialog.close());
  els.cancelJobDialog.addEventListener("click", () => els.jobDialog.close());

  els.closeEstimateChangesDialog.addEventListener("click", () => els.estimateChangesDialog.close());
  els.cancelEstimateChangesDialog.addEventListener("click", () => els.estimateChangesDialog.close());
  els.estimateChangesForm.addEventListener("submit", (event) => {
    event.preventDefault();
    recordEstimateDecision(els.estimateChangesDocId.value, "changes", els.estimateChangesText.value).catch(() => {
      els.customerPortal.insertAdjacentHTML("afterbegin", `<div class="empty-state">Could not save the response. Please try again.</div>`);
    });
    els.estimateChangesDialog.close();
  });

  els.deleteJob.addEventListener("click", async () => {
    const id = els.jobId.value;
    const job = state.jobs.find((item) => item.id === id);
    if (!job) return;
    if (!window.confirm(`Delete "${job.name}" and all of its records? This cannot be undone.`)) return;
    if (backend.live) {
      const storagePaths = job.documents.map((doc) => doc.storagePath).filter(Boolean);
      const { error } = await backend.client.from("jobs").delete().eq("id", id);
      if (error) {
        console.warn("Job delete failed", error);
        showToast("Could not delete the job.", "error");
        return;
      }
      let storageWarning = false;
      if (storagePaths.length) {
        const { error: storageError } = await backend.client.storage.from(DOCUMENT_BUCKET).remove(storagePaths);
        storageWarning = Boolean(storageError);
        if (storageError) console.warn("Job files could not be removed", storageError);
      }
      els.jobDialog.close();
      await loadLiveState();
      showToast("Job deleted.", "success");
      render();
      if (storageWarning) showToast("Job deleted, but some uploaded files need support cleanup.", "error");
      return;
    }
    state.jobs = state.jobs.filter((job) => job.id !== id);
    selectedJobId = state.jobs[0]?.id || null;
    if (state.portalAccess.jobId === id) {
      state.portalAccess.jobId = selectedJobId;
      state.portalAccess.token = selectedJobId ? "demo-access-reset" : null;
      state.portalAccess.lastSentTo = selectedJob()?.customerEmail || "";
    }
    els.jobDialog.close();
    showToast("Job deleted in preview mode.", "success");
    render();
  });
}

initStaticControls();
bindEvents();
render();
initBackend();
