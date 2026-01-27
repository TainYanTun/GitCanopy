import fetch from 'node-fetch';
import { logError } from './logger-service';
import { LRUCache } from 'lru-cache';

interface GeneratedMessage {
  summary: string;
  description: string;
}

interface CodeReviewResult {
  score: number;
  summary: string;
  issues: Array<{
    type: 'security' | 'bug' | 'optimization' | 'style';
    file: string;
    message: string;
    severity: 'high' | 'medium' | 'low';
  }>;
}

export class AiService {
  private cache = new LRUCache<string, any>({ max: 100, ttl: 1000 * 60 * 60 }); // 1 hour cache

  private filterDiff(diff: string): string {
    if (!diff) return "";
    
    // Split into hunks per file
    const sections = diff.split(/^diff --git /m);
    const filteredSections = sections.filter(section => {
      if (!section.trim()) return false;
      
      const firstLine = section.split('\n')[0];
      const fileName = firstLine.split(' ').pop() || "";
      
      // Filter out noisy files
      const noisyExtensions = ['.lock', 'lock.json', '.min.js', '.map', '.pnp.js'];
      const noisyPaths = ['node_modules/', 'dist/', 'build/', '.next/', 'out/'];
      
      if (noisyExtensions.some(ext => fileName.endsWith(ext))) return false;
      if (noisyPaths.some(p => section.includes(p))) return false;
      
      // Skip binary markers
      if (section.includes('Binary files')) return false;
      
      return true;
    });

    return filteredSections.join('diff --git ').substring(0, 40000);
  }

  private extractJson(content: string): any {
    try {
      // First, try to find a JSON object using brace matching
      const startIndex = content.indexOf('{');
      const endIndex = content.lastIndexOf('}');
      
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const jsonStr = content.substring(startIndex, endIndex + 1);
        return JSON.parse(jsonStr);
      }

      // Fallback to cleaning markdown tags if braces aren't found or parsing fails
      // Make the regex case insensitive
      const cleanJson = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      logError("AiService", `Failed to parse JSON from content: ${content.substring(0, 100)}...`);
      throw new Error("Failed to parse AI response as JSON.");
    }
  }

  async reviewCode(
    diff: string,
    apiKey: string,
    provider: 'gemini' | 'openai' | 'claude' = 'gemini',
    model?: string
  ): Promise<CodeReviewResult> {
    if (!diff || !diff.trim()) throw new Error("Diff is empty.");
    
    const cleanDiff = this.filterDiff(diff);
    
    const prompt = `
You are a strict Senior Software Engineer performing a code review.
Analyze the following git diff for bugs, security vulnerabilities, performance issues, and code style.

Return ONLY a raw JSON object (no markdown, no backticks) with this structure:
{
  "score": number, // 0-100 (100 is perfect)
  "summary": "Short markdown summary of the changes quality",
  "issues": [
    {
      "type": "security" | "bug" | "optimization" | "style",
      "file": "filename (guess if unknown)",
      "message": "concise explanation",
      "severity": "high" | "medium" | "low"
    }
  ]
}

Diff:
${cleanDiff}
`;

    let content = "";

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-3-flash'}:generateContent?key=${apiKey}`;
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
      });
      const data = await response.json();
      content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    } else if (provider === 'openai') {
      const response = await this.fetchWithRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model || 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        }),
      });
      const data = await response.json();
      content = data.choices[0].message.content;
    } else if (provider === 'claude') {
      const response = await this.fetchWithRetry('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-latest',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }]
        }),
      });
      const data = await response.json();
      content = data.content[0].text;
    }

    return this.extractJson(content);
  }

  async generateCommitMessage(
    diff: string,
    apiKey: string,
    provider: 'gemini' | 'openai' | 'claude' = 'gemini',
    model?: string
  ): Promise<GeneratedMessage> {
    if (!diff || !diff.trim()) throw new Error("Diff is empty.");
    if (!apiKey) throw new Error(`API Key for ${provider} is missing.`);

    const prompt = `
You are an expert software engineer. 
Analyze the following git diff and generate a semantic commit message following the Conventional Commits specification.
Return ONLY a raw JSON object (no markdown formatting, no backticks) with the following structure:
{
  "summary": "type(scope): concise description (max 72 chars)",
  "description": "- bullet point explaining why\\n- another bullet point explaining what changed"
}

Diff:
${this.filterDiff(diff)} 
`;

    if (provider === 'gemini') {
      return this.generateWithGemini(prompt, apiKey, model || 'gemini-3-flash');
    } else if (provider === 'openai') {
      return this.generateWithOpenAI(prompt, apiKey, model || 'gpt-4o');
    } else if (provider === 'claude') {
      return this.generateWithClaude(prompt, apiKey, model || 'claude-3-5-sonnet-latest');
    }
    throw new Error(`Provider ${provider} not supported.`);
  }

  private async generateWithGemini(prompt: string, apiKey: string, model: string): Promise<GeneratedMessage> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
      });
      if (!response.ok) throw new Error(`Gemini API Error (${response.status}): ${await response.text()}`);
      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return this.parseJsonMessage(content);
    } catch (error) {
      logError("AiService", `Gemini failed: ${error}`);
      throw error;
    }
  }

  private async generateWithOpenAI(prompt: string, apiKey: string, model: string): Promise<GeneratedMessage> {
    const url = 'https://api.openai.com/v1/chat/completions';
    try {
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        }),
      });
      if (!response.ok) throw new Error(`OpenAI API Error (${response.status}): ${await response.text()}`);
      const data = await response.json();
      return this.parseJsonMessage(data.choices[0].message.content);
    } catch (error) {
      logError("AiService", `OpenAI failed: ${error}`);
      throw error;
    }
  }

  private async generateWithClaude(prompt: string, apiKey: string, model: string): Promise<GeneratedMessage> {
    const url = 'https://api.anthropic.com/v1/messages';
    try {
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        }),
      });
      if (!response.ok) throw new Error(`Claude API Error (${response.status}): ${await response.text()}`);
      const data = await response.json();
      return this.parseJsonMessage(data.content[0].text);
    } catch (error) {
      logError("AiService", `Claude failed: ${error}`);
      throw error;
    }
  }

  private parseJsonMessage(content: string): GeneratedMessage {
    try {
      const parsed = this.extractJson(content);
      return {
        summary: parsed.summary || "chore: update code",
        description: parsed.description || ""
      };
    } catch (e) {
      throw new Error("Failed to parse AI response as JSON.");
    }
  }

  private async fetchWithRetry(url: string, options: any, retries = 3, backoff = 1000): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(url, { ...options, signal: controller.signal });
          if (response.status === 503 || response.status === 429) {
            await new Promise(resolve => setTimeout(resolve, backoff));
            backoff *= 2;
            continue;
          }
          return response;
        } catch (err: any) {
          if (err.name === 'AbortError') throw new Error("Request timed out after 30 seconds.");
          if (i === retries - 1) throw err;
          await new Promise(resolve => setTimeout(resolve, backoff));
          backoff *= 2;
        }
      }
      return fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  async resolveConflictWithAi(
    current: string,
    incoming: string,
    apiKey: string,
    provider: 'gemini' | 'openai' | 'claude' = 'gemini',
    instruction?: string,
    model?: string
  ): Promise<string> {
    const prompt = `
You are an expert developer resolving a merge conflict.
Below are two versions of a code block. 
Merge them intelligently, preserving logic from both where appropriate. 
If the changes are mutually exclusive, prefer the one that seems more complete or bug-free.
${instruction ? `\nSPECIAL USER INSTRUCTION: ${instruction}\n` : ""}
Return ONLY the resolved code block. No markdown, no backticks, no explanations.

<<< CURRENT (OURS) >>>
${current}

<<< INCOMING (THEIRS) >>>
${incoming}
`;

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-3-flash'}:generateContent?key=${apiKey}`;
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const data = await response.json();
      return this.cleanCode(data.candidates?.[0]?.content?.parts?.[0]?.text);
    } else if (provider === 'openai') {
      const response = await this.fetchWithRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || 'gpt-4o', messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await response.json();
      return this.cleanCode(data.choices[0].message.content);
    } else if (provider === 'claude') {
      const response = await this.fetchWithRetry('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model || 'claude-3-5-sonnet-latest', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await response.json();
      return this.cleanCode(data.content[0].text);
    }
    throw new Error("Provider not supported");
  }

  private cleanCode(content: string): string {
    // 1. Try to find content within markdown code blocks ```...```
    const codeBlockRegex = /```(?:[\w\-.]+)?\s*([\s\S]*?)\s*```/i;
    const match = content.match(codeBlockRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }

    // 2. Fallback: If no code blocks, assume the whole text is code but trim whitespace
    // potentially removing "Here is the code:" prefixes if they don't use markdown is hard 
    // without risking deleting code, so we rely on the prompt being strict.
    // But we can clean common "output only" markers.
    return content.trim();
  }

  async explainDiff(
    diff: string,
    apiKey: string,
    provider: 'gemini' | 'openai' | 'claude' = 'gemini',
    model?: string
  ): Promise<string> {
    const prompt = `
You are an expert technical lead. 
Analyze the following git diff and provide a high-level explanation of WHAT changed and WHY.
Focus on architectural impact and potential risks. 
Keep it concise but insightful. Use markdown formatting.

Diff:
${diff.substring(0, 30000)}
`;

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-3-flash'}:generateContent?key=${apiKey}`;
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No explanation.";
    } else if (provider === 'openai') {
      const response = await this.fetchWithRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || 'gpt-4o', messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await response.json();
      return data.choices[0].message.content;
    } else if (provider === 'claude') {
      const response = await this.fetchWithRetry('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model || 'claude-3-5-sonnet-latest', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await response.json();
      return data.content[0].text;
    }
    throw new Error("Provider not supported");
  }

  async getTeamPulse(
    stats: any[],
    apiKey: string,
    provider: 'gemini' | 'openai' | 'claude' = 'gemini',
    model?: string
  ): Promise<string> {
    const prompt = `
You are a technical people manager. 
Based on the following team Git statistics, provide a 2-sentence "Team Pulse" summary.
Identify the team's current health, work rhythm, and if there are any risks (like knowledge silos or heavy individual load).
Be insightful and professional.

Team Stats:
${JSON.stringify(stats)}
`;

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-3-flash'}:generateContent?key=${apiKey}`;
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No summary available.";
    } else if (provider === 'openai') {
      const response = await this.fetchWithRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || 'gpt-4o', messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await response.json();
      return data.choices[0].message.content;
    } else if (provider === 'claude') {
      const response = await this.fetchWithRetry('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model || 'claude-3-5-sonnet-latest', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await response.json();
      return data.content[0].text;
    }
    throw new Error("Provider not supported");
  }

  async translateNaturalLanguageToGit(
    query: string,
    context: string,
    apiKey: string,
    provider: 'gemini' | 'openai' | 'claude' = 'gemini',
    model?: string
  ): Promise<string> {
    const prompt = `
You are a Git expert. Translate the following natural language request into a valid Git command.
The current repository context is: ${context}

Natural Language Request: "${query}"

Rules:
1. Return ONLY the git command (no markdown, no backticks, no explanations).
2. If the request is ambiguous, return the most likely command.
3. If the request is not related to Git, return "NOT_A_GIT_COMMAND".
4. Use standard Git CLI syntax.

Example:
Request: "checkout my last feature branch"
Response: git checkout feature/login

Example:
Request: "undo my last commit but keep changes"
Response: git reset --soft HEAD~1
`;

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-3-flash'}:generateContent?key=${apiKey}`;
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const data = await response.json();
      return this.cleanCode(data.candidates?.[0]?.content?.parts?.[0]?.text || "NOT_A_GIT_COMMAND");
    } else if (provider === 'openai') {
      const response = await this.fetchWithRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || 'gpt-4o', messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await response.json();
      return this.cleanCode(data.choices[0].message.content);
    } else if (provider === 'claude') {
      const response = await this.fetchWithRetry('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model || 'claude-3-5-sonnet-latest', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await response.json();
      return this.cleanCode(data.content[0].text);
    }
    throw new Error("Provider not supported");
  }

  async analyzeGitError(
    error: string,
    context: string,
    apiKey: string,
    provider: 'gemini' | 'openai' | 'claude' = 'gemini',
    model?: string
  ): Promise<string> {
    const prompt = `
You are a Git expert. A user encountered the following Git error:
"${error}"

The current repository context is: ${context}

Analyze this error and provide:
1. A clear explanation of what went wrong.
2. A suggested Git command to fix it.

Keep it concise and helpful. Use markdown.
`;

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-3-flash'}:generateContent?key=${apiKey}`;
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't analyze this error.";
    } else if (provider === 'openai') {
      const response = await this.fetchWithRetry('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model || 'gpt-4o', messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await response.json();
      return data.choices[0].message.content;
    } else if (provider === 'claude') {
      const response = await this.fetchWithRetry('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model || 'claude-3-5-sonnet-latest', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await response.json();
      return data.content[0].text;
    }
    throw new Error("Provider not supported");
  }
}
