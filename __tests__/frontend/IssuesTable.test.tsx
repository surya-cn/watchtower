// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import IssuesTable from "../../src/components/IssuesTable";
import { apiClient } from "../../src/lib/apiClient";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useRouter, useSearchParams } from "next/navigation";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock apiClient
vi.mock("../../src/lib/apiClient", () => ({
  apiClient: vi.fn(),
}));

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

const mockData = {
  data: [
    {
      id: "issue-1",
      title: "Wallhack report",
      category: "wallhack",
      severity: "high",
      status: "active",
      post_count: 5,
      last_reported_at: new Date().toISOString(),
      priority_score: null,
    },
  ],
  pagination: {
    page: 1,
    page_size: 10,
    total_count: 1,
    total_pages: 1,
  },
};

describe("IssuesTable Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: mockPush });
    (useSearchParams as any).mockReturnValue(mockSearchParams);
  });

  it("renders correctly with API response shape", async () => {
    (apiClient as any).mockResolvedValueOnce(mockData);

    render(
      <IssuesTable
        projectId="test-project"
        availableCategories={["wallhack", "aimbot"]}
        isCompletelyEmpty={false}
        parentLoading={false}
      />
    );

    // Wait for fetch to complete and table to render
    await waitFor(() => {
      expect(screen.getByText("Issue Title")).toBeDefined();
      expect(screen.getByText("Wallhack report")).toBeDefined();
    });
  });

  it("resets to page 1 on filter change", async () => {
    (apiClient as any).mockResolvedValueOnce(mockData);

    render(
      <IssuesTable
        projectId="test-project"
        availableCategories={["wallhack", "aimbot"]}
        isCompletelyEmpty={false}
        parentLoading={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Wallhack report")).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText("Search titles...");
    fireEvent.change(searchInput, { target: { value: "test" } });

    // Expect push to have been called with search=test and page=1
    expect(mockPush).toHaveBeenCalledWith("/?search=test&page=1");
  });

  it("calls API with correct page param when pagination clicked", async () => {
    const pagedData = {
      ...mockData,
      pagination: {
        page: 2,
        page_size: 10,
        total_count: 20,
        total_pages: 2,
      },
    };
    (apiClient as any).mockResolvedValueOnce(pagedData);

    render(
      <IssuesTable
        projectId="test-project"
        availableCategories={["wallhack"]}
        isCompletelyEmpty={false}
        parentLoading={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Showing 1 of 20 issues")).toBeDefined();
    });

    const prevBtn = screen.getByText("Previous");
    fireEvent.click(prevBtn);

    expect(mockPush).toHaveBeenCalledWith("/?page=1");
  });
});
