import React, { useState, useEffect, useRef } from "react";
import { Modal } from "antd";
import {
  SafetyCertificateOutlined,
  CloseOutlined,
  CopyOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  GitlabOutlined,
  CaretRightOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import { SecurityAuditResult } from "@shared/types";
import { useToast } from "./ToastContext";

interface SecurityAuditModalProps {
  visible: boolean;
  onClose: () => void;
  result: SecurityAuditResult | null;
  loading: boolean;
}

// ── Severity config ────────────────────────────────────────────────────────────
const SEV = {
  critical: {
    border: "border-l-red-500",
    dot: "bg-red-500",
    text: "text-red-500 dark:text-red-400",
    chip: "text-red-500 dark:text-red-400 bg-red-500/8 border-red-500/20 hover:bg-red-500/15",
    chipActive: "bg-red-500 text-white border-red-500",
  },
  high: {
    border: "border-l-orange-400",
    dot: "bg-orange-400",
    text: "text-orange-400",
    chip: "text-orange-400 bg-orange-400/8 border-orange-400/20 hover:bg-orange-400/15",
    chipActive: "bg-orange-400 text-white border-orange-400",
  },
  medium: {
    border: "border-l-yellow-400",
    dot: "bg-yellow-400",
    text: "text-yellow-500 dark:text-yellow-400",
    chip: "text-yellow-500 dark:text-yellow-400 bg-yellow-400/8 border-yellow-400/20 hover:bg-yellow-400/15",
    chipActive: "bg-yellow-400 text-white border-yellow-400",
  },
  low: {
    border: "border-l-blue-400",
    dot: "bg-blue-400",
    text: "text-blue-400",
    chip: "text-blue-400 bg-blue-400/8 border-blue-400/20 hover:bg-blue-400/15",
    chipActive: "bg-blue-400 text-white border-blue-400",
  },
} as const;

type Severity = keyof typeof SEV;

const getSev = (s: string) =>
  SEV[(s as Severity) in SEV ? (s as Severity) : "low"];

const LOADING_STEPS = [
  "Scanning hardcoded secrets...",
  "Checking SQL injection vectors...",
  "Detecting XSS surfaces...",
  "Auditing dependency chain...",
  "Validating compliance (GDPR / HIPAA)...",
  "Generating report...",
];

const TYPE_ICON: Record<string, React.ReactNode> = {
  secret: <LockOutlined />,
  vulnerability: <ExclamationCircleOutlined />,
  compliance: <GlobalOutlined />,
  default: <SafetyCertificateOutlined />,
};

// ── Main component ─────────────────────────────────────────────────────────────
export const SecurityAuditModal: React.FC<SecurityAuditModalProps> = ({
  visible,
  onClose,
  result,
  loading,
}) => {
  const [loadingStep, setLoadingStep] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Severity | "all">("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setActiveFilter("all");
      setExpandedIds(new Set());
      setAllExpanded(false);
      setMounted(false);
      // Stagger mount for entrance animation
      const t = setTimeout(() => setMounted(true), 50);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // Loading step ticker
  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep((prev) =>
        prev < LOADING_STEPS.length - 1 ? prev + 1 : prev,
      );
    }, 900);
    return () => clearInterval(interval);
  }, [loading]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const findings = result?.findings ?? [];

  const severityCounts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});

  const presentSeverities = (
    ["critical", "high", "medium", "low"] as Severity[]
  ).filter((s) => severityCounts[s]);

  const filteredFindings =
    activeFilter === "all"
      ? findings
      : findings.filter((f) => f.severity === activeFilter);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const toggleExpand = (i: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(filteredFindings.map((_, i) => i)));
    }
    setAllExpanded((v) => !v);
  };

  const handleCopyReport = async () => {
    if (!result) return;
    const text = [
      "# Security Audit Report",
      `Status: ${result.isSafe ? "SAFE" : "RISKS DETECTED"}`,
      "",
      "## Summary",
      result.summary,
      "",
      `## Findings (${findings.length})`,
      ...findings.map(
        (f) =>
          `\n### [${f.severity.toUpperCase()}] ${f.message}\nType: ${f.type}\nFile: ${f.file}\nRemediation: ${f.remediation}`,
      ),
    ].join("\n");

    try {
      await window.gitcanopyAPI.copyToClipboard(text);
      setIsCopied(true);
      showToast("Report copied", "success", 2000);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showToast("Failed to copy", "error");
    }
  };

  const handleCreateIssue = async () => {
    if (!result || !findings.length) return;
    setIsCreatingIssue(true);
    try {
      const title = `Security Audit: ${findings.length} Issue${findings.length !== 1 ? "s" : ""} Detected`;
      const description = [
        "# Automated Security Audit Report",
        "",
        `**Summary:** ${result.summary}`,
        "",
        "## Findings",
        "",
        ...findings.map(
          (f) =>
            `### ${f.message}\n- **Type:** ${f.type}\n- **Severity:** ${f.severity}\n- **File:** \`${f.file}\`\n- **Remediation:** ${f.remediation}\n\n\`\`\`javascript\n${f.snippet ?? "// No snippet"}\n\`\`\``,
        ),
        "",
        "---",
        "*Generated by GitCanopy Guardian Agent*",
      ].join("\n");

      const { webUrl } = await window.gitcanopyAPI.createGitLabIssue(
        title,
        description,
      );
      showToast("GitLab issue created", "success");
      window.gitcanopyAPI.openExternal(webUrl);
    } catch (err: any) {
      showToast(err.message || "Failed to create issue", "error");
    } finally {
      setIsCreatingIssue(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={640}
      centered
      classNames={{
        content:
          "!p-0 overflow-hidden !bg-white dark:!bg-[#181a1f] !rounded-lg !border !border-zed-border dark:!border-zed-dark-border !shadow-2xl",
        mask: "backdrop-blur-sm bg-black/40",
      }}
      closeIcon={null}
    >
      {/* ══ LOADING ══════════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-5 px-8">
          {/* Thin ring spinner */}
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 rounded-full border border-zed-border dark:border-zed-dark-border" />
            <div className="absolute inset-0 rounded-full border-t border-zed-accent dark:border-zed-dark-accent animate-spin" />
          </div>

          <div className="text-center space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zed-muted dark:text-zed-dark-muted">
              Security Guard
            </p>
            <p
              key={loadingStep}
              className="text-[12px] text-zed-text dark:text-zed-dark-text tabular-nums transition-all"
              style={{ animation: "fadeSlideIn 0.3s ease" }}
            >
              {LOADING_STEPS[loadingStep]}
            </p>

            {/* Progress bar */}
            <div className="w-40 h-px bg-zed-border dark:bg-zed-dark-border rounded-full overflow-hidden mx-auto mt-1">
              <div
                className="h-full bg-zed-accent dark:bg-zed-dark-accent rounded-full transition-all duration-700"
                style={{
                  width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : result ? (
        /* ══ RESULT ════════════════════════════════════════════════════════ */
        <div
          className="flex flex-col max-h-[88vh]"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "none" : "translateY(4px)",
            transition: "opacity 0.2s ease, transform 0.2s ease",
          }}
        >
          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className="px-5 py-4 flex items-center justify-between border-b border-zed-border dark:border-zed-dark-border">
            <div className="flex items-center gap-3 min-w-0">
              {/* Pulsing status dot */}
              <span className="relative flex h-2 w-2 shrink-0">
                {!result.isSafe && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${result.isSafe ? "bg-emerald-500" : "bg-red-500"}`}
                />
              </span>

              <div className="min-w-0">
                <h2 className="text-[13px] font-semibold text-zed-text dark:text-zed-dark-text leading-none">
                  {result.isSafe ? "No risks detected" : "Security risks found"}
                </h2>
                <p className="text-[11px] text-zed-muted dark:text-zed-dark-muted mt-0.5">
                  {findings.length === 0
                    ? "All staged changes passed"
                    : `${findings.length} finding${findings.length !== 1 ? "s" : ""} · staged changes`}
                </p>
              </div>
            </div>

            {/* Severity summary pills (header-right) */}
            {findings.length > 0 && (
              <div className="flex items-center gap-1.5 mr-3">
                {presentSeverities.map((s) => (
                  <span
                    key={s}
                    className={`text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded ${getSev(s).text} bg-current/10`}
                    style={{ background: "transparent" }}
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${getSev(s).dot}`}
                      style={{ display: "inline-block", verticalAlign: "middle", marginBottom: 1 }}
                    />
                    {severityCounts[s]}
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1 rounded text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-zed-dark-text hover:bg-zed-element dark:hover:bg-zed-dark-element transition-colors"
            >
              <CloseOutlined className="text-[11px]" />
            </button>
          </div>

          {/* ── Summary strip ─────────────────────────────────────────────── */}
          {result.summary && (
            <div className="px-5 py-2.5 border-b border-zed-border dark:border-zed-dark-border bg-zed-surface dark:bg-zed-dark-surface">
              <div className="text-[11px] text-zed-muted dark:text-zed-dark-muted leading-relaxed [&_p]:m-0 [&_strong]:font-semibold [&_strong]:text-zed-text dark:[&_strong]:text-zed-dark-text">
                <ReactMarkdown>{result.summary}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* ── Filter bar ────────────────────────────────────────────────── */}
          {findings.length > 0 && (
            <div className="px-5 py-2 border-b border-zed-border dark:border-zed-dark-border flex items-center gap-2">
              {/* All chip */}
              <button
                onClick={() => setActiveFilter("all")}
                className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border transition-all ${
                  activeFilter === "all"
                    ? "bg-zed-text dark:bg-zed-dark-text text-white dark:text-zed-dark-bg border-transparent"
                    : "text-zed-muted dark:text-zed-dark-muted border-zed-border dark:border-zed-dark-border hover:text-zed-text dark:hover:text-zed-dark-text"
                }`}
              >
                All ({findings.length})
              </button>

              {/* Per-severity chips */}
              {presentSeverities.map((s) => {
                const cfg = getSev(s);
                const isActive = activeFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setActiveFilter(isActive ? "all" : s)}
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border transition-all ${
                      isActive ? cfg.chipActive : cfg.chip
                    }`}
                  >
                    {s} ({severityCounts[s]})
                  </button>
                );
              })}

              {/* Spacer + expand-all toggle */}
              <button
                onClick={toggleAll}
                className="ml-auto text-[9px] font-medium text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-zed-dark-text transition-colors"
              >
                {allExpanded ? "Collapse all" : "Expand all"}
              </button>
            </div>
          )}

          {/* ── Findings list ─────────────────────────────────────────────── */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto divide-y divide-zed-border/40 dark:divide-zed-dark-border/40"
          >
            {filteredFindings.length === 0 && findings.length === 0 ? (
              /* All clear */
              <div className="py-16 flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400/30" />
                  <CheckCircleOutlined className="relative text-3xl text-emerald-500" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[12px] font-semibold text-zed-text dark:text-zed-dark-text">
                    Clean
                  </p>
                  <p className="text-[10px] text-zed-muted dark:text-zed-dark-muted">
                    No vulnerabilities found in staged changes
                  </p>
                </div>
              </div>
            ) : filteredFindings.length === 0 ? (
              /* Filter returned nothing */
              <div className="py-12 flex flex-col items-center justify-center gap-2 opacity-50">
                <p className="text-[11px] text-zed-muted dark:text-zed-dark-muted">
                  No {activeFilter} findings
                </p>
              </div>
            ) : (
              filteredFindings.map((f, i) => {
                const sev = getSev(f.severity);
                const isOpen = expandedIds.has(i);
                const hasDetails = !!(f.snippet || f.remediation);

                return (
                  <div
                    key={i}
                    className={`border-l-2 ${sev.border} transition-colors hover:bg-zed-surface dark:hover:bg-zed-dark-surface`}
                    style={{
                      animation: `fadeSlideIn 0.2s ease ${i * 40}ms both`,
                    }}
                  >
                    {/* ── Collapsed row (always visible) ── */}
                    <button
                      className="w-full px-4 py-3 flex items-start gap-3 text-left"
                      onClick={() => hasDetails && toggleExpand(i)}
                      style={{ cursor: hasDetails ? "pointer" : "default" }}
                    >
                      {/* Expand caret */}
                      <CaretRightOutlined
                        className={`text-[9px] mt-[3px] shrink-0 text-zed-muted dark:text-zed-dark-muted transition-transform duration-150 ${
                          isOpen ? "rotate-90" : ""
                        } ${!hasDetails ? "opacity-0" : ""}`}
                      />

                      <div className="flex-1 min-w-0">
                        {/* Meta row */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-zed-muted dark:text-zed-dark-muted">
                            {TYPE_ICON[f.type] ?? TYPE_ICON.default}
                            <span className="ml-1">{f.type}</span>
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase ${sev.text}`}
                          >
                            {f.severity}
                          </span>
                          <span
                            className="ml-auto text-[9px] font-mono text-zed-muted dark:text-zed-dark-muted opacity-50 truncate max-w-[180px]"
                            title={f.file}
                          >
                            {f.file}
                          </span>
                        </div>

                        {/* Message — clamped when collapsed, full when expanded */}
                        <div className="relative">
                          <p
                            className={`text-[12px] font-medium text-zed-text dark:text-zed-dark-text leading-snug transition-all ${
                              !isOpen && hasDetails
                                ? "line-clamp-2"
                                : ""
                            }`}
                          >
                            {f.message}
                          </p>
                          {/* Fade + expand hint when clamped */}
                          {!isOpen && hasDetails && (
                            <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-white dark:from-[#181a1f] to-transparent pointer-events-none" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* ── Expanded details ── */}
                    {hasDetails && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateRows: isOpen ? "1fr" : "0fr",
                          transition: "grid-template-rows 0.18s ease",
                        }}
                      >
                        <div className="overflow-hidden">
                          <div className="px-4 pb-3 ml-5 space-y-2.5">
                            {/* Full message (visible only when expanded, only if it was clamped) */}
                            {hasDetails && (
                              <p className="text-[12px] font-medium text-zed-text dark:text-zed-dark-text leading-relaxed">
                                {f.message}
                              </p>
                            )}

                            {/* Snippet */}
                            {f.snippet && (
                              <div className="rounded bg-zed-element dark:bg-black/40 border border-zed-border dark:border-zed-dark-border px-3 py-2 overflow-x-auto">
                                <code className="text-[10px] font-mono text-red-500 dark:text-red-400 whitespace-pre">
                                  {f.snippet}
                                </code>
                              </div>
                            )}

                            {/* Remediation */}
                            {f.remediation && (
                              <div className="rounded bg-zed-surface dark:bg-zed-dark-surface border border-zed-border dark:border-zed-dark-border px-3 py-2.5 flex items-start gap-2.5">
                                <CheckCircleOutlined className="text-[10px] mt-[3px] shrink-0 text-emerald-500 dark:text-emerald-400" />
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                                    Remediation
                                  </p>
                                  <p className="text-[11px] text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                                    {f.remediation}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div className="px-5 py-2.5 border-t border-zed-border dark:border-zed-dark-border flex items-center justify-between">
            <span className="text-[9px] text-zed-muted dark:text-zed-dark-muted opacity-40 select-none">
              Security Guard · Gemini
            </span>

            <div className="flex items-center gap-3">
              {findings.length > 0 && (
                <button
                  onClick={handleCreateIssue}
                  disabled={isCreatingIssue}
                  className="flex items-center gap-1.5 text-[10px] font-medium text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-zed-dark-text transition-colors disabled:opacity-40"
                >
                  {isCreatingIssue ? (
                    <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <GitlabOutlined />
                  )}
                  {isCreatingIssue ? "Creating..." : "Create issue"}
                </button>
              )}

              <button
                onClick={handleCopyReport}
                className={`flex items-center gap-1.5 text-[10px] font-medium transition-colors ${
                  isCopied
                    ? "text-emerald-500"
                    : "text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-zed-dark-text"
                }`}
              >
                {isCopied ? <CheckOutlined /> : <CopyOutlined />}
                {isCopied ? "Copied" : "Copy"}
              </button>

              <button
                onClick={onClose}
                className="text-[10px] font-medium px-3 py-1 rounded bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text hover:bg-zed-border dark:hover:bg-zed-dark-border transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
