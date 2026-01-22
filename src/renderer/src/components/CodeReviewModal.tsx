import React from "react";
import { Modal } from "antd";
import {
  SafetyCertificateOutlined,
  BugOutlined,
  ThunderboltOutlined,
  FormatPainterOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import { CodeReviewResult } from "@shared/types";

interface CodeReviewModalProps {
  visible: boolean;
  onClose: () => void;
  result: CodeReviewResult | null;
  loading: boolean;
}

export const CodeReviewModal: React.FC<CodeReviewModalProps> = ({
  visible,
  onClose,
  result,
  loading,
}) => {
  const [loadingStep, setLoadingStep] = React.useState(0);

  React.useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }

    const steps = [
      "Parsing diff...",
      "Auditing security...",
      "Analyzing logic...",
      "Checking performance...",
      "Finalizing report...",
    ];

    const interval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [loading]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-500";
    if (score >= 70) return "text-amber-500";
    return "text-red-500";
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "security":
        return <SafetyCertificateOutlined />;
      case "bug":
        return <BugOutlined />;
      case "optimization":
        return <ThunderboltOutlined />;
      case "style":
        return <FormatPainterOutlined />;
      default:
        return <CheckCircleOutlined />;
    }
  };

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={650}
      centered
      classNames={{
        content:
          "p-0 overflow-hidden bg-zed-bg dark:bg-zed-dark-bg rounded-lg border border-zed-border dark:border-zed-dark-border shadow-2xl",
        mask: "backdrop-blur-sm bg-black/40",
      }}
      closeIcon={null}
    >
      {loading ? (
        <div className="h-80 flex flex-col items-center justify-center relative">
          <div className="w-12 h-12 border-[3px] border-zed-border dark:border-zed-dark-border border-t-zed-accent rounded-full animate-spin mb-8" />
          <div className="space-y-2 text-center z-10">
            <h3 className="text-sm font-mono uppercase tracking-widest text-zed-muted animate-pulse">
              AI Audit in Progress
            </h3>
            <p className="text-xs font-medium text-zed-text dark:text-zed-dark-text transition-all duration-300 min-h-[1.5em]">
              {
                [
                  "Parsing diff...",
                  "Auditing security...",
                  "Analyzing logic...",
                  "Checking performance...",
                  "Finalizing report...",
                ][loadingStep]
              }
            </p>
          </div>
        </div>
      ) : result ? (
        <div className="flex flex-col max-h-[85vh] text-zed-text dark:text-zed-dark-text font-sans">
          {/* Minimalist Header */}
          <div className="px-6 py-5 border-b border-zed-border dark:border-zed-dark-border flex items-start justify-between bg-white/50 dark:bg-white/[0.02]">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={`text-4xl font-mono font-bold tracking-tighter ${getScoreColor(result.score)}`}
                >
                  {result.score}
                </span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zed-muted opacity-60">
                    Quality Score
                  </span>
                  <span className="text-xs font-medium opacity-80">
                    {result.score >= 90
                      ? "Excellent"
                      : result.score >= 70
                        ? "Needs Review"
                        : "Critical Issues"}
                  </span>
                </div>
              </div>
              <div className="text-xs text-zed-muted leading-relaxed max-w-md prose dark:prose-invert prose-p:my-0 prose-strong:font-medium prose-strong:text-zed-text dark:prose-strong:text-zed-dark-text">
                <ReactMarkdown>{result.summary}</ReactMarkdown>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zed-muted hover:text-zed-text dark:hover:text-zed-dark-text transition-colors p-1"
            >
              <CloseOutlined />
            </button>
          </div>

          {/* Flat Issue List */}
          <div className="flex-1 overflow-y-auto bg-[#fafafa] dark:bg-[#111111]">
            {result.issues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 opacity-40">
                <CheckCircleOutlined className="text-3xl mb-3" />
                <span className="text-xs font-mono uppercase tracking-widest">
                  Clean Audit
                </span>
              </div>
            ) : (
              <div className="divide-y divide-zed-border/50 dark:divide-zed-dark-border/50">
                {result.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="group px-6 py-4 hover:bg-white dark:hover:bg-white/[0.03] transition-colors flex gap-4 items-start"
                  >
                    {/* Icon Column */}
                    <div
                      className={`mt-0.5 text-sm shrink-0 w-6 h-6 flex items-center justify-center rounded bg-opacity-10 dark:bg-opacity-20 ${
                        issue.type === "security"
                          ? "text-red-500 bg-red-500"
                          : issue.type === "bug"
                            ? "text-orange-500 bg-orange-500"
                            : "text-blue-500 bg-blue-500"
                      }`}
                    >
                      {getTypeIcon(issue.type)}
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zed-muted">
                          {issue.type}
                        </span>
                        {issue.severity === "high" && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            High Severity
                          </span>
                        )}
                        <span
                          className="text-[10px] font-mono text-zed-muted opacity-50 ml-auto truncate max-w-[200px]"
                          title={issue.file}
                        >
                          {issue.file}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed opacity-90 group-hover:opacity-100">
                        {issue.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Minimalist Footer */}
          <div className="px-6 py-3 border-t border-zed-border dark:border-zed-dark-border bg-white dark:bg-zed-dark-bg flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-zed-muted opacity-60">
              <WarningOutlined />
              <span>AI-generated report. Verify before committing.</span>
            </div>
            <button
              onClick={onClose}
              className="text-[10px] font-bold uppercase tracking-widest hover:text-zed-accent transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
