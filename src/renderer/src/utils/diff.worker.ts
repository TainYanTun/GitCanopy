// Optimized Web Worker for parsing git diffs
export interface DiffLine {
  oldLineNumber: number | null;
  newLineNumber: number | null;
  type: "addition" | "deletion" | "context" | "info" | "hunk";
  content: string;
  key: number;
}

const parseDiff = (diffContent: string): DiffLine[] => {
  if (!diffContent || diffContent === "BINARY_FILE") return [];

  const lines = diffContent.split("\n");
  const len = lines.length;
  const parsedLines: DiffLine[] = new Array(len);
  
  let oldLineCounter = 0;
  let newLineCounter = 0;

  for (let i = 0; i < len; i++) {
    const line = lines[i];
    const firstChar = line[0];
    
    let type: DiffLine["type"] = "context";
    let oldNum: number | null = null;
    let newNum: number | null = null;
    let content = line;

    // Faster checks using char comparison
    if (firstChar === "+") {
      type = "addition";
      newLineCounter++;
      newNum = newLineCounter;
      content = line.substring(1);
    } else if (firstChar === "-") {
      type = "deletion";
      oldLineCounter++;
      oldNum = oldLineCounter;
      content = line.substring(1);
    } else if (firstChar === " ") {
      type = "context";
      oldLineCounter++;
      newLineCounter++;
      oldNum = oldLineCounter;
      newNum = newLineCounter;
      content = line.substring(1);
    } else if (firstChar === "@" && line[1] === "@") {
      type = "hunk";
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        oldLineCounter = parseInt(match[1], 10) - 1;
        newLineCounter = parseInt(match[3], 10) - 1;
      }
    } else if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("diff")) {
      type = "info";
    } else {
      type = "info";
    }

    parsedLines[i] = {
      oldLineNumber: oldNum,
      newLineNumber: newNum,
      type,
      content,
      key: i
    };
  }

  return parsedLines;
};

self.onmessage = (e) => {
  try {
    const result = parseDiff(e.data.diffContent);
    self.postMessage({ type: 'SUCCESS', result });
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: String(err) });
  }
};