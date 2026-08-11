(() => {
  const initializeForms = (scope = document) => {
    scope.querySelectorAll('[data-prada-validity-form]').forEach((form) => {
      if (form.dataset.pradaValidityReady === 'true') return;
      form.dataset.pradaValidityReady = 'true';

      const submitButton = form.querySelector('[data-prada-validity-submit]');
      if (!submitButton) return;

      const syncValidity = () => {
        submitButton.disabled = !form.checkValidity();
      };

      form.addEventListener('input', syncValidity);
      form.addEventListener('change', syncValidity);
      form.addEventListener('reset', () => requestAnimationFrame(syncValidity));
      syncValidity();
    });
  };

  initializeForms();
  document.addEventListener('shopify:section:load', (event) => initializeForms(event.target));
})();
