(() => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');

  if (toggle && nav) {
    const closeMenu = () => {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    };

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });

    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

    document.addEventListener('click', (event) => {
      if (!nav.contains(event.target) && !toggle.contains(event.target)) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
  }

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();

// Republishes the sharper hero-image build to GitHub Pages.
