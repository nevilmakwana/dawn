/* Luxury Footer JS - Mobile Accordion */

class LuxuryFooter {
  constructor() {
    this.columns = document.querySelectorAll('.footer-column');
    this.init();
  }

  init() {
    if (this.columns.length === 0) return;

    this.columns.forEach(column => {
      const title = column.querySelector('.footer-column__title');
      if (title) {
        title.addEventListener('click', (e) => {
          // Only trigger on mobile/tablet (less than 768px)
          if (window.innerWidth < 768) {
            column.classList.toggle('is-open');
          }
        });
      }
    });

    // Handle resize events to ensure clean state
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768) {
        this.columns.forEach(column => column.classList.remove('is-open'));
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new LuxuryFooter();
});
