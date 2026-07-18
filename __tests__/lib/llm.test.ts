import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { classifyAndMatchPost, client } from "../../src/lib/llm";

describe("llm.ts", () => {
  beforeEach(() => {
    vi.spyOn(client.chat.completions, "create");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should correctly parse and return data when given a valid classify_and_match tool call", async () => {
    vi.mocked(client.chat.completions.create).mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                type: "function",
                function: {
                  name: "classify_and_match",
                  arguments: JSON.stringify({
                    category: "bug",
                    matched_cluster_id: "cluster-123",
                    is_new_issue: false,
                    suggested_title: null,
                  }),
                },
              },
            ],
          },
        },
      ],
    } as any);

    const result = await classifyAndMatchPost("Test post", ["bug"], []);
    
    expect(result).toEqual({
      category: "bug",
      matched_cluster_id: "cluster-123",
      is_new_issue: false,
      suggested_title: null,
    });
  });

  it("should ignore reasoning content and extract only tool_calls for reasoning models like Nemotron", async () => {
    vi.mocked(client.chat.completions.create).mockResolvedValue({
      choices: [
        {
          message: {
            content: "Here is my thinking: I see the user is reporting a bug. Let me check the clusters. I should match it to an existing one.",
            tool_calls: [
              {
                type: "function",
                function: {
                  name: "classify_and_match",
                  arguments: JSON.stringify({
                    category: "crash",
                    matched_cluster_id: null,
                    is_new_issue: true,
                    suggested_title: "Client Crash on Startup",
                  }),
                },
              },
            ],
          },
        },
      ],
    } as any);

    const result = await classifyAndMatchPost("Test post", ["crash"], []);
    
    expect(result).toEqual({
      category: "crash",
      matched_cluster_id: null,
      is_new_issue: true,
      suggested_title: "Client Crash on Startup",
    });
  });
});
