# Grey Exim performance and accessibility follow-up

Date: 2026-09-24

Scope: audit actions 2-9 requested after `GREY-EXIM-COMPLETE-WEBSITE-AUDIT.md`. The duplicate GoAffPro loader (action 1) was deliberately not changed.

## Outcome

The collection and search pages now reach useful content much sooner in the mobile Lighthouse lab profile. Search also sends materially fewer requests after removing the unused facets path. Accessibility issues addressed in this pass now pass Lighthouse; the only remaining automated failure on sampled pages is a title-less third-party iframe.

The implementation is uploaded only to the isolated development theme `codex-perf-a11y-20260924` (theme ID `166922354846`). The live theme was not changed.

Preview: <https://yfaeik-kr.myshopify.com?preview_theme_id=166922354846>

## Three-run mobile Lighthouse medians

| Route | Baseline performance | After performance | Baseline LCP | After LCP | Baseline FCP | After FCP | Baseline requests | After requests | After accessibility |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Collection | 60 | 78 | 7,727 ms | 2,768 ms | 3,946 ms | 2,403 ms | 277 | 231 | 97 |
| Search | 60 | 86 | 7,146 ms | 2,498 ms | 3,269 ms | 1,383 ms | 297 | 233 | 97 |
| Product | 90 (older single run) | 77 | 3,179 ms | 3,539 ms | 2,294 ms | 1,288 ms | 248 | 195 | 97 |

Collection LCP improved by 64.2%, collection requests fell by 16.6%, search LCP improved by 65.0%, and search requests fell by 21.5%.

Product performance is marked neutral/inconclusive rather than regressed: a same-time three-run live-theme control had median performance 78 and median LCP 2,471 ms, while the preview median was performance 77 and LCP 3,539 ms. The route was highly variable, and this pass did not alter its image-loading path. The product LCP image was already correctly rendered with `loading="eager"` and `fetchpriority="high"`; no duplicate preload was added.

Per-run JSON evidence is in `audit/evidence/after-fixes/`.

## Implemented

1. Collection/search LCP
   - Search now uses a lightweight collection-style count/sort toolbar instead of rendering the full facets component.
   - Search no longer downloads `facets.js`, `component-facets.css`, or a duplicate copy of `component-search.css`.
   - Product indexing is independent of article/page results, so the first actual product consistently receives above-the-fold image priority.
   - Mobile Lighthouse screenshots confirm a stable two-column grid and aligned toolbar.

2. Above-the-fold product image priority
   - Verified the product hero and first product-card image paths.
   - The product hero already uses eager loading plus high fetch priority.
   - The first actual search product now always receives the same priority even when non-product results precede it.

3. JavaScript reduction
   - Removed the unused search facets runtime and its DOM replacement observer.
   - Deleted the now-unreferenced `facets.liquid` and `price-facet.liquid` snippets.
   - Third-party checkout, analytics, consent, and app code was not removed blindly. Lighthouse still attributes roughly 96-97 KB of unused JavaScript mainly to Shopify/app/analytics payloads; those require owner-level consent and attribution decisions.
   - GoAffPro was not touched, as requested.

4. Accessibility
   - Search sort has an effective accessible name.
   - Swatch and carousel-dot hit areas are 24 x 24 px while their visible dot size is preserved.
   - Product compare-at price contrast was strengthened.
   - Article images without alt text receive a caption/title fallback.
   - Imported article tables receive semantic column headers and cell/header associations.
   - The article back-link accessible name now matches its visible label.
   - Search, collection, product, and article sampled accessibility scores are 97. The remaining automated failure is a third-party iframe without a title.

5. CSS cleanup
   - Moved search layout rules out of inline section CSS into `component-search.css`.
   - Removed obsolete search facets/sort overrides and duplicate search stylesheet loading.

6. Theme Check
   - Added a repository Theme Check configuration that excludes documentation and audit artifacts from theme-source validation.
   - Fixed Liquid naming warnings and initialized the password-layout color-scheme accumulator.
   - Final result: 0 errors and 0 warnings.

## Browser and device verification

- Chrome/Lighthouse mobile emulation: completed.
- Edge desktop/mobile smoke screenshots: completed.
- Firefox physical device: not available in this environment; pending.
- macOS/iOS Safari physical device: not available on this Windows environment; pending.
- A physical-device pass must still cover iPhone Safari focus/zoom, VoiceOver, Firefox desktop, drawer keyboard trapping, and real touch targets before production release.

## Validation caveats

- Lighthouse values are lab results and vary because Shopify/app/third-party work changes between runs. Medians are used instead of selecting the best run.
- The Shopify remote validator was not run because the execution security gate rejected external transmission of theme-derived validation data. Local Shopify Theme Check completed successfully instead.
- The development-theme preview bar adds its own request/work and is not present on the published storefront.

## Release recommendation

The code is suitable for stakeholder review on the development theme. Before publishing, complete the physical Safari/Firefox matrix and a focused cart/search/collection smoke test. Keep the GoAffPro change as a separate explicitly approved task.
