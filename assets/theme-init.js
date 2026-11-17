(() => {
  const storageKey = "servicePortal.theme";
  let savedTheme = "";
  try {
    savedTheme = localStorage.getItem(storageKey) || "";
  } catch (_) {
    savedTheme = "";
  }
  const theme = savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
})();
