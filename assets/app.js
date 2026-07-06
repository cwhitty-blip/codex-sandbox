const STORAGE_KEY = "serviceJobPortal.v1";

const industries = [
  {
    id: "roofing",
    label: "Roofing",
    materialLabel: "Material status",
    dateLabel: "Projected install date",
    suggestedFields: ["Insurance carrier", "Claim number", "Roof type"],
  },
  {
    id: "plumbing",
    label: "Plumbing",
    materialLabel: "Parts status",
    dateLabel: "Projected service date",
    suggestedFields: ["Fixture type", "Water shutoff location", "Access notes"],
  },
  {
    id: "hvac",
    label: "HVAC",
    materialLabel: "Equipment status",
    dateLabel: "Projected service date",
    suggestedFields: ["System type", "Filter size", "Equipment model"],
  },
  {
    id: "electrical",
    label: "Electrical",
    materialLabel: "Parts status",
    dateLabel: "Projected service date",
    suggestedFields: ["Panel location", "Permit needed", "Circuit notes"],
  },
  {
    id: "tiling",
    label: "Tiling",
    materialLabel: "Material status",
    dateLabel: "Projected install date",
    suggestedFields: ["Tile selection", "Grout color", "Room dimensions"],
  },
  {
    id: "general",
    label: "General Service",
    materialLabel: "Material or parts status",
    dateLabel: "Projected service date",
    suggestedFields: ["Access instructions", "Parking notes", "Preferred contact"],
  },
];

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

const jobStatuses = ["Active", "Waiting on Customer", "Scheduled", "In Progress", "Complete", "On Hold"];
const materialStatuses = ["Not Ordered", "Ordered", "In Transit", "Arrived", "Not Required"];
const documentTypes = ["Insurance Claim", "Photo", "Signed Document", "Estimate", "Permit", "Other"];

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const demoState = {
  settings: {
    billingProvider: "QuickBooks Online",
    billingAccount: "Demo Roofing Co.",
    billingSync: "Invoices and payment status",
    billingConnected: true,
    customFields: [
      { id: createId(), label: "Claim number", type: "text", options: [] },
      { id: createId(), label: "Gate code", type: "text", options: [] },
      { id: createId(), label: "Permit required", type: "select", options: ["Yes", "No", "Unknown"] },
    ],
  },
  jobs: [
    {
      id: createId(),
      industry: "roofing",
      name: "Garcia roof replacement",
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
        },
      ],
      timeline: [
        "Job started",
        "Magic link sent to customer",
        "Estimate shared with customer",
      ],
      magicLinkLastSent: "2026-07-03T17:20:00.000Z",
    },
    {
      id: createId(),
      industry: "hvac",
      name: "Miller condenser replacement",
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
      magicLinkLastSent: null,
    },
  ],
};

let state = loadState();
let selectedJobId = state.jobs[0]?.id || null;
let selectedCustomerJobId = selectedJobId;

const els = {
  tabs: document.querySelectorAll(".nav-tab"),
  views: {
    dashboard: document.getElementById("dashboardView"),
    customer: document.getElementById("customerView"),
    settings: document.getElementById("settingsView"),
  },
  viewTitle: document.getElementById("viewTitle"),
  activeJobCount: document.getElementById("activeJobCount"),
  billingProviderSummary: document.getElementById("billingProviderSummary"),
  resetDemo: document.getElementById("resetDemo"),
  exportData: document.getElementById("exportData"),
  startJob: document.getElementById("startJob"),
  quickStartJob: document.getElementById("quickStartJob"),
  quickUpdateJob: document.getElementById("quickUpdateJob"),
  industryFilter: document.getElementById("industryFilter"),
  jobList: document.getElementById("jobList"),
  detailIndustry: document.getElementById("detailIndustry"),
  detailTitle: document.getElementById("detailTitle"),
  detailStatus: document.getElementById("detailStatus"),
  jobDetail: document.getElementById("jobDetail"),
  customerJobSelect: document.getElementById("customerJobSelect"),
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
  presetList: document.getElementById("presetList"),
  jobDialog: document.getElementById("jobDialog"),
  jobForm: document.getElementById("jobForm"),
  jobDialogMode: document.getElementById("jobDialogMode"),
  jobDialogTitle: document.getElementById("jobDialogTitle"),
  jobId: document.getElementById("jobId"),
  jobIndustry: document.getElementById("jobIndustry"),
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
  documentPicker: document.getElementById("documentPicker"),
};

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return structuredClone(demoState);
  try {
    return JSON.parse(stored);
  } catch {
    return structuredClone(demoState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function industryFor(id) {
  return industries.find((industry) => industry.id === id) || industries.at(-1);
}

function selectedJob() {
  return state.jobs.find((job) => job.id === selectedJobId) || state.jobs[0] || null;
}

function customerJob() {
  return state.jobs.find((job) => job.id === selectedCustomerJobId) || state.jobs[0] || null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  populateSelect(els.industryFilter, [{ id: "all", label: "All industries" }, ...industries], "id", "label");
  populateSelect(els.jobIndustry, industries, "id", "label");
  populateSelect(els.jobStatus, jobStatuses);
  populateSelect(els.materialStatus, materialStatuses);
  populateSelect(els.billingProvider, billingProviders);
}

function render() {
  saveState();
  renderMetrics();
  renderJobs();
  renderJobDetail();
  renderCustomerSelector();
  renderCustomerPortal();
  renderSettings();
}

function renderMetrics() {
  const active = state.jobs.filter((job) => job.jobStatus !== "Complete").length;
  els.activeJobCount.textContent = `${active} active ${active === 1 ? "job" : "jobs"}`;
  els.billingProviderSummary.textContent = state.settings.billingConnected
    ? `${state.settings.billingProvider} connected`
    : "No billing provider connected";
}

function renderJobs() {
  const filter = els.industryFilter.value || "all";
  const jobs = filter === "all" ? state.jobs : state.jobs.filter((job) => job.industry === filter);
  els.jobList.innerHTML = jobs
    .map((job) => {
      const industry = industryFor(job.industry);
      return `
        <button class="job-row ${job.id === selectedJobId ? "active" : ""}" data-job-id="${job.id}" type="button">
          <span>
            <strong>${escapeHtml(job.name)}</strong>
            <small>${escapeHtml(job.customerName)} / ${escapeHtml(industry.label)}</small>
          </span>
          <em>${escapeHtml(job.jobStatus)}</em>
        </button>
      `;
    })
    .join("");

  if (!jobs.length) {
    els.jobList.innerHTML = `<div class="empty-state">No jobs match this industry filter.</div>`;
  }
}

function renderJobDetail() {
  const job = selectedJob();
  if (!job) {
    els.detailTitle.textContent = "No jobs yet";
    els.detailIndustry.textContent = "Job";
    els.detailStatus.textContent = "Empty";
    els.jobDetail.innerHTML = "Start a job to create the first customer portal.";
    return;
  }

  const industry = industryFor(job.industry);
  const visibleDocs = job.documents.filter((doc) => doc.visibility === "Customer Visible").length;
  const customerDocs = job.documents.filter((doc) => doc.uploadedBy === "Customer").length;
  els.detailTitle.textContent = job.name;
  els.detailIndustry.textContent = industry.label;
  els.detailStatus.textContent = job.jobStatus;
  els.jobDetail.classList.remove("empty-state");
  els.jobDetail.innerHTML = `
    <div class="detail-actions">
      <button class="primary-button" data-action="edit-job" type="button">Update a job</button>
      <button class="ghost-button" data-action="send-email" type="button">Send magic email</button>
      <button class="ghost-button" data-action="send-sms" type="button">Send magic text</button>
      <button class="ghost-button" data-action="upload-staff-doc" type="button">Add shared file</button>
    </div>
    <div class="stat-grid">
      <div><span>Customer</span><strong>${escapeHtml(job.customerName)}</strong></div>
      <div><span>${escapeHtml(industry.dateLabel)}</span><strong>${formatDate(job.projectedDate)}</strong></div>
      <div><span>${escapeHtml(industry.materialLabel)}</span><strong>${escapeHtml(job.materialStatus)}</strong></div>
      <div><span>Customer uploads</span><strong>${customerDocs}</strong></div>
    </div>
    <section class="plain-section">
      <h3>Next action</h3>
      <p>${escapeHtml(job.nextAction || "No next action set.")}</p>
    </section>
    <section class="plain-section">
      <h3>Billing</h3>
      <p>${state.settings.billingProvider} / ${job.invoiceUrl ? `<a href="${escapeHtml(job.invoiceUrl)}" target="_blank" rel="noreferrer">Invoice link</a>` : "No invoice linked"}</p>
    </section>
    <section class="plain-section">
      <h3>Custom fields</h3>
      <div class="field-readout">${renderCustomValueReadout(job)}</div>
    </section>
    <section class="plain-section">
      <h3>Documents</h3>
      <div class="document-list">${renderDocumentList(job.documents)}</div>
      <p class="fine-print">${visibleDocs} customer-visible document${visibleDocs === 1 ? "" : "s"}. Customer uploads are marked new until reviewed.</p>
    </section>
    <section class="plain-section internal-note">
      <h3>Internal notes</h3>
      <p>${escapeHtml(job.internalNotes || "No staff-only notes yet.")}</p>
    </section>
    <section class="plain-section">
      <h3>Activity</h3>
      <ol class="timeline">${job.timeline.map((event) => `<li>${escapeHtml(event)}</li>`).join("")}</ol>
      <p class="fine-print">Last magic link: ${formatDateTime(job.magicLinkLastSent)}</p>
    </section>
  `;
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

function renderDocumentList(documents) {
  if (!documents.length) return `<div class="empty-state">No documents yet.</div>`;
  return documents
    .map(
      (doc) => `
        <div class="document-row">
          <span>
            <strong>${escapeHtml(doc.name)}</strong>
            <small>${escapeHtml(doc.type)} / ${escapeHtml(doc.uploadedBy)} / ${escapeHtml(doc.visibility)}</small>
          </span>
          <em>${escapeHtml(doc.status)}</em>
        </div>
      `,
    )
    .join("");
}

function renderCustomerSelector() {
  els.customerJobSelect.innerHTML = state.jobs
    .map((job) => `<option value="${job.id}">${escapeHtml(job.customerName)} / ${escapeHtml(job.name)}</option>`)
    .join("");
  if (customerJob()) els.customerJobSelect.value = customerJob().id;
}

function renderCustomerPortal() {
  const job = customerJob();
  if (!job) {
    els.customerPortal.innerHTML = `<div class="empty-state">No customer portal to preview yet.</div>`;
    return;
  }
  const industry = industryFor(job.industry);
  const customerVisibleDocs = job.documents.filter((doc) => doc.visibility === "Customer Visible");
  const receivedUploads = job.documents.filter((doc) => doc.uploadedBy === "Customer").length;
  els.customerPortal.innerHTML = `
    <div class="customer-hero">
      <div>
        <p class="eyebrow">${escapeHtml(industry.label)} portal</p>
        <h2>${escapeHtml(job.name)}</h2>
        <p>${escapeHtml(job.serviceAddress)}</p>
      </div>
      <span class="status-pill">${escapeHtml(job.jobStatus)}</span>
    </div>
    <div class="stat-grid">
      <div><span>${escapeHtml(industry.materialLabel)}</span><strong>${escapeHtml(job.materialStatus)}</strong></div>
      <div><span>${escapeHtml(industry.dateLabel)}</span><strong>${formatDate(job.projectedDate)}</strong></div>
      <div><span>Uploads received</span><strong>${receivedUploads}</strong></div>
    </div>
    <section class="plain-section">
      <h3>Requested documents</h3>
      <p>Upload insurance claims, photos, signed documents, or any file requested by your service provider.</p>
      <div class="customer-upload-actions">
        ${documentTypes
          .map((type) => `<button class="ghost-button" data-action="customer-upload" data-doc-type="${type}" type="button">Upload ${type}</button>`)
          .join("")}
      </div>
    </section>
    <section class="plain-section">
      <h3>Shared documents</h3>
      <div class="document-list">${renderDocumentList(customerVisibleDocs)}</div>
    </section>
    <section class="plain-section">
      <h3>Timeline</h3>
      <ol class="timeline">${job.timeline.slice(-4).map((event) => `<li>${escapeHtml(event)}</li>`).join("")}</ol>
    </section>
  `;
}

function renderSettings() {
  els.billingProvider.value = state.settings.billingProvider;
  els.billingAccount.value = state.settings.billingAccount || "";
  els.billingSync.value = state.settings.billingSync;
  els.billingStatus.textContent = state.settings.billingConnected ? "Connected" : "Not connected";
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
              <button class="ghost-button" data-field-id="${field.id}" type="button">Remove</button>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">Add a field contractors can fill out on every job.</div>`;

  els.presetList.innerHTML = industries
    .map(
      (industry) => `
        <div class="preset-row">
          <strong>${escapeHtml(industry.label)}</strong>
          <span>${escapeHtml(industry.materialLabel)} / ${escapeHtml(industry.dateLabel)}</span>
          <small>${escapeHtml(industry.suggestedFields.join(", "))}</small>
        </div>
      `,
    )
    .join("");
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
  els.jobIndustry.value = job?.industry || "general";
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

function saveJobFromForm() {
  const id = els.jobId.value || createId();
  const existing = state.jobs.find((job) => job.id === id);
  const customValues = {};
  document.querySelectorAll("[data-custom-field]").forEach((input) => {
    customValues[input.dataset.customField] = input.value;
  });
  const payload = {
    id,
    industry: els.jobIndustry.value,
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
    magicLinkLastSent: existing?.magicLinkLastSent || null,
  };

  if (existing) {
    Object.assign(existing, payload);
    existing.timeline.push("Job updated by contractor");
  } else {
    state.jobs.unshift(payload);
  }
  selectedJobId = id;
  selectedCustomerJobId = id;
  render();
}

function sendMagicLink(channel) {
  const job = selectedJob();
  if (!job) return;
  job.magicLinkLastSent = new Date().toISOString();
  job.timeline.push(`Magic link sent by ${channel} to ${channel === "email" ? job.customerEmail : job.customerPhone || "customer phone"}`);
  render();
}

function addDocuments(files, uploadedBy, docType = "Other") {
  const job = uploadedBy === "Customer" ? customerJob() : selectedJob();
  if (!job || !files.length) return;
  Array.from(files).forEach((file) => {
    job.documents.unshift({
      id: createId(),
      name: file.name,
      type: docType,
      uploadedBy,
      visibility: uploadedBy === "Customer" ? "Staff Only" : "Customer Visible",
      status: uploadedBy === "Customer" ? "New" : "Reviewed",
      createdAt: new Date().toISOString(),
    });
  });
  job.timeline.push(`${uploadedBy} uploaded ${files.length} document${files.length === 1 ? "" : "s"}`);
  render();
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "service-job-portal-export.json";
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      els.tabs.forEach((item) => item.classList.toggle("active", item === tab));
      Object.entries(els.views).forEach(([view, node]) => node.classList.toggle("active", view === tab.dataset.view));
      els.viewTitle.textContent = tab.dataset.view === "dashboard" ? "Jobs" : tab.dataset.view === "customer" ? "Customer View" : "Setup";
    });
  });

  els.startJob.addEventListener("click", () => openJobDialog());
  els.quickStartJob.addEventListener("click", () => openJobDialog());
  els.quickUpdateJob.addEventListener("click", () => openJobDialog(selectedJob()));
  els.industryFilter.addEventListener("change", renderJobs);
  els.resetDemo.addEventListener("click", () => {
    state = structuredClone(demoState);
    selectedJobId = state.jobs[0]?.id || null;
    selectedCustomerJobId = selectedJobId;
    render();
  });
  els.exportData.addEventListener("click", exportState);

  els.jobList.addEventListener("click", (event) => {
    const row = event.target.closest("[data-job-id]");
    if (!row) return;
    selectedJobId = row.dataset.jobId;
    selectedCustomerJobId = row.dataset.jobId;
    render();
  });

  els.jobDetail.addEventListener("click", (event) => {
    const action = event.target.dataset.action;
    if (action === "edit-job") openJobDialog(selectedJob());
    if (action === "send-email") sendMagicLink("email");
    if (action === "send-sms") sendMagicLink("text");
    if (action === "upload-staff-doc") {
      els.documentPicker.dataset.uploadedBy = "Contractor";
      els.documentPicker.dataset.docType = "Other";
      els.documentPicker.click();
    }
  });

  els.customerJobSelect.addEventListener("change", () => {
    selectedCustomerJobId = els.customerJobSelect.value;
    renderCustomerPortal();
  });

  els.customerPortal.addEventListener("click", (event) => {
    if (event.target.dataset.action !== "customer-upload") return;
    els.documentPicker.dataset.uploadedBy = "Customer";
    els.documentPicker.dataset.docType = event.target.dataset.docType;
    els.documentPicker.click();
  });

  els.documentPicker.addEventListener("change", () => {
    addDocuments(els.documentPicker.files, els.documentPicker.dataset.uploadedBy, els.documentPicker.dataset.docType);
    els.documentPicker.value = "";
  });

  els.billingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.settings.billingProvider = els.billingProvider.value;
    state.settings.billingAccount = els.billingAccount.value;
    state.settings.billingSync = els.billingSync.value;
    state.settings.billingConnected = true;
    render();
  });

  els.fieldForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const label = els.fieldLabel.value.trim();
    if (!label) return;
    state.settings.customFields.push({
      id: createId(),
      label,
      type: els.fieldType.value,
      options: els.fieldOptions.value.split(",").map((option) => option.trim()).filter(Boolean),
    });
    els.fieldForm.reset();
    render();
  });

  els.customFieldList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-field-id]");
    if (!button) return;
    state.settings.customFields = state.settings.customFields.filter((field) => field.id !== button.dataset.fieldId);
    render();
  });

  els.jobForm.addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") {
      els.jobDialog.close();
      return;
    }
    event.preventDefault();
    saveJobFromForm();
    els.jobDialog.close();
  });

  els.jobForm.addEventListener("click", (event) => {
    if (event.target.closest('[value="cancel"]')) {
      els.jobDialog.close();
    }
  });

  els.deleteJob.addEventListener("click", () => {
    const id = els.jobId.value;
    state.jobs = state.jobs.filter((job) => job.id !== id);
    selectedJobId = state.jobs[0]?.id || null;
    selectedCustomerJobId = selectedJobId;
    els.jobDialog.close();
    render();
  });
}

initStaticControls();
bindEvents();
render();
