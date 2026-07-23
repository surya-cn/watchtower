import OpenAI from "openai";

const apiKey = process.env.OPENROUTER_API_KEY || "mock-key";
export const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey,
});

export type ExistingCluster = {
  id: string;
  title: string;
  category: string;
  summary: string | null;
  status: string;
};

export type ClassifyAndMatchResult = {
  category: string;
  matched_cluster_id: string | null;
  is_new_issue: boolean;
  suggested_title: string | null;
};

export async function classifyAndMatchPost(
  content: string,
  allowedCategories: string[],
  existingClusters: ExistingCluster[]
): Promise<ClassifyAndMatchResult> {
  const systemPrompt = `You are an AI triaging user posts for WatchTower.
You must categorize the post into exactly one of the allowed categories: [${allowedCategories.join(", ")}].
You are provided a list of existing clusters. Determine if the post describes an issue that matches one of these existing clusters.
If it does, return the matched_cluster_id. If it describes a distinct new issue, mark is_new_issue as true and suggest a short, descriptive title for the new cluster (3-6 words).
Crucial: Always prioritize assigning to an existing cluster if it matches the core issue, even if the cluster's status is 'fixed', 'resolved', or 'closed_false_positive'. This helps us track recurrences.`;

  let clustersText = existingClusters.length > 0 
    ? "Existing Clusters:\n" + existingClusters.map(c => `- ID: ${c.id}\n  Title: ${c.title}\n  Category: ${c.category}\n  Status: ${c.status}\n  Summary: ${c.summary ?? 'None'}`).join("\n\n")
    : "No existing clusters.";

  const userMessage = `Post Content:
${content}

${clustersText}

Respond ONLY using the classify_and_match tool.`;

  const msg = await client.chat.completions.create({
    model: "google/gemini-2.5-flash",
    max_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "classify_and_match",
          description: "Classifies a post and matches it to an existing issue cluster or creates a new one.",
          parameters: {
            type: "object",
            properties: {
              category: { type: "string", description: "Must be one of the allowed categories." },
              matched_cluster_id: { type: ["string", "null"], description: "The ID of the matching cluster, or null if it's a new issue." },
              is_new_issue: { type: "boolean", description: "True if no existing cluster matches and a new one should be created." },
              suggested_title: { type: ["string", "null"], description: "A short, descriptive title if creating a new cluster, else null." }
            },
            required: ["category", "matched_cluster_id", "is_new_issue", "suggested_title"]
          }
        }
      }
    ],
    tool_choice: { type: "function", function: { name: "classify_and_match" } }
  });

  const responseMessage = msg.choices[0].message;
  
  console.log("----- RAW NEMOTRON RESPONSE -----");
  console.log("Content:", responseMessage.content);
  console.log("Tool Calls:", JSON.stringify(responseMessage.tool_calls, null, 2));
  console.log("---------------------------------");
  
  // Note: Nemotron 3 Ultra is a reasoning model, so it may include reasoning trace in the content.
  // We must extract the tool_calls specifically and ignore the free-form text.
  if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
    throw new Error("OpenAI API did not return the expected tool call.");
  }

  const toolCall = responseMessage.tool_calls.find((t: any) => t.function.name === "classify_and_match");
  if (!toolCall) {
    throw new Error("Missing classify_and_match tool call.");
  }

  const input = JSON.parse((toolCall as any).function.arguments);
  
  return {
    category: input.category,
    matched_cluster_id: input.matched_cluster_id || null,
    is_new_issue: input.is_new_issue === true,
    suggested_title: input.suggested_title || null,
  };
}

export async function generateClusterSummary(postsContent: string[]): Promise<string> {
  const userMessage = `Based on the following user posts, provide a concise 2-3 sentence summary of the issue being reported. Focus on the symptoms, error messages, and impact.
  
Posts:
${postsContent.join("\n\n---\n\n")}

Provide only the summary text without any introduction or conclusion.`;

  const msg = await client.chat.completions.create({
    model: "google/gemini-2.5-flash",
    max_tokens: 256,
    messages: [{ role: "user", content: userMessage }]
  });

  if (!msg.choices[0].message.content) {
    throw new Error("Expected text response for summary");
  }

  return msg.choices[0].message.content.trim();
}
