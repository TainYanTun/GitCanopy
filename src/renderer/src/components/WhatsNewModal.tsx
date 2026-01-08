import React from "react";
import { Modal } from "antd";
import {
  RocketOutlined,
  SearchOutlined,
  HistoryOutlined,
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
              <div className="w-8 h-8 shrink-0 rounded bg-red-500/10 flex items-center justify-center text-red-500">
                <SafetyCertificateOutlined className="text-base" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-wider mb-1">
                  Visual Conflict Resolver
                </h3>
                <p className="text-xs text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                  Resolve merge conflicts without leaving the app. A new 3-pane
                  interface allows you to pick current, incoming, or both changes
                  with a single click.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 shrink-0 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                <HistoryOutlined className="text-base" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-wider mb-1">
                  Git Reflog Explorer
                </h3>
                <p className="text-xs text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                  The ultimate safety net. View every action taken in your repo
                  and perform a hard reset to any point in time to recover
                  lost work or undo mistakes.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 shrink-0 rounded bg-green-500/10 flex items-center justify-center text-green-500">
                <SearchOutlined className="text-base" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-wider mb-1">
                  Stash Diff Viewer
                </h3>
                <p className="text-xs text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                  Inspect exact code changes inside a stash before applying it.
                  Now supports previews for both tracked and untracked files
                  directly in the Objects Gallery.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 shrink-0 rounded bg-purple-500/10 flex items-center justify-center text-purple-500">
                <ThunderboltOutlined className="text-base" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-wider mb-1">
                  Security & Live Monitoring
                </h3>
                <p className="text-xs text-zed-muted dark:text-zed-dark-muted leading-relaxed">
                  Hardened path resolution prevents unauthorized file access,
                  while the updated watcher provides real-time status updates
                  for rebase and merge states.
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
