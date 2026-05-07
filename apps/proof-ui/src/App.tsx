import { useEffect, useState } from "react";
import type { CaseStudy } from "./cases";
import { loadCaseStudies } from "./cases";

const repoUrl = import.meta.env.VITE_PUBLIC_REPO_URL || "https://github.com/PRADDZY/agents-assemble";
const marketplaceUrl = import.meta.env.VITE_MARKETPLACE_URL || "";
const agentMarketplaceUrl = import.meta.env.VITE_AGENT_MARKETPLACE_URL || "";
const mcpUrl = import.meta.env.VITE_MCP_URL || "https://referral-ready-mcp.dpratik3005.workers.dev/mcp";
const demoVideoUrl = import.meta.env.VITE_DEMO_VIDEO_URL || "";

type LaunchTone = "positive" | "pending" | "neutral";

function LaunchCard(props: { label: string; status: string; detail: string; href?: string; tone?: LaunchTone }) {
  return (
    <article className="launch-card">
      <div className="launch-head">
        <span>{props.label}</span>
        <strong className={`status-badge ${props.tone ?? "neutral"}`}>{props.status}</strong>
      </div>
      <p>{props.detail}</p>
      {props.href ? (
        <a className="inline-link" href={props.href} target="_blank" rel="noreferrer">
          Open surface
        </a>
      ) : (
        <span className="inline-note">Final link pending</span>
      )}
    </article>
  );
}

function SummaryRow(props: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  );
}

function formatOwners(caseStudy: CaseStudy) {
  const owners = Array.from(new Set(caseStudy.tasks.tasks.slice(0, 3).map((task) => task.owner)));
  return owners.join(", ");
}

function ReadinessCase({ caseStudy }: { caseStudy: CaseStudy }) {
  const presentEvidence = caseStudy.readiness.presentEvidence.slice(0, 3);
  const missingEvidence = caseStudy.readiness.missingEvidence.slice(0, 3);
  const packetSections = caseStudy.packet.sections.slice(0, 2).map((section) => section.title).join(", ");
  const prepChecklist = caseStudy.prep.checklist.slice(0, 2).join("; ");
  const owners = formatOwners(caseStudy);
  const taskCount = caseStudy.tasks.tasks.length;
  const facts = [
    { label: "Readiness score", value: `${caseStudy.readiness.readinessScore}/100` },
    { label: "Evidence found", value: `${caseStudy.readiness.presentEvidence.length}` },
    { label: "Blocking gaps", value: `${caseStudy.readiness.missingEvidence.length}` }
  ];

  return (
    <article className="case-card">
      <div className="case-head">
        <div className="case-title">
          <p className="eyebrow">{caseStudy.specialtyName}</p>
          <h3>{caseStudy.patientName}</h3>
        </div>
        <span className={`status-pill ${caseStudy.readiness.readyForReferral ? "ready" : "needs-work"}`}>
          {caseStudy.readiness.readyForReferral ? "Ready for referral" : "Needs closure work"}
        </span>
      </div>

      <p className="case-summary">{caseStudy.summary}</p>

      <dl className="case-facts" aria-label={`${caseStudy.patientName} case facts`}>
        {facts.map((fact) => (
          <div key={fact.label} className="fact-chip">
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="case-detail-grid">
        <section className="detail-card">
          <h4>Evidence present</h4>
          <ul className="compact-list">
            {presentEvidence.map((item) => (
              <li key={item.requirementId}>
                <strong>{item.label}</strong>
                <span>{item.citations.map((citation) => citation.label).join("; ")}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="detail-card">
          <h4>Missing before referral</h4>
          {missingEvidence.length > 0 ? (
            <ul className="compact-list">
              {missingEvidence.map((item) => (
                <li key={item.requirementId}>
                  <strong>{item.label}</strong>
                  <span>{item.suggestedAction}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">No blocking gaps detected for this referral path.</p>
          )}
        </section>

        <section className="detail-card">
          <h4>Output package</h4>
          <ul className="compact-list">
            <li>
              <strong>Referral packet</strong>
              <span>{packetSections}</span>
            </li>
            <li>
              <strong>Patient prep</strong>
              <span>{prepChecklist}</span>
            </li>
            <li>
              <strong>Tasks and FHIR export</strong>
              <span>
                {taskCount} follow-up tasks for {owners}; {caseStudy.exportBundle.artifactCounts.documentReferenceCount} DocumentReference,{" "}
                {caseStudy.exportBundle.artifactCounts.taskCount} Task resource
                {caseStudy.exportBundle.artifactCounts.taskCount === 1 ? "" : "s"}, {caseStudy.exportBundle.artifactCounts.provenanceCount} Provenance
              </span>
            </li>
          </ul>
        </section>
      </div>
    </article>
  );
}

export default function App() {
  const [cases, setCases] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const heroKicker = marketplaceUrl ? "Published Prompt Opinion MCP" : "Prompt Opinion-ready clinical MCP";
  const primaryAction = marketplaceUrl
    ? { href: marketplaceUrl, label: "Open Marketplace entry" }
    : { href: repoUrl, label: "View GitHub repo" };

  useEffect(() => {
    let mounted = true;
    loadCaseStudies()
      .then((items) => {
        if (mounted) {
          setCases(items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="hero-kicker">{heroKicker}</p>
          <h1>Referral Ready MCP</h1>
          <p className="hero-subtitle">
            Referral Ready turns Prompt Opinion FHIR context into specialist-ready referrals. It identifies missing workup,
            packages the handoff, prepares patient follow-up, and emits standards-native FHIR artifacts.
          </p>
          <p className="hero-note">
            Built for a narrow referral workflow where structured output matters more than generic healthcare chat.
          </p>

          <div className="hero-actions">
            <a className="action-link primary" href={primaryAction.href} target="_blank" rel="noreferrer">
              {primaryAction.label}
            </a>
            {marketplaceUrl ? null : <span className="action-link muted">Marketplace link pending publish</span>}
            {primaryAction.href === repoUrl ? null : (
              <a className="action-link" href={repoUrl} target="_blank" rel="noreferrer">
                GitHub repo
              </a>
            )}
            {agentMarketplaceUrl ? (
              <a className="action-link" href={agentMarketplaceUrl} target="_blank" rel="noreferrer">
                Coordinator agent
              </a>
            ) : null}
            {mcpUrl ? (
              <a className="action-link" href={mcpUrl} target="_blank" rel="noreferrer">
                MCP endpoint
              </a>
            ) : null}
            {demoVideoUrl ? (
              <a className="action-link" href={demoVideoUrl} target="_blank" rel="noreferrer">
                Demo video
              </a>
            ) : null}
          </div>
        </div>

        <aside className="summary-card" aria-label="Project summary">
          <p className="eyebrow">At a glance</p>
          <dl className="summary-list">
            <SummaryRow label="Contest lane" value="MCP Superpower" />
            <SummaryRow label="Demo data" value="Synthetic FHIR R4" />
            <SummaryRow label="Core outputs" value="Readiness table, packet, tasks, FHIR bundle" />
            <SummaryRow label="Specialty scope" value="Gastroenterology and cardiology" />
          </dl>

          <div className="hero-brief">
            <div>
              <span className="brief-label">Why this workflow</span>
              <p>Referrals fail when the chart handoff is incomplete, not because another summary was missing.</p>
            </div>
            <div>
              <span className="brief-label">What the MCP returns</span>
              <p>Evidence-backed readiness scoring, patient prep, follow-up tasks, and standards-native export artifacts.</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="section-block">
        <div className="section-head">
          <p className="eyebrow">Public Surface</p>
          <h2>Everything needed to verify the project</h2>
          <p className="section-intro">
            The live repo, worker, marketplace path, and demo slot stay visible without taking over the page.
          </p>
        </div>

        <div className="launch-grid">
          <LaunchCard
            label="GitHub Repo"
            status="Live"
            detail="Public source repo for setup, review, and verification."
            href={repoUrl}
            tone="positive"
          />
          <LaunchCard
            label="MCP Worker"
            status={mcpUrl ? "Live" : "Set URL"}
            detail="Public MCP endpoint used by Prompt Opinion and smoke tests."
            href={mcpUrl || undefined}
            tone={mcpUrl ? "positive" : "pending"}
          />
          <LaunchCard
            label="Marketplace Entry"
            status={marketplaceUrl ? "Published" : "Publish pending"}
            detail="Published MCP Marketplace listing used as the primary submission surface."
            href={marketplaceUrl || undefined}
            tone={marketplaceUrl ? "positive" : "pending"}
          />
          <LaunchCard
            label="Coordinator Agent"
            status={agentMarketplaceUrl ? "Published" : "Publish pending"}
            detail="Published BYO agent entry that exercises the MCP tools inside Prompt Opinion."
            href={agentMarketplaceUrl || undefined}
            tone={agentMarketplaceUrl ? "positive" : "pending"}
          />
          <LaunchCard
            label="Demo Video"
            status={demoVideoUrl ? "Attached" : "User-owned"}
            detail="Add the final public video after the in-platform path is stable."
            href={demoVideoUrl || undefined}
            tone={demoVideoUrl ? "neutral" : "pending"}
          />
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <p className="eyebrow">Rehearsal Cases</p>
          <h2>Two short synthetic referral cases</h2>
          <p className="section-intro">
            Both previews come from the same engine used by the MCP tools, shortened here for fast judge scanning.
          </p>
        </div>

        {loading ? (
          <div className="loading-panel">Loading synthetic referral cases...</div>
        ) : (
          <div className="case-stack">
            {cases.map((caseStudy) => (
              <ReadinessCase key={caseStudy.id} caseStudy={caseStudy} />
            ))}
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-head">
          <p className="eyebrow">Architecture</p>
          <h2>Thin worker, deterministic rules, selective generation</h2>
          <p className="section-intro">
            The UI stays light because the actual clinical workflow logic lives in the worker and referral engine.
          </p>
        </div>

        <div className="architecture-grid">
          <article className="arch-card">
            <h3>Prompt Opinion</h3>
            <p>Patient context, in-platform orchestration, and the final Marketplace path.</p>
          </article>
          <article className="arch-card">
            <h3>Cloudflare Worker</h3>
            <p>Stateless MCP endpoint that reads FHIR headers and returns structured outputs.</p>
          </article>
          <article className="arch-card">
            <h3>Referral Engine</h3>
            <p>Deterministic specialty playbooks for readiness scoring, missing-workup checks, and export shaping.</p>
          </article>
          <article className="arch-card">
            <h3>Google AI</h3>
            <p>Used only for narrative lift on packets, patient prep, and task phrasing when enabled.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
