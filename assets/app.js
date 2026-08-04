const STORAGE_KEY = "serviceJobPortal.v2";
const DOCUMENT_BUCKET = "job-documents";
const BRANDING_BUCKET = "company-branding";
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
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
const trialDays = 14;
const previewPromoCodes = { "20off": 20, "30off": 30 };
const scheduleTimezones = [
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Phoenix", label: "Arizona Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
];
const defaultScheduleSettings = {
  schedulingTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago",
  schedulingWorkdays: [1, 2, 3, 4, 5],
  schedulingWorkdayStart: "08:00",
  schedulingWorkdayEnd: "17:00",
  schedulingBufferMinutes: 30,
};

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createDemoSchedule(daysAhead, hour, durationMinutes) {
  const start = new Date();
  start.setDate(start.getDate() + daysAhead);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const date = [start.getFullYear(), start.getMonth() + 1, start.getDate()]
    .map((part, index) => String(part).padStart(index ? 2 : 4, "0"))
    .join("-");
  return { start: start.toISOString(), end: end.toISOString(), date };
}

const demoPrimarySchedule = createDemoSchedule(2, 9, 240);
const demoRecurringSchedule = createDemoSchedule(4, 10, 120);

const demoState = {
  settings: {
    billingProvider: "QuickBooks Online",
    billingAccount: "Demo Service Co.",
    billingSync: "Invoices and payment status",
    billingConnected: true,
    billingMode: "off",
    subscriptionProvider: "none",
    subscriptionStatus: "trialing",
    canWrite: true,
    trialStartedAt: "2026-07-09T00:00:00.000Z",
    trialEndsAt: "2026-07-23T00:00:00.000Z",
    currentPeriodEndsAt: "",
    graceEndsAt: "",
    cancelAtPeriodEnd: false,
    checkoutUrl: "",
    basePlanPriceCents: monthlyPlanCents,
    planPriceCents: monthlyPlanCents,
    promoCode: "",
    promoPercentOff: 0,
    mileageTrackingEnabled: true,
    ...defaultScheduleSettings,
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
      projectedDate: demoPrimarySchedule.date,
      scheduledStart: demoPrimarySchedule.start,
      scheduledEnd: demoPrimarySchedule.end,
      estimatedDurationMinutes: 240,
      recurrenceFrequency: "none",
      recurrenceInterval: 1,
      recurrenceUntil: "",
      scheduleExceptions: [],
      invoiceUrl: "https://pay.example.com/invoice/garcia",
      nextAction: "Customer needs to upload insurance claim letter.",
      internalNotes: "Adjuster approved roof, gutters still pending.",
      customValues: { "Claim number": "CLM-10492", "Gate code": "2418", "Permit required": "Yes" },
      mileageEntries: [
        { id: createId(), date: "2026-07-18", miles: 18.4, createdAt: "2026-07-18T16:30:00.000Z" },
        { id: createId(), date: "2026-07-02", miles: 11, createdAt: "2026-07-02T14:10:00.000Z" },
      ],
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
      projectedDate: demoRecurringSchedule.date,
      scheduledStart: demoRecurringSchedule.start,
      scheduledEnd: demoRecurringSchedule.end,
      estimatedDurationMinutes: 120,
      recurrenceFrequency: "weekly",
      recurrenceInterval: 2,
      recurrenceUntil: "2026-10-31",
      scheduleExceptions: [],
      invoiceUrl: "",
      nextAction: "Crew scheduled for Thursday morning.",
      internalNotes: "Customer requested shoe covers and driveway parking.",
      customValues: { "Claim number": "", "Gate code": "", "Permit required": "No" },
      mileageEntries: [],
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
  entitlement: null,
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
  canWrite: true,
};

let toastTimer = null;
let pendingLogoPreviewUrl = "";
let pendingLogoRemoval = false;
let jobSaveBusy = false;
let mileageMutationBusy = false;
let jobSearchQuery = "";
let jobStatusFilter = "open";
let jobAttentionFilter = "";

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
  sidebarCompanyLogo: document.getElementById("sidebarCompanyLogo"),
  sidebarBrandFallback: document.getElementById("sidebarBrandFallback"),
  sidebarCompanyName: document.getElementById("sidebarCompanyName"),
  portalCompanyLogo: document.getElementById("portalCompanyLogo"),
  portalBrandFallback: document.getElementById("portalBrandFallback"),
  portalCompanyName: document.getElementById("portalCompanyName"),
  resetDemo: document.getElementById("resetDemo"),
  startJob: document.getElementById("startJob"),
  quickStartJob: document.getElementById("quickStartJob"),
  quickUpdateJob: document.getElementById("quickUpdateJob"),
  attentionSummary: document.getElementById("attentionSummary"),
  attentionQueue: document.getElementById("attentionQueue"),
  upcomingSchedule: document.getElementById("upcomingSchedule"),
  upcomingScheduleCount: document.getElementById("upcomingScheduleCount"),
  jobSearch: document.getElementById("jobSearch"),
  jobStatusFilter: document.getElementById("jobStatusFilter"),
  clearJobFilters: document.getElementById("clearJobFilters"),
  filteredJobCount: document.getElementById("filteredJobCount"),
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
  mileageTrackingEnabled: document.getElementById("mileageTrackingEnabled"),
  mileageTrackingStatus: document.getElementById("mileageTrackingStatus"),
  scheduleSettingsForm: document.getElementById("scheduleSettingsForm"),
  scheduleSettingsStatus: document.getElementById("scheduleSettingsStatus"),
  scheduleTimezone: document.getElementById("scheduleTimezone"),
  scheduleWorkdays: document.getElementById("scheduleWorkdays"),
  scheduleWorkdayStart: document.getElementById("scheduleWorkdayStart"),
  scheduleWorkdayEnd: document.getElementById("scheduleWorkdayEnd"),
  scheduleBufferMinutes: document.getElementById("scheduleBufferMinutes"),
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
  scheduledTime: document.getElementById("scheduledTime"),
  estimatedHours: document.getElementById("estimatedHours"),
  recurrenceEnabled: document.getElementById("recurrenceEnabled"),
  recurrenceControls: document.getElementById("recurrenceControls"),
  recurrencePattern: document.getElementById("recurrencePattern"),
  recurrenceUntilLabel: document.getElementById("recurrenceUntilLabel"),
  recurrenceUntil: document.getElementById("recurrenceUntil"),
  suggestNextAvailable: document.getElementById("suggestNextAvailable"),
  scheduleSuggestionStatus: document.getElementById("scheduleSuggestionStatus"),
  invoiceUrl: document.getElementById("invoiceUrl"),
  customFieldInputs: document.getElementById("customFieldInputs"),
  nextAction: document.getElementById("nextAction"),
  internalNotes: document.getElementById("internalNotes"),
  saveJob: document.getElementById("saveJob"),
  deleteJob: document.getElementById("deleteJob"),
  closeJobDialog: document.getElementById("closeJobDialog"),
  cancelJobDialog: document.getElementById("cancelJobDialog"),
  scheduleVisitDialog: document.getElementById("scheduleVisitDialog"),
  scheduleVisitForm: document.getElementById("scheduleVisitForm"),
  scheduleVisitTitle: document.getElementById("scheduleVisitTitle"),
  scheduleVisitJobId: document.getElementById("scheduleVisitJobId"),
  scheduleVisitOriginalStart: document.getElementById("scheduleVisitOriginalStart"),
  scheduleVisitDate: document.getElementById("scheduleVisitDate"),
  scheduleVisitTime: document.getElementById("scheduleVisitTime"),
  closeScheduleVisitDialog: document.getElementById("closeScheduleVisitDialog"),
  cancelScheduleVisitDialog: document.getElementById("cancelScheduleVisitDialog"),
  skipScheduleVisit: document.getElementById("skipScheduleVisit"),
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
  authConfirmPasswordLabel: document.getElementById("authConfirmPasswordLabel"),
  authConfirmPassword: document.getElementById("authConfirmPassword"),
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
  workspaceLogo: document.getElementById("workspaceLogo"),
  workspaceLogoPreview: document.getElementById("workspaceLogoPreview"),
  workspaceLogoFallback: document.getElementById("workspaceLogoFallback"),
  chooseWorkspaceLogo: document.getElementById("chooseWorkspaceLogo"),
  removeWorkspaceLogo: document.getElementById("removeWorkspaceLogo"),
  subscriptionStatus: document.getElementById("subscriptionStatus"),
  subscriptionSummary: document.getElementById("subscriptionSummary"),
  subscriptionFinePrint: document.getElementById("subscriptionFinePrint"),
  promoForm: document.getElementById("promoForm"),
  promoCode: document.getElementById("promoCode"),
  checkoutButton: document.getElementById("checkoutButton"),
  workspaceAccessNotice: document.getElementById("workspaceAccessNotice"),
  toastRegion: document.getElementById("toastRegion"),
};

function loadState() {
  if (demoMode()) return normalizeState(structuredClone(demoState));
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
  nextState.settings.schedulingWorkdays = Array.isArray(nextState.settings.schedulingWorkdays)
    ? nextState.settings.schedulingWorkdays.map(Number).filter((day) => day >= 0 && day <= 6)
    : [...defaultScheduleSettings.schedulingWorkdays];
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
    job.mileageEntries = Array.isArray(job.mileageEntries) ? job.mileageEntries : [];
    job.scheduledStart = job.scheduledStart || null;
    job.scheduledEnd = job.scheduledEnd || null;
    job.estimatedDurationMinutes = Math.max(30, Number(job.estimatedDurationMinutes || 60));
    job.recurrenceFrequency = ["weekly", "monthly"].includes(job.recurrenceFrequency) ? job.recurrenceFrequency : "none";
    job.recurrenceInterval = Math.max(1, Number(job.recurrenceInterval || 1));
    job.recurrenceUntil = job.recurrenceUntil || "";
    job.scheduleExceptions = Array.isArray(job.scheduleExceptions) ? job.scheduleExceptions : [];
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
  if (demoMode()) return false;
  const config = window.SERVICE_PORTAL_CONFIG;
  return Boolean(config?.supabaseUrl && config?.supabasePublishableKey && window.supabase?.createClient);
}

function demoMode() {
  return new URLSearchParams(window.location.search).has("demo");
}

function readOnlyPreviewMode() {
  return demoMode() && new URLSearchParams(window.location.search).get("demo") === "readonly";
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
  if (/read.?only|billing.*restored|trial.*ended/i.test(message)) return "Your trial has ended. The workspace is read-only until billing is restored.";
  if (/network|fetch|timeout/i.test(message)) return "Connection issue. Please try again.";
  return fallback;
}

function workspaceCanWrite() {
  if (readOnlyPreviewMode()) return false;
  if (!backend.live) return true;
  return backend.entitlement?.can_write ?? state.settings.canWrite ?? true;
}

function requireWorkspaceWriteAccess() {
  if (workspaceCanWrite()) return true;
  showToast("Your trial has ended. The workspace is read-only until billing is restored.", "error");
  return false;
}

async function edgeFunctionErrorMessage(error, fallback) {
  const response = error?.context;
  if (response?.json) {
    try {
      const readableResponse = response.clone ? response.clone() : response;
      const body = await readableResponse.json();
      if (body?.error) return String(body.error);
    } catch {
      // Fall through to the standard public error below.
    }
  }
  return publicError(error, fallback);
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

  if (demoMode()) {
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
  els.authConfirmPasswordLabel.hidden = backend.recovery || backend.authMode !== "signup";
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
    els.authConfirmPassword.autocomplete = "new-password";
  } else {
    els.authStatus.textContent = "Contractor sign in";
    els.backendStatus.textContent = "Enter your contractor email and password.";
    setButtonLabel(els.authSubmit, "log-in", "Sign in");
    els.authSubmit.value = "signin";
    setButtonLabel(els.authCreate, "user-plus", "Create account");
    els.authPassword.autocomplete = "current-password";
    els.authConfirmPassword.value = "";
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
  if (demoMode() && new URLSearchParams(window.location.search).has("portalPreview")) {
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
  const confirmPassword = els.authConfirmPassword.value;
  if (!email || !password) {
    els.backendStatus.textContent = "Enter your email and password.";
    return;
  }
  if (password.length < 6) {
    els.backendStatus.textContent = "Use at least 6 characters for the password.";
    return;
  }
  if (mode === "signup" && !confirmPassword) {
    els.backendStatus.textContent = "Enter the password again to confirm it.";
    return;
  }
  if (mode === "signup" && password !== confirmPassword) {
    els.backendStatus.textContent = "Passwords do not match.";
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

function mapDbMileageEntry(entry) {
  return {
    id: entry.id,
    date: entry.mileage_date,
    miles: Number(entry.miles || 0),
    createdAt: entry.created_at,
  };
}

function mapDbScheduleException(exception) {
  return {
    id: exception.id,
    originalStart: exception.occurrence_start,
    replacementStart: exception.replacement_start || null,
    replacementEnd: exception.replacement_end || null,
    status: exception.status,
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
    scheduledStart: job.scheduled_start || null,
    scheduledEnd: job.scheduled_end || null,
    estimatedDurationMinutes: Math.max(30, Number(job.estimated_duration_minutes || 60)),
    recurrenceFrequency: job.recurrence_frequency || "none",
    recurrenceInterval: Math.max(1, Number(job.recurrence_interval || 1)),
    recurrenceUntil: job.recurrence_until || "",
    scheduleExceptions: (job.schedule_exceptions || []).map(mapDbScheduleException),
    invoiceUrl: job.invoice_url || "",
    nextAction: job.next_action || "",
    internalNotes: job.internal_notes || "",
    customValues: job.custom_values || {},
    mileageEntries: (job.mileage_entries || [])
      .map(mapDbMileageEntry)
      .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt)),
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
  const [
    { data: company, error: companyError },
    { data: fields, error: fieldsError },
    { data: jobs, error: jobsError },
    { data: entitlement, error: entitlementError },
  ] =
    await Promise.all([
      backend.client.from("companies").select("*").eq("id", companyId).single(),
      backend.client.from("custom_fields").select("*").eq("company_id", companyId).order("created_at"),
      backend.client
        .from("jobs")
        .select("*, customers(*), documents(*), estimate_acceptances(*), mileage_entries(*), schedule_exceptions(*)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      backend.client.rpc("get_my_company_entitlement").maybeSingle(),
    ]);

  if (companyError) throw companyError;
  if (fieldsError) throw fieldsError;
  if (jobsError) throw jobsError;
  if (entitlementError) throw entitlementError;

  backend.company = company;
  backend.entitlement = entitlement || null;
  state.settings = {
    billingProvider: company.billing_provider || "QuickBooks Online",
    billingAccount: company.billing_account || company.name || "",
    billingSync: company.billing_sync || "Invoice links only",
    billingConnected: Boolean(company.billing_provider),
    billingMode: entitlement?.billing_mode || "off",
    subscriptionProvider: entitlement?.provider || "none",
    subscriptionStatus: entitlement?.status || company.subscription_status || "trialing",
    canWrite: entitlement?.can_write ?? true,
    trialStartedAt: entitlement?.trial_started_at || company.trial_started_at || company.created_at,
    trialEndsAt: entitlement?.trial_ends_at || company.trial_ends_at || "",
    currentPeriodEndsAt: entitlement?.current_period_ends_at || "",
    graceEndsAt: entitlement?.grace_ends_at || "",
    cancelAtPeriodEnd: Boolean(entitlement?.cancel_at_period_end),
    checkoutUrl: entitlement?.checkout_url || "",
    basePlanPriceCents: entitlement?.base_plan_price_cents || monthlyPlanCents,
    planPriceCents: entitlement?.plan_price_cents || monthlyPlanCents,
    promoCode: entitlement?.promo_code || "",
    promoPercentOff: entitlement?.promo_percent_off || 0,
    mileageTrackingEnabled: Boolean(company.mileage_tracking_enabled),
    schedulingTimezone: company.scheduling_timezone || defaultScheduleSettings.schedulingTimezone,
    schedulingWorkdays: Array.isArray(company.scheduling_workdays)
      ? company.scheduling_workdays.map(Number)
      : [...defaultScheduleSettings.schedulingWorkdays],
    schedulingWorkdayStart: String(company.scheduling_workday_start || defaultScheduleSettings.schedulingWorkdayStart).slice(0, 5),
    schedulingWorkdayEnd: String(company.scheduling_workday_end || defaultScheduleSettings.schedulingWorkdayEnd).slice(0, 5),
    schedulingBufferMinutes: Number(company.scheduling_buffer_minutes ?? defaultScheduleSettings.schedulingBufferMinutes),
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

function applyPortalCompany(companyData) {
  if (!companyData) return;
  backend.company = {
    id: companyData.id || null,
    name: companyData.name || "Service Portal",
    logo_url: companyData.logo_url || "",
    logo_path: null,
  };
  if (companyData.scheduling_timezone) state.settings.schedulingTimezone = companyData.scheduling_timezone;
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
    if (actionPayload.action && actionPayload.action !== "payload") {
      const message = await edgeFunctionErrorMessage(error, "Could not save that change. Please try again.");
      showToast(message, "error");
      render();
      activateCustomerPortalView();
      return;
    }
    els.customerPortal.innerHTML = `<div class="empty-state">This portal link is invalid or expired. Please ask the contractor to send a new link.</div>`;
    return;
  }
  applyPortalCompany(data.company);
  portalMode.canWrite = data.can_write !== false;
  applyPortalJob(data.job);
  render();
  activateCustomerPortalView();
}

function selectedJob() {
  return state.jobs.find((job) => job.id === selectedJobId) || null;
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

const attentionDefinitions = [
  { id: "customer-upload", label: "New uploads", icon: "cloud-upload" },
  { id: "estimate-response", label: "Estimate replies", icon: "file-check-2" },
  { id: "unscheduled", label: "Needs scheduling", icon: "calendar-plus" },
  { id: "past-date", label: "Past projected date", icon: "calendar-clock" },
];

function isOpenJob(job) {
  return job.jobStatus !== "Complete";
}

function attentionCategoriesForJob(job) {
  const categories = [];
  const activeDocuments = (job.documents || []).filter((doc) => doc.status !== "Archived");
  if (activeDocuments.some((doc) => doc.uploadedBy === "Customer" && doc.status === "New")) {
    categories.push("customer-upload");
  }
  const estimate = estimateFor(job);
  if (
    estimate
    && job.estimateDecision?.documentId === estimate.id
    && ["changes", "reject"].includes(job.estimateDecision.status)
  ) {
    categories.push("estimate-response");
  }
  if (isOpenJob(job) && !job.projectedDate) categories.push("unscheduled");
  if (isOpenJob(job) && job.projectedDate && job.projectedDate < todayInputValue()) categories.push("past-date");
  return categories;
}

function filteredJobs() {
  const query = jobSearchQuery.trim().toLowerCase();
  return state.jobs.filter((job) => {
    const searchable = [job.name, job.customerName, job.serviceAddress, job.customerEmail]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (jobStatusFilter === "all") return true;
    if (jobStatusFilter === "open") return isOpenJob(job);
    if (jobStatusFilter === "attention") {
      const categories = attentionCategoriesForJob(job);
      return jobAttentionFilter ? categories.includes(jobAttentionFilter) : categories.length > 0;
    }
    return job.jobStatus === jobStatusFilter;
  });
}

function ensureFilteredJobSelection(jobs = filteredJobs()) {
  if (!jobs.some((job) => job.id === selectedJobId)) {
    selectedJobId = jobs[0]?.id || null;
  }
  return jobs;
}

function attentionLabelForJob(job) {
  const categories = attentionCategoriesForJob(job);
  if (!categories.length) return "";
  const labels = categories
    .map((category) => attentionDefinitions.find((item) => item.id === category)?.label)
    .filter(Boolean);
  return labels.length > 1 ? `${labels[0]} +${labels.length - 1}` : labels[0];
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
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
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

function formatMiles(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(Number(value || 0));
}

function todayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function scheduleTimezone() {
  return state.settings.schedulingTimezone || defaultScheduleSettings.schedulingTimezone;
}

function datePartsInTimezone(value, timeZone = scheduleTimezone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function dateInputInTimezone(value, timeZone = scheduleTimezone()) {
  if (!value) return "";
  const parts = datePartsInTimezone(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function timeInputInTimezone(value, timeZone = scheduleTimezone()) {
  if (!value) return "";
  const parts = datePartsInTimezone(value, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

function zonedDateTimeToUtc(dateValue, timeValue, timeZone = scheduleTimezone()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue || "") || !/^\d{2}:\d{2}$/.test(timeValue || "")) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
  let result = targetUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = datePartsInTimezone(result, timeZone);
    const renderedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    const adjustment = targetUtc - renderedUtc;
    result += adjustment;
    if (!adjustment) break;
  }
  return new Date(result);
}

function addCalendarDays(dateValue, days) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function addCalendarMonths(dateValue, months) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const monthIndex = month - 1 + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function weekdayForDate(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function formatScheduleDateTime(value) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: scheduleTimezone(),
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(minutes) {
  const total = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(total / 60);
  const remaining = total % 60;
  if (!hours) return `${remaining} min`;
  if (!remaining) return `${hours} ${hours === 1 ? "hr" : "hrs"}`;
  return `${hours} hr ${remaining} min`;
}

function recurrenceLabel(job) {
  if (job.recurrenceFrequency === "weekly") {
    return Number(job.recurrenceInterval || 1) === 2 ? "Every 2 weeks" : "Every week";
  }
  if (job.recurrenceFrequency === "monthly") return "Every month";
  return "One visit";
}

function scheduleExceptionFor(job, originalStart) {
  const target = new Date(originalStart).getTime();
  return (job.scheduleExceptions || []).find((exception) => new Date(exception.originalStart).getTime() === target);
}

function occurrencesForJob(job, rangeStart, rangeEnd, includeSkipped = false) {
  if (!job.scheduledStart || job.jobStatus === "Complete") return [];
  const baseStart = new Date(job.scheduledStart);
  if (Number.isNaN(baseStart.getTime())) return [];
  const duration = Math.max(30, Number(job.estimatedDurationMinutes || 60));
  const baseDate = dateInputInTimezone(baseStart);
  const baseTime = timeInputInTimezone(baseStart);
  const frequency = job.recurrenceFrequency || "none";
  const interval = Math.max(1, Number(job.recurrenceInterval || 1));
  const until = job.recurrenceUntil || "";
  const occurrences = [];
  let occurrenceDate = baseDate;

  for (let index = 0; index < 520; index += 1) {
    if (until && occurrenceDate > until) break;
    const originalDate = frequency === "none" && index === 0
      ? baseStart
      : zonedDateTimeToUtc(occurrenceDate, baseTime);
    if (!originalDate || originalDate > rangeEnd) break;
    const originalStart = originalDate.toISOString();
    const exception = scheduleExceptionFor(job, originalStart);
    const skipped = exception?.status === "skipped";
    const occurrenceStart = exception?.status === "rescheduled" && exception.replacementStart
      ? new Date(exception.replacementStart)
      : originalDate;
    const occurrenceEnd = exception?.status === "rescheduled" && exception.replacementEnd
      ? new Date(exception.replacementEnd)
      : new Date(occurrenceStart.getTime() + duration * 60_000);
    if ((includeSkipped || !skipped) && occurrenceEnd >= rangeStart && occurrenceStart <= rangeEnd) {
      occurrences.push({
        job,
        originalStart,
        start: occurrenceStart.toISOString(),
        end: occurrenceEnd.toISOString(),
        status: skipped ? "skipped" : exception?.status || "scheduled",
      });
    }
    if (frequency === "none") break;
    occurrenceDate = frequency === "monthly"
      ? addCalendarMonths(baseDate, (index + 1) * interval)
      : addCalendarDays(baseDate, (index + 1) * interval * 7);
  }
  return occurrences;
}

function upcomingOccurrences(days = 90) {
  const start = new Date();
  const end = new Date(start.getTime() + days * 86_400_000);
  return state.jobs
    .flatMap((job) => occurrencesForJob(job, start, end))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

function nextOccurrenceForJob(job) {
  const now = new Date();
  const end = new Date(now.getTime() + 400 * 86_400_000);
  return occurrencesForJob(job, now, end)[0] || null;
}

function candidateHasConflict(start, end, excludedJobId = "", excludedOriginalStart = "") {
  const bufferMs = Math.max(0, Number(state.settings.schedulingBufferMinutes || 0)) * 60_000;
  const rangeStart = new Date(start.getTime() - 86_400_000);
  const rangeEnd = new Date(end.getTime() + 86_400_000);
  return state.jobs.some((job) => occurrencesForJob(job, rangeStart, rangeEnd).some((occurrence) => {
    if (job.id === excludedJobId && (!excludedOriginalStart || occurrence.originalStart === excludedOriginalStart)) return false;
    const busyStart = new Date(occurrence.start).getTime();
    const busyEnd = new Date(occurrence.end).getTime();
    return start.getTime() < busyEnd + bufferMs && end.getTime() + bufferMs > busyStart;
  }));
}

function suggestNextAvailableSlot(durationMinutes, earliestDate = "", excludedJobId = "") {
  const timeZone = scheduleTimezone();
  const now = new Date();
  const today = dateInputInTimezone(now, timeZone);
  const firstDate = earliestDate && earliestDate > today ? earliestDate : today;
  const workdays = state.settings.schedulingWorkdays || defaultScheduleSettings.schedulingWorkdays;
  const dayStartTime = state.settings.schedulingWorkdayStart || defaultScheduleSettings.schedulingWorkdayStart;
  const dayEndTime = state.settings.schedulingWorkdayEnd || defaultScheduleSettings.schedulingWorkdayEnd;
  const durationMs = Math.max(30, Number(durationMinutes || 60)) * 60_000;

  for (let offset = 0; offset <= 90; offset += 1) {
    const dateValue = addCalendarDays(firstDate, offset);
    if (!workdays.includes(weekdayForDate(dateValue))) continue;
    const workdayStart = zonedDateTimeToUtc(dateValue, dayStartTime, timeZone);
    const workdayEnd = zonedDateTimeToUtc(dateValue, dayEndTime, timeZone);
    if (!workdayStart || !workdayEnd || workdayEnd <= workdayStart) continue;
    let cursorMs = Math.max(workdayStart.getTime(), now.getTime());
    cursorMs = Math.ceil(cursorMs / (15 * 60_000)) * 15 * 60_000;
    while (cursorMs + durationMs <= workdayEnd.getTime()) {
      const start = new Date(cursorMs);
      const end = new Date(cursorMs + durationMs);
      if (!candidateHasConflict(start, end, excludedJobId)) return { start, end };
      cursorMs += 15 * 60_000;
    }
  }
  return null;
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
  const browserTimezone = defaultScheduleSettings.schedulingTimezone;
  const timezoneOptions = scheduleTimezones.some((item) => item.value === browserTimezone)
    ? scheduleTimezones
    : [{ value: browserTimezone, label: `Local time (${browserTimezone})` }, ...scheduleTimezones];
  populateSelect(els.scheduleTimezone, timezoneOptions, "value", "label");
}

function render() {
  saveState();
  renderAuth();
  renderBranding();
  renderMetrics();
  renderAttentionQueue();
  renderUpcomingSchedule();
  renderJobs();
  renderJobDetail();
  renderCustomerAccessSummary();
  renderCustomerPortal();
  renderSettings();
  renderWorkspaceAccess();
  refreshIcons();
}

function companyLogoUrl(company = backend.company) {
  if (!company) return "";
  const directUrl = safeExternalUrl(company.logo_url || company.logoUrl);
  if (directUrl) return directUrl;
  if (!company.logo_path || !backend.client) return "";
  const { data } = backend.client.storage.from(BRANDING_BUCKET).getPublicUrl(company.logo_path);
  return safeExternalUrl(data?.publicUrl);
}

function renderBrandImage(image, fallback, url) {
  if (!image || !fallback) return;
  image.src = url || "";
  image.hidden = !url;
  fallback.hidden = Boolean(url);
}

function renderBranding() {
  const companyName = backend.company?.name || "Service Portal";
  const logoUrl = companyLogoUrl();
  els.sidebarCompanyName.textContent = companyName;
  els.portalCompanyName.textContent = companyName;
  renderBrandImage(els.sidebarCompanyLogo, els.sidebarBrandFallback, logoUrl);
  renderBrandImage(els.portalCompanyLogo, els.portalBrandFallback, logoUrl);
}

function renderMetrics() {
  const active = state.jobs.filter((job) => job.jobStatus !== "Complete").length;
  els.activeJobCount.textContent = `${active} active ${active === 1 ? "job" : "jobs"}`;
  const status = state.settings.subscriptionStatus;
  els.billingProviderSummary.textContent = state.settings.billingMode === "off"
    ? "Early access"
    : status === "trialing"
      ? `${trialDaysLeft()} trial ${trialDaysLeft() === 1 ? "day" : "days"} left`
      : status === "active"
        ? "Plan active"
        : workspaceCanWrite()
          ? "Payment needs attention"
          : "Read-only";
}

function renderAttentionQueue() {
  const attentionJobs = state.jobs.filter((job) => attentionCategoriesForJob(job).length > 0);
  els.attentionSummary.textContent = `${attentionJobs.length} ${attentionJobs.length === 1 ? "job" : "jobs"}`;
  els.attentionQueue.innerHTML = attentionDefinitions
    .map((item) => {
      const count = state.jobs.filter((job) => attentionCategoriesForJob(job).includes(item.id)).length;
      const pressed = jobStatusFilter === "attention" && jobAttentionFilter === item.id;
      return `
        <button class="attention-item ${pressed ? "active" : ""}" data-attention-filter="${escapeHtml(item.id)}" type="button" aria-pressed="${pressed}" ${count ? "" : "disabled"}>
          <span class="attention-icon">${iconMarkup(item.icon)}</span>
          <span><strong>${count}</strong><small>${escapeHtml(item.label)}</small></span>
        </button>
      `;
    })
    .join("");
}

function renderUpcomingSchedule() {
  const allOccurrences = upcomingOccurrences(90);
  const occurrences = allOccurrences.slice(0, 8);
  els.upcomingScheduleCount.textContent = `${allOccurrences.length} ${allOccurrences.length === 1 ? "visit" : "visits"}`;
  els.upcomingSchedule.innerHTML = occurrences.length
    ? occurrences.map((occurrence) => {
        const job = occurrence.job;
        const recurring = job.recurrenceFrequency !== "none";
        return `
          <div class="schedule-row ${job.id === selectedJobId ? "active" : ""}">
            <button class="schedule-row-main" data-schedule-job-id="${escapeHtml(job.id)}" type="button">
              <span class="schedule-date-block">
                <strong>${escapeHtml(new Intl.DateTimeFormat(undefined, { timeZone: scheduleTimezone(), month: "short", day: "numeric" }).format(new Date(occurrence.start)))}</strong>
                <small>${escapeHtml(new Intl.DateTimeFormat(undefined, { timeZone: scheduleTimezone(), hour: "numeric", minute: "2-digit" }).format(new Date(occurrence.start)))}</small>
              </span>
              <span class="schedule-job-copy">
                <strong>${escapeHtml(job.name)}</strong>
                <small>${escapeHtml(job.customerName)} / ${escapeHtml(formatDuration(job.estimatedDurationMinutes))}</small>
              </span>
            </button>
            ${recurring ? `
              <button class="icon-button" data-action="reschedule-occurrence" data-job-id="${escapeHtml(job.id)}" data-original-start="${escapeHtml(occurrence.originalStart)}" type="button" aria-label="Change this visit" title="Change this visit">
                ${iconMarkup("calendar-cog")}
              </button>
            ` : ""}
          </div>
        `;
      }).join("")
    : `<div class="empty-state">No visits are scheduled in the next 90 days.</div>`;
}

function renderJobs() {
  const jobs = ensureFilteredJobSelection();
  els.quickUpdateJob.disabled = !selectedJob();
  els.jobSearch.value = jobSearchQuery;
  els.jobStatusFilter.value = jobStatusFilter;
  els.clearJobFilters.hidden = !jobSearchQuery && jobStatusFilter === "open" && !jobAttentionFilter;
  els.filteredJobCount.textContent = `${jobs.length} shown`;
  els.jobList.innerHTML = jobs
    .map(
      (job) => {
        const attentionLabel = attentionLabelForJob(job);
        return `
        <button class="job-row ${job.id === selectedJobId ? "active" : ""}" data-job-id="${job.id}" type="button" aria-pressed="${job.id === selectedJobId}">
          <span>
            <strong>${escapeHtml(job.name)}</strong>
            <small>${escapeHtml(job.customerName)}</small>
            ${attentionLabel ? `<small class="job-attention-label">${escapeHtml(attentionLabel)}</small>` : ""}
          </span>
          <em class="job-status" data-status="${escapeHtml(job.jobStatus)}">${escapeHtml(job.jobStatus)}</em>
        </button>
      `;
      },
    )
    .join("");

  if (!jobs.length) {
    els.jobList.innerHTML = state.jobs.length
      ? `<div class="empty-state">No jobs match this search or filter.</div>`
      : `<div class="empty-state">No jobs yet.</div>`;
  }
}

function renderJobDetail() {
  const job = selectedJob();
  if (!job) {
    els.detailTitle.textContent = state.jobs.length ? "No matching job" : "No jobs yet";
    els.detailStatus.textContent = "Empty";
    els.detailStatus.dataset.status = "Empty";
    els.jobDetail.classList.add("empty-state");
    els.jobDetail.innerHTML = state.jobs.length
      ? "Adjust the search or filter to select a job."
      : "Start a job to create the first customer portal.";
    return;
  }

  const estimate = estimateFor(job);
  const activeDocuments = job.documents.filter((doc) => doc.status !== "Archived");
  const archivedDocuments = job.documents.filter((doc) => doc.status === "Archived");
  const visibleDocs = activeDocuments.filter((doc) => doc.visibility === "Customer Visible").length;
  const customerDocs = activeDocuments.filter((doc) => doc.uploadedBy === "Customer").length;
  const archivedDocs = job.documents.length - activeDocuments.length;
  const invoiceUrl = safeExternalUrl(job.invoiceUrl);
  const nextAppointment = nextOccurrenceForJob(job);
  const billingProvider = state.settings.billingConnected ? state.settings.billingProvider : "Billing not configured";
  els.detailTitle.textContent = job.name;
  els.detailStatus.textContent = job.jobStatus;
  els.detailStatus.dataset.status = job.jobStatus;
  els.jobDetail.classList.remove("empty-state");
  els.jobDetail.innerHTML = `
    <div class="detail-actions">
      <button class="primary-button" data-action="edit-job" data-requires-write type="button">${iconMarkup("pencil-line")}<span>Edit job</span></button>
      <button class="ghost-button" data-action="send-email" data-requires-write type="button">${iconMarkup("mail")}<span>Email customer</span></button>
      <button class="ghost-button" data-action="upload-estimate" data-requires-write type="button">${iconMarkup("file-up")}<span>Upload estimate</span></button>
      <button class="ghost-button" data-action="upload-staff-doc" data-requires-write type="button">${iconMarkup("paperclip")}<span>Add shared file</span></button>
    </div>
    ${job.actionMessage ? `<div class="action-feedback" role="status">${iconMarkup("info")}<span>${escapeHtml(job.actionMessage)}</span></div>` : ""}
    <div class="stat-grid">
      <div><span>Customer</span><strong>${escapeHtml(job.customerName)}</strong></div>
      <div><span>Next visit</span><strong>${nextAppointment ? formatScheduleDateTime(nextAppointment.start) : formatDate(job.projectedDate)}</strong></div>
      <div><span>Material or parts status</span><strong>${escapeHtml(job.materialStatus)}</strong></div>
      <div><span>Estimate</span><strong>${escapeHtml(estimateStatus(job))}</strong></div>
    </div>
    <section class="plain-section estimate-summary">
      <h3>Estimate</h3>
      ${renderContractorEstimateStatus(job, estimate)}
    </section>
    <section class="plain-section schedule-summary">
      <h3>Schedule</h3>
      ${nextAppointment ? `
        <div class="schedule-summary-line">
          <span>${iconMarkup("calendar-clock")}</span>
          <span>
            <strong>${escapeHtml(formatScheduleDateTime(nextAppointment.start))}</strong>
            <small>${escapeHtml(formatDuration(job.estimatedDurationMinutes))} / ${escapeHtml(recurrenceLabel(job))}${job.recurrenceUntil ? ` through ${escapeHtml(formatDate(job.recurrenceUntil))}` : ""}</small>
          </span>
        </div>
      ` : `<p>No appointment time has been scheduled.</p>`}
    </section>
    <section class="plain-section">
      <h3>Next action</h3>
      <p>${escapeHtml(job.nextAction || "No next action set.")}</p>
    </section>
    <section class="plain-section">
      <h3>Billing</h3>
      <p>${escapeHtml(billingProvider)} / ${invoiceUrl ? `<a href="${escapeHtml(invoiceUrl)}" target="_blank" rel="noopener noreferrer">Invoice link</a>` : "No invoice linked"}</p>
    </section>
    ${renderMileageTracker(job)}
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

function renderMileageTracker(job) {
  if (!state.settings.mileageTrackingEnabled) return "";
  const entries = job.mileageEntries || [];
  const total = entries.reduce((sum, entry) => sum + Number(entry.miles || 0), 0);
  return `
    <section class="plain-section mileage-section">
      <div class="mileage-heading">
        <h3>Mileage</h3>
        <span class="mileage-total">${escapeHtml(formatMiles(total))} total miles</span>
      </div>
      <form class="mileage-entry-form" data-mileage-form>
        <label>
          Date
          <input name="mileageDate" data-requires-write type="date" value="${todayInputValue()}" required />
        </label>
        <label>
          Miles
          <input name="mileageMiles" data-requires-write type="number" min="0.1" max="10000" step="0.1" inputmode="decimal" placeholder="0.0" required />
        </label>
        <button class="primary-button" data-requires-write type="submit">${iconMarkup("plus")}<span>Add mileage</span></button>
      </form>
      <div class="mileage-list">
        ${entries.length ? entries.map((entry) => `
          <div class="mileage-row">
            <span>${escapeHtml(formatDate(entry.date))}</span>
            <strong>${escapeHtml(formatMiles(entry.miles))} mi</strong>
            <button class="icon-button" data-action="delete-mileage" data-mileage-id="${escapeHtml(entry.id)}" data-requires-write type="button" aria-label="Remove mileage entry" title="Remove mileage entry">${iconMarkup("trash-2")}</button>
          </div>
        `).join("") : `<div class="empty-state">No mileage recorded for this job.</div>`}
      </div>
    </section>
  `;
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
            <button class="text-button document-archive-button" data-action="${archived ? "restore-document" : "archive-document"}" data-doc-id="${escapeHtml(doc.id)}" data-requires-write type="button">${iconMarkup(archived ? "archive-restore" : "archive")}<span>${archived ? "Restore" : "Archive"}</span></button>
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
  const nextAppointment = nextOccurrenceForJob(job);
  if (nextAppointment) items.push(`Next visit: ${formatScheduleDateTime(nextAppointment.start)}`);
  else if (job.projectedDate) items.push(`Projected service date: ${formatDate(job.projectedDate)}`);
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
  const nextAppointment = nextOccurrenceForJob(job);
  els.customerPortal.innerHTML = `
    <div class="customer-hero">
      <div>
        <p class="eyebrow">Customer portal</p>
        <h2>${escapeHtml(job.name)}</h2>
        <p>${escapeHtml(job.serviceAddress)}</p>
      </div>
      <span class="status-pill" data-status="${escapeHtml(job.jobStatus)}">${escapeHtml(job.jobStatus)}</span>
    </div>
    ${portalMode.active && !portalMode.canWrite ? `<div class="action-feedback" role="status">${iconMarkup("lock-keyhole")}<span>This portal is temporarily read-only. Files and job details remain available.</span></div>` : ""}
    <div class="stat-grid">
      <div><span>Material or parts status</span><strong>${escapeHtml(job.materialStatus)}</strong></div>
      <div><span>Next visit</span><strong>${nextAppointment ? formatScheduleDateTime(nextAppointment.start) : formatDate(job.projectedDate)}</strong></div>
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
          <button class="ghost-button" data-action="customer-upload" data-doc-type="Insurance Claim" type="button" ${portalMode.canWrite ? "" : "disabled"}>${iconMarkup("upload")}<span>Upload insurance claim</span></button>
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
        <button class="accept-button" data-action="estimate-decision" data-decision="accept" data-doc-id="${escapeHtml(estimate.id)}" type="button" ${viewed && portalMode.canWrite ? "" : "disabled"}>${iconMarkup("check")}<span>I accept</span></button>
        <button class="ghost-button" data-action="estimate-decision" data-decision="changes" data-doc-id="${escapeHtml(estimate.id)}" type="button" ${viewed && portalMode.canWrite ? "" : "disabled"}>${iconMarkup("message-square-text")}<span>Accept with changes</span></button>
        <button class="danger-button" data-action="estimate-decision" data-decision="reject" data-doc-id="${escapeHtml(estimate.id)}" type="button" ${viewed && portalMode.canWrite ? "" : "disabled"}>${iconMarkup("x-circle")}<span>Do not accept</span></button>
        <small>Your response will be saved with this estimate version.</small>
      </div>
    ` : `<p class="fine-print">Response controls appear in the secure customer portal sent by email.</p>`}
  `;
}

function renderSettings() {
  els.workspaceName.value = backend.company?.name || "";
  els.workspaceEmail.value = backend.user?.email || "";
  els.workspaceStatus.textContent = backend.live ? "Saved" : "Preview";
  const savedLogoUrl = pendingLogoRemoval ? "" : companyLogoUrl();
  const previewLogoUrl = pendingLogoPreviewUrl || savedLogoUrl;
  renderBrandImage(els.workspaceLogoPreview, els.workspaceLogoFallback, previewLogoUrl);
  els.removeWorkspaceLogo.hidden = !previewLogoUrl;
  els.billingProvider.value = state.settings.billingProvider;
  els.billingAccount.value = state.settings.billingAccount || "";
  els.billingSync.value = state.settings.billingSync;
  els.billingStatus.textContent = state.settings.billingConnected ? "Preference saved" : "Not connected";
  els.mileageTrackingEnabled.checked = Boolean(state.settings.mileageTrackingEnabled);
  els.mileageTrackingStatus.textContent = state.settings.mileageTrackingEnabled ? "On" : "Off";
  els.mileageTrackingStatus.dataset.status = state.settings.mileageTrackingEnabled ? "Active" : "Empty";
  if (![...els.scheduleTimezone.options].some((option) => option.value === scheduleTimezone())) {
    els.scheduleTimezone.add(new Option(scheduleTimezone(), scheduleTimezone()));
  }
  els.scheduleTimezone.value = scheduleTimezone();
  els.scheduleWorkdayStart.value = state.settings.schedulingWorkdayStart || defaultScheduleSettings.schedulingWorkdayStart;
  els.scheduleWorkdayEnd.value = state.settings.schedulingWorkdayEnd || defaultScheduleSettings.schedulingWorkdayEnd;
  els.scheduleBufferMinutes.value = String(state.settings.schedulingBufferMinutes ?? defaultScheduleSettings.schedulingBufferMinutes);
  const selectedWorkdays = state.settings.schedulingWorkdays || defaultScheduleSettings.schedulingWorkdays;
  els.scheduleWorkdays.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = selectedWorkdays.includes(Number(checkbox.value));
  });
  els.scheduleSettingsStatus.textContent = backend.live ? "Saved" : "Preview";
  els.scheduleSettingsStatus.dataset.status = "Active";
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
              <button class="ghost-button" data-field-id="${field.id}" data-requires-write type="button">${iconMarkup("trash-2")}<span>Remove</span></button>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">Add a field contractors can fill out on every job.</div>`;

}

function logoValidationError(file) {
  if (!file?.size) return "That logo file is empty.";
  if (file.size > MAX_LOGO_BYTES) return "Logo files must be 2 MB or smaller.";
  if (!ALLOWED_LOGO_TYPES.has(file.type)) return "Use a PNG, JPG, or WebP logo.";
  return "";
}

function clearPendingLogo() {
  if (pendingLogoPreviewUrl) URL.revokeObjectURL(pendingLogoPreviewUrl);
  pendingLogoPreviewUrl = "";
  pendingLogoRemoval = false;
  els.workspaceLogo.value = "";
}

async function uploadCompanyLogo(file) {
  const validationError = logoValidationError(file);
  if (validationError) throw new Error(validationError);
  const storagePath = `${backend.company.id}/logo-${Date.now()}-${safeStorageName(file.name)}`;
  const { error } = await backend.client.storage.from(BRANDING_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return storagePath;
}

function normalizePromoCode(value) {
  return (value || "").trim().toLowerCase();
}

function promoPercentFor(value) {
  return previewPromoCodes[normalizePromoCode(value)] || 0;
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
  const billingMode = state.settings.billingMode || "off";
  const status = state.settings.subscriptionStatus || "trialing";
  const canWrite = workspaceCanWrite();
  const basePrice = Number(state.settings.basePlanPriceCents || monthlyPlanCents);
  const planPrice = Number(state.settings.planPriceCents || basePrice);
  const checkoutUrl = safeExternalUrl(state.settings.checkoutUrl || window.SERVICE_PORTAL_CONFIG?.waveCheckoutUrl);
  const promoPercent = Number(state.settings.promoPercentOff || 0);
  const daysLeft = trialDaysLeft();

  els.promoCode.value = state.settings.promoCode || "";
  els.subscriptionStatus.dataset.status = canWrite ? "Active" : "On Hold";

  if (billingMode === "off") {
    els.subscriptionStatus.textContent = "Early access";
    els.subscriptionSummary.innerHTML = `
      <span>
        <strong>Free early access</strong>
        <small>Billing is prepared but has not been activated.</small>
      </span>
      <small>You will receive notice before the 14-day paid trial begins.</small>
    `;
    els.promoForm.hidden = true;
    els.checkoutButton.hidden = true;
    els.subscriptionFinePrint.textContent = "Early access remains free until billing is deliberately activated.";
    return;
  }

  if (status === "active") {
    els.subscriptionStatus.textContent = "Active";
    els.subscriptionSummary.innerHTML = `
      <span>
        <strong>${formatMoney(planPrice)} per month</strong>
        <small>${promoPercent ? `${promoPercent}% promo applied. ` : ""}${state.settings.cancelAtPeriodEnd ? "Cancellation is scheduled." : "Payment is current."}</small>
      </span>
      <small>${state.settings.currentPeriodEndsAt ? `Current access runs through ${formatDate(state.settings.currentPeriodEndsAt)}.` : "Monthly access is active."}</small>
    `;
  } else if (status === "trialing" && canWrite) {
    els.subscriptionStatus.textContent = "Free trial";
    els.subscriptionSummary.innerHTML = `
      <span>
        <strong>${daysLeft} ${daysLeft === 1 ? "day" : "days"} left in your 14-day trial</strong>
        <small>Then ${formatMoney(planPrice)} per month${promoPercent ? ` with ${promoPercent}% off` : ""}.</small>
      </span>
      <small>No payment is collected until you complete Wave checkout.</small>
    `;
  } else if (status === "past_due" && canWrite) {
    els.subscriptionStatus.textContent = "Payment due";
    els.subscriptionSummary.innerHTML = `
      <span>
        <strong>Payment needs attention</strong>
        <small>Your workspace remains editable during the grace period.</small>
      </span>
      <small>${state.settings.graceEndsAt ? `Grace access ends ${formatDate(state.settings.graceEndsAt)}.` : "Please restore payment soon."}</small>
    `;
  } else if (status === "cancelled" && canWrite) {
    els.subscriptionStatus.textContent = "Ending";
    els.subscriptionSummary.innerHTML = `
      <span>
        <strong>Cancellation is scheduled</strong>
        <small>Your workspace remains editable through the paid period.</small>
      </span>
      <small>${state.settings.currentPeriodEndsAt ? `Access continues through ${formatDate(state.settings.currentPeriodEndsAt)}.` : "Access will end after the current period."}</small>
    `;
  } else {
    els.subscriptionStatus.textContent = "Read-only";
    els.subscriptionSummary.innerHTML = `
      <span>
        <strong>Your records are still here</strong>
        <small>Jobs and files remain viewable, but changes are paused.</small>
      </span>
      <small>Restore the ${formatMoney(planPrice)} monthly plan to continue working.</small>
    `;
  }

  els.promoForm.hidden = status === "active" || state.settings.cancelAtPeriodEnd;
  els.checkoutButton.hidden = !checkoutUrl || status === "active";
  els.checkoutButton.dataset.checkoutUrl = checkoutUrl;
  els.checkoutButton.textContent = status === "trialing"
    ? "Set up monthly payment"
    : status === "cancelled" && canWrite
      ? "Restart monthly access"
      : "Restore monthly access";
  els.subscriptionFinePrint.textContent = "Payments are handled securely by Wave. The app does not store card or bank details.";
}

function renderWorkspaceAccess() {
  const readOnly = (backend.live || readOnlyPreviewMode()) && !workspaceCanWrite();
  els.workspaceAccessNotice.hidden = !readOnly || portalMode.active;
  document.querySelectorAll("[data-requires-write]").forEach((control) => {
    control.disabled = readOnly || (control === els.quickUpdateJob && !selectedJob());
  });
  [els.billingForm, els.fieldForm].forEach((form) => {
    form?.querySelectorAll("input, select, textarea, button").forEach((control) => {
      control.disabled = readOnly;
    });
  });
  els.mileageTrackingEnabled.disabled = readOnly;
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

function applySuggestedSchedule() {
  const durationMinutes = Math.round(Math.max(0.5, Number(els.estimatedHours.value || 1)) * 60);
  const suggestion = suggestNextAvailableSlot(durationMinutes, els.projectedDate.value, els.jobId.value);
  if (!suggestion) {
    els.scheduleSuggestionStatus.textContent = "No opening was found in the next 90 days. Check company availability.";
    showToast("No available opening was found in the next 90 days.", "error");
    return;
  }
  els.projectedDate.value = dateInputInTimezone(suggestion.start);
  els.scheduledTime.value = timeInputInTimezone(suggestion.start);
  els.scheduleSuggestionStatus.textContent = `Suggested ${formatScheduleDateTime(suggestion.start)}.`;
  showToast("Next available appointment selected.", "success");
}

function openScheduleVisitDialog(jobId, originalStart) {
  if (!requireWorkspaceWriteAccess()) return;
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job) return;
  const occurrence = occurrencesForJob(
    job,
    new Date(new Date(originalStart).getTime() - 86_400_000),
    new Date(new Date(originalStart).getTime() + 86_400_000),
  ).find((item) => item.originalStart === originalStart);
  const currentStart = occurrence?.start || originalStart;
  els.scheduleVisitJobId.value = jobId;
  els.scheduleVisitOriginalStart.value = originalStart;
  els.scheduleVisitTitle.textContent = job.name;
  els.scheduleVisitDate.value = dateInputInTimezone(currentStart);
  els.scheduleVisitTime.value = timeInputInTimezone(currentStart);
  els.scheduleVisitDialog.showModal();
}

async function saveScheduleException(job, originalStart, status, replacementStart = null, replacementEnd = null) {
  if (backend.live) {
    const { error } = await backend.client.from("schedule_exceptions").upsert({
      company_id: backend.company.id,
      job_id: job.id,
      occurrence_start: originalStart,
      replacement_start: replacementStart,
      replacement_end: replacementEnd,
      status,
    }, { onConflict: "job_id,occurrence_start" });
    if (error) throw error;
    await loadLiveState();
    return;
  }
  const existing = scheduleExceptionFor(job, originalStart);
  const nextException = {
    id: existing?.id || createId(),
    originalStart,
    replacementStart,
    replacementEnd,
    status,
  };
  if (existing) Object.assign(existing, nextException);
  else job.scheduleExceptions.push(nextException);
}

async function rescheduleSelectedOccurrence() {
  const job = state.jobs.find((item) => item.id === els.scheduleVisitJobId.value);
  if (!job) return;
  const start = zonedDateTimeToUtc(els.scheduleVisitDate.value, els.scheduleVisitTime.value);
  if (!start) throw new Error("Choose a valid appointment date and time.");
  const end = new Date(start.getTime() + Math.max(30, Number(job.estimatedDurationMinutes || 60)) * 60_000);
  if (candidateHasConflict(start, end, job.id, els.scheduleVisitOriginalStart.value)) {
    throw new Error("That time overlaps another scheduled visit or its buffer.");
  }
  await saveScheduleException(
    job,
    els.scheduleVisitOriginalStart.value,
    "rescheduled",
    start.toISOString(),
    end.toISOString(),
  );
  els.scheduleVisitDialog.close();
  await notifyCustomerOfJobUpdate(job.id, "Visit rescheduled.");
}

async function skipSelectedOccurrence() {
  const job = state.jobs.find((item) => item.id === els.scheduleVisitJobId.value);
  if (!job) return;
  if (!window.confirm(`Skip this visit for "${job.name}"? The rest of the series will stay scheduled.`)) return;
  await saveScheduleException(job, els.scheduleVisitOriginalStart.value, "skipped");
  els.scheduleVisitDialog.close();
  await notifyCustomerOfJobUpdate(job.id, "Visit skipped.");
}

function updateRecurrenceControls() {
  const enabled = els.recurrenceEnabled.checked;
  els.recurrenceControls.hidden = !enabled;
  els.recurrenceUntilLabel.hidden = !enabled;
  els.recurrenceEnabled.setAttribute("aria-checked", String(enabled));
}

function openJobDialog(job = null) {
  if (!requireWorkspaceWriteAccess()) return;
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
  els.projectedDate.value = job?.scheduledStart ? dateInputInTimezone(job.scheduledStart) : job?.projectedDate || "";
  els.scheduledTime.value = job?.scheduledStart ? timeInputInTimezone(job.scheduledStart) : "";
  els.estimatedHours.value = String(Math.max(0.5, Number(job?.estimatedDurationMinutes || 60) / 60));
  const recurrenceEnabled = Boolean(job?.recurrenceFrequency && job.recurrenceFrequency !== "none");
  els.recurrenceEnabled.checked = recurrenceEnabled;
  els.recurrencePattern.value = recurrenceEnabled
    ? `${job.recurrenceFrequency}:${Math.max(1, Number(job.recurrenceInterval || 1))}`
    : "weekly:1";
  els.recurrenceUntil.value = job?.recurrenceUntil || "";
  updateRecurrenceControls();
  els.scheduleSuggestionStatus.textContent = "Suggestions use the company availability in Settings.";
  els.invoiceUrl.value = job?.invoiceUrl || "";
  els.nextAction.value = job?.nextAction || "";
  els.internalNotes.value = job?.internalNotes || "";
  renderCustomFieldInputs(job);
  els.jobDialog.showModal();
}

async function saveJobFromForm() {
  if (!requireWorkspaceWriteAccess()) throw new Error("Workspace is read-only");
  const id = els.jobId.value || createId();
  const existing = state.jobs.find((job) => job.id === id);
  const customValues = {};
  document.querySelectorAll("[data-custom-field]").forEach((input) => {
    customValues[input.dataset.customField] = input.value;
  });
  const estimatedDurationMinutes = Math.round(Math.max(0.5, Number(els.estimatedHours.value || 1)) * 60);
  const [recurrenceFrequency, recurrenceIntervalText] = els.recurrenceEnabled.checked
    ? els.recurrencePattern.value.split(":")
    : ["none", "1"];
  const hasScheduleDate = Boolean(els.projectedDate.value);
  const hasScheduleTime = Boolean(els.scheduledTime.value);
  if (hasScheduleDate !== hasScheduleTime) {
    throw new Error("Choose both an appointment date and start time.");
  }
  if (recurrenceFrequency !== "none" && !hasScheduleDate) {
    throw new Error("Recurring work needs a first appointment date and time.");
  }
  const scheduledStartDate = hasScheduleDate
    ? zonedDateTimeToUtc(els.projectedDate.value, els.scheduledTime.value)
    : null;
  const scheduledEndDate = scheduledStartDate
    ? new Date(scheduledStartDate.getTime() + estimatedDurationMinutes * 60_000)
    : null;
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
    scheduledStart: scheduledStartDate?.toISOString() || null,
    scheduledEnd: scheduledEndDate?.toISOString() || null,
    estimatedDurationMinutes,
    recurrenceFrequency,
    recurrenceInterval: Math.max(1, Number(recurrenceIntervalText || 1)),
    recurrenceUntil: recurrenceFrequency === "none" ? "" : els.recurrenceUntil.value,
    scheduleExceptions: existing?.recurrenceFrequency === recurrenceFrequency
      ? existing?.scheduleExceptions || []
      : [],
    invoiceUrl: els.invoiceUrl.value,
    nextAction: els.nextAction.value,
    internalNotes: els.internalNotes.value,
    customValues,
    mileageEntries: existing?.mileageEntries || [],
    documents: existing?.documents || [],
    timeline: existing?.timeline || ["Job started"],
    estimateAcceptedAt: existing?.estimateAcceptedAt || null,
    acceptedEstimate: existing?.acceptedEstimate || null,
    estimateDecision: existing?.estimateDecision || null,
    viewedEstimateId: existing?.viewedEstimateId || null,
    magicLinkLastSent: existing?.magicLinkLastSent || null,
  };

  if (backend.live) {
    const { data, error } = await backend.client.rpc("save_scheduled_job_record", {
      target_company_id: backend.company.id,
      target_job_id: existing?.id || null,
      input_customer_name: payload.customerName,
      input_customer_email: payload.customerEmail,
      input_customer_phone: payload.customerPhone || "",
      input_job_industry: payload.industry,
      input_job_name: payload.name,
      input_job_service_address: payload.serviceAddress,
      input_job_status: payload.jobStatus,
      input_job_material_status: payload.materialStatus,
      input_job_projected_date: payload.projectedDate || null,
      input_job_scheduled_start: payload.scheduledStart,
      input_job_scheduled_end: payload.scheduledEnd,
      input_job_estimated_duration_minutes: payload.estimatedDurationMinutes,
      input_job_recurrence_frequency: payload.recurrenceFrequency,
      input_job_recurrence_interval: payload.recurrenceInterval,
      input_job_recurrence_until: payload.recurrenceUntil || null,
      input_job_invoice_url: payload.invoiceUrl || "",
      input_job_next_action: payload.nextAction || "",
      input_job_internal_notes: payload.internalNotes || "",
      input_job_custom_values: payload.customValues,
    });
    if (error) throw error;
    const savedJob = Array.isArray(data) ? data[0] : data;
    if (!savedJob?.id) throw new Error("Job save did not return a record");
    selectedJobId = savedJob.id;
    await loadLiveState();
    return { jobId: savedJob.id, created: !existing };
  }

  if (existing) {
    Object.assign(existing, payload);
    existing.timeline.push("Job updated by contractor");
  } else {
    state.jobs.unshift(payload);
  }
  selectedJobId = id;
  render();
  return { jobId: id, created: !existing };
}

async function sendCustomerAccessEmail() {
  if (!requireWorkspaceWriteAccess()) return;
  const job = selectedJob();
  if (!job) return;
  if (backend.live) {
    job.actionMessage = "Sending customer email...";
    render();
    const { error } = await backend.client.functions.invoke("send-magic-link", {
      body: { jobId: job.id, emailType: "access" },
    });
    if (error) {
      const message = await edgeFunctionErrorMessage(error, "Customer email could not be sent.");
      console.warn("Customer email failed", error);
      job.timeline.push("Customer email could not be sent");
      job.actionMessage = message;
      showToast(message, "error");
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

async function notifyCustomerOfJobUpdate(jobId, savedMessage = "Change saved.") {
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job) return false;
  if (!backend.live) {
    activatePortalAccess(job, "email");
    job.timeline.push("Customer update queued for the next digest");
    showToast(`${savedMessage} Customer update queued for the next email window.`, "success");
    render();
    return true;
  }

  const { data, error } = await backend.client.functions.invoke("send-magic-link", {
    body: { jobId, emailType: "job_update" },
  });
  if (error) {
    const message = await edgeFunctionErrorMessage(error, "Customer update email could not be sent.");
    console.warn("Automatic customer update email failed", error);
    job.actionMessage = message;
    showToast(`${savedMessage} Customer email could not be sent.`, "error");
    render();
    return false;
  }

  if (!data?.queued) {
    showToast(`${savedMessage} Customer update could not be confirmed.`, "error");
    return false;
  }
  job.actionMessage = "Customer update queued for 10 AM, 4 PM, or 9 PM.";
  showToast(`${savedMessage} Customer update queued for the next email window.`, "success");
  render();
  return true;
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

async function removeLiveDocumentFiles(storagePaths) {
  const paths = storagePaths.filter(Boolean);
  if (!paths.length) return;
  const { error } = await backend.client.storage.from(DOCUMENT_BUCKET).remove(paths);
  if (error) console.warn("Uploaded file cleanup failed", error);
}

async function uploadLiveDocumentFiles(job, files) {
  const uploaded = [];
  try {
    for (const file of files) {
      uploaded.push(await uploadLiveDocumentFile(job, file));
    }
    return uploaded;
  } catch (error) {
    await removeLiveDocumentFiles(uploaded.map((item) => item.storagePath));
    throw error;
  }
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
  applyPortalCompany(data.company);
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
  if (!requireWorkspaceWriteAccess()) return;
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
    ? await uploadLiveDocumentFiles(job, sourceFiles)
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
    if (error) {
      await removeLiveDocumentFiles(docs.map((doc) => doc.storagePath));
      throw error;
    }
    await loadLiveState();
    await notifyCustomerOfJobUpdate(
      job.id,
      `${docs.length} file${docs.length === 1 ? "" : "s"} uploaded.`,
    );
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
  await notifyCustomerOfJobUpdate(job.id, `${docs.length} file${docs.length === 1 ? "" : "s"} uploaded.`);
}

async function setDocumentArchived(docId, archived) {
  if (!requireWorkspaceWriteAccess()) return;
  const job = selectedJob();
  const doc = job?.documents.find((item) => item.id === docId);
  if (!job || !doc) return;
  const nextStatus = archived ? "Archived" : doc.type === "Estimate" || doc.uploadedBy === "Contractor" ? "Reviewed" : "New";
  if (backend.live) {
    const { error } = await backend.client.from("documents").update({ status: nextStatus }).eq("id", docId);
    if (error) throw error;
    await loadLiveState();
    await notifyCustomerOfJobUpdate(job.id, `${archived ? "Archived" : "Restored"} ${doc.name}.`);
    return;
  }
  doc.status = nextStatus;
  job.timeline.push(`${archived ? "Archived" : "Restored"} ${doc.name}`);
  await notifyCustomerOfJobUpdate(job.id, `${archived ? "Archived" : "Restored"} ${doc.name}.`);
}

async function addMileageEntry(job, date, milesValue) {
  if (!requireWorkspaceWriteAccess()) return;
  const miles = Number(milesValue);
  if (!job || !date || !Number.isFinite(miles) || miles <= 0 || miles > 10000) {
    showToast("Enter a date and mileage greater than zero.", "error");
    return;
  }
  if (mileageMutationBusy) return;
  mileageMutationBusy = true;
  try {
    if (backend.live) {
      const { error } = await backend.client.from("mileage_entries").insert({
        company_id: backend.company.id,
        job_id: job.id,
        mileage_date: date,
        miles: Math.round(miles * 10) / 10,
      });
      if (error) throw error;
      await loadLiveState();
    } else {
      job.mileageEntries.unshift({
        id: createId(),
        date,
        miles: Math.round(miles * 10) / 10,
        createdAt: new Date().toISOString(),
      });
      job.mileageEntries.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));
    }
    showToast("Mileage added.", "success");
    render();
  } finally {
    mileageMutationBusy = false;
  }
}

async function deleteMileageEntry(entryId) {
  if (!requireWorkspaceWriteAccess()) return;
  const job = selectedJob();
  if (!job || !job.mileageEntries.some((entry) => entry.id === entryId)) return;
  if (mileageMutationBusy) return;
  mileageMutationBusy = true;
  try {
    if (backend.live) {
      const { error } = await backend.client
        .from("mileage_entries")
        .delete()
        .eq("id", entryId)
        .eq("job_id", job.id)
        .eq("company_id", backend.company.id);
      if (error) throw error;
      await loadLiveState();
    } else {
      job.mileageEntries = job.mileageEntries.filter((entry) => entry.id !== entryId);
    }
    showToast("Mileage removed.", "success");
    render();
  } finally {
    mileageMutationBusy = false;
  }
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
  els.recurrenceEnabled.addEventListener("change", updateRecurrenceControls);
  els.suggestNextAvailable.addEventListener("click", applySuggestedSchedule);
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
  els.attentionQueue.addEventListener("click", (event) => {
    const button = event.target.closest("[data-attention-filter]");
    if (!button) return;
    const nextFilter = button.dataset.attentionFilter;
    const alreadySelected = jobStatusFilter === "attention" && jobAttentionFilter === nextFilter;
    jobSearchQuery = "";
    jobStatusFilter = alreadySelected ? "open" : "attention";
    jobAttentionFilter = alreadySelected ? "" : nextFilter;
    ensureFilteredJobSelection();
    render();
  });
  els.upcomingSchedule.addEventListener("click", (event) => {
    const rescheduleButton = event.target.closest('[data-action="reschedule-occurrence"]');
    if (rescheduleButton) {
      openScheduleVisitDialog(rescheduleButton.dataset.jobId, rescheduleButton.dataset.originalStart);
      return;
    }
    const jobButton = event.target.closest("[data-schedule-job-id]");
    if (!jobButton) return;
    selectedJobId = jobButton.dataset.scheduleJobId;
    render();
    els.detailTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  els.jobSearch.addEventListener("input", () => {
    jobSearchQuery = els.jobSearch.value;
    ensureFilteredJobSelection();
    render();
    els.jobSearch.focus();
  });
  els.jobStatusFilter.addEventListener("change", () => {
    jobStatusFilter = els.jobStatusFilter.value;
    jobAttentionFilter = "";
    ensureFilteredJobSelection();
    render();
  });
  els.clearJobFilters.addEventListener("click", () => {
    jobSearchQuery = "";
    jobStatusFilter = "open";
    jobAttentionFilter = "";
    ensureFilteredJobSelection();
    render();
    els.jobSearch.focus();
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
    if (action === "delete-mileage") deleteMileageEntry(actionTarget.dataset.mileageId).catch((error) => {
      console.warn("Mileage delete failed", error);
      showToast("Could not remove the mileage entry.", "error");
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

  els.jobDetail.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-mileage-form]");
    if (!form) return;
    event.preventDefault();
    const job = selectedJob();
    const date = form.elements.mileageDate.value;
    const miles = form.elements.mileageMiles.value;
    addMileageEntry(job, date, miles).catch((error) => {
      console.warn("Mileage save failed", error);
      showToast("Could not save mileage.", "error");
    });
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

  els.chooseWorkspaceLogo.addEventListener("click", () => {
    if (requireWorkspaceWriteAccess()) els.workspaceLogo.click();
  });

  els.workspaceLogo.addEventListener("change", () => {
    if (!requireWorkspaceWriteAccess()) {
      els.workspaceLogo.value = "";
      return;
    }
    const file = els.workspaceLogo.files?.[0];
    if (!file) return;
    const validationError = logoValidationError(file);
    if (validationError) {
      els.workspaceLogo.value = "";
      showToast(validationError, "error");
      return;
    }
    if (pendingLogoPreviewUrl) URL.revokeObjectURL(pendingLogoPreviewUrl);
    pendingLogoPreviewUrl = URL.createObjectURL(file);
    pendingLogoRemoval = false;
    renderSettings();
    els.workspaceStatus.textContent = "Unsaved";
    refreshIcons();
  });

  els.removeWorkspaceLogo.addEventListener("click", () => {
    if (!requireWorkspaceWriteAccess()) return;
    if (pendingLogoPreviewUrl) URL.revokeObjectURL(pendingLogoPreviewUrl);
    pendingLogoPreviewUrl = "";
    pendingLogoRemoval = true;
    els.workspaceLogo.value = "";
    renderSettings();
    els.workspaceStatus.textContent = "Unsaved";
    refreshIcons();
  });

  els.workspaceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireWorkspaceWriteAccess()) return;
    const name = els.workspaceName.value.trim();
    if (!name) return;
    if (!backend.live) {
      els.workspaceStatus.textContent = "Sign in required";
      showToast("Sign in to change the company profile.", "error");
      return;
    }
    els.workspaceStatus.textContent = "Saving";
    const previousLogoPath = backend.company.logo_path || null;
    let nextLogoPath = pendingLogoRemoval ? null : previousLogoPath;
    let uploadedLogoPath = "";
    const logoFile = els.workspaceLogo.files?.[0];
    try {
      if (logoFile) {
        uploadedLogoPath = await uploadCompanyLogo(logoFile);
        nextLogoPath = uploadedLogoPath;
      }
    } catch (error) {
      console.warn("Company logo upload failed", error);
      els.workspaceStatus.textContent = "Could not save";
      showToast(publicError(error, "Could not upload the company logo."), "error");
      return;
    }
    const { data, error } = await backend.client.functions.invoke("workspace-settings", {
      body: { name, logoPath: nextLogoPath },
    });
    if (error || !data?.company) {
      console.warn("Workspace profile save failed", error);
      if (uploadedLogoPath) await backend.client.storage.from(BRANDING_BUCKET).remove([uploadedLogoPath]);
      els.workspaceStatus.textContent = "Could not save";
      showToast("Could not save the company profile.", "error");
      return;
    }
    backend.company = { ...backend.company, ...data.company };
    if (previousLogoPath && previousLogoPath !== nextLogoPath) {
      const { error: cleanupError } = await backend.client.storage.from(BRANDING_BUCKET).remove([previousLogoPath]);
      if (cleanupError) console.warn("Previous company logo could not be removed", cleanupError);
    }
    clearPendingLogo();
    els.workspaceStatus.textContent = "Saved";
    showToast("Company profile saved.", "success");
    render();
  });

  els.mileageTrackingEnabled.addEventListener("change", async () => {
    if (!requireWorkspaceWriteAccess()) {
      els.mileageTrackingEnabled.checked = Boolean(state.settings.mileageTrackingEnabled);
      return;
    }
    const enabled = els.mileageTrackingEnabled.checked;
    const previous = Boolean(state.settings.mileageTrackingEnabled);
    els.mileageTrackingEnabled.disabled = true;
    els.mileageTrackingStatus.textContent = "Saving";
    if (backend.live) {
      const { error } = await backend.client
        .from("companies")
        .update({ mileage_tracking_enabled: enabled })
        .eq("id", backend.company.id);
      if (error) {
        console.warn("Mileage setting failed", error);
        els.mileageTrackingEnabled.checked = previous;
        els.mileageTrackingEnabled.disabled = false;
        els.mileageTrackingStatus.textContent = previous ? "On" : "Off";
        showToast("Could not save the mileage setting.", "error");
        return;
      }
      backend.company.mileage_tracking_enabled = enabled;
    }
    state.settings.mileageTrackingEnabled = enabled;
    els.mileageTrackingEnabled.disabled = false;
    showToast(`Mileage tracking turned ${enabled ? "on" : "off"}.`, "success");
    render();
  });

  els.scheduleSettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireWorkspaceWriteAccess()) return;
    const workdays = [...els.scheduleWorkdays.querySelectorAll('input[type="checkbox"]:checked')].map((checkbox) => Number(checkbox.value));
    const workdayStart = els.scheduleWorkdayStart.value;
    const workdayEnd = els.scheduleWorkdayEnd.value;
    if (!workdays.length) {
      showToast("Choose at least one working day.", "error");
      return;
    }
    if (!workdayStart || !workdayEnd || workdayStart >= workdayEnd) {
      showToast("The workday end time must be after the start time.", "error");
      return;
    }
    const nextSettings = {
      schedulingTimezone: els.scheduleTimezone.value,
      schedulingWorkdays: workdays,
      schedulingWorkdayStart: workdayStart,
      schedulingWorkdayEnd: workdayEnd,
      schedulingBufferMinutes: Number(els.scheduleBufferMinutes.value || 0),
    };
    els.scheduleSettingsStatus.textContent = "Saving";
    if (backend.live) {
      const { error } = await backend.client.from("companies").update({
        scheduling_timezone: nextSettings.schedulingTimezone,
        scheduling_workdays: nextSettings.schedulingWorkdays,
        scheduling_workday_start: nextSettings.schedulingWorkdayStart,
        scheduling_workday_end: nextSettings.schedulingWorkdayEnd,
        scheduling_buffer_minutes: nextSettings.schedulingBufferMinutes,
      }).eq("id", backend.company.id);
      if (error) {
        console.warn("Schedule availability save failed", error);
        els.scheduleSettingsStatus.textContent = "Could not save";
        showToast("Could not save company availability.", "error");
        return;
      }
      Object.assign(backend.company, {
        scheduling_timezone: nextSettings.schedulingTimezone,
        scheduling_workdays: nextSettings.schedulingWorkdays,
        scheduling_workday_start: nextSettings.schedulingWorkdayStart,
        scheduling_workday_end: nextSettings.schedulingWorkdayEnd,
        scheduling_buffer_minutes: nextSettings.schedulingBufferMinutes,
      });
    }
    Object.assign(state.settings, nextSettings);
    els.scheduleSettingsStatus.textContent = backend.live ? "Saved" : "Preview";
    showToast("Company availability saved.", "success");
    render();
  });

  els.billingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireWorkspaceWriteAccess()) return;
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
    if (!code) {
      showToast("Enter a promo code.", "error");
      return;
    }
    if (backend.live) {
      const { error } = await backend.client.rpc("apply_billing_promo_code", { input_code: code });
      if (error) {
        console.warn("Promo save failed", error);
        showToast("That promo code is not active.", "error");
        return;
      }
      await loadLiveState();
    } else {
      const percent = promoPercentFor(code);
      if (!percent) {
        showToast("That promo code is not active.", "error");
        return;
      }
      state.settings.promoCode = code;
      state.settings.promoPercentOff = percent;
      state.settings.planPriceCents = Math.round(monthlyPlanCents * (100 - percent) / 100);
    }
    showToast("Promo code applied.", "success");
    render();
  });

  els.checkoutButton.addEventListener("click", () => {
    const checkoutUrl = safeExternalUrl(els.checkoutButton.dataset.checkoutUrl);
    if (!checkoutUrl) {
      showToast("Billing is off during early access.", "info");
      return;
    }
    window.open(checkoutUrl, "_blank", "noopener,noreferrer");
  });

  els.fieldForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireWorkspaceWriteAccess()) return;
    const label = els.fieldLabel.value.trim();
    if (!label) return;
    if (state.settings.customFields.some((field) => field.label.toLowerCase() === label.toLowerCase())) {
      showToast("A custom field with that name already exists.", "error");
      return;
    }
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
    if (!requireWorkspaceWriteAccess()) return;
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
    if (!requireWorkspaceWriteAccess()) return;
    if (jobSaveBusy) return;
    jobSaveBusy = true;
    els.saveJob.disabled = true;
    setButtonLabel(els.saveJob, "loader-circle", "Saving...");
    refreshIcons();
    try {
      const savedJob = await saveJobFromForm();
      els.jobDialog.close();
      await notifyCustomerOfJobUpdate(savedJob.jobId, savedJob.created ? "Job started." : "Job updated.");
    } catch (error) {
      console.warn("Job save failed", error);
      const validationMessage = /appointment date|Recurring work/i.test(String(error?.message || ""))
        ? error.message
        : "Could not save the job.";
      showToast(validationMessage, "error");
    } finally {
      jobSaveBusy = false;
      els.saveJob.disabled = false;
      setButtonLabel(els.saveJob, "save", "Save job");
      refreshIcons();
    }
  });

  els.closeJobDialog.addEventListener("click", () => els.jobDialog.close());
  els.cancelJobDialog.addEventListener("click", () => els.jobDialog.close());

  els.closeScheduleVisitDialog.addEventListener("click", () => els.scheduleVisitDialog.close());
  els.cancelScheduleVisitDialog.addEventListener("click", () => els.scheduleVisitDialog.close());
  els.scheduleVisitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    rescheduleSelectedOccurrence().catch((error) => {
      console.warn("Visit reschedule failed", error);
      const message = /overlaps|valid appointment/i.test(String(error?.message || ""))
        ? error.message
        : "Could not reschedule this visit.";
      showToast(message, "error");
    });
  });
  els.skipScheduleVisit.addEventListener("click", () => {
    skipSelectedOccurrence().catch((error) => {
      console.warn("Visit skip failed", error);
      showToast("Could not skip this visit.", "error");
    });
  });

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
    if (!requireWorkspaceWriteAccess()) return;
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
