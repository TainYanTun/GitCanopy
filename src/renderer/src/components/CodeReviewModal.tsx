import React from "react";
import { Modal, Progress, Tag } from "antd";
import {
  SafetyCertificateOutlined,
  BugOutlined,
  ThunderboltOutlined,
  FormatPainterOutlined,
  CheckCircleOutlined,
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
  const getScoreColor = (score: number) => {
    if (score >= 90) return "#10b981"; // Emerald-500
    if (score >= 70) return "#f59e0b"; // Amber-500
    return "#ef4444"; // Red-500
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "red";
      case "medium": return "orange";
      case "low": return "blue";
      default: return "default";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "security": return <SafetyCertificateOutlined />;
      case "bug": return <BugOutlined />;
      case "optimization": return <ThunderboltOutlined />;
      case "style": return <FormatPainterOutlined />;
      default: return <CheckCircleOutlined />;
    }
  };

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      centered
      classNames={{
        content: "p-0 overflow-hidden bg-zed-bg dark:bg-zed-dark-bg rounded-lg border border-zed-border dark:border-zed-dark-border shadow-xl"
      }}
    >
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center p-8">
          <div className="w-16 h-16 border-4 border-zed-accent border-t-transparent rounded-full animate-spin mb-6" />
          <h3 className="text-lg font-bold animate-pulse text-zed-text dark:text-zed-dark-text">Analyzing Code Quality...</h3>
          <p className="text-zed-muted dark:text-zed-dark-muted text-sm mt-2">Gemini is reviewing your changes for bugs and security risks.</p>
        </div>
      ) : result ? (
        <div className="flex flex-col max-h-[85vh]">
          {/* Header with Score */}
          <div className="bg-[#fcfcfc] dark:bg-zed-dark-surface border-b border-zed-border dark:border-zed-dark-border p-6 flex items-center gap-8">
            <div className="flex flex-col items-center">
              <Progress
                type="circle"
                percent={result.score}
                strokeColor={getScoreColor(result.score)}
                format={(percent) => (
                  <div className="flex flex-col items-center mt-1">
                    <span className="text-2xl font-black text-zed-text dark:text-zed-dark-text">{percent}</span>
                    <span className="text-[10px] uppercase tracking-widest text-zed-muted">Score</span>
                  </div>
                )}
                width={80}
                strokeWidth={8}
              />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-zed-text dark:text-zed-dark-text mb-2">AI Code Review</h2>
              <div className="text-sm text-zed-muted dark:text-zed-dark-muted prose dark:prose-invert max-w-none leading-snug">
                <ReactMarkdown>{result.summary}</ReactMarkdown>
              </div>
            </div>
          </div>

          {/* Issues List */}
          <div className="flex-1 overflow-y-auto p-6 bg-zed-bg dark:bg-zed-dark-bg space-y-4">
            {result.issues.length === 0 ? (
              <div className="text-center py-12 opacity-50">
                <CheckCircleOutlined className="text-4xl text-green-500 mb-4" />
                <p className="text-lg font-bold">No issues found!</p>
                <p className="text-sm">Great job, your code looks clean.</p>
              </div>
            ) : (
              result.issues.map((issue, idx) => (
                <div key={idx} className="bg-white dark:bg-zed-dark-element/30 border border-zed-border dark:border-zed-dark-border rounded-lg p-4 flex gap-4 hover:shadow-sm transition-shadow">
                  <div className={`mt-1 text-lg ${
                    issue.type === 'security' ? 'text-red-500' : 
                    issue.type === 'bug' ? 'text-orange-500' : 'text-blue-500'
                  }`}>
                    {getTypeIcon(issue.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-sm text-zed-text dark:text-zed-dark-text capitalize">
                        {issue.type} Issue
                      </h4>
                      <Tag color={getSeverityColor(issue.severity)} className="uppercase text-[9px] font-bold m-0">
                        {issue.severity}
                      </Tag>
                    </div>
                    <p className="text-xs font-mono text-zed-muted dark:text-zed-dark-muted mb-2 bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded inline-block">
                      {issue.file}
                    </p>
                    <p className="text-sm text-zed-text dark:text-zed-dark-text leading-relaxed">
                      {issue.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="p-4 border-t border-zed-border dark:border-zed-dark-border bg-[#fcfcfc] dark:bg-zed-dark-surface flex justify-end">
            <button 
              onClick={onClose}
              className="px-6 py-2 bg-zed-text dark:bg-white text-zed-bg dark:text-black font-bold uppercase text-[10px] tracking-widest rounded hover:opacity-90 transition-opacity"
            >
              Close Report
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
