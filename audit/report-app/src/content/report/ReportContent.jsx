import React from "react";

import {
  ReportSection,
  RichNarrative,
  useDataApp,
} from "../../data-app-public.jsx";
import auditMarkdown from "./audit.md?raw";

const formatSeconds = (milliseconds) => `${(Number(milliseconds || 0) / 1000).toFixed(1)} s`;
const formatMegabytes = (bytes) => `${(Number(bytes || 0) / 1024 / 1024).toFixed(2)} MB`;

function Kpi({ label, value, detail, tone = "neutral" }) {
  return (
    <div className={`audit-kpi audit-kpi--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function LighthouseTable({ rows }) {
  return (
    <div className="audit-table-wrap" tabIndex="0" aria-label="Scrollable Lighthouse results table">
      <table className="audit-table">
        <thead>
          <tr>
            <th>Page / profile</th>
            <th>Performance</th>
            <th>Accessibility</th>
            <th>LCP</th>
            <th>TBT</th>
            <th>Requests</th>
            <th>Transfer</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.page}>
              <td>{row.page}</td>
              <td><span className={`score score--${row.performance < 70 ? "poor" : row.performance < 90 ? "warn" : "good"}`}>{row.performance}</span></td>
              <td>{row.accessibility}</td>
              <td>{formatSeconds(row.lcpMs)}</td>
              <td>{Math.round(row.tbtMs)} ms</td>
              <td>{row.requests}</td>
              <td>{formatMegabytes(row.transferBytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BugTable({ rows }) {
  return (
    <div className="audit-table-wrap" tabIndex="0" aria-label="Scrollable master bug database">
      <table className="audit-table audit-table--bugs">
        <thead>
          <tr>
            <th>ID</th>
            <th>Priority / confidence</th>
            <th>What</th>
            <th>Where</th>
            <th>Why</th>
            <th>How</th>
            <th>Expected result</th>
            <th>How to verify</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><strong>{row.id}</strong></td>
              <td>{row.severity}</td>
              <td>{row.what}</td>
              <td>{row.where}</td>
              <td>{row.why}</td>
              <td>{row.how}</td>
              <td>{row.expectedResult}</td>
              <td>{row.verify}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportContent() {
  const { snapshot, canEdit, mode, appTitle, setAppTitle } = useDataApp();
  const queries = snapshot?.queries || {};
  const lighthouse = queries.lighthouse_runs?.rows || [];
  const crawl = queries.crawl_summary?.rows?.[0] || {};
  const bugs = queries.bug_database?.rows || [];
  const collection = lighthouse.find((row) => row.page === "collection-mobile");
  const search = lighthouse.find((row) => row.page === "search-mobile");
  const product = lighthouse.find((row) => row.page === "product-mobile");

  return (
    <article className="report-content" aria-label="Grey Exim website audit report">
      <header className="report-hero">
        <p className="report-eyebrow">Production storefront · read-only audit · 23 September 2026</p>
        <h1
          data-data-app-title
          contentEditable={canEdit && mode === "edit"}
          suppressContentEditableWarning
          onBlur={canEdit && mode === "edit" ? (event) => setAppTitle(event.currentTarget.textContent.trim() || appTitle) : undefined}
        >{appTitle}</h1>
        <p className="report-deck">
          Evidence-backed QA, performance, UX, SEO, accessibility, and Shopify theme audit across 91 URLs,
          7 Lighthouse profiles, 19 responsive probes, and 442 local theme files. No orders, payments, store data,
          or live-theme code were changed.
        </p>
        <div className="report-badges" aria-label="Audit methods">
          <span>Production crawl</span><span>Lighthouse</span><span>DOM probes</span><span>Theme Check</span><span>Static analysis</span>
        </div>
      </header>

      <section className="audit-kpis" aria-label="Audit summary metrics">
        <Kpi label="URLs audited" value={crawl.auditedPages ?? "91"} detail="Sitemaps plus priority routes" />
        <Kpi label="Confirmed 404 routes" value={crawl.non200Pages ?? "3"} detail="Plus one broken policy target" tone="danger" />
        <Kpi label="Collection mobile LCP" value={formatSeconds(collection?.lcpMs)} detail={`Performance ${collection?.performance ?? 60}/100`} tone="danger" />
        <Kpi label="Search mobile LCP" value={formatSeconds(search?.lcpMs)} detail={`Performance ${search?.performance ?? 60}/100`} tone="danger" />
        <Kpi label="Product mobile LCP" value={formatSeconds(product?.lcpMs)} detail={`Performance ${product?.performance ?? 90}/100`} tone="warn" />
        <Kpi label="Master findings" value={bugs.length || 35} detail="Confirmed, likely, potential, and not verified" />
      </section>

      <ReportSection
        id="audit-lighthouse"
        title="Measured Lighthouse results"
        queryId="lighthouse_runs"
        sourceRows={lighthouse}
        className="audit-evidence-section"
      >
        <p className="section-intro">Single-run lab measurements; use three-run medians after fixes. TBT is not field INP.</p>
        <LighthouseTable rows={lighthouse} />
      </ReportSection>

      <ReportSection
        id="audit-master-report"
        title="Complete audit"
        queryId="crawl_summary"
        queryIds={["crawl_summary", "responsive_checks", "static_theme", "broken_links", "lighthouse_runs", "bug_database"]}
        sourceRowsByQuery={{
          crawl_summary: queries.crawl_summary?.rows || [],
          responsive_checks: queries.responsive_checks?.rows || [],
          static_theme: queries.static_theme?.rows || [],
          broken_links: queries.broken_links?.rows || [],
          lighthouse_runs: lighthouse,
          bug_database: bugs,
        }}
        showHeading={false}
        className="audit-narrative-section"
      >
        <RichNarrative id="audit:complete-report" value={auditMarkdown} label="Complete Grey Exim audit" />
      </ReportSection>

      <ReportSection
        id="audit-bug-database"
        title="Developer-ready bug database"
        queryId="bug_database"
        sourceRows={bugs}
        className="audit-evidence-section"
      >
        <p className="section-intro">Every row includes WHAT → WHERE → WHY → HOW → EXPECTED RESULT → HOW TO VERIFY.</p>
        <BugTable rows={bugs} />
      </ReportSection>

      <footer className="audit-footer">
        <strong>Scope note.</strong> Checkout was inspected only up to safe, reversible boundaries. Browser coverage used
        Chromium-family engines available in the environment; Safari and Firefox remain explicitly marked where unverified.
        Remote source submission was not authorized, so local Shopify Theme Check is reported instead of remote Liquid validation.
      </footer>
    </article>
  );
}
