import { useEffect, useState } from "react";
import type { CaseStudy } from "./cases";
import { loadCaseStudies } from "./cases";

const repoUrl = import.meta.env.VITE_PUBLIC_REPO_URL || "https://github.com/PRADDZY/agents-assemble";
const marketplaceUrl = import.meta.env.VITE_MARKETPLACE_URL || "";
const mcpUrl = import.meta.env.VITE_MCP_URL || "https://referral-ready-mcp.dpratik3005.workers.dev/mcp";
const demoVideoUrl = import.meta.env.VITE_DEMO_VIDEO_URL || "";

function LaunchCard(props: { label: string; status: string; detail: string; href?: string }) {
  return (
    <article className="launch-card">
      <div className="launch-head">
        <span>{props.label}</span>
        <strong>{props.status}</strong>
      </div>
      <p>{props.detail}</p>
      {props.href ? (
        <a href={props.href} target="_blank" rel="noreferrer">
          Open link
        </a>
      ) : null}
    </article>
  );
}

function MetricCard(props: { label: string; value: string; tone?: "warm" | "cool" }) {
  return (
    <div className={`metric-card ${props.tone ?? "cool"}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function ReadinessCase({ caseStudy }: { caseStudy: CaseStudy }) {
  return (
    <article className="case-card">
      <div className="case-head">
        <p className="eyebrow">{caseStudy.specialtyName}</p>
        <h3>{caseStudy.patientName}</h3>
        <span className={`status-pill ${caseStudy.readiness.readyForReferral ? "ready" : "needs-work"}`}>
          {caseStudy.readiness.readyForReferral ? "Referral-ready" : "Needs closure work"}
        </span>
      </div>

      <p className="case-summary">{caseStudy.summary}</p>

      <div className="case-grid">
        <section>
          <h4>Present evidence</h4>
          <ul>
            {caseStudy.readiness.presentEvidence.map((item) => (
              <li key={item.requirementId}>
                <strong>{item.label}</strong>
                <span>{item.citations.map((citation) => citation.label).join("; ")}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4>Open gaps</h4>
          <ul>
            {caseStudy.readiness.missingEvidence.map((item) => (
              <li key={item.requirementId}>
                <strong>{item.label}</strong>
                <span>{item.suggestedAction}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="packet-preview">
        <h4>Packet preview</h4>
        {caseStudy.packet.sections.slice(0, 2).map((section) => (
          <div key={section.title} className="packet-section">
            <strong>{section.title}</strong>
            <p>{section.body}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function App() {
  const [cases, setCases] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const heroKicker = marketplaceUrl ? "Published Prompt Opinion MCP" : "Prompt Opinion-ready MCP";

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
            A healthcare MCP superpower that reads patient context, spots missing workup, drafts specialist-ready packets,
            and prepares patient outreach without pretending that generic chat is clinical workflow.
          </p>

          <div className="hero-links">
            <a href={repoUrl} target="_blank" rel="noreferrer">
              GitHub Repo
            </a>
            {marketplaceUrl ? (
              <a href={marketplaceUrl} target="_blank" rel="noreferrer">
                Prompt Opinion Marketplace
              </a>
            ) : (
              <span>Marketplace link pending publish</span>
            )}
            {mcpUrl ? (
              <a href={mcpUrl} target="_blank" rel="noreferrer">
                MCP Endpoint
              </a>
            ) : null}
            {demoVideoUrl ? (
              <a href={demoVideoUrl} target="_blank" rel="noreferrer">
                Demo Video
              </a>
            ) : null}
          </div>
        </div>

        <div className="hero-metrics">
          <MetricCard label="Contest lane" value="MCP Superpower" tone="warm" />
          <MetricCard label="Demo data" value="Synthetic FHIR R4" />
          <MetricCard label="Core outputs" value="Table + Template + Tasks" />
          <MetricCard label="MVP specialties" value="GI + Cardiology" tone="warm" />
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <p className="eyebrow">Submission Surface</p>
          <h2>Public artifacts and publish path</h2>
        </div>

        <div className="launch-grid">
          <LaunchCard
            label="GitHub Repo"
            status="Live"
            detail="Public source repo for judges, setup, and verification."
            href={repoUrl}
          />
          <LaunchCard
            label="MCP Worker"
            status={mcpUrl ? "Live" : "Set URL"}
            detail="Public MCP endpoint used by Prompt Opinion and smoke tests."
            href={mcpUrl || undefined}
          />
          <LaunchCard
            label="Marketplace Entry"
            status={marketplaceUrl ? "Published" : "Publish pending"}
            detail="Attach the final Prompt Opinion share link here after Marketplace publish."
            href={marketplaceUrl || undefined}
          />
          <LaunchCard
            label="Demo Video"
            status={demoVideoUrl ? "Attached" : "User-owned"}
            detail="Video remains outside the repo flow and should be added after the in-platform run is stable."
            href={demoVideoUrl || undefined}
          />
        </div>
      </section>

      <section className="story-strip">
        <div>
          <span className="story-label">Why this angle</span>
          <p>
            Most hackathon healthcare agents stop at summarization. Referral Ready focuses on the real failure point:
            incomplete handoffs that waste specialist time, bounce patients, and hide missing workup until too late.
          </p>
        </div>
        <div>
          <span className="story-label">What the MCP adds</span>
          <p>
            Instead of another chat wrapper, the MCP returns concrete workflow artifacts: readiness scoring, evidence
            citations, referral packets, pre-visit prep, and follow-up tasks.
          </p>
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <p className="eyebrow">Rehearsal Cases</p>
          <h2>Same engine, demo-safe synthetic patients</h2>
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

      <section className="section-block architecture">
        <div className="section-head">
          <p className="eyebrow">Architecture</p>
          <h2>Thin worker, strong rules, optional narrative generation</h2>
        </div>

        <div className="architecture-grid">
          <div className="arch-card">
            <h3>Prompt Opinion</h3>
            <p>Patient context, agent orchestration, Marketplace publish path, and the in-platform judge demo.</p>
          </div>
          <div className="arch-card">
            <h3>Cloudflare Worker</h3>
            <p>Stateless MCP endpoint that reads FHIR headers, applies referral rules, and returns structured outputs.</p>
          </div>
          <div className="arch-card">
            <h3>Referral Engine</h3>
            <p>Deterministic specialty playbooks for readiness scoring, missing-workup detection, and red-flag surfacing.</p>
          </div>
          <div className="arch-card">
            <h3>Google AI</h3>
            <p>Used only for narrative lift on packet drafting, patient prep, and follow-up task phrasing.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

