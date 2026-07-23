"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import styles from "./IssuesTable.module.css";
import Button from '@/components/Button/Button';
import SimilarPostsSlideOver from "./SimilarPostsSlideOver";
import { apiClient } from "../lib/apiClient";

interface Issue {
  id: string;
  title: string;
  category: string;
  severity: string;
  impact_severity: string;
  status: string;
  post_count: number;
  last_reported_at: string;
  priority_score: number | null;
  recurrence_ratio: number | null;
  latest_post: {
    id: string;
    content: string;
    url: string;
    author: string | null;
    source: string;
    posted_at: string;
  } | null;
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
  refreshTrigger?: number;
}

export default function IssuesTable({ projectId, availableCategories, isCompletelyEmpty, parentLoading, selectedIssueId, setSelectedIssueId, refreshTrigger }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [data, setData] = useState<IssuesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [similarIssueId, setSimilarIssueId] = useState<string | null>(null);

  const urlSearch = searchParams.get("search") || "";
  const [searchQuery, setSearchQuery] = useState(urlSearch);

  useEffect(() => {
    setSearchQuery(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== urlSearch) {
        const newParams = new URLSearchParams(searchParams.toString());
        if (searchQuery) {
          newParams.set("search", searchQuery);
        } else {
          newParams.delete("search");
        }
        newParams.set("page", "1");
        router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, urlSearch, searchParams, router]);

  const fetchIssues = useCallback(async (silent = false) => {
    if (!projectId || isCompletelyEmpty) {
      if (!silent) setLoading(false);
      if (!silent) setData(null);
      return;
    }
    
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }, [projectId, searchParams, isCompletelyEmpty]);

  useEffect(() => {
    fetchIssues(false);
  }, [fetchIssues]);

  const prevRefreshTrigger = useRef(refreshTrigger || 0);
  useEffect(() => {
    if (refreshTrigger && refreshTrigger !== prevRefreshTrigger.current) {
      prevRefreshTrigger.current = refreshTrigger;
      fetchIssues(true);
    }
  }, [refreshTrigger, fetchIssues]);

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set("page", "1"); // reset to page 1
    router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    const newParams = new URLSearchParams();
    newParams.set("project", projectId);
    router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
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
    router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
          <span className={styles.filterLabel}>Volume Severity</span>
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
          <span className={styles.filterLabel}>Impact Severity</span>
          <select 
            className={styles.filterSelect}
            value={searchParams.get("impact_severity") || ""}
            onChange={(e) => updateFilter("impact_severity", e.target.value)}
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
            <option value="severity_desc">Volume Severity (High first)</option>
            <option value="impact_severity_desc">Impact Severity (High first)</option>
            <option value="priority_score_desc">Priority (Highest first)</option>
          </select>
        </div>

        {hasActiveFilters && (
          <Button size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
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
                <th>Vol. Severity</th>
                <th>Imp. Severity</th>
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
                    <td style={{ maxWidth: "300px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={issue.latest_post?.content || issue.title}>
                      {issue.latest_post ? (
                        <a href={issue.latest_post.url} target="_blank" rel="noreferrer" style={{ color: "var(--text-main)", textDecoration: "underline" }}>
                          {issue.latest_post.content}
                        </a>
                      ) : (
                        issue.title
                      )}
                    </td>
                    <td>{issue.category}</td>
                    <td>{renderBadge(issue.severity, "severity")}</td>
                    <td>{renderBadge(issue.impact_severity, "severity")}</td>
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
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => setSelectedIssueId(issue.id)}
                        >
                          View
                        </button>
                        {issue.post_count > 1 && (
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnSimilar}`}
                            onClick={() => setSimilarIssueId(issue.id)}
                          >
                            Similar ({issue.post_count - 1})
                          </button>
                        )}
                      </div>
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
            <Button disabled={data.pagination.page <= 1} size="sm" onClick={() => handlePageChange(data.pagination.page - 1)}
            >
              Previous
            </Button>
            <span>Page {data.pagination.page} of {data.pagination.total_pages}</span>
            <Button disabled={data.pagination.page>= data.pagination.total_pages}
              size="sm"
              
              
              
              
              
              
              
              
              onClick={() => handlePageChange(data.pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {similarIssueId && (
        <SimilarPostsSlideOver
          projectId={projectId}
          issueId={similarIssueId}
          onClose={() => setSimilarIssueId(null)}
        />
      )}
    </div>
  );
}
