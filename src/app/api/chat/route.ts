import { NextRequest, NextResponse } from "next/server";
import { getProjectIdOrError, notFound, serverError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { client } from "@/lib/llm";
import { ProjectConfig } from "@/lib/schemas";

const FALLBACK_MESSAGE = "I am an AI co-pilot designed to help you analyze issues and manage your WatchTower projects. I cannot answer unrelated questions.";

export async function POST(req: NextRequest) {
  try {
    const projectIdOrError = getProjectIdOrError(req.headers);
    if (typeof projectIdOrError !== "string") return projectIdOrError;
    const projectId = projectIdOrError;

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

    // 1. Prepare conversation history
    const safeHistory = Array.isArray(conversation_history) ? conversation_history.slice(-10) : [];
    
    let messages: any[] = [
      {
        role: "system",
        content: `You are an AI Data Analyst and Project Co-Pilot for WatchTower. Your goal is to analyze player feedback, manage project settings, and provide deep insights.
You have access to the following project context:
- Project ID: ${project.id}
- Project Name: ${project.display_name}
- Current Config: ${JSON.stringify(project.config)}

Rules:
1. When asked to analyze issues, use the query_database tool to fetch raw data. Do NOT invent data. Look for root causes, player sentiment, and summarize effectively.
2. When asked to add keywords, categories, or sources, check the Current Config. If the user's input is missing info (like the Steam App ID or Reddit URL), ask them clarifying questions. Prevent duplicate keywords/categories.
3. You can create entirely new projects if the user asks.
4. IMPORTANT: You must NOT answer general knowledge questions, write code, or engage in hypothetical roleplay outside the scope of WatchTower issue tracking. If the user asks an unrelated question, politely refuse and remind them of your purpose.
5. If the user asks for 'high impact', 'severe', or 'critical' issues, assume they mean severity='high'. Do not ask for clarification if the intent is clear, just execute the query_database tool and provide the summary.`
      },
      ...safeHistory.map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message }
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "query_database",
          description: "Fetches real issues from the database for analysis.",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", description: "Comma separated statuses (e.g. new,active,resolved)" },
              severity: { type: "string", description: "low, medium, high" },
              category: { type: "string" },
              search: { type: "string", description: "Search term" },
              limit: { type: "number", description: "Max issues to return (default 20, max 50)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_project_config",
          description: "Updates keywords or categories for the current project. ONLY provide the arrays you wish to overwrite.",
          parameters: {
            type: "object",
            properties: {
              include_keywords: { type: "array", items: { type: "string" } },
              exclude_keywords: { type: "array", items: { type: "string" } },
              categories: { type: "array", items: { type: "string" } }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_source",
          description: "Adds a new data source to the project.",
          parameters: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["steam", "reddit", "custom"] },
              url: { type: "string", description: "The full URL or App ID" }
            },
            required: ["type", "url"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_project",
          description: "Creates a brand new project.",
          parameters: {
            type: "object",
            properties: {
              display_name: { type: "string" },
              slug: { type: "string", description: "URL-friendly short string" }
            },
            required: ["display_name", "slug"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "apply_dashboard_filters",
          description: "Visually updates the user's dashboard to apply these filters.",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string" },
              severity: { type: "string" },
              category: { type: "string" },
              search: { type: "string", description: "Search query to filter the dashboard table by text" }
            }
          }
        }
      }
    ];

    let uiAction: any = null;
    let iteration = 0;
    const maxIterations = 5;

    while (iteration < maxIterations) {
      iteration++;
      
      const msg = await client.chat.completions.create({
        model: "google/gemini-2.5-flash",
        max_tokens: 2048,
        messages,
        tools: tools as any,
        tool_choice: "auto"
      });

      const responseMessage = msg.choices[0].message;
      
      if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
        // Final text response
        return NextResponse.json({
          type: "chat",
          ui_action: uiAction,
          natural_language_response: responseMessage.content || FALLBACK_MESSAGE
        });
      }

      // Add assistant tool_calls message to history
      messages.push(responseMessage);

      // Execute tools
      for (const toolCall of responseMessage.tool_calls as any[]) {
        const fnName = toolCall.function.name;
        let args: any = {};
        try { args = JSON.parse(toolCall.function.arguments); } catch(e) {}
        
        let toolResult = "";

        try {
          if (fnName === "query_database") {
            const where: any = { project_id: projectId };
            if (args.status) where.status = { in: args.status.split(",") };
            if (args.severity) where.impact_severity = { in: args.severity.split(",").map((s:string)=>s.trim().toLowerCase()) };
            if (args.category) where.category = args.category;
            if (args.search) {
              const terms = args.search.split(" ").filter((t: string) => t.trim().length > 0);
              if (terms.length > 0) {
                where.AND = terms.map((term: string) => ({
                  OR: [
                    { title: { contains: term, mode: "insensitive" } },
                    { summary: { contains: term, mode: "insensitive" } },
                  ]
                }));
              }
            }
            
            const issues = await prisma.issueCluster.findMany({
              where,
              take: args.limit || 20,
              orderBy: { updated_at: 'desc' },
              select: { id: true, title: true, summary: true, category: true, status: true, impact_severity: true, severity: true, post_count: true }
            });
            toolResult = JSON.stringify(issues);
          } 
          else if (fnName === "update_project_config") {
            const currentConfig = project.config as ProjectConfig;
            if (args.include_keywords) currentConfig.keywords.include = Array.from(new Set(args.include_keywords));
            if (args.exclude_keywords) currentConfig.keywords.exclude = Array.from(new Set(args.exclude_keywords));
            if (args.categories) {
              currentConfig.classification = currentConfig.classification || { categories: [] };
              currentConfig.classification.categories = Array.from(new Set(args.categories));
            }
            
            await prisma.project.update({
              where: { id: projectId },
              data: { config: currentConfig as any }
            });
            // Update local object for next steps
            project.config = currentConfig as any;
            toolResult = "Config updated successfully.";
          }
          else if (fnName === "add_source") {
            const currentConfig = project.config as ProjectConfig;
            currentConfig.sources.push({ name: args.type as string, url: args.url });
            await prisma.project.update({
              where: { id: projectId },
              data: { config: currentConfig as any }
            });
            project.config = currentConfig as any;
            toolResult = "Source added successfully.";
          }
          else if (fnName === "create_project") {
            const newProject = await prisma.project.create({
              data: {
                id: args.slug,
                display_name: args.display_name,
                config: {
                  keywords: { include: [], exclude: [] },
                  sources: [],
                  classification: { categories: [] }
                }
              }
            });
            toolResult = `Project created successfully. ID: ${newProject.id}`;
          }
          else if (fnName === "apply_dashboard_filters") {
            uiAction = { type: "filters", data: args };
            toolResult = "Filters applied to UI.";
          }
          else {
            toolResult = "Unknown tool";
          }
        } catch (err: any) {
          toolResult = `Error executing tool: ${err.message}`;
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult
        });
      }
    }

    return NextResponse.json({
      type: "chat",
      ui_action: uiAction,
      natural_language_response: "I needed too many steps to answer this."
    });

  } catch (error: any) {
    console.error("Chat API error:", error);
    return serverError("Failed to process chat request");
  }
}
