import { logError } from './logger-service';

interface GeneratedMessage {
  summary: string;
  description: string;
}

export class AiService {
  async generateCommitMessage(
    diff: string,
    apiKey: string,
    provider: 'gemini' | 'openai' = 'gemini'
  ): Promise<GeneratedMessage> {
    if (!diff || !diff.trim()) {
      throw new Error("Diff is empty.");
    }

    if (!apiKey) {
      throw new Error("AI API Key is missing. Please configure it in settings.");
    }

    if (provider === 'gemini') {
      return this.generateWithGemini(diff, apiKey);
    } else {
        // Placeholder for OpenAI or others
        throw new Error(`Provider ${provider} is not yet supported.`);
    }
  }

  private async generateWithGemini(diff: string, apiKey: string): Promise<GeneratedMessage> {
    const prompt = `
You are an expert software engineer. 
Analyze the following git diff and generate a semantic commit message following the Conventional Commits specification.
Return ONLY a raw JSON object (no markdown formatting, no backticks) with the following structure:
{
  "summary": "type(scope): concise description (max 72 chars)",
  "description": "- bullet point explaining why\n- another bullet point explaining what changed"
}

Diff:
${diff.substring(0, 30000)} 
`;
// Truncate diff to 30k chars to avoid hitting token limits safely (Gemini 1.5 Flash has 1M context but good to be safe/fast)

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
              responseMimeType: "application/json"
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        throw new Error("Received empty response from Gemini.");
      }

      try {
        // Clean up markdown if present (e.g. ```json ... ```)
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return {
          summary: parsed.summary || "chore: update code",
          description: parsed.description || ""
        };
      } catch (parseError) {
        logError("AiService", `Failed to parse AI response: ${content}`);
        throw new Error("Failed to parse AI response. Please try again.");
      }

    } catch (error) {
      logError("AiService", `Generate failed: ${error}`);
      throw error;
    }
  }

  async resolveConflictWithAi(
    current: string,
    incoming: string,
    apiKey: string,
    provider: 'gemini' | 'openai' = 'gemini'
  ): Promise<string> {
    const prompt = `
You are an expert developer resolving a merge conflict.
Below are two versions of a code block. 
Merge them intelligently, preserving logic from both where appropriate. 
If the changes are mutually exclusive, prefer the one that seems more complete or bug-free.
Return ONLY the resolved code block. No markdown, no backticks, no explanations.

<<< CURRENT (OURS) >>>
${current}

<<< INCOMING (THEIRS) >>>
${incoming}
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
      });

      if (!response.ok) throw new Error(`AI API Error: ${response.status}`);

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content) throw new Error("AI returned empty resolution.");

      // Strip potential markdown wrapping
      return content.replace(/^```(?:\w+)?\n/, "").replace(/\n```$/, "").trim();
    } catch (error) {
      logError("AiService", `Conflict resolution failed: ${error}`);
      throw error;
    }
  }
}
