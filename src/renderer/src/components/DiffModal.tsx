import React, { useMemo, useEffect, useState } from "react";
import { Modal, Switch } from "antd";
import {
  CopyOutlined,
  FileTextOutlined,
  CheckOutlined,
  PicCenterOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import { List } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";

interface DiffLine {
  lineNumber: number | null;
  type: "addition" | "deletion" | "context" | "info" | "hunk" | "empty";
  content: string;
}

interface SideBySideRow {
  left: DiffLine | null;
  right: DiffLine | null;
  unified?: DiffLine;
  type: "split" | "unified";
  key: number;
}

interface DiffRowProps {
  items: SideBySideRow[];
  splitView: boolean;
}

const Cell = ({ line, isSplit }: { line: DiffLine; isSplit: boolean }) => {
  const isAddition = line.type === "addition";
  const isDeletion = line.type === "deletion";
  const isHunk = line.type === "hunk";
  const isInfo = line.type === "info";
  const isEmpty = line.type === "empty";

  return (
    <div
      className={`flex min-w-0 border-r border-zed-border/5 dark:border-zed-dark-border/5 ${
        isSplit ? 'flex-1' : 'w-full'
      } ${
        isAddition
          ? "bg-green-500/10 dark:bg-green-900/20"
          : isDeletion
            ? "bg-red-500/10 dark:bg-red-900/20"
            : isHunk
              ? "bg-zed-accent/5 dark:bg-zed-accent/10 text-zed-accent/80 font-bold border-y border-zed-accent/10"
              : isInfo
                ? "bg-zed-element/30 dark:bg-zed-dark-element/30 text-zed-muted italic opacity-60"
                : isEmpty
                  ? "diff-empty-pattern opacity-40"
                  : "hover:bg-zed-element/40 dark:hover:bg-zed-dark-element/40"
      }`}
    >
      {/* Gutter */}
      <div className="flex-shrink-0 w-12 text-right pr-3 text-[10px] font-mono py-1 select-none bg-zed-surface/50 dark:bg-black/20 text-zed-muted/40 border-r border-zed-border/5 dark:border-zed-dark-border/5">
        {line.lineNumber || ""}
      </div>

      {/* Indicator */}
      <div className={`flex-shrink-0 w-6 flex items-center justify-center font-mono text-[11px] select-none ${
        isAddition ? "text-green-500" : isDeletion ? "text-red-500" : "text-zed-muted/20"
      }`}>
        {isAddition ? "+" : isDeletion ? "-" : isHunk ? "§" : ""}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-x-auto custom-scrollbar-h">
        <pre
          className={`px-3 whitespace-pre font-mono text-[12px] leading-6 ${
            isAddition
              ? "text-green-700 dark:text-green-300"
              : isDeletion
                ? "text-red-700 dark:text-red-300"
                : isHunk
                  ? "text-zed-accent opacity-80"
                  : "text-zed-text dark:text-zed-dark-text opacity-90"
          }`}
          dangerouslySetInnerHTML={{ __html: line.content }}
        />
      </div>
    </div>
  );
};

const Row = ({
  index,
  style,
  items,
}: {
  index: number;
  style: React.CSSProperties;
} & DiffRowProps): React.ReactElement => {
  const row = items[index];
  if (!row) return <div style={style} />;

  if (row.type === "split") {
    return (
      <div style={style} className="flex border-b border-transparent">
        <Cell line={row.left!} isSplit={true} />
        <Cell line={row.right!} isSplit={true} />
      </div>
    );
  }

  return (
    <div style={style} className="flex border-b border-transparent">
      <Cell line={row.unified!} isSplit={false} />
    </div>
  );
};

interface DiffModalProps {
  repoPath: string;
  diffContent: string;
  filePath: string;
  onClose: () => void;
  visible: boolean;
}

export const DiffModal: React.FC<DiffModalProps> = ({
  repoPath,
  diffContent,
  filePath,
  onClose,
  visible,
}) => {
  const [rows, setRows] = React.useState<SideBySideRow[]>([]);
  const [parsing, setParsing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [splitView, setSplitView] = useState(true);
  const [imageDataUrl, setImageDataUrl] = React.useState<string | null>(null);

  const isBinary = diffContent === "BINARY_FILE";

  const fileStatus = useMemo(() => {
    if (!diffContent) return null;
    if (diffContent.includes("new file mode")) return "Added";
    if (diffContent.includes("deleted file mode")) return "Deleted";
    return "Modified";
  }, [diffContent]);

  useEffect(() => {
    if (
      visible &&
      !isBinary &&
      diffContent &&
      diffContent !== "Loading diff..."
    ) {
      setParsing(true);
      const worker = new Worker(
        new URL("../utils/diff.worker.ts", import.meta.url),
        {
          type: "module",
        },
      );

      worker.onmessage = (e) => {
        if (e.data.type === "SUCCESS") {
          setRows(e.data.result);
        }
        setParsing(false);
        worker.terminate();
      };

      worker.onerror = () => {
        setParsing(false);
        worker.terminate();
      };

      worker.postMessage({ diffContent, splitView, fileName: filePath });
      return () => worker.terminate();
    } else {
      setRows([]);
      if (diffContent !== "Loading diff...") {
        setParsing(false);
      } else {
        setParsing(true);
      }
    }
  }, [visible, diffContent, isBinary, splitView, filePath]);

  const isImage = useMemo(() => {
    const ext = filePath.split(".").pop()?.toLowerCase();
    return ["png", "jpg", "jpeg", "gif", "svg", "ico", "icns"].includes(
      ext || "",
    );
  }, [filePath]);

  useEffect(() => {
    if (visible && isBinary && isImage) {
      window.gitcanopyAPI
        .getFileDataUrl(repoPath, filePath)
        .then((url) => {
          setImageDataUrl(url);
        })
        .catch(() => {
          // Ignore errors if image data URL cannot be fetched
        });
    } else {
      setImageDataUrl(null);
    }
  }, [visible, isBinary, isImage, repoPath, filePath]);

  const handleCopyDiff = () => {
    if (isBinary) return;
    window.gitcanopyAPI.copyToClipboard(diffContent);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <Modal
      title={null}
      footer={null}
      open={visible}
      onCancel={onClose}
      width="90%"
      style={{ top: 20 }}
      centered={false}
      closable={false}
      classNames={{
        content:
          "p-0 overflow-hidden bg-zed-surface dark:bg-zed-dark-surface rounded-lg border border-zed-border dark:border-zed-dark-border shadow-2xl",
        mask: "bg-black/60 backdrop-blur-sm",
      }}
      styles={{
        body: { height: "85vh", padding: "0" },
      }}
    >
      <div className="flex flex-col h-full bg-zed-surface dark:bg-zed-dark-surface text-zed-text dark:text-zed-dark-text">
        {/* Modern Header */}
        <div className="flex items-center justify-between py-3 px-6 border-b border-zed-border dark:border-zed-dark-border bg-zed-element/20 dark:bg-zed-dark-element/20 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-zed-accent/10 dark:bg-zed-accent/20 rounded-md">
              <FileTextOutlined className="text-zed-accent text-lg" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-zed-text dark:text-zed-dark-text tracking-tight truncate max-w-xl">
                  {filePath}
                </span>
                {fileStatus && (
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${
                    fileStatus === 'Added' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                    fileStatus === 'Deleted' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                    'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  }`}>
                    {fileStatus}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zed-muted dark:text-zed-dark-muted uppercase tracking-widest font-bold opacity-60">
                {splitView ? "Side-by-Side Diff" : "Unified Diff View"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-2 px-3 py-1 bg-zed-element/30 dark:bg-zed-dark-element/30 rounded-lg border border-zed-border/50 dark:border-zed-dark-border/50">
              <span
                className={`text-[10px] font-bold uppercase tracking-tighter transition-opacity ${!splitView ? "text-zed-accent" : "text-zed-muted opacity-40"}`}
              >
                <MenuOutlined className="mr-1" /> Unified
              </span>
              <Switch
                size="small"
                checked={splitView}
                onChange={setSplitView}
                className="bg-zed-muted/20"
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-tighter transition-opacity ${splitView ? "text-zed-accent" : "text-zed-muted opacity-40"}`}
              >
                Split <PicCenterOutlined className="ml-1" />
              </span>
            </div>

            {!isBinary && (
              <button
                onClick={handleCopyDiff}
                className={`flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider px-4 py-2 rounded transition-all duration-200 border ${
                  copied
                    ? "bg-green-500/10 dark:bg-green-900/20 border-green-500/50 text-green-500"
                    : "bg-zed-bg/50 dark:bg-zed-dark-bg/50 border-zed-border dark:border-zed-dark-border text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-zed-dark-text hover:border-zed-accent"
                }`}
              >
                {copied ? (
                  <CheckOutlined className="animate-in zoom-in" />
                ) : (
                  <CopyOutlined />
                )}
                <span>{copied ? "Copied" : "Copy Full Diff"}</span>
              </button>
            )}
            <div className="w-px h-4 bg-zed-border dark:border-zed-dark-border mx-1" />
            <button
              onClick={onClose}
              className="text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-zed-dark-text p-1.5 rounded transition-colors duration-200 hover:bg-zed-element/50 dark:hover:bg-zed-dark-element/50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* List Header / Column Labels */}
        {!isBinary && (
          <div className="flex bg-zed-element/10 dark:bg-zed-dark-element/10 border-b border-zed-border/10 dark:border-zed-dark-border/10 text-[9px] uppercase font-black tracking-[0.2em] text-zed-muted/40 dark:text-zed-dark-muted/40 select-none">
            {splitView ? (
              <>
                <div className="flex-1 flex border-r border-zed-border/10">
                  <div className="w-12 text-center py-1 border-r border-zed-border/10">
                    Line
                  </div>
                  <div className="px-4 py-1">Original (Old)</div>
                </div>
                <div className="flex-1 flex">
                  <div className="w-12 text-center py-1 border-r border-zed-border/10">
                    Line
                  </div>
                  <div className="px-4 py-1">Modified (New)</div>
                </div>
              </>
            ) : (
              <div className="w-full flex">
                <div className="w-12 text-center py-1 border-r border-zed-border/10">
                  Line
                </div>
                <div className="px-4 py-1">Interleaved Changes</div>
              </div>
            )}
          </div>
        )}

        {/* Diff Container */}
        <div className="flex-1 bg-zed-bg dark:bg-zed-dark-bg overflow-hidden relative">
          {isBinary ? (
            <div className="h-full flex flex-col items-center justify-center p-8">
              {isImage && imageDataUrl ? (
                <div className="max-h-full overflow-auto flex flex-col items-center gap-6">
                  <div className="bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAAXNSR0IArs4c6QAAADhJREFUKFNjZGA4wMRABGBA6v///z8Gxv///z9Gxv///z9Gxv///z9Gxv///z9Gxv///z9Gxv///z96XwMBZmk7fAAAAABJRU5ErkJggg==')] bg-repeat p-4 rounded-lg border border-zed-border dark:border-zed-dark-border shadow-xl">
                    <img
                      src={imageDataUrl}
                      alt={filePath}
                      className="max-w-full max-h-[60vh] object-contain shadow-2xl"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-zed-text dark:text-zed-dark-text">
                      {filePath.split("/").pop()}
                    </span>
                    <span className="text-[10px] text-zed-muted uppercase tracking-widest font-bold">
                      Image Preview
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-zed-muted opacity-40">
                  <svg
                    className="w-16 h-16"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="text-sm font-mono italic">
                    Binary file - No preview available
                  </span>
                </div>
              )}
            </div>
          ) : (
            <>
              {parsing && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-zed-bg/50 dark:bg-zed-dark-bg/50 backdrop-blur-[1px]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-zed-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                      Parsing Diff...
                    </span>
                  </div>
                </div>
              )}
              <AutoSizer
                Child={({ height, width }: any) => (
                  <List
                    key={`${filePath}-${splitView}`}
                    style={{ height: height || 0, width: width || 0 }}
                    rowCount={rows.length}
                    rowHeight={24}
                    overscanCount={15}
                    rowComponent={Row as any}
                    rowProps={{ items: rows, splitView }}
                    className="custom-scrollbar"
                  />
                )}
              />

              {rows.length === 0 && !isBinary && !parsing && (
                <div className="absolute inset-0 flex items-center justify-center text-zed-muted dark:text-zed-dark-muted italic font-mono text-sm opacity-30">
                  No changes to display.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        {!isBinary && (
          <div className="px-4 py-1.5 border-t border-zed-border dark:border-zed-dark-border bg-zed-element/10 dark:bg-zed-dark-element/10 flex justify-between items-center text-[10px] font-mono text-zed-muted/50 dark:text-zed-dark-muted/50">
            <div>Total Rows: {rows.length}</div>
            <div className="flex gap-4">
              <span className="text-green-600 dark:text-green-400/60">
                + New Changes
              </span>
              <span className="text-red-600 dark:text-red-400/60">
                - Previous Version
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
