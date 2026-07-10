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
  const createButton = document.getElementById("authCreate");
  const signInButton = document.getElementById("authSubmit");
  const authPanel = document.getElementById("authPanel");
  const authForm = document.getElementById("authForm");
  const forgotButton = document.getElementById("forgotPassword");
  const signOutButton = document.getElementById("signOut");
  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");
  const status = document.getElementById("authStatus");
  const detail = document.getElementById("backendStatus");
  let actionId = 0;
  let resetCooldownUntil = 0;
  let authMode = "signin";
  let signedIn = false;

  createButton.type = "button";
  signInButton.type = "button";

  function isRecoveryRequest() {
    return window.SERVICE_PORTAL_RECOVERY_MODE
      || /type=recovery|password_recovery/i.test(`${window.location.search}${window.location.hash}`);
  }

  function showSignedInMode(session) {
    signedIn = Boolean(session);
    if (!signedIn || isRecoveryRequest()) return;
    document.body.classList.add("service-portal-signed-in");
    authPanel.hidden = true;
    authForm.hidden = true;
    forgotButton.hidden = true;
    signOutButton.hidden = true;
    const recoveryForm = document.getElementById("recoveryForm");
    if (recoveryForm) recoveryForm.hidden = true;
    setStatus("Live workspace", `Signed in as ${session.user.email}.`);
  }

  function setStatus(title, message) {
    status.textContent = title;
    detail.textContent = message;
  }

  function renderMode(message) {
    const isSignup = authMode === "signup";
    signInButton.textContent = isSignup ? "Create account" : "Sign in";
    signInButton.value = authMode;
    createButton.textContent = isSignup ? "Back to sign in" : "Create account";
    createButton.value = isSignup ? "signin" : "signup";
    passwordInput.autocomplete = isSignup ? "new-password" : "current-password";
    forgotButton.hidden = isSignup;
    if (message) {
      setStatus(
        isSignup ? "Create contractor account" : "Contractor sign in",
        message,
      );
    }
  }

  function publicError(error, fallback = "Could not complete. Please try again.") {
    const message = String(error?.message || error || "");
    if (/already|exists|registered/i.test(message)) return "That email may already have an account.";
    if (/invalid login|credentials/i.test(message)) return "Email or password did not match.";
    if (/rate limit/i.test(message)) return "Too many attempts. Please wait a few minutes and try again.";
    if (/network|fetch/i.test(message)) return "Connection issue. Please try again.";
    return fallback;
  }

  function showSignInMode() {
    if (isRecoveryRequest()) return;
    if (signedIn) return;
    authPanel.hidden = false;
    createButton.disabled = false;
    signInButton.disabled = false;
    authForm.hidden = false;
    forgotButton.hidden = authMode === "signup";
    signOutButton.hidden = true;
    const recoveryForm = document.getElementById("recoveryForm");
    if (recoveryForm) recoveryForm.hidden = true;
    renderMode();
  }

  function stabilizeAuthVisibility() {
    if (isRecoveryRequest()) return;
    if (signedIn) {
      document.body.classList.add("service-portal-signed-in");
      authPanel.hidden = true;
      authForm.hidden = true;
      forgotButton.hidden = true;
      signOutButton.hidden = true;
      return;
    }
    authPanel.hidden = false;
    document.body.classList.remove("service-portal-signed-in");
    authForm.hidden = false;
    signOutButton.hidden = true;
    if (!authForm.hidden) {
      forgotButton.hidden = authMode === "signup";
    }
  }

  function nextAction() {
    actionId += 1;
    return actionId;
  }

  function isCurrentAction(id) {
    return id === actionId;
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

  async function createAccount(id, email, password) {
    setStatus("Creating account", "One moment...");
    try {
      const { data, error } = await withTimeout(client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.href.split("#")[0],
        },
      }));

      if (error) {
        if (!isCurrentAction(id)) return;
        setStatus("Could not create account", publicError(error, "Could not create account."));
        return;
      }

      if (!data?.session) {
        if (!isCurrentAction(id)) return;
        setStatus(
          "Account created",
          "Check your email if account confirmation is requested, then sign in.",
        );
        authMode = "signin";
        showSignInMode();
        return;
      }

      if (!isCurrentAction(id)) return;
      setStatus("Account created", "Loading your workspace.");
    } catch (error) {
      if (!isCurrentAction(id)) return;
      setStatus("Could not create account", publicError(error, "Could not create account."));
    } finally {
      if (isCurrentAction(id)) showSignInMode();
    }
  }

  async function signIn(id, email, password) {
    setStatus("Signing in", "One moment...");
    try {
      const { error } = await withTimeout(client.auth.signInWithPassword({ email, password }));
      if (error) {
        if (!isCurrentAction(id)) return;
        setStatus("Sign-in failed", publicError(error, "Could not complete sign in."));
        return;
      }
      if (!isCurrentAction(id)) return;
      signedIn = true;
      document.body.classList.add("service-portal-signed-in");
      window.localStorage.removeItem("servicePortalPasswordResetPending");
      window.history.replaceState({}, document.title, window.location.pathname);
      authPanel.hidden = true;
      authForm.hidden = true;
      forgotButton.hidden = true;
      signOutButton.hidden = true;
      setStatus("Signed in", "Loading your workspace.");
    } catch (error) {
      if (!isCurrentAction(id)) return;
      setStatus("Could not complete", publicError(error));
    } finally {
      if (isCurrentAction(id) && !signedIn) showSignInMode();
    }
  }

  createButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    nextAction();
    authMode = authMode === "signup" ? "signin" : "signup";
    showSignInMode();
    renderMode(authMode === "signup"
      ? "Enter an email and password for the contractor account."
      : "Enter your contractor email and password.");
  }, true);

  signInButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = nextAction();

    showSignInMode();
    const { email, password } = readCredentials();
    if (!validateCredentials(email, password)) return;

    showSignInMode();
    if (authMode === "signup") {
      await createAccount(id, email, password);
      return;
    }
    await signIn(id, email, password);
  }, true);

  forgotButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const email = emailInput.value.trim();
    if (!email) {
      setStatus("Email needed", "Enter your contractor email first, then click password reset.");
      return;
    }

    const secondsLeft = Math.ceil((resetCooldownUntil - Date.now()) / 1000);
    if (secondsLeft > 0) {
      setStatus("Reset already sent", `Please wait about ${secondsLeft} seconds before trying again.`);
      return;
    }

    const id = nextAction();
    resetCooldownUntil = Date.now() + 60_000;
    forgotButton.disabled = true;
    setStatus("Sending reset email", "Check your inbox after this finishes.");
    try {
      const { error } = await withTimeout(sendPasswordSetupEmail(email));
      if (!isCurrentAction(id)) return;
      if (!error) {
        window.localStorage.setItem("servicePortalPasswordResetPending", "true");
      }
      setStatus(
        error ? "Reset failed" : "Reset email sent",
        error ? publicError(error, "Could not send reset email.") : "Open the reset link in your email.",
      );
    } catch (error) {
      if (!isCurrentAction(id)) return;
      setStatus("Reset failed", publicError(error, "Could not send reset email."));
    } finally {
      window.setTimeout(() => {
        forgotButton.disabled = false;
      }, Math.max(0, resetCooldownUntil - Date.now()));
    }
  }, true);

  client.auth.getSession().then(({ data }) => showSignedInMode(data.session));
  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") showSignedInMode(session);
    if (event === "SIGNED_OUT") {
      signedIn = false;
      document.body.classList.remove("service-portal-signed-in");
      authPanel.hidden = false;
      signOutButton.hidden = true;
      showSignInMode();
    }
  });

  showSignInMode();
  window.setTimeout(() => {
    showSignInMode();
    stabilizeAuthVisibility();
  }, 0);
  window.setTimeout(() => {
    showSignInMode();
    stabilizeAuthVisibility();
  }, 500);
  window.setTimeout(stabilizeAuthVisibility, 1500);
})();
