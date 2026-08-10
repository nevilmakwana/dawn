(() => {
  const buildShippingPolicy = () => {
    const policy = document.querySelector('.shopify-policy__container');
    const body = policy?.querySelector('.shopify-policy__body');
    const content = body?.querySelector('.rte') || body;
    if (!policy || !content || policy.dataset.pradaReady === 'true') return;
    policy.dataset.pradaReady = 'true';

    const children = [...content.children];
    const intro = [];
    const sections = [];
    let current = null;

    const headingText = (element) => {
      if (/^H[2-4]$/.test(element.tagName)) return element.textContent.trim();
      if (element.tagName !== 'P' || element.children.length !== 1 || element.firstElementChild?.tagName !== 'STRONG') return '';
      return element.textContent.trim();
    };

    children.forEach((element) => {
      const title = headingText(element);
      if (title) {
        current = { title, nodes: [] };
        sections.push(current);
      } else if (current) {
        current.nodes.push(element);
      } else {
        intro.push(element);
      }
    });

    if (!sections.length) {
      sections.push({ title: 'Shipping and delivery information', nodes: children });
      intro.length = 0;
    }

    const shell = document.createElement('div');
    shell.className = 'prada-shipping-policy';
    shell.innerHTML = `
      <aside class="prada-shipping-policy__sidebar">
        <nav class="prada-shipping-policy__nav" aria-label="Customer service">
          <a href="/pages/contact">Contact us</a>
          <a href="/pages/contact?view=track-order">Track your order</a>
          <a href="/pages/contact?view=returns">Returns</a>
          <a href="/policies/shipping-policy" aria-current="page">Shipping and delivery</a>
        </nav>
        <p class="prada-shipping-policy__support">Customer service<br>Monday – Saturday: 10:00 – 18:00</p>
      </aside>
      <section class="prada-shipping-policy__main">
        <a class="prada-shipping-policy__back" href="/pages/contact">Customer service</a>
        <h1 class="prada-shipping-policy__heading">Shipping and delivery</h1>
        <div class="prada-shipping-policy__lead"></div>
        <div class="prada-shipping-policy__accordion"></div>
      </section>`;

    const lead = shell.querySelector('.prada-shipping-policy__lead');
    intro.forEach((node) => lead.append(node));

    const accordion = shell.querySelector('.prada-shipping-policy__accordion');
    sections.forEach((section, index) => {
      const details = document.createElement('details');
      details.className = 'prada-shipping-policy__item';
      if (index === 0) details.open = true;

      const summary = document.createElement('summary');
      summary.textContent = section.title;
      const answer = document.createElement('div');
      answer.className = 'prada-shipping-policy__answer';
      section.nodes.forEach((node) => answer.append(node));
      details.append(summary, answer);
      accordion.append(details);
    });

    accordion.addEventListener('toggle', (event) => {
      const opened = event.target;
      if (!(opened instanceof HTMLDetailsElement) || !opened.open) return;
      accordion.querySelectorAll('details[open]').forEach((item) => {
        if (item !== opened) item.open = false;
      });
    }, true);

    policy.replaceWith(shell);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildShippingPolicy, { once: true });
  } else {
    buildShippingPolicy();
  }
})();
