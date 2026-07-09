(function () {
  const config = window.SERVICE_PORTAL_CONFIG;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey || !window.supabase?.createClient) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const createButton = document.getElementById("authCreate");
  const signInButton = document.getElementById("authSubmit");
  const recoveryForm = document.getElementById("recoveryForm");
  const authForm = document.getElementById("authForm");
  const forgotButton = document.getElementById("forgotPassword");
  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");
  const companyInput = document.getElementById("authCompany");
  const promoInput = document.getElementById("authPromoCode");
  const status = document.getElementById("authStatus");
  const detail = document.getElementById("backendStatus");

  createButton.type = "button";
  signInButton.type = "button";

  function setStatus(title, message) {
    status.textContent = title;
    detail.textContent = message;
  }

  function publicError(error, fallback = "Could not complete. Please try again.") {
    const message = String(error?.message || error || "");
    if (/already|exists|registered/i.test(message)) return "That email may already have an account.";
    if (/invalid login|credentials/i.test(message)) return "Email or password did not match.";
    if (/rate limit/i.test(message)) return "Too many attempts. Please wait a few minutes and try again.";
    if (/network|fetch/i.test(message)) return "Connection issue. Please try again.";
    return fallback;
  }

  function normalizePromoCode(value) {
    return (value || "").trim().toLowerCase();
  }

  function showSignInMode() {
    createButton.disabled = false;
    signInButton.disabled = false;
    authForm.hidden = false;
    forgotButton.hidden = false;
    recoveryForm.hidden = true;
  }

  function withTimeout(promise, ms = 12000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  }

  async function sendPasswordSetupEmail(email) {
    return client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href.split("#")[0],
    });
  }

  function readCredentials() {
    return {
      email: emailInput.value.trim(),
      password: passwordInput.value,
    };
  }

  function validateCredentials(email, password) {
    if (!email || !password) {
      setStatus("Missing info", "Enter your contractor email and password.");
      return false;
    }
    if (password.length < 6) {
      setStatus("Password too short", "Use at least 6 characters for the password.");
      return false;
    }
    return true;
  }

  authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  createButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const { email, password } = readCredentials();
    if (!validateCredentials(email, password)) return;

    createButton.disabled = true;
    signInButton.disabled = true;
    setStatus("Creating account", "One moment...");
    try {
      const { data, error } = await withTimeout(client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.href.split("#")[0],
          data: {
            company_name: companyInput.value.trim(),
            promo_code: normalizePromoCode(promoInput.value),
          },
        },
      }));

      if (error) {
        setStatus("Could not create account", publicError(error, "Could not create account."));
        return;
      }

      if (!data?.session) {
        const resetResult = await withTimeout(sendPasswordSetupEmail(email));
        setStatus(
          resetResult.error ? "Account created" : "Check your email",
          resetResult.error
            ? "Could not send setup email. Try the reset email button below."
            : "Open the setup/reset email, choose your password, then sign in.",
        );
        return;
      }

      setStatus("Account created", "Loading your workspace.");
    } catch (error) {
      setStatus("Could not create account", publicError(error, "Could not create account."));
    } finally {
      showSignInMode();
    }
  }, true);

  signInButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    showSignInMode();
    const { email, password } = readCredentials();
    if (!validateCredentials(email, password)) return;

    createButton.disabled = true;
    signInButton.disabled = true;
    setStatus("Signing in", "One moment...");
    try {
      const { error } = await withTimeout(client.auth.signInWithPassword({ email, password }));
      if (error) {
        setStatus("Sign-in failed", publicError(error, "Could not complete sign in."));
        return;
      }
      setStatus("Signed in", "Loading your workspace.");
    } catch (error) {
      setStatus("Could not complete", publicError(error));
    } finally {
      showSignInMode();
    }
  }, true);
})();
