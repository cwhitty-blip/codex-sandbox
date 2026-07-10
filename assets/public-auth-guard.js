(function () {
  const config = window.SERVICE_PORTAL_CONFIG;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey || !window.supabase?.createClient) return;
  if (new URLSearchParams(window.location.search).get("portal")) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  const status = document.getElementById("authStatus");
  const detail = document.getElementById("backendStatus");
  const authPanel = document.getElementById("authPanel");
  const authForm = document.getElementById("authForm");
  const forgotButton = document.getElementById("forgotPassword");
  const signOutButton = document.getElementById("signOut");
  const companyInput = document.getElementById("authCompany");

  function setStatus(title, message) {
    status.textContent = title;
    detail.textContent = message;
  }

  function isTechnicalMessage(message) {
    return /schema cache|public\.|bootstrap_company|relation|sql|postgres|supabase|function/i.test(message || "");
  }

  function isRecoveryRequest() {
    const locationText = `${window.location.search}${window.location.hash}`;
    const hasAuthCode = /[?&#]code=|[?&#]access_token=/i.test(locationText);
    return window.SERVICE_PORTAL_RECOVERY_MODE
      || /type=recovery|password_recovery/i.test(locationText)
      || (hasAuthCode && window.localStorage.getItem("servicePortalPasswordResetPending") === "true");
  }

  function sanitizeVisibleMessage() {
    if (isTechnicalMessage(detail.textContent)) {
      detail.textContent = "";
    }
  }

  function hideAuthForSignedInSession() {
    document.body.classList.add("service-portal-signed-in");
    authPanel.hidden = true;
    authForm.hidden = true;
    if (forgotButton) forgotButton.hidden = true;
    if (signOutButton) signOutButton.hidden = true;
  }

  async function bootstrapCompanyCompatible() {
    if (isRecoveryRequest()) return;
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) return;
    hideAuthForSignedInSession();
    if (sessionStorage.getItem("servicePortal.compatBootstrapDone") === "1") return;

    const companyName = companyInput.value.trim() || "Service Company";
    let result = await client.rpc("bootstrap_company", { company_name: companyName, promo_code: null });
    if (result.error && /bootstrap_company|schema cache|function/i.test(result.error.message || "")) {
      result = await client.rpc("bootstrap_company", { company_name: companyName });
    }
    if (result.error) {
      hideAuthForSignedInSession();
      return;
    }
    sessionStorage.setItem("servicePortal.compatBootstrapDone", "1");
    window.location.reload();
  }

  new MutationObserver(sanitizeVisibleMessage).observe(detail, { childList: true, characterData: true, subtree: true });
  sanitizeVisibleMessage();
  bootstrapCompanyCompatible();
})();
