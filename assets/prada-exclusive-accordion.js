(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const animateDetails = (details, shouldOpen) => {
    const summary = details.querySelector(':scope > summary');
    if (!summary) return Promise.resolve();

    details._pradaAccordionAnimation?.cancel();
    const startHeight = details.getBoundingClientRect().height;
    if (shouldOpen) details.open = true;
    const endHeight = shouldOpen ? details.scrollHeight : summary.getBoundingClientRect().height;

    if (reducedMotion.matches || typeof details.animate !== 'function') {
      details.open = shouldOpen;
      return Promise.resolve();
    }

    details.style.overflow = 'hidden';
    const animation = details.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: shouldOpen ? 340 : 280, easing: shouldOpen ? 'cubic-bezier(.22, 1, .36, 1)' : 'cubic-bezier(.4, 0, 1, 1)' }
    );
    details._pradaAccordionAnimation = animation;

    return animation.finished.catch(() => {}).then(() => {
      if (details._pradaAccordionAnimation !== animation) return;
      details.open = shouldOpen;
      details.style.removeProperty('overflow');
      details._pradaAccordionAnimation = null;
    });
  };

  const initialize = (scope = document) => {
    scope.querySelectorAll('[data-prada-exclusive-accordion]').forEach((group) => {
      if (group.dataset.pradaAccordionReady === 'true') return;
      group.dataset.pradaAccordionReady = 'true';

      const items = Array.from(group.querySelectorAll(':scope > details'));
      items.forEach((details) => {
        const summary = details.querySelector(':scope > summary');
        if (!summary) return;
        summary.setAttribute('aria-expanded', String(details.open));

        summary.addEventListener('click', (event) => {
          event.preventDefault();
          const shouldOpen = !details.open;

          if (shouldOpen) {
            items.forEach((sibling) => {
              if (sibling !== details && sibling.open) {
                sibling.querySelector(':scope > summary')?.setAttribute('aria-expanded', 'false');
                animateDetails(sibling, false);
              }
            });
          }

          summary.setAttribute('aria-expanded', String(shouldOpen));
          animateDetails(details, shouldOpen);
        });
      });
    });
  };

  initialize();
  document.addEventListener('shopify:section:load', (event) => initialize(event.target));
})();
