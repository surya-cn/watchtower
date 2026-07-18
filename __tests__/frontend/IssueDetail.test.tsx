// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import IssueDetailSlideOver from "../../src/components/IssueDetailSlideOver";
import { apiClient } from "../../src/lib/apiClient";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../src/lib/apiClient", () => ({
  apiClient: vi.fn(),
}));

const mockIssue = {
  id: "issue-1",
  title: "Wallhack report",
  summary: "Detailed summary",
  category: "wallhack",
  severity: "high",
  status: "active",
  created_at: new Date().toISOString(),
  last_reported_at: new Date().toISOString(),
  raw_posts: [],
  status_history: [],
};

describe("IssueDetail Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls PATCH /api/issues/:id/status with correct payload when submitting form", async () => {
    (apiClient as any).mockImplementation((url: string) => {
      if (url.includes("/lifecycle")) return Promise.resolve({ post_counts_by_date: [], status_events: [] });
      if (url.endsWith("/status")) return Promise.resolve({});
      return Promise.resolve(mockIssue);
    });

    const onUpdateMock = vi.fn();

    render(
      <IssueDetailSlideOver
        issueId="issue-1"
        projectId="test-project"
        onClose={vi.fn()}
        onUpdate={onUpdateMock}
      />
    );

    // Wait for the detail to load
    await waitFor(() => {
      expect(screen.getByText("Wallhack report")).toBeDefined();
    });

    // Change status
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "escalated" } });

    // Add note
    const noteInput = screen.getByPlaceholderText("Why is this status changing?");
    fireEvent.change(noteInput, { target: { value: "Needs immediate review" } });

    // Submit
    const submitBtn = screen.getByRole("button", { name: "Update Status" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient).toHaveBeenCalledWith(
        "/api/issues/issue-1/status",
        "test-project",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "escalated", note: "Needs immediate review" })
        })
      );
      expect(onUpdateMock).toHaveBeenCalled();
    });
  });
});
