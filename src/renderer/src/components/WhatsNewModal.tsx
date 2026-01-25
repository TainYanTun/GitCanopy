import React from "react";
import { Modal } from "antd";
import {
  RocketOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

interface WhatsNewModalProps {
  visible: boolean;
  onClose: () => void;
  version: string;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  visible,
  onClose,
  version,
}) => {
  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      width={550}
      classNames={{
        content:
          "p-0 overflow-hidden bg-zed-bg dark:bg-zed-dark-surface rounded-lg border border-zed-border dark:border-zed-dark-border shadow-2xl animate-in zoom-in-95 duration-300",
      }}
    >
      <div className="flex flex-col h-full">
        {/* Banner */}
        <div className="h-32 bg-zed-accent/5 dark:bg-zed-accent/10 border-b border-zed-border/50 dark:border-zed-dark-border/50 flex items-center justify-center relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
              backgroundSize: "16px 16px",
            }}
          />
          <RocketOutlined className="text-5xl text-zed-accent animate-pulse" />
        </div>

        <div className="p-8">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-xl font-black text-zed-text dark:text-zed-dark-text tracking-tight uppercase">
              What&apos;s New in {version}
            </h2>
            <span className="text-[10px] font-mono text-zed-muted opacity-50 uppercase tracking-widest bg-zed-element dark:bg-zed-dark-element px-2 py-0.5 rounded">
              Stable Release
            </span>
          </div>

          <div className="space-y-6">
            {/* Feature 1 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 shrink-0 rounded bg-purple-500/10 flex items-center justify-center text-purple-500">
                <RobotOutlined className="text-base" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-wider mb-1">
                  AI Command Center v2
                </h3>
                <p className="text-xs text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                  A redesigned, minimalist text interface for natural language
                  git operations. Now features a sleek &quot;Zinc&quot; glassmorphism
                  aesthetic.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 shrink-0 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                <ThunderboltOutlined className="text-base" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-wider mb-1">
                  Hybrid Execution Engine
                </h3>
                <p className="text-xs text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                  The best of both worlds: Direct zero-latency execution for
                  standard Git commands, and AI translation for complex natural
                  language intents.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 shrink-0 rounded bg-red-500/10 flex items-center justify-center text-red-500">
                <SafetyCertificateOutlined className="text-base" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-wider mb-1">
                  Enterprise-Grade Security
                </h3>
                <p className="text-xs text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                  Hardened execution pipeline with strict command whitelisting
                  and injection prevention to keep your workstation safe.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-zed-border/30 dark:border-zed-dark-border/30 flex justify-between items-center">
            <span className="text-[10px] text-zed-muted italic font-mono opacity-50">
              Thanks for building with GitCanopy.
            </span>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-zed-accent hover:opacity-90 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm transition-all shadow-lg active:scale-95"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
