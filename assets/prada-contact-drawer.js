(() => {
  const drawer = document.querySelector('[data-prada-contact-drawer]');
  if (!drawer || drawer.dataset.bound === 'true') return;
  drawer.dataset.bound = 'true';

  const panel = drawer.querySelector('[data-prada-contact-panel]');
  const closeButton = drawer.querySelector('[data-prada-contact-close]');
  let opener = null;
  let closeTimer = null;

  const close = () => {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('prada-contact-open');
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => drawer.classList.remove('is-visible'), 440);
    opener?.focus({ preventScroll: true });
  };

  const open = (trigger) => {
    opener = trigger;
    window.clearTimeout(closeTimer);
    drawer.classList.add('is-visible');
    drawer.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('prada-contact-open');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        drawer.classList.add('is-open');
        closeButton?.focus({ preventScroll: true });
      });
    });
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-prada-contact-open]');
    if (trigger) {
      event.preventDefault();
      open(trigger);
      return;
    }
    if (event.target.closest('[data-prada-contact-close]')) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) close();
    if (event.key !== 'Tab' || !drawer.classList.contains('is-open')) return;
    const focusable = Array.from(panel.querySelectorAll('a[href], button:not([disabled])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
})();
