# GREY EXIM — COMPLETE WEBSITE AUDIT

**Audit date:** 23 September 2026  
**Production origin:** [https://www.greyexim.com](https://www.greyexim.com)  
**Mode:** Read-only production audit plus local theme-source review  
**Theme snapshot:** local `main` branch at `06cf183ca02f6ae98a97749eac049588703e3a6a`  
**Evidence:** 91 sitemap/priority URLs, 7 Lighthouse profiles, 19 responsive DOM probes, Chrome/Edge/Brave captures, 442 local theme files.

## Audit confidence and boundaries

- **Confirmed** means reproduced by HTTP crawl, rendered-browser probe, Lighthouse, screenshot, or exact local code.
- **Likely** means code and observed symptoms support the finding, but the specific user timing/race was not reproduced deterministically.
- **Potential** means a risk that needs device, legal, analytics, or production-RUM verification.
- No theme, store, product, customer, order, payment, or Shopify Admin data was changed.
- Checkout was not taken through a real order or payment. Physical iOS Safari, macOS Safari, Firefox, Instagram WebView, logged-in customer flows, and real payment gateways were not available; these are explicitly **Not verified**.
- Lighthouse values are one lab observation per listed profile, not Chrome UX Report or real-user metrics. INP requires field/RUM data and is **Not measured**.

## 1. Executive Summary

Grey Exim is functional and visually coherent on the sampled Chromium browsers, with correct canonical/social metadata on nearly all sitemap pages, no reproduced broken product images, no page-wide mobile overflow, and strong desktop homepage lab performance. The largest risks are concentrated in production navigation integrity, mobile PLP/search speed, third-party script hygiene, accessibility, and CSS/JS maintainability.

Top evidence-backed findings:

- **P0/P1:** The linked Return & Refund Policy URL, [https://www.greyexim.com/policies/return-and-refund-policy](https://www.greyexim.com/policies/return-and-refund-policy), returns 404. It is referenced from the cart footer and local policy code.
- **P1:** A duplicate GoAffPro load throws an uncaught console exception on every one of the seven Lighthouse pages and all 19 browser probes.
- **P1 performance:** Mobile collection and search scored **60**, with LCP **7.7 s** and **7.1 s** respectively. Their request counts were **277** and **297**.
- **P1 mobile UX:** The visible search-page input computes to **14 px** on mobile; iOS can auto-zoom focused form controls below 16 px.
- **P1 accessibility:** 13 px product-colour links, 6 px carousel dots, a search sort select with an ineffective hidden label, product contrast failure, an article image without alt, and a table without semantic headers were confirmed.
- **P1 SEO/content:** Three groups of duplicate product titles exist across distinct indexed URLs; the contact page has no H1; cart renders three H1s; `kp-account` has no meta description.
- **Architecture risk:** Static review found **1,344 `!important` declarations**, including 532 in `header.liquid`, plus 119 inline script tags and 358 `addEventListener` calls across the theme source. These are not automatically runtime defects, but they materially increase regression risk.

Immediate sequence: repair the broken policy URL; remove the duplicate affiliate loader; make search/form controls and colour/dot targets accessible; reduce PLP/search render-blocking and global script payload; then consolidate header/support/article CSS and validate on real iOS Safari.

## 2. Website Architecture

The storefront is a heavily customized Dawn theme using Liquid sections, JSON templates, custom CSS/JS assets, Shopify hosted assets, Web Pixels, Shop/checkout assets, Meta Pixel, and GoAffPro. Key local architecture:

- 238 assets, 74 sections, 45 snippets, 30 templates, 2 layouts.
- Core layout: `layout/theme.liquid`, with global CSS, global scripts, cart drawer, header/footer groups, SEO snippets, cookie UI, predictive search lazy-loading, and page-specific assets.
- Major bespoke surfaces: Prada-style header/navigation, linked collection loading, product gallery/variants, search/collection grid, support-page AJAX navigation, cart drawer/page, and editorial article template.
- Total scanned theme payload on disk: **8.86 MB**, including two hero videos totaling about **3.23 MB**.
- Local JSON/JSONC files parsed successfully after honoring Shopify’s generated leading comments; no missing `{% render %}` or `{% section %}` targets were found.

Architecture concern: `header.liquid` is 97 KB and contains 532 `!important` declarations. `theme.liquid` contains 27 inline scripts and acts as a global orchestration layer. The resulting cross-component coupling makes small UI changes more likely to cause FOUC, ordering issues, or regressions.

## 3. URL / Page Inventory

Shopify sitemap discovery returned:

| Sitemap | URLs | Result |
|---|---:|---|
| Agentic discovery | 1 | 200 |
| Products | 71 | 200 |
| Pages | 2 | 200 |
| Collections | 10 | 200 |
| Blogs/articles | 2 | 200 |
| Additional priority utility URLs | 5 unique additions | Crawled |
| **Total audited pages** | **91** | 88 returned 200; 3 legacy direct support URLs returned 404 |

Primary templates/surfaces reviewed: home, collection, product, search, cart, contact, FAQ view, returns view, track-order view, blog/article, policies, customer/account code, footer/newsletter, navigation/menu drawer, predictive search, and cart drawer.

The three direct legacy paths returning 404 were `/pages/faq`, `/pages/track-order`, and `/pages/returns`. Current navigation uses `/pages/contact?view=...`; bookmarks or external links to the legacy paths will fail unless redirects are configured.

## 4. Critical Bugs

1. **GE-001 — Confirmed — P0:** Return-policy URL linked from cart returns 404.
2. **GE-002 — Confirmed — P1:** GoAffPro loader is executed twice and throws on every sampled page.
3. **GE-003 — Confirmed — P1:** Collection/search mobile LCP exceeds 7 seconds in the lab profile.
4. **GE-004 — Confirmed — P1:** Mobile search input is 14 px, retaining iOS auto-zoom risk.
5. **GE-005 — Confirmed — P1:** Search sort select lacks an effective accessible name in Lighthouse.

No production data-loss, payment, authentication-bypass, mixed-content, invalid schema JSON, or site-wide broken-image defect was confirmed in this pass.

## 5. Functional Bugs

- `/policies/return-and-refund-policy` returns 404 even though cart content links to it.
- Direct legacy support URLs return 404; current query-view URLs return 200.
- GoAffPro throws `Goaffpro is already loaded` on every tested route.
- A Shopify/Shop request to `/sf_private_access_tokens` returned 401 on all narrow-width probes. This may be an expected optional Shop/accelerated-checkout probe; treat it as **Potential** until the owning integration is confirmed.
- Support navigation swaps full page sections through AJAX, dynamically copies styles/scripts, and can fall back to full navigation. This is a **Likely** source of the previously observed millisecond flash because layout/style readiness depends on a race and the support stylesheet may be appended again.
- Collection deep-link code applies a `prada-collection-route-pending` class and removes it after up to four seconds. This is a **Likely** source of transient hidden/incorrect-grid flashes on nested navigation.

## 6. UI / Visual Bugs

- On the 390 px search capture, the right-side relevance/sort label is visually cropped at the viewport edge although the document itself does not overflow.
- Mobile collection/search product tiles use extremely small colour swatches (13 px) and gallery indicators (6 px).
- Three sticky collection rows—title, category tabs, and toolbar—remain present after scroll on mobile, consuming a large part of a 320 px viewport.
- Product-detail trigger text and several footer/social controls have rendered boxes below recommended touch size.
- Article content is visually dense on small screens; imported markup adds inconsistent structure even though page-wide overflow and table overflow were not reproduced.
- CSS has extensive cascade overrides; this can explain intermittent first-frame alignment differences even when final layout settles correctly.

## 7. Micro-Glitches

- Support-page AJAX navigation temporarily sets `aria-busy`, waits up to four seconds for styles, replaces the support root, appends missing scripts, and then reinitializes components. A flash is plausible under cache miss/slow CPU.
- Nested collection routes intentionally enter a pending visual state for up to four seconds.
- Predictive search is injected on first hover/focus/touch/click, so the first invocation can differ from subsequent cached invocations.
- The cart drawer styles are initially loaded through `media="print"` then switched on load; critical anti-flow CSS is inlined to mask the gap. Slow parsing can still expose intermediate states in nested elements.
- Headless cross-browser captures for the same collection were pixel-identical between Chrome and Brave; Edge differed slightly in rendered bytes but showed no obvious structural mismatch.

## 8. Homepage Audit

Strengths:

- One visible H1, no broken images, no horizontal overflow at 320/390/1440 probes.
- Lighthouse: mobile 85 performance / 97 accessibility / 100 SEO; desktop 96 / 100 / 100.
- Mobile LCP 3.3 s, CLS 0; desktop LCP 1.0 s, CLS 0.

Issues:

- Mobile Speed Index 4.2 s and interactive 11.2 s.
- Mobile transferred 2.66 MB across 239 requests; desktop transferred 4.49 MB across 219 requests.
- Desktop hero video was the largest request at about 2.49 MB; mobile hero video about 824 KB.
- Global unused-JS opportunity about 104 KB.
- 6 px gallery dots and numerous undersized links/controls reduce touch accessibility.

## 9. Collection Page Audit

Representative URL: [Women’s Scarves](https://www.greyexim.com/collections/women-scarves).

- Mobile Lighthouse performance **60**, LCP **7.7 s**, FCP 3.9 s, Speed Index 4.2 s, TBT 280 ms, CLS 0.
- 277 requests and 2.45 MB transfer; main-thread work about 2.89 s.
- Render-blocking insight estimated 820 ms savings; unused JS about 100 KB.
- Colour swatches render at about 13 × 13 px and fail touch-target sizing.
- No broken images or page-wide overflow reproduced at 320/390/1440 widths.
- Sticky title/tabs/toolbar remain after scroll. On small screens this materially reduces the product viewport.
- Nested collection pending-state logic is a likely cause of reported transient incorrect-product/blank states.

## 10. Product Page Audit

Representative URL: [Merry Forest French Vanilla Candle](https://www.greyexim.com/products/merry-forest-french-vanilla-candle).

- Mobile Lighthouse performance 90, accessibility 93, SEO 100.
- LCP 3.2 s, TBT 120 ms, CLS 0; 248 requests and 1.87 MB transfer.
- Confirmed failures: colour contrast and touch-target size.
- Variant changes use the current product root URL plus `?variant=...`; no code evidence that the theme forces all products to a single handle.
- Across all crawled live product URLs, no strong current title/slug mismatch was found. Duplicate title groups remain an SEO issue and numeric suffixes (`-1`, `-2`) weaken URL clarity.
- No broken product image was reproduced in 320/390/1440 probes. The previously reported intermittent missing images remains **Not reproduced**; add image-error RUM before claiming resolution.

## 11. Cart Audit

- Empty cart Lighthouse: performance 96, accessibility 100, SEO 100; LCP 2.0 s, TBT 200 ms, CLS 0.
- Cart page exposes three H1s: “Shopping bag (0)”, “Your cart”, and “Your shopping bag is empty”. Use a single page H1 and downgrade state/subsection headings.
- The Return & Refund Policy link is broken (404).
- Cart drawer code is large: `cart-drawer.js` 42.7 KB, `cart.js` 40.2 KB, cart-drawer CSS 38.4 KB, cart page CSS 49.9 KB plus page JS 32.9 KB.
- Quantity/update/remove race behavior was not exercised against a populated production cart to avoid unnecessary live session mutations. **Not verified:** rapid multi-click quantity, remove-last-item, inventory error, discount, note persistence, and drawer/page parity.

## 12. Checkout Audit

Checkout was deliberately not progressed through a real transaction. Verified only through public resource evidence and empty-cart boundary.

- Shopify checkout/Shop assets are loaded on ordinary pages: `hydrate` about 202 KB and `is-address-empty` about 96 KB were among the largest recurring requests.
- Third-party cookies from Facebook and Shop were reported by Lighthouse.
- Security-sensitive checkout, shipping-rate, tax, address validation, discount, gateway, OTP, failure/retry, order-confirmation, and refund flows are **Not verified**.
- Recommendation: run a separate Shopify test-order matrix using Bogus Gateway/test mode in a non-production or explicitly approved test setup.

## 13. Mobile Audit

Tested widths: 320 and 390 CSS px via Chrome device emulation; mobile Lighthouse uses its default mobile profile.

- No page-wide horizontal overflow on home, collection, product, search, article, contact, FAQ, returns, or track-order views.
- No broken images reproduced.
- Search page’s main input is 14 px; newsletter input is also 14 px. Both can trigger iOS zoom.
- Collection/search sort controls are 12 px text with 16 px rendered height; colour swatches are 13 px; carousel dots are 6 px.
- Article table shrank to the viewport at 320/390, so the prior internal table scrollbar was not reproduced.
- Physical iPhone Safari, Android Chrome hardware, rotation, browser text scaling, safe areas, virtual keyboard, low-memory reloads, and Instagram WebView are **Not verified**.

## 14. Browser Compatibility

| Browser | Method | Result |
|---|---|---|
| Google Chrome | Headless screenshots, Lighthouse, CDP | Core sampled pages rendered; findings above |
| Microsoft Edge | Headless 390 px collection capture | No structural difference observed |
| Brave | Headless 390 px collection capture | Pixel-identical to Chrome capture |
| Firefox | Not available | Not verified |
| Safari macOS | Not available | Not verified |
| iOS Safari | UA + device emulation only | Not equivalent to physical Safari; not verified |
| Instagram WebView | Not available | Not verified |

## 15. Lighthouse Results

| Page/profile | Perf | A11y | Best practices | SEO | FCP | LCP | TBT | CLS | Requests | Transfer |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Home mobile | 85 | 97 | 73 | 100 | 1.9 s | 3.3 s | 210 ms | 0 | 239 | 2.66 MB |
| Home desktop | 96 | 100 | 73 | 100 | 0.7 s | 1.0 s | 0 ms | 0 | 219 | 4.49 MB |
| Collection mobile | 60 | 97 | 73 | 100 | 3.9 s | 7.7 s | 280 ms | 0 | 277 | 2.45 MB |
| Product mobile | 90 | 93 | 73 | 100 | 2.3 s | 3.2 s | 120 ms | 0 | 248 | 1.87 MB |
| Search mobile | 60 | 92 | 73 | 69* | 3.3 s | 7.1 s | 350 ms | 0 | 297 | 2.45 MB |
| Article mobile | 87 | 95 | 73 | 92 | 2.1 s | 3.7 s | 110 ms | 0.001 | 208 | 1.59 MB |
| Empty cart mobile | 96 | 100 | 73 | 100 | 1.1 s | 2.0 s | 200 ms | 0 | 195 | 1.53 MB |

`*` Search SEO score is reduced because the page is deliberately `noindex,follow`; that directive is normally appropriate for internal search and should not be removed just to raise the score.

## 16. Core Web Vitals

- **LCP:** Desktop home passes lab target. Mobile home/product/article need improvement; collection/search are severe at 7.7/7.1 s.
- **CLS:** All sampled Lighthouse runs were excellent (0 to 0.001).
- **INP:** Not measured. Lighthouse TBT is only a lab proxy and must not be reported as INP.
- **TBT:** Search 350 ms and collection 280 ms indicate interaction work that deserves profiling; home/product/article are better.
- **Field status:** Chrome UX Report/store RUM was not supplied, so no claim about real-user CWV pass rate is supported.

## 17. Performance Waterfall

Recurring heavy requests:

- Shopify checkout-web `hydrate` ~202 KB on all sampled routes.
- Shopify checkout-web `is-address-empty` ~96 KB on all sampled routes.
- Meta `fbevents.js` ~108 KB plus signals config ~83–84 KB.
- Shopify Web Pixel manager bundle ~80 KB.
- Home hero: desktop WebM ~2.49 MB; mobile WebM ~824 KB.

Collection/search additionally pay for many product images and grid resources. The origin accounted for most bytes; Meta was the largest external JavaScript contributor. Rendering was not blocked by a single catastrophic request; the problem is cumulative request count, global commerce/analytics code, and late product-grid rendering.

## 18. Image Optimization

Positive:

- Product and collection images use Shopify CDN URLs and responsive variants in theme code.
- No broken images reproduced in browser probes.
- Lighthouse estimated only 5–27 KB image-delivery savings on sampled routes, so images are not the only bottleneck.

Issues/actions:

- Article contains one `<img>` without alt and an externally hosted `static.wixstatic.com` image.
- Confirm LCP images are eager/high priority and never lazy-loaded; defer below-fold grid images.
- Keep explicit width/height/aspect ratio for all rendered images.
- Add runtime image-error logging with URL, product handle, variant, viewport, connection, and navigation type to diagnose intermittent reports.
- Review 247.8 KB white wordmark and 179.3 KB GIF; use SVG/WebP/AVIF where visually equivalent.

## 19. JavaScript Audit

- 358 `addEventListener` calls, 4 MutationObserver constructions, 2 intervals, and 19 console calls in static source.
- Lighthouse found ~98–105 KB unused JS on every sampled route.
- GoAffPro duplicate initialization produces an uncaught exception.
- Support AJAX swaps markup, styles, and scripts, creating reinitialization/race complexity.
- Linked collection loading and pending-state logic can show transient intermediate content.
- Global standard-events, wishlist, cart disclosure, details, search-form, and other scripts load from `theme.liquid`; verify route-level necessity.
- Repeated Shopify checkout/Shop bundles on content routes should be reviewed through app embeds/settings, not hacked out of generated Shopify code.

## 20. CSS Audit

- 1,344 `!important` declarations: header 532; typography 250; article 146; image-banner section 102.
- Global `base.css` is 85.4 KB; header embeds a large amount of CSS inside Liquid.
- The cascade is heavily patched across breakpoints, increasing first-frame/final-frame differences.
- Search/collection/product/cart have bespoke CSS layers on top of Dawn components.
- Recommendation: define tokens and component ownership, remove dead overrides, and migrate one surface at a time. Do not bulk-delete `!important` without screenshot regression coverage.

## 21. Font Audit

- Shopify-hosted body font is preloaded when non-system; `font-display: swap` is used.
- Lighthouse still identified legacy JS and render-blocking work, but no failing font-display audit in sampled results.
- Mobile form font sizes are inconsistent: modal search 16 px; search template 14 px; newsletter 14 px; sort select 12 px.
- Standardize interactive text to at least 16 px on touch layouts and use visual sizing through surrounding scale, not sub-16 input text.

## 22. Third-Party Script Audit

Observed domains include `connect.facebook.net`, `www.facebook.com`, `shop.app`, `cdn.shopify.com`, Shopify telemetry, GoAffPro through a Shopify proxy, and one Wix static asset in article content.

- Meta scripts transfer roughly 191–192 KB in sampled runs.
- GoAffPro is duplicate-loaded and throws.
- Facebook and Shop cookies triggered the Lighthouse third-party-cookie audit.
- Checkout-web resources load broadly.
- Audit every app embed in Shopify Theme Customizer and Admin Apps. Disable duplicate or unused embeds at source; do not merely suppress the error.

## 23. Network Audit

- Request volume ranges from 195 (empty cart) to 297 (search) in lab runs.
- `/sf_private_access_tokens` returned 401 in mobile probes. Confirm ownership before changing; it may be a normal optional Shop request.
- Some aborted fetches occurred during sequential page navigation; they were cancelled requests, not proof of customer-facing failure.
- Response security headers include HSTS, CSP `frame-ancestors 'none'`, `upgrade-insecure-requests`, X-Frame-Options DENY, and nosniff.
- No `Referrer-Policy` or `Permissions-Policy` response header was observed. These are hardening opportunities, often controlled by Shopify/platform constraints.

## 24. Shopify Technical Audit

- `content_for_header` and `content_for_layout` are present.
- SEO/social snippets exist and rendered schema JSON parsed successfully across 91 crawled pages.
- No missing local snippet/section targets were found.
- Shopify Theme Check found one HTML syntax error in `docs/order-confirmation-email.liquid` (a `td` closed before `table`), plus warnings for variable naming in `main-list-collections.liquid` and `main-article.liquid`, and undefined `scheme_classes` in `layout/password.liquid`.
- The email file is under `docs`, not a normal deployable theme directory, but should still be fixed before reuse.
- Official remote Liquid validation was attempted but blocked by the privacy control because it would submit local source externally. No bypass was used.
- Follow Shopify guidance on [responsive theme performance](https://shopify.dev/docs/storefronts/themes/best-practices/performance/implement-responsive-design) and [theme accessibility](https://shopify.dev/docs/storefronts/themes/best-practices/accessibility).

## 25. SEO Audit

Positive:

- Canonicals present on all true HTML pages except `agents.md`.
- Open Graph images present on all true HTML pages sampled.
- No invalid JSON-LD detected.
- Search `noindex,follow` is intentional and appropriate.

Issues:

- Duplicate title groups: three Pillar French Vanilla Candle URLs, three Floral Printed Square Scarf URLs, and two Leopard Print Pattern Square Scarf URLs.
- `kp-account` lacks a meta description.
- Contact page has no H1; cart has three H1s.
- Numeric product-handle suffixes weaken semantic URL quality and can split signals when products are near-duplicates.
- Legacy support paths 404; create server-side redirects if they were ever published/shared.
- Review whether `kp-account` should be indexed at all.

## 26. Accessibility Audit

Confirmed Lighthouse failures:

- Collection/home/search: insufficient touch target spacing.
- Product: colour contrast and touch target size.
- Search: sort select has an ineffective hidden label.
- Article: missing image alt, accessible-name/visible-label mismatch, and table cells without headers.

DOM probe specifics:

- Colour links ~13 px, carousel dots ~6 px, social icons ~18 px.
- Several text links have only 14–20 px height.
- Contact page lacks H1; cart heading hierarchy is ambiguous.

Fix targets: 24 × 24 px minimum safe target (prefer 44 × 44 px for primary touch controls), visible focus, meaningful labels, semantic table `<th scope>`, alt text, and logical headings.

## 27. Form Audit

- Contact form has programmatic labels, required attributes, and useful name/email/tel autocomplete values.
- Return and track forms have labels and required email/order number.
- Search template input is 14 px on mobile; newsletter input 14 px. Raise to 16 px.
- Search sort label is visually hidden in a way Lighthouse considers ineffective; use a persistent accessible name (`aria-label` or non-hidden associated label).
- Form success/error submission was not executed to avoid sending production support messages. Server validation, spam behavior, duplicate submit, offline retry, and email receipt are **Not verified**.

## 28. Navigation Audit

- Main and support navigation render at narrow/desktop widths without page overflow.
- Legacy support URLs need redirects.
- Support AJAX navigation is architecturally fragile and likely related to the reported brief flash.
- Nested collection pending state is likely related to the reported wrong-products-before-correct-products flash.
- Recommendation: prefer direct URL navigation with server-rendered correct state, or keep existing page shell but replace only after new content and its required CSS are ready; never expose stale product content.

## 29. Search Audit

- Search results return and render relevant product grids; 50 results were shown for `scarf` in the tested snapshot.
- Performance is weak: 60 score, 7.1 s LCP, 297 requests, 3.33 s main-thread work.
- Mobile input is 14 px and sort select is 12 px/16 px high.
- Sort label accessibility fails; toolbar right edge is visually clipped in the capture.
- Search is correctly noindexed.
- Predictive search first-load and keyboard interaction were not exhaustively tested; run real-device focus, arrow-key, escape, screen-reader, and no-result tests.

## 30. Cart / AJAX Audit

- Empty-cart render is fast and accessible in Lighthouse.
- Cart code has multiple global and component layers; rapid update race was not exercised.
- Drawer resources are lazy-ish CSS via print media, but significant cart JS is global when drawer mode is enabled.
- Verify add/remove/change endpoints with an isolated test cart: debounce quantity changes, abort stale requests, preserve focus, announce totals, and reconcile drawer bubble/subtotal after every response.
- Never test inventory/payment failure against a real order without a test setup.

## 31. Security Observations

Positive response headers: HSTS, CSP mixed-content upgrade plus `frame-ancestors 'none'`, X-Frame-Options DENY, and nosniff.

Hardening/verification:

- Add/confirm Referrer-Policy and Permissions-Policy if Shopify permits.
- Review third-party app permissions and loaders; remove duplicate GoAffPro embed.
- Cookie consent UI cannot by itself prove pixels are withheld before consent. Because Meta/Shop cookies appeared in Lighthouse, have counsel/implementation owners verify jurisdictional consent behavior. This is **Potential compliance risk**, not a legal conclusion.
- No penetration testing, authenticated account attack testing, secret scanning of Shopify Admin, or payment-security assessment was performed.

## 32. Broken Links

Confirmed internal/priority failures:

| URL | Status | Notes |
|---|---:|---|
| `/policies/return-and-refund-policy` | 404 | Linked from cart; highest priority |
| `/pages/faq` | 404 | Legacy direct path; current query-view URL works |
| `/pages/track-order` | 404 | Legacy direct path; current query-view URL works |
| `/pages/returns` | 404 | Legacy direct path; current query-view URL works |

One harmless normalized search redirect (`%20` to `+`) was observed. The crawl checked sitemap pages and discovered internal anchors, not every externally indexed/backlinked URL.

## 33. Visual Regression Findings

- Chrome and Brave 390 px collection captures were pixel-identical; Edge showed only a minor byte-level/render difference.
- Search mobile toolbar clips its right label/indicator.
- No page-wide overflow on tested widths.
- No broken images on tested widths.
- Article table fits at 320/390 and header scrolls away on the article, matching the requested behavior.
- Remaining regression risk is high around header/support/article due to 928 combined `!important` declarations in header, typography, and article CSS.

## 34. Quick Wins

1. Point cart policy links to `/policies/refund-policy` or add a permanent redirect.
2. Disable the duplicate GoAffPro loader/embed.
3. Set mobile search/newsletter input font-size to 16 px.
4. Add `aria-label="Sort by"` to the mobile search sort select.
5. Expand colour/dot hit areas without enlarging the visual dot.
6. Add alt text to the article image.
7. Convert article header row cells to `<th scope="col">`.
8. Align article back-link accessible name with visible text.
9. Reduce cart H1s to one and add contact H1.
10. Add redirects for legacy support paths.

## 35. Top Performance Fixes

1. Defer/remove nonessential checkout/Shop assets from non-commerce intent pages where app/platform settings allow.
2. Gate Meta and affiliate scripts by consent and actual need.
3. Deduplicate GoAffPro.
4. Reduce collection/search initial product image count and preload only the true LCP image.
5. Eliminate render-blocking collection/search CSS; inline only measured critical CSS.
6. Route-split custom JS and CSS.
7. Remove verified dead CSS/assets after regression tests.
8. Replace desktop hero with a smaller encoded video/poster strategy.
9. Keep mobile hero below ~500–700 KB where visual quality allows.
10. Reduce DOM size and hidden duplicate navigation/cart markup.

## 36. Top UX / CRO Fixes

- Make every product swatch and carousel dot reliably tappable.
- Prevent iOS zoom on search and newsletter inputs.
- Keep search sort/result count fully visible.
- Reduce sticky mobile chrome to preserve product viewport.
- Keep direct navigation deterministic; remove stale-content flashes.
- Make policy links trustworthy and non-404.
- Improve product contrast and focus states.
- Preserve exact product title/handle relationships and consolidate duplicates.
- Add image failure fallbacks plus monitoring.
- Validate cart state changes with accessible live announcements.

## 37. Master Bug Database

Each row follows **WHAT → WHERE → WHY → HOW → EXPECTED RESULT → HOW TO VERIFY**.

| ID | Sev / confidence | What | Where | Why | How | Expected result | Verify |
|---|---|---|---|---|---|---|---|
| GE-001 | P0 Confirmed | Broken return-policy link | Cart footer; policy references | Trust/legal navigation; 404 | Link to `/policies/refund-policy` and 301 old path | Policy always opens | Crawl + click from cart |
| GE-002 | P1 Confirmed | GoAffPro loaded twice | Every sampled page | Uncaught error; wasted work | Remove duplicate app embed/loader at source | One loader, zero exception | Console on 7 page types |
| GE-003 | P1 Confirmed | Collection LCP 7.7 s | Mobile PLP | Poor CWV/conversion | Prioritize first image; reduce blocking/global work | Lab LCP <2.5–3 s | 3-run median Lighthouse |
| GE-004 | P1 Confirmed | Search LCP 7.1 s | Mobile search | Slow discovery | Same as GE-003 plus smaller initial result render | Faster useful results | 3-run median Lighthouse |
| GE-005 | P1 Confirmed | Search input 14 px | `main-search` mobile | iOS focus zoom | Set interactive input text to 16 px | No viewport zoom | Physical iPhone Safari |
| GE-006 | P1 Confirmed | Sort select inaccessible | Search mobile | Screen-reader label failure | Visible label or `aria-label`; keep association | Named control | Lighthouse + VoiceOver |
| GE-007 | P1 Confirmed | 13 px colour targets | Product tiles | Mistaps/accessibility | 24–44 px hit wrapper; keep 13 px dot | Reliable selection | Lighthouse target-size + touch |
| GE-008 | P1 Confirmed | 6 px carousel dots | Home/product grids | Untappable | Pseudo-element/hit-area enlargement | Reliable navigation | Touch + keyboard |
| GE-009 | P1 Confirmed | Product contrast failure | Product mobile | WCAG readability | Adjust failing foreground/background token | AA contrast | Lighthouse + contrast tool |
| GE-010 | P1 Confirmed | Article image missing alt | GSM article | SEO/a11y | Add meaningful alt or `alt=""` if decorative | Correct announcement | Lighthouse image-alt |
| GE-011 | P1 Confirmed | Article table lacks headers | GSM article | Table unreadable to AT | Use `<thead>`, `<th scope="col">` | Semantic grid | Lighthouse + screen reader |
| GE-012 | P1 Confirmed | Back-link label mismatch | Article subbar | Accessible name differs from “JOURNAL” | Align visible text and aria-label | Predictable announcement | Lighthouse label-name |
| GE-013 | P1 Confirmed | Contact lacks H1 | Contact | Heading/SEO hierarchy | Add one descriptive H1 | Clear page topic | Crawl + accessibility tree |
| GE-014 | P2 Confirmed | Cart has three H1s | Empty cart | Heading ambiguity | Keep one H1; downgrade state headings | Logical hierarchy | Crawl + screen reader |
| GE-015 | P1 Confirmed | Duplicate product titles | 8 indexed product URLs | Cannibalization/confusion | Consolidate, differentiate, canonical/redirect | Unique intent per URL | Crawl + Search Console |
| GE-016 | P2 Confirmed | Missing description | `/pages/kp-account` | Weak snippet; unclear index intent | Add description or noindex/private | Intentional index state | Crawl + source |
| GE-017 | P1 Confirmed | Legacy support URLs 404 | `/pages/faq`, `/track-order`, `/returns` | Old links/bookmarks fail | 301 to query-view URLs | Backward compatibility | HTTP status + final URL |
| GE-018 | P1 Confirmed | ~100 KB unused JS | All Lighthouse pages | Parse/execute cost | Route-split; remove unused embeds | Lower JS/TBT | Coverage + Lighthouse |
| GE-019 | P1 Confirmed | 195–297 requests | All pages | Latency/CPU overhead | Remove apps, combine ownership, lazy load | Smaller waterfalls | Request budget CI |
| GE-020 | P1 Confirmed | 4.49 MB desktop home | Home desktop | High transfer | Re-encode/defer hero video | Lower first load | Lighthouse/network |
| GE-021 | P2 Confirmed | Checkout bundles global | Content/product pages | ~298 KB recurring code | Review Shop/accelerated checkout app settings | Fewer nonessential bytes | Waterfall diff |
| GE-022 | P2 Confirmed | Third-party cookies | All Lighthouse pages | Privacy/future browser risk | Consent-gate and document necessity | Expected cookie state | Fresh profile before/after consent |
| GE-023 | P2 Likely | Support-page flash | Contact query views | AJAX style/script race | Server navigation or atomic preloaded swap | No intermediate layout | Slow-3G video + performance marks |
| GE-024 | P2 Likely | Wrong products flash | Nested collections | pending class/late loader | Render correct server state; hide stale grid atomically | Direct correct grid | Slow-3G deep links |
| GE-025 | P2 Confirmed | Search toolbar clipped | 390 px search | Sort affordance obscured | Grid minmax, padding, label constraints | Full label/arrow | 320/375/390 screenshots |
| GE-026 | P2 Confirmed | Sticky stack consumes viewport | Collection mobile | Less shopping space | Collapse title/tabs or sticky only toolbar | More visible products | Scroll on 320 px |
| GE-027 | P2 Confirmed | 1,344 `!important`s | Theme CSS/Liquid | Fragile cascade | Component-by-component specificity cleanup | Predictable styling | Visual regression suite |
| GE-028 | P2 Confirmed | Monolithic header | `header.liquid` 97 KB | High regression/maintenance risk | Split CSS/behavior/snippets | Clear ownership | Theme Check + screenshots |
| GE-029 | P2 Confirmed | Inline/global orchestration | `theme.liquid`, sections | Ordering/dup-init risk | Move idempotent components to assets | Fewer first-frame differences | Console + section reload tests |
| GE-030 | P2 Potential | `/sf_private_access_tokens` 401 | Mobile probes | Network noise; unclear integration | Confirm Shop ownership; change only if unintended | No unexplained error | Network with Shop enabled/disabled |
| GE-031 | P3 Confirmed | Missing response policies | Site headers | Security hardening | Add Referrer/Permissions policy if supported | Reduced leakage/capabilities | Header scan |
| GE-032 | P2 Confirmed | Email template invalid HTML | `docs/order-confirmation-email.liquid` | Reuse/render risk | Correct table nesting | Valid email HTML | Theme Check + email preview |
| GE-033 | P2 Confirmed | Password undefined object warning | `layout/password.liquid` | Potential styling gap | Define `scheme_classes` or remove reference | No warning/stable page | Theme Check + password preview |
| GE-034 | P2 Potential | Intermittent missing images | Reported PLP behavior | Lost product discovery | Add error fallback/RUM; validate URLs | Observable/recoverable failures | RUM + throttled repeat loads |
| GE-035 | P3 Confirmed | External Wix article asset | GSM article | Extra origin/control/a11y risk | Move to Shopify Files/CDN | Controlled asset pipeline | Network/domain crawl |

## 38. Prioritized Development Roadmap

**Phase 0 — same day:** GE-001, GE-002, GE-005, GE-006, GE-010–012, GE-017. These are narrow, measurable fixes.

**Phase 1 — 2–4 days:** collection/search LCP, request/JS audit, touch targets, search toolbar, product contrast, heading hierarchy.

**Phase 2 — 1–2 weeks:** support and nested-collection navigation redesign; app/embed inventory; global checkout/analytics payload reduction; responsive regression suite.

**Phase 3 — ongoing:** CSS architecture cleanup, header modularization, product consolidation/redirect plan, RUM for image failures and CWV, real-device/browser matrix.

Release gate for each phase: local Theme Check; Chrome/Edge/Brave and physical iOS Safari smoke; 320/375/390/768/1024/1440 screenshots; console/network errors; sitemap/link crawl; cart/checkout test-mode checklist.

## 39. Recommended Performance Budget

| Metric | Budget |
|---|---:|
| Mobile LCP lab median | ≤2.5 s target; ≤3.0 s interim |
| Field INP p75 | ≤200 ms |
| CLS | ≤0.10 |
| Mobile TBT lab | ≤200 ms |
| Initial transfer, non-home | ≤1.5 MB interim; ≤1.0 MB target |
| Initial transfer, media home | ≤2.0 MB interim |
| Requests | ≤150 interim; ≤100 target |
| First-party JS transfer | ≤250 KB |
| Third-party JS transfer | ≤150 KB before explicit user interaction/consent |
| Initial product images | Only above-fold/LCP eager; rest lazy |
| Console exceptions | 0 |
| Broken internal links | 0 |

Budgets should be enforced in CI with Lighthouse CI and a link crawler, using three-run medians for performance.

## 40. Final Action Plan

1. Fix the broken policy URL and legacy redirects; recrawl.
2. Identify the two GoAffPro injection points; retain exactly one; verify zero exception.
3. Patch mobile input sizes, sort label, hit areas, article semantics, contrast, and heading hierarchy.
4. Profile collection/search LCP with DevTools trace; prioritize the actual LCP image and remove render-blocking/global work.
5. Inventory Shopify app embeds and pixels; document owner, page scope, consent category, bytes, and business need.
6. Replace support/nested-collection intermediate rendering with deterministic server state or atomic swaps.
7. Establish screenshot + Lighthouse + link-check release gates.
8. Run the unavailable test matrix: real iOS Safari, Firefox, Instagram WebView, logged-in customer, populated cart, and Shopify test checkout.

# A. TOP 20 BUGS TO FIX FIRST

1. GE-001 broken return-policy link.
2. GE-002 duplicate GoAffPro loader.
3. GE-003 collection mobile LCP.
4. GE-004 search mobile LCP.
5. GE-005 search input iOS zoom.
6. GE-006 sort select accessible name.
7. GE-007 colour swatch hit area.
8. GE-008 carousel-dot hit area.
9. GE-009 product contrast.
10. GE-010 article image alt.
11. GE-011 article table headers.
12. GE-012 article label/name mismatch.
13. GE-013 contact H1.
14. GE-015 duplicate product titles.
15. GE-017 legacy support redirects.
16. GE-018 unused global JavaScript.
17. GE-019 excessive requests.
18. GE-023 support flash.
19. GE-024 nested collection flash.
20. GE-025 search toolbar clipping.

# B. TOP 20 PERFORMANCE IMPROVEMENTS

1. Deduplicate GoAffPro.
2. Audit app embeds and Web Pixels.
3. Remove/condition nonessential checkout assets on content pages where supported.
4. Reduce initial PLP/search result count/DOM.
5. Eager-load only the true LCP image.
6. Lazy-load below-fold product media.
7. Eliminate collection/search render-blocking CSS.
8. Route-split search scripts.
9. Route-split collection scripts.
10. Route-split product/cart-only scripts.
11. Re-encode desktop hero video.
12. Reduce mobile hero video size.
13. Use a lightweight poster and delayed autoplay when appropriate.
14. Remove verified unused CSS.
15. Remove verified unused assets.
16. Reduce header DOM/duplicate hidden markup.
17. Make component initialization idempotent.
18. Replace broad MutationObserver/listener patterns with scoped ownership.
19. Add performance budgets to CI.
20. Add production RUM for LCP/INP/CLS and image errors.

# C. TOP 20 UX / CONVERSION IMPROVEMENTS

1. Never send policy links to 404.
2. Remove stale/wrong-product flashes.
3. Prevent iOS input zoom.
4. Make swatches 44 px tappable areas.
5. Make carousel dots keyboard/touch usable.
6. Keep sort label and chevron fully visible.
7. Reduce mobile sticky chrome.
8. Improve low-contrast product text/control.
9. Use one clear H1 per page.
10. Differentiate/consolidate duplicate products.
11. Provide image fallbacks and retry.
12. Announce cart updates to assistive technology.
13. Preserve focus after drawer/accordion updates.
14. Keep FAQ links deep-linkable and deterministic.
15. Show useful no-result search suggestions.
16. Keep product-title/price/card heights stable during image load.
17. Make newsletter form 16 px and show inline errors.
18. Test checkout in Shopify test mode.
19. Validate real iOS Safari and Instagram WebView.
20. Add user-visible recovery for network/cart failures.

# D. COMPLETE BUG DATABASE

The authoritative database is the 35-row table in Section 37. Machine-readable evidence is stored beside this report:

- `audit/evidence/site-crawl.json`
- `audit/evidence/lighthouse-summary.json`
- `audit/evidence/browser-probe.json`
- `audit/evidence/browser-probe-article.json`
- `audit/evidence/static-theme-audit.json`
- `audit/evidence/lighthouse-*.json`
- `audit/evidence/screenshots/`

# E. DEVELOPER IMPLEMENTATION CHECKLIST

- [ ] Fix GE-001 and add three legacy support redirects.
- [ ] Disable duplicate GoAffPro source and verify console clean.
- [ ] Make inputs ≥16 px on mobile.
- [ ] Give sort select an effective accessible name.
- [ ] Expand swatch/dot/social hit areas; preserve visual scale.
- [ ] Resolve product contrast failure.
- [ ] Add article alt, semantic headers, matching link label.
- [ ] Correct contact/cart heading hierarchy.
- [ ] Audit duplicate products, canonical plan, redirects, internal links.
- [ ] Profile collection/search LCP and main-thread work.
- [ ] Reduce render-blocking resources and unused JS.
- [ ] Review checkout/Shop/Meta/affiliate global loading.
- [ ] Replace support AJAX/nested collection transitional flashes.
- [ ] Fix Theme Check findings, including email table nesting and password object.
- [ ] Run responsive screenshots at 320/375/390/768/1024/1440.
- [ ] Test Chrome, Edge, Brave, Firefox, Safari, iOS Safari, Instagram WebView.
- [ ] Test keyboard, VoiceOver/NVDA, focus order, escape, drawer trapping.
- [ ] Test isolated populated cart: add/update/remove/rapid click/error recovery.
- [ ] Test checkout only with Shopify-supported test payment setup.
- [ ] Run link crawl, Lighthouse three-run medians, Theme Check, and console/network gate before release.

## Evidence notes

- Lighthouse cleanup emitted a Windows temp-directory permission warning after each run, but each JSON result was written successfully and parsed. The warning did not invalidate the captured LHR.
- HTTP crawl used bounded concurrency (5 pages, 6 link checks), 20-second timeout, HEAD with GET fallback for links, and the public sitemap as scope.
- Browser DOM probe used an isolated Chrome profile, 3.5-second settling time, narrow device metrics, and no form submission/cart/payment mutation.
- Official Shopify references used: [responsive performance](https://shopify.dev/docs/storefronts/themes/best-practices/performance/implement-responsive-design), [accessibility best practices](https://shopify.dev/docs/storefronts/themes/best-practices/accessibility), and [Shopify CLI](https://shopify.dev/docs/api/shopify-cli).

## Follow-up implementation (2026-09-24)

Audit actions 2-9 were implemented and validated on an isolated development theme. Collection/search mobile LCP, request count, accessibility, CSS duplication, and Theme Check findings were addressed. Action 1 (duplicate GoAffPro loader) was intentionally left unchanged. See `audit/GREY-EXIM-AFTER-FIXES-VALIDATION.md` for the three-run Lighthouse comparison, changed scope, evidence, and remaining physical Safari/Firefox release gate.

Broken-route cleanup was also completed in the local theme on 2026-09-24. The cart now links directly to `/policies/refund-policy`, which contains the full policy. The refund-policy section no longer rewrites the browser URL to the broken `/policies/return-and-refund-policy` alias, and the theme-level 404 redirect script was removed. The content-backed FAQ, Returns and Track Order alternate templates remain intact and continue to use `/pages/contact?view=faq`, `/pages/contact?view=returns` and `/pages/contact?view=track-order`. The unlinked legacy paths `/pages/faq`, `/pages/returns` and `/pages/track-order` remain intentionally absent rather than being recreated or redirected.
