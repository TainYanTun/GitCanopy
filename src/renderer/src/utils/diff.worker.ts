// Optimized Web Worker for parsing git diffs
export interface DiffLine {
  lineNumber: number | null;
  type: "addition" | "deletion" | "context" | "info" | "hunk" | "empty";
  content: string;
}

export interface SideBySideRow {
  left: DiffLine | null;
  right: DiffLine | null;
  unified?: DiffLine;
  type: "split" | "unified";
  key: number;
}

// Robust Syntax Highlighter
const highlight = (code: string, _fileName: string): string => {
  if (!code) return code;

  // Highlighting regex rules
  const patterns = [
    { name: "comment", re: /(\/\/.*|\/\*[\s\S]*?\*\/)/ },
    { name: "string", re: /(['"`])(?:\\.|(?!\1)[^\\\n])*\1/ },
    {
      name: "keyword",
      re: /\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|import|export|from|class|extends|async|await|try|catch|finally|new|this|typeof|instanceof|interface|type|enum|namespace|as|keyof|readonly|public|private|protected|static|abstract|implements|true|false|null|undefined|void|any|number|string|boolean|object|Symbol|BigInt)\b/,
    },
    { name: "number", re: /\b\d+(\.\d+)?\b/ },
    { name: "function", re: /\b(\w+)(?=\s*\()/ },
    { name: "property", re: /\.(\w+)\b/ },
  ];

  // Tokenize and highlight in a single pass to avoid nested spans
  let html = "";
  let remaining = code;

  while (remaining.length > 0) {
    let bestMatch = null;
    let bestPattern = null;

    for (const p of patterns) {
      const match = p.re.exec(remaining);
      if (match && (bestMatch === null || match.index < bestMatch.index)) {
        bestMatch = match;
        bestPattern = p;
      }
    }

    if (bestMatch && bestPattern) {
      // Add plain text before match
      if (bestMatch.index > 0) {
        html += escapeHtml(remaining.substring(0, bestMatch.index));
      }
      // Add highlighted match
      html += `<span class="hl-${bestPattern.name}">${escapeHtml(bestMatch[0])}</span>`;
      remaining = remaining.substring(bestMatch.index + bestMatch[0].length);
    } else {
      html += escapeHtml(remaining);
      remaining = "";
    }
  }

  return html;
};

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const parseUnified = (diffContent: string): SideBySideRow[] => {
  const lines = diffContent.split("\n");
  const rows: SideBySideRow[] = [];

  let oldLineCounter = 0;
  let newLineCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const firstChar = line[0];

    let type: DiffLine["type"] = "info";
    let content = line;
    let ln: number | null = null;

    if (firstChar === "+") {
      type = "addition";
      newLineCounter++;
      ln = newLineCounter;
      content = line.substring(1);
    } else if (firstChar === "-") {
      type = "deletion";
      oldLineCounter++;
      ln = oldLineCounter;
      content = line.substring(1);
    } else if (firstChar === " ") {
      type = "context";
      oldLineCounter++;
      newLineCounter++;
      ln = newLineCounter; // Use new line number for context in unified
      content = line.substring(1);
    } else if (firstChar === "@" && line[1] === "@") {
      type = "hunk";
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        oldLineCounter = parseInt(match[1], 10) - 1;
        newLineCounter = parseInt(match[3], 10) - 1;
      }
    }

    rows.push({
      type: "unified",
      left: null,
      right: null,
      unified: { lineNumber: ln, type, content },
      key: i,
    });
  }
  return rows;
};

const parseSplit = (diffContent: string): SideBySideRow[] => {
  const lines = diffContent.split("\n");
  const rows: SideBySideRow[] = [];

  let oldLineCounter = 0;
  let newLineCounter = 0;

  let leftBuffer: DiffLine[] = [];
  let rightBuffer: DiffLine[] = [];

  const flushBuffers = () => {
    const max = Math.max(leftBuffer.length, rightBuffer.length);
    for (let i = 0; i < max; i++) {
      rows.push({
        type: "split",
        left: leftBuffer[i] || { lineNumber: null, type: "empty", content: "" },
        right: rightBuffer[i] || {
          lineNumber: null,
          type: "empty",
          content: "",
        },
        key: rows.length,
      });
    }
    leftBuffer = [];
    rightBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const firstChar = line[0];

    if (firstChar === "+") {
      newLineCounter++;
      rightBuffer.push({
        lineNumber: newLineCounter,
        type: "addition",
        content: line.substring(1),
      });
    } else if (firstChar === "-") {
      oldLineCounter++;
      leftBuffer.push({
        lineNumber: oldLineCounter,
        type: "deletion",
        content: line.substring(1),
      });
    } else {
      flushBuffers();

      if (firstChar === " ") {
        oldLineCounter++;
        newLineCounter++;
        const content = line.substring(1);
        rows.push({
          type: "split",
          left: { lineNumber: oldLineCounter, type: "context", content },
          right: { lineNumber: newLineCounter, type: "context", content },
          key: rows.length,
        });
      } else if (firstChar === "@" && line[1] === "@") {
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          oldLineCounter = parseInt(match[1], 10) - 1;
          newLineCounter = parseInt(match[3], 10) - 1;
        }
        rows.push({
          type: "split",
          left: { lineNumber: null, type: "hunk", content: line },
          right: { lineNumber: null, type: "hunk", content: line },
          key: rows.length,
        });
      } else {
        rows.push({
          type: "split",
          left: { lineNumber: null, type: "info", content: line },
          right: { lineNumber: null, type: "info", content: line },
          key: rows.length,
        });
      }
    }
  }
  flushBuffers();
  return rows;
};

self.onmessage = (e) => {
  const { diffContent, splitView, fileName } = e.data;
  try {
    const result = splitView
      ? parseSplit(diffContent)
      : parseUnified(diffContent);

    // Apply highlighting to result
    result.forEach((row) => {
      if (row.type === "split") {
        if (
          row.left?.content &&
          row.left.type !== "hunk" &&
          row.left.type !== "info"
        ) {
          row.left.content = highlight(row.left.content, fileName);
        }
        if (
          row.right?.content &&
          row.right.type !== "hunk" &&
          row.right.type !== "info"
        ) {
          row.right.content = highlight(row.right.content, fileName);
        }
      } else if (row.unified) {
        if (
          row.unified.content &&
          row.unified.type !== "hunk" &&
          row.unified.type !== "info"
        ) {
          row.unified.content = highlight(row.unified.content, fileName);
        }
      }
    });

    self.postMessage({ type: "SUCCESS", result });
  } catch (err) {
    self.postMessage({ type: "ERROR", error: String(err) });
  }
};
