(function () {
  const config = window.SERVICE_PORTAL_CONFIG;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey || !window.supabase?.createClient) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const status = document.getElementById("authStatus");
  const detail = document.getElementById("backendStatus");
  const companyInput = document.getElementById("authCompany");

  function setStatus(title, message) {
    status.textContent = title;
    detail.textContent = message;
  }

  function isTechnicalMessage(message) {
    return /schema cache|public\.|bootstrap_company|relation|sql|postgres|supabase|function/i.test(message || "");
  }

  function sanitizeVisibleMessage() {
    if (isTechnicalMessage(detail.textContent)) {
      setStatus("Could not complete sign in", "Could not finish setting up the workspace.");
    }
  }

  async function bootstrapCompanyCompatible() {
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) return;
    if (sessionStorage.getItem("servicePortal.compatBootstrapDone") === "1") return;

    const companyName = companyInput.value.trim() || "Service Company";
    let result = await client.rpc("bootstrap_company", { company_name: companyName, promo_code: null });
    if (result.error && /bootstrap_company|schema cache|function/i.test(result.error.message || "")) {
      result = await client.rpc("bootstrap_company", { company_name: companyName });
    }
    if (result.error) {
      setStatus("Could not complete sign in", "Could not finish setting up the workspace.");
      return;
    }
    sessionStorage.setItem("servicePortal.compatBootstrapDone", "1");
    window.location.reload();
  }

  new MutationObserver(sanitizeVisibleMessage).observe(detail, { childList: true, characterData: true, subtree: true });
  sanitizeVisibleMessage();
  bootstrapCompanyCompatible();
})();
