import React, { useMemo, useCallback, useEffect } from "react";
import { Modal } from "antd";
import {
  CopyOutlined,
  FileTextOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import { List } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";

interface DiffLine {
  oldLineNumber: number | null;
  newLineNumber: number | null;
  type: "addition" | "deletion" | "context" | "info" | "hunk";
  content: string;
  key: number;
  originalLine: string;
}

interface DiffModalProps {
  repoPath: string;
  diffContent: string;
  filePath: string;
  onClose: () => void;
  visible: boolean;
}

const parseDiff = (diffContent: string): DiffLine[] => {
  if (!diffContent || diffContent === "BINARY_FILE") {
    return [];
  }

  const lines = diffContent.split("\n");
  const parsedLines: DiffLine[] = [];
  let oldLineCounter = 0;
  let newLineCounter = 0;

  lines.forEach((line, index) => {
    let type: DiffLine["type"] = "context";
    let currentOldLine = null;
    let currentNewLine = null;
    let content = line;

    if (
      line.startsWith("--- a/") ||
      line.startsWith("+++ b/") ||
      line.startsWith("diff --git")
    ) {
      type = "info";
    } else if (line.startsWith("@@")) {
      type = "hunk";
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        oldLineCounter = parseInt(match[1], 10) - 1;
        newLineCounter = parseInt(match[3], 10) - 1;
      }
    } else if (line.startsWith("+")) {
      type = "addition";
      newLineCounter++;
      currentNewLine = newLineCounter;
      content = line.substring(1);
    } else if (line.startsWith("-")) {
      type = "deletion";
      oldLineCounter++;
      currentOldLine = oldLineCounter;
      content = line.substring(1);
    } else if (line.startsWith(" ")) {
      type = "context";
      oldLineCounter++;
      newLineCounter++;
      currentOldLine = oldLineCounter;
      currentNewLine = newLineCounter;
      content = line.substring(1);
    } else {
      type = "info";
    }

    parsedLines.push({
      oldLineNumber: currentOldLine,
      newLineNumber: currentNewLine,
      type,
      content,
      key: index,
      originalLine: line,
    });
  });

  return parsedLines;
};

export const DiffModal: React.FC<DiffModalProps> = ({
  repoPath,
  diffContent,
  filePath,
  onClose,
  visible,
}) => {
  const diffLines = useMemo(() => parseDiff(diffContent), [diffContent]);
  const [copied, setCopied] = React.useState(false);
  const [imageDataUrl, setImageDataUrl] = React.useState<string | null>(null);

  const isBinary = diffContent === "BINARY_FILE";
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
    navigator.clipboard.writeText(diffContent);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  const Row = useCallback(
    ({ index, style }: any): React.ReactElement => {
      const diffLine = diffLines[index];

      if (!diffLine) return <div style={style} />;

      const isAddition = diffLine.type === "addition";
      const isDeletion = diffLine.type === "deletion";
      const isHunk = diffLine.type === "hunk";
      const isInfo = diffLine.type === "info";

      return (
        <div
          style={style}
          className={`flex group border-b border-transparent transition-colors duration-75 ${ 
            isAddition
              ? "bg-green-500/10 dark:bg-green-900/20 hover:bg-green-500/20 dark:hover:bg-green-900/30"
              : isDeletion
              ? "bg-red-500/10 dark:bg-red-900/20 hover:bg-red-500/20 dark:hover:bg-red-900/30"
              : isHunk
              ? "bg-zed-accent/5 dark:bg-zed-accent/10 text-zed-accent/80 font-bold"
              : isInfo
              ? "bg-zed-element/30 dark:bg-zed-dark-element/30 text-zed-muted italic"
              : "hover:bg-zed-element/40 dark:hover:bg-zed-dark-element/40"
          }`}
        >
          {/* Gutter: Line Numbers */}
          <div className="flex-shrink-0 flex select-none border-r border-zed-border/20 dark:border-zed-dark-border/20 bg-zed-bg/50 dark:bg-zed-dark-bg/50">
            <div
              className={`w-10 text-right pr-2 text-[10px] font-mono py-1 ${ 
                isAddition
                  ? "text-green-600 dark:text-green-400/50"
                  : isDeletion
                  ? "text-red-600 dark:text-red-400/50"
                  : "text-zed-muted/40"
              }`}
            >
              {diffLine.oldLineNumber || ""}
            </div>
            <div
              className={`w-10 text-right pr-2 text-[10px] font-mono py-1 ${ 
                isAddition
                  ? "text-green-600 dark:text-green-400/50"
                  : isDeletion
                  ? "text-red-600 dark:text-red-400/50"
                  : "text-zed-muted/40"
              }`}
            >
              {diffLine.newLineNumber || ""}
            </div>
          </div>

          {/* Indicator Column */}
          <div
            className={`flex-shrink-0 w-6 flex items-center justify-center font-mono text-sm select-none ${ 
              isAddition
                ? "text-green-500 dark:text-green-400"
                : isDeletion
                ? "text-red-500 dark:text-red-400"
                : "text-zed-muted/30"
            }`}
          >
            {isAddition ? "+" : isDeletion ? "-" : ""}
          </div>

          {/* Content */}
          <pre
            className={`flex-grow px-2 whitespace-pre font-mono text-[12px] leading-6 overflow-hidden ${ 
              isAddition
                ? "text-green-700 dark:text-green-300"
                : isDeletion
                ? "text-red-700 dark:text-red-300"
                : isHunk
                ? "text-zed-accent"
                : "text-zed-text dark:text-zed-dark-text opacity-90"
            }`}
          >
            {diffLine.content}
          </pre>
        </div>
      );
    },
    [diffLines]
  );

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
              <span className="font-bold text-sm text-zed-text dark:text-zed-dark-text tracking-tight truncate max-w-xl">
                {filePath}
              </span>
              <span className="text-[10px] text-zed-muted dark:text-zed-dark-muted uppercase tracking-widest font-bold opacity-60">
                Unified Diff View
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
            <div className="w-20 border-r border-zed-border/10 dark:border-zed-dark-border/10 text-center py-1">
              Lines
            </div>
            <div className="w-6 text-center py-1">±</div>
            <div className="px-2 py-1">Content</div>
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
              <AutoSizer
                Child={({ height, width }: any) => (
                  <List
                    style={{ height: height || 0, width: width || 0 }}
                    rowCount={diffLines.length}
                    rowHeight={24}
                    rowComponent={Row}
                    rowProps={{} as any}
                    className="custom-scrollbar"
                  />
                )}
              />

              {diffLines.length === 0 && !isBinary && (
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
            <div>Total Lines: {diffLines.length}</div>
            <div className="flex gap-4">
              <span className="text-green-600 dark:text-green-400/60">
                + {diffLines.filter((l) => l.type === "addition").length}
              </span>
              <span className="text-red-600 dark:text-red-400/60">
                - {diffLines.filter((l) => l.type === "deletion").length}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};