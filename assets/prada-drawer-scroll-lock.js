(() => {
  if (window.pradaDrawerScrollLock) return;

  let lockCount = 0;

  const hasOtherScrollLock = () => {
    return Boolean(
      document.querySelector('header-drawer details[open]') ||
        document.querySelector('.header__search details[open]'),
    );
  };

  const setScrollbarCompensation = () => {
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.documentElement.style.setProperty('--prada-drawer-scrollbar-width', `${scrollbarWidth}px`);
  };

  window.pradaDrawerScrollLock = {
    lock() {
      if (lockCount === 0) {
        setScrollbarCompensation();
        document.body.classList.add('prada-drawer-scroll-locked');
      }

      lockCount += 1;
      document.body.classList.add('overflow-hidden');
    },

    unlock() {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount > 0) return;

      document.body.classList.remove('prada-drawer-scroll-locked');
      document.documentElement.style.removeProperty('--prada-drawer-scrollbar-width');

      if (!hasOtherScrollLock()) document.body.classList.remove('overflow-hidden');
    },
  };
})();
