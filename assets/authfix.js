(function () {
  const config = window.SERVICE_PORTAL_CONFIG;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey || !window.supabase?.createClient) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const createButton = document.getElementById("authCreate");
  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");
  const companyInput = document.getElementById("authCompany");
  const promoInput = document.getElementById("authPromoCode");
  const status = document.getElementById("authStatus");
  const detail = document.getElementById("backendStatus");

  function setStatus(title, message) {
    status.textContent = title;
    detail.textContent = message;
  }

  function normalizePromoCode(value) {
    return (value || "").trim().toLowerCase();
  }

  async function sendPasswordSetupEmail(email) {
    return client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href.split("#")[0],
    });
  }

  createButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      setStatus("Missing info", "Enter your contractor email and password.");
      return;
    }
    if (password.length < 6) {
      setStatus("Password too short", "Use at least 6 characters for the password.");
      return;
    }

    createButton.disabled = true;
    setStatus("Creating account", "One moment...");
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.href.split("#")[0],
        data: {
          company_name: companyInput.value.trim(),
          promo_code: normalizePromoCode(promoInput.value),
        },
      },
    });

    if (error) {
      createButton.disabled = false;
      setStatus("Create account failed", error.message);
      return;
    }

    if (!data?.session) {
      const resetResult = await sendPasswordSetupEmail(email);
      createButton.disabled = false;
      setStatus(
        resetResult.error ? "Account created" : "Check your email",
        resetResult.error
          ? "The account exists, but Supabase did not send the setup email. Click Send password reset email below."
          : "Open the setup/reset email, choose your password, then sign in.",
      );
      return;
    }

    createButton.disabled = false;
    setStatus("Account created", "Loading your workspace.");
  }, true);
})();
