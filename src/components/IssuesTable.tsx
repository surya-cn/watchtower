"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./IssuesTable.module.css";
import { apiClient } from "../lib/apiClient";
import IssueDetailSlideOver from "./IssueDetailSlideOver";

interface Issue {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  post_count: number;
  last_reported_at: string;
  priority_score: number | null;
  recurrence_ratio: number | null;
}

interface IssuesResponse {
  data: Issue[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

interface Props {
  projectId: string;
  availableCategories: string[];
  isCompletelyEmpty: boolean;
  parentLoading: boolean;
  selectedIssueId: string | null;
  setSelectedIssueId: (id: string | null) => void;
}

export default function IssuesTable({ projectId, availableCategories, isCompletelyEmpty, parentLoading, selectedIssueId, setSelectedIssueId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<IssuesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    if (!projectId || isCompletelyEmpty) {
      setLoading(false);
      setData(null);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const urlParams = new URLSearchParams(searchParams.toString());
      if (!urlParams.has("page")) urlParams.set("page", "1");
      if (!urlParams.has("page_size")) urlParams.set("page_size", "10");

      const response = await apiClient<IssuesResponse>(`/api/issues?${urlParams.toString()}`, projectId);
      setData(response);
    } catch (err: any) {
      setError(err.message || "Failed to fetch issues");
    } finally {
      setLoading(false);
    }
  }, [projectId, searchParams, isCompletelyEmpty]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set("page", "1"); // reset to page 1
    router.push(`/?${newParams.toString()}`);
  };

  const clearFilters = () => {
    const newParams = new URLSearchParams();
    newParams.set("project", projectId);
    router.push(`/?${newParams.toString()}`);
  };

  const hasActiveFilters = Array.from(searchParams.keys()).some(
    k => !["project", "page", "page_size"].includes(k)
  );

  const renderBadge = (value: string, type: "severity" | "status") => {
    const isClosed = type === "status" && ["fixed", "closed_false_positive", "resolved"].includes(value);
    const className = `${styles.badge} ${isClosed ? styles.strikethrough : ""}`;
    return (
      <span
        className={className}
        style={{
          backgroundColor: `var(--${type}-${value}-bg, rgba(255,255,255,0.1))`,
          color: `var(--${type}-${value}, var(--text-main))`,
          border: `1px solid var(--${type}-${value})`,
        }}
      >
        {(value || "").replace(/_/g, " ")}
      </span>
    );
  };

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("page", newPage.toString());
    router.push(`/?${newParams.toString()}`);
  };

  if (isCompletelyEmpty) return null; // Metric cards row already handles this

  return (
    <div className={styles.container}>
      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Search</span>
          <input
            className={styles.filterInput}
            type="text"
            placeholder="Search titles..."
            value={searchParams.get("search") || ""}
            onChange={(e) => updateFilter("search", e.target.value)}
          />
        </div>
        
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Status</span>
          <select 
            className={styles.filterSelect}
            value={searchParams.get("status") || ""}
            onChange={(e) => updateFilter("status", e.target.value)}
          >
            <option value="">All</option>
            <option value="new">New</option>
            <option value="active">Active</option>
            <option value="escalated">Escalated</option>
            <option value="fixed">Fixed</option>
            <option value="closed_false_positive">Closed (False Positive)</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Severity</span>
          <select 
            className={styles.filterSelect}
            value={searchParams.get("severity") || ""}
            onChange={(e) => updateFilter("severity", e.target.value)}
          >
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Category</span>
          <select 
            className={styles.filterSelect}
            value={searchParams.get("category") || ""}
            onChange={(e) => updateFilter("category", e.target.value)}
          >
            <option value="">All</option>
            {availableCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Sort</span>
          <select 
            className={styles.filterSelect}
            value={searchParams.get("sort") || ""}
            onChange={(e) => updateFilter("sort", e.target.value)}
          >
            <option value="">Default (Last Reported)</option>
            <option value="last_reported_desc">Last Reported (Newest first)</option>
            <option value="post_count_desc">Post Count (Highest first)</option>
            <option value="severity_desc">Severity (High first)</option>
            <option value="priority_score_desc">Priority (Highest first)</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button className={styles.clearBtn} onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table Content */}
      <div className={styles.tableWrapper}>
        {(loading || parentLoading) ? (
          <div className={styles.emptyState}>
             <div className="skeleton" style={{ height: "400px", width: "100%" }} />
          </div>
        ) : error ? (
          <div className={styles.emptyState} style={{ color: "var(--severity-high)" }}>
            Error: {error}
          </div>
        ) : data?.data.length === 0 ? (
          <div className={styles.emptyState}>
            No issues match your current filters.
            {hasActiveFilters && (
              <div style={{ marginTop: 'var(--spacing-sm)' }}>
                <button className={styles.clearBtn} onClick={clearFilters}>Clear filters</button>
              </div>
            )}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Sl No</th>
                <th>Issue Title</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Post Count</th>
                <th>Score</th>
                <th>Last Reported</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((issue, index) => {
                const currentPage = data.pagination.page;
                const pageSize = data.pagination.page_size;
                const slNo = (currentPage - 1) * pageSize + index + 1;
                
                return (
                  <tr key={issue.id}>
                    <td>{slNo}</td>
                    <td style={{ maxWidth: "300px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={issue.title}>
                      {issue.title}
                    </td>
                    <td>{issue.category}</td>
                    <td>{renderBadge(issue.severity, "severity")}</td>
                    <td>{renderBadge(issue.status, "status")}</td>
                    <td>{issue.post_count}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600 }}>{issue.priority_score?.toFixed(1) || "-"}</span>
                        {typeof issue.recurrence_ratio === 'number' && (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }} title="Recurrence Ratio (After/Before)">
                            {issue.recurrence_ratio.toFixed(2)}x
                          </span>
                        )}
                      </div>
                    </td>
                    <td title={new Date(issue.last_reported_at).toLocaleString()}>
                      {relativeTime(issue.last_reported_at)}
                    </td>
                    <td>
                      <button 
                        className={styles.actionBtn}
                        onClick={() => setSelectedIssueId(issue.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.total_pages > 0 && !(loading || parentLoading) && (
        <div className={styles.pagination}>
          <span>Showing {data.data.length} of {data.pagination.total_count} issues</span>
          <div className={styles.pageControls}>
            <button 
              className={styles.pageBtn}
              disabled={data.pagination.page <= 1}
              onClick={() => handlePageChange(data.pagination.page - 1)}
            >
              Previous
            </button>
            <span>Page {data.pagination.page} of {data.pagination.total_pages}</span>
            <button 
              className={styles.pageBtn}
              disabled={data.pagination.page >= data.pagination.total_pages}
              onClick={() => handlePageChange(data.pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selectedIssueId && (
        <IssueDetailSlideOver 
          issueId={selectedIssueId} 
          projectId={projectId}
          onClose={() => setSelectedIssueId(null)}
          onUpdate={() => fetchIssues()}
        />
      )}
    </div>
  );
}
