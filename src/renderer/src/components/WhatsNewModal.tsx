import React from "react";
import { Modal } from "antd";
import {
  RocketOutlined,
  SelectOutlined,
  BranchesOutlined,
  BgColorsOutlined,
  ThunderboltOutlined,
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
              Feature Release
            </span>
          </div>

          <div className="space-y-6">
            {/* Feature 1 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 shrink-0 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                <SelectOutlined className="text-base" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-wider mb-1">
                  Marquee Selection
                </h3>
                <p className="text-xs text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                  Bulk operations are here. Switch to **Select Mode (V)** and
                  drag a marquee box over commits to copy hashes or prepare for
                  squashing.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 shrink-0 rounded bg-green-500/10 flex items-center justify-center text-green-500">
                <BranchesOutlined className="text-base" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-wider mb-1">
                  Origin Tracking & Noise Reduction
                </h3>
                <p className="text-xs text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                  The graph now displays inferred branch origins for every
                  commit. Branch lists are now grouped into **Primary** and
                  **Ancestors** to eliminate merged-branch clutter.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 shrink-0 rounded bg-red-500/10 flex items-center justify-center text-red-500">
                <ThunderboltOutlined className="text-base" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-wider mb-1">
                  Safe Force Push
                </h3>
                <p className="text-xs text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                  GitCanopy now offers a smart **Force Push** option when
                  history diverges. It uses safe leases and dynamic remote
                  detection to keep your work synchronized.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 shrink-0 rounded bg-zinc-500/10 flex items-center justify-center text-zinc-500">
                <BgColorsOutlined className="text-base" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-wider mb-1">
                  Hyper-Minimalist UI
                </h3>
                <p className="text-xs text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                  Refined glass-morphism, ultra-fine 0.5px borders, and
                  invisible scrollbars. Designed to stay out of your way.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-zed-border/30 dark:border-zed-dark-border/30 flex justify-between items-center">
            <span className="text-[10px] text-zed-muted italic font-mono opacity-50">
              High-velocity Git visualizer.
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
