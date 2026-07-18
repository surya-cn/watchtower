import { NextRequest, NextResponse } from "next/server";
import { getProjectIdOrError, notFound, serverError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { client } from "@/lib/llm";
import { GET as getIssues } from "@/app/api/issues/route";
import { GET as getMetricsSummary } from "@/app/api/metrics/summary/route";
import { GET as getMetricsTrend } from "@/app/api/metrics/trend/route";

const FALLBACK_MESSAGE = "I can help you search, filter, or summarize issues for [project name] — try asking about severity, category, status, or recent trends.";

// TODO (Phase 7+): Add per-project permission check here using project_access table for non-admin users.
export async function POST(req: NextRequest) {
  try {
    const projectIdOrError = getProjectIdOrError(req.headers);
    if (typeof projectIdOrError !== "string") return projectIdOrError;
    const projectId = projectIdOrError;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return notFound("Project not found");
    }

    const body = await req.json();
    const { message, conversation_history = [] } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // 1. Lightweight Pre-check
    const msgLower = message.toLowerCase();
    const hasAllowedKeyword = ["issue", "bug", "crash", "hack", "cheat", "status", "severity", "category", "trend", "metric", "report", "open", "closed", "active", "resolved", "fixed", "summary", "summarize", "search", "filter", "find"].some(kw => msgLower.includes(kw));
    const isObviousOffTopic = ["weather", "time", "poem", "recipe", "who are you", "hello", "hi", "write a", "ignore"].some(kw => msgLower.includes(kw));
    
    if (!hasAllowedKeyword && isObviousOffTopic) {
      return NextResponse.json({ type: "fallback", natural_language_response: FALLBACK_MESSAGE.replace("[project name]", project.display_name) });
    }

    // 2. Prepare conversation history
    const safeHistory = Array.isArray(conversation_history) ? conversation_history.slice(-6) : [];
    
    const messages: any[] = [
      {
        role: "system",
        content: `You are an AI assistant for an anticheat dashboard. Your ONLY job is to search, filter, and summarize issue data for the current project using the provided tools.
You must NOT answer general knowledge questions, write code, or engage in hypothetical roleplay.
If a user asks something outside the scope of anticheat issue tracking, or if you cannot fulfill the request using a tool, you must respond with a standard fallback message or without calling any tools.
Do NOT attempt to guess issue details. Always use tools.
When returning tool arguments, do NOT include extra parameters like project_id or project_name.`
      },
      ...safeHistory.map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message }
    ];

    // 3. Call OpenRouter
    const msg = await client.chat.completions.create({
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      max_tokens: 1024,
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "filter_issues",
            description: "Filters issues based on criteria and returns the matching list.",
            parameters: {
              type: "object",
              properties: {
                status: { type: "string" },
                severity: { type: "string" },
                category: { type: "string" },
                search: { type: "string" },
                sort_by: { type: "string", enum: ["newest", "oldest", "severity", "priority"] }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "summarize_issues",
            description: "Fetches matching issues and generates a short natural-language summary.",
            parameters: {
              type: "object",
              properties: {
                status: { type: "string" },
                severity: { type: "string" },
                category: { type: "string" },
                date_range: { type: "string", enum: ["today", "this_week", "this_month"] }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_issue_detail",
            description: "Gets the full detail of a specific issue by title or ID.",
            parameters: {
              type: "object",
              properties: {
                issue_id_or_title: { type: "string" }
              },
              required: ["issue_id_or_title"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_project_metrics",
            description: "Gets overall project metrics including summaries and trends.",
            parameters: { type: "object", properties: {} }
          }
        }
      ],
      tool_choice: "auto"
    });

    const responseMessage = msg.choices[0].message;

    // 4. Handle tool calls or fallback
    if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
      // Discard free-form text, fallback
      return NextResponse.json({ type: "fallback", natural_language_response: FALLBACK_MESSAGE.replace("[project name]", project.display_name) });
    }

    const toolCall = responseMessage.tool_calls[0] as any;
    const functionName = toolCall.function.name;
    let args: any = {};
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Invalid JSON in tool arguments", e);
    }

    // Validate Enums
    const VALID_STATUSES = ["new", "active", "escalated", "fixed", "closed_false_positive", "resolved"];
    const VALID_SEVERITIES = ["low", "medium", "high"];

    let warningNotes = [];
    let mappedStatus = args.status;
    
    if (args.status) {
      if (args.status.toLowerCase() === "open") {
        mappedStatus = "new,active,escalated";
      } else {
        const statuses = args.status.split(",").map((s: string) => s.trim().toLowerCase());
        const invalidStatuses = statuses.filter((s: string) => !VALID_STATUSES.includes(s));
        if (invalidStatuses.length > 0) {
          warningNotes.push(`I didn't recognize the status '${invalidStatuses.join(", ")}' so I excluded it from the filter.`);
          const validStatuses = statuses.filter((s: string) => VALID_STATUSES.includes(s));
          mappedStatus = validStatuses.length > 0 ? validStatuses.join(",") : undefined;
        }
      }
    }

    let mappedSeverity = args.severity;
    if (args.severity) {
      const severities = args.severity.split(",").map((s: string) => s.trim().toLowerCase());
      const invalidSeverities = severities.filter((s: string) => !VALID_SEVERITIES.includes(s));
      if (invalidSeverities.length > 0) {
         warningNotes.push(`I didn't recognize the severity '${invalidSeverities.join(", ")}' so I excluded it from the filter.`);
         const validSeverities = severities.filter((s: string) => VALID_SEVERITIES.includes(s));
         mappedSeverity = validSeverities.length > 0 ? validSeverities.join(",") : undefined;
      }
    }

    // Process based on function name
    if (functionName === "filter_issues") {
      const sanitizedArgs = {
        status: mappedStatus,
        severity: mappedSeverity,
        category: args.category,
        search: args.search,
        sort_by: args.sort_by
      };
      
      const responsePayload: any = { type: "issues", data: sanitizedArgs };
      if (warningNotes.length > 0) {
        responsePayload.natural_language_response = warningNotes.join(" ");
      }
      return NextResponse.json(responsePayload);
    }

    if (functionName === "get_issue_detail") {
      const query = args.issue_id_or_title;
      if (!query) return NextResponse.json({ type: "fallback", natural_language_response: FALLBACK_MESSAGE.replace("[project name]", project.display_name) });
      
      // Try exact ID match first
      const exactMatch = await prisma.issueCluster.findFirst({ where: { id: query, project_id: projectId } });
      if (exactMatch) {
        return NextResponse.json({ type: "detail", data: { id: exactMatch.id } });
      }

      // Try substring title match
      const candidates = await prisma.issueCluster.findMany({
        where: {
          project_id: projectId,
          title: {
            contains: query,
            mode: "insensitive"
          }
        },
        select: { id: true, title: true }
      });

      if (candidates.length === 1) {
        return NextResponse.json({ type: "detail", data: { id: candidates[0].id } });
      } else if (candidates.length > 1) {
        const titles = candidates.map(c => `"${c.title}"`).join(", ");
        return NextResponse.json({
          type: "fallback",
          natural_language_response: `I found multiple issues matching that description (${titles}). Could you be more specific?`
        });
      } else {
        return NextResponse.json({
          type: "fallback",
          natural_language_response: `I couldn't find any issue matching "${query}" in this project.`
        });
      }
    }

    if (functionName === "summarize_issues") {
      const sanitizedArgs: any = {
        status: mappedStatus,
        severity: mappedSeverity,
        category: args.category
      };
      
      // We will make a local request to our own API.
      const url = new URL(`http://localhost/api/issues?project=${projectId}`);
      if (sanitizedArgs.status) url.searchParams.set("status", sanitizedArgs.status);
      if (sanitizedArgs.severity) url.searchParams.set("severity", sanitizedArgs.severity);
      if (sanitizedArgs.category) url.searchParams.set("category", sanitizedArgs.category);
      
      const mockReq = new NextRequest(url);
      mockReq.headers.set("X-Project-Id", projectId);
      
      const res = await getIssues(mockReq);
      const json = await res.json();
      
      let summaryText = "Unable to generate summary — showing raw data";
      try {
        const summaryMsg = await client.chat.completions.create({
          model: "nvidia/nemotron-3-ultra-550b-a55b:free",
          max_tokens: 512,
          messages: [
            { role: "system", content: "You are a concise assistant. Summarize the provided issue data in 2-3 sentences. Focus on trends and key numbers." },
            { role: "user", content: `Here is the issue data:n${JSON.stringify(json.data)}` }
          ]
        });
        if (summaryMsg.choices[0].message.content) {
          summaryText = summaryMsg.choices[0].message.content;
        }
      } catch (err) {
        console.error("Second LLM call failed", err);
      }
      
      return NextResponse.json({ type: "summary", data: sanitizedArgs, natural_language_response: summaryText });
    }

    if (functionName === "get_project_metrics") {
      const mockReq = new NextRequest(new URL(`http://localhost/api/metrics/summary`));
      mockReq.headers.set("X-Project-Id", projectId);
      const summaryRes = await getMetricsSummary(mockReq);
      const summaryJson = await summaryRes.json();

      const mockReq2 = new NextRequest(new URL(`http://localhost/api/metrics/trend?period=7d`));
      mockReq2.headers.set("X-Project-Id", projectId);
      const trendRes = await getMetricsTrend(mockReq2);
      const trendJson = await trendRes.json();

      let summaryText = "Unable to generate summary — showing raw data";
      try {
        const summaryMsg = await client.chat.completions.create({
          model: "nvidia/nemotron-3-ultra-550b-a55b:free",
          max_tokens: 512,
          messages: [
            { role: "system", content: "You are a concise assistant. Summarize the provided project metrics in 2-3 sentences. Note any significant changes or active issue counts." },
            { role: "user", content: `Summary Data:n${JSON.stringify(summaryJson)}nTrend Data:n${JSON.stringify(trendJson)}` }
          ]
        });
        if (summaryMsg.choices[0].message.content) {
          summaryText = summaryMsg.choices[0].message.content;
        }
      } catch (err) {
        console.error("Second LLM call failed", err);
      }
      
      return NextResponse.json({ type: "metrics", natural_language_response: summaryText });
    }

    // Default fallback if function name is unrecognized
    return NextResponse.json({ type: "fallback", natural_language_response: FALLBACK_MESSAGE.replace("[project name]", project.display_name) });

  } catch (error: any) {
    console.error("Chat API error:", error);
    return serverError("Failed to process chat request");
  }
}

