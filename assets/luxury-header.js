/* Luxury Header JS */

class LuxuryHeader {
  constructor() {
    this.header = document.getElementById('LuxuryHeader');
    this.mobileMenuOpenBtn = document.getElementById('MobileMenuOpen');
    this.mobileMenuCloseBtn = document.getElementById('MobileMenuClose');
    this.mobileMenuDrawer = document.getElementById('MobileMenuDrawer');
    this.searchOpenBtn = document.getElementById('SearchOpen');
    this.searchCloseBtn = document.getElementById('SearchClose');
    this.searchOverlay = document.getElementById('SearchOverlay');
    this.searchInput = this.searchOverlay?.querySelector('input[type="search"]');

    this.lastScrollY = window.scrollY;

    this.init();
  }

  init() {
    if (!this.header) return;

    // Sticky Header Logic
    window.addEventListener('scroll', () => {
      this.handleScroll();
    }, { passive: true });

    // Mobile Menu
    if (this.mobileMenuOpenBtn && this.mobileMenuDrawer) {
      this.mobileMenuOpenBtn.addEventListener('click', () => this.openMobileMenu());
      this.mobileMenuCloseBtn.addEventListener('click', () => this.closeMobileMenu());
    }

    // Search Overlay
    if (this.searchOpenBtn && this.searchOverlay) {
      this.searchOpenBtn.addEventListener('click', () => this.openSearch());
      this.searchCloseBtn.addEventListener('click', () => this.closeSearch());
    }

    // Close overlays on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMobileMenu();
        this.closeSearch();
      }
    });
  }

  handleScroll() {
    const currentScrollY = window.scrollY;
    
    // Add sticky class after scrolling down 100px
    if (currentScrollY > 100) {
      this.header.classList.add('is-sticky');
    } else {
      this.header.classList.remove('is-sticky');
    }

    this.lastScrollY = currentScrollY;
  }

  openMobileMenu() {
    this.mobileMenuDrawer.classList.add('is-open');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
  }

  closeMobileMenu() {
    this.mobileMenuDrawer.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  openSearch() {
    this.searchOverlay.classList.add('is-open');
    if (this.searchInput) {
      setTimeout(() => this.searchInput.focus(), 300); // Wait for transition
    }
  }

  closeSearch() {
    this.searchOverlay.classList.remove('is-open');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new LuxuryHeader();
});
