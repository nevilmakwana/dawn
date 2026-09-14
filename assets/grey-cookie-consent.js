(() => {
  const root = document.querySelector('[data-grey-cookie-consent]');
  if (!root || root.dataset.initialized === 'true') return;

  root.dataset.initialized = 'true';

  const banner = root.querySelector('[data-grey-cookie-banner]');
  const modal = root.querySelector('[data-grey-cookie-modal]');
  const panel = modal?.querySelector('.grey-cookie-modal__panel');
  const status = root.querySelector('[data-cookie-status]');
  const consentInputs = [...root.querySelectorAll('[data-cookie-consent]')];
  let privacyApi = null;
  let lastFocusedElement = null;
  let saving = false;

  const setStatus = (message = '') => {
    if (status) status.textContent = message;
  };

  const hideBanner = () => {
    if (banner) banner.hidden = true;
  };

  const hasNativeBanner = () =>
    Boolean(document.querySelector('#shopify-pc__banner, .shopify-pc__banner__dialog, [data-shopify-privacy-banner]'));

  const readConsent = () => {
    if (!privacyApi?.currentVisitorConsent) return {};
    try {
      return privacyApi.currentVisitorConsent() || {};
    } catch (error) {
      return {};
    }
  };

  const syncInputs = () => {
    const current = readConsent();
    consentInputs.forEach((input) => {
      input.checked = current[input.dataset.cookieConsent] === 'yes';
    });
  };

  const closeModal = () => {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('grey-cookie-modal-open');
    setStatus('');
    lastFocusedElement?.focus?.({ preventScroll: true });
    lastFocusedElement = null;
  };

  const openModal = (trigger = document.activeElement) => {
    if (!modal) return;
    lastFocusedElement = trigger instanceof HTMLElement ? trigger : null;
    syncInputs();
    hideBanner();
    modal.hidden = false;
    document.body.classList.add('grey-cookie-modal-open');
    requestAnimationFrame(() => modal.querySelector('[data-cookie-action="close"]')?.focus({ preventScroll: true }));
  };

  const setBusy = (busy) => {
    saving = busy;
    panel?.setAttribute('aria-busy', String(busy));
    root.querySelectorAll('[data-cookie-action="accept"], [data-cookie-action="reject"], [data-cookie-action="save"]')
      .forEach((button) => {
        button.disabled = busy;
        button.setAttribute('aria-disabled', String(busy));
      });
  };

  const saveConsent = (consent, successMessage) => {
    if (saving) return;
    if (!privacyApi?.setTrackingConsent) {
      setStatus('Cookie controls are loading. Please try again.');
      return;
    }

    setBusy(true);
    setStatus('Saving your preferences…');

    privacyApi.setTrackingConsent(consent, (result) => {
      setBusy(false);
      if (result?.error) {
        setStatus('We could not save your preferences. Please try again.');
        return;
      }

      setStatus(successMessage);
      hideBanner();
      window.setTimeout(closeModal, 220);
    });
  };

  const consentForAll = (allowed) => ({
    preferences: allowed,
    analytics: allowed,
    marketing: allowed,
  });

  const selectedConsent = () =>
    consentInputs.reduce((selection, input) => {
      selection[input.dataset.cookieConsent] = input.checked;
      return selection;
    }, {});

  const handleAction = (action, trigger) => {
    if (action === 'manage') {
      openModal(trigger);
      return;
    }
    if (action === 'close') {
      closeModal();
      return;
    }
    if (action === 'accept') {
      saveConsent(consentForAll(true), 'All optional cookies have been accepted.');
      return;
    }
    if (action === 'reject') {
      saveConsent(consentForAll(false), 'Optional cookies have been rejected.');
      return;
    }
    if (action === 'save') {
      saveConsent(selectedConsent(), 'Your cookie preferences have been saved.');
    }
  };

  root.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-cookie-action]');
    if (!actionButton || !root.contains(actionButton)) return;

    const switchControl = event.target.closest('.grey-cookie-switch');
    if (switchControl) event.stopPropagation();

    handleAction(actionButton.dataset.cookieAction, actionButton);
  });

  root.querySelectorAll('.grey-cookie-switch').forEach((control) => {
    control.addEventListener('click', (event) => event.stopPropagation());
  });

  document.addEventListener('shopify:open-cookie-preferences', (event) => {
    openModal(event.detail?.trigger || document.activeElement);
  });

  document.addEventListener('visitorConsentCollected', () => {
    syncInputs();
    hideBanner();
  });

  document.addEventListener('keydown', (event) => {
    if (!modal || modal.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), summary')]
      .filter((element) => element.offsetParent !== null);
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

  const initializePrivacy = () => {
    if (!window.Shopify?.loadFeatures) {
      window.setTimeout(initializePrivacy, 100);
      return;
    }

    window.Shopify.loadFeatures(
      [{ name: 'consent-tracking-api', version: '0.1' }],
      (error) => {
        if (error || !window.Shopify?.customerPrivacy) {
          setStatus('Cookie controls are temporarily unavailable.');
          return;
        }

        privacyApi = window.Shopify.customerPrivacy;
        syncInputs();

        const shouldShow = privacyApi.shouldShowBanner?.() === true;
        if (shouldShow && !hasNativeBanner() && banner) banner.hidden = false;
      },
    );
  };

  const nativeBannerObserver = new MutationObserver(() => {
    if (hasNativeBanner()) hideBanner();
  });

  nativeBannerObserver.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => nativeBannerObserver.disconnect(), 10000);
  initializePrivacy();
})();
