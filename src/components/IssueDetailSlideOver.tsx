"use client";

import React, { useEffect, useState, useCallback } from "react";
import styles from "./IssueDetailSlideOver.module.css";
import LifecycleChart from "./LifecycleChart";
import { apiClient } from "../lib/apiClient";
import tableStyles from "./IssuesTable.module.css";

interface RawPost {
  id: string;
  source: string;
  author: string;
  content: string;
  posted_at: string;
  url: string;
}

interface StatusHistory {
  id: string;
  status: string;
  note: string | null;
  changed_at: string;
}

interface IssueDetail {
  id: string;
  title: string;
  summary: string;
  category: string;
  severity: string;
  status: string;
  created_at: string;
  last_reported_at: string;
  raw_posts: RawPost[];
  status_history: StatusHistory[];
}

interface Props {
  issueId: string;
  projectId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function IssueDetailSlideOver({ issueId, projectId, onClose, onUpdate }: Props) {
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newStatus, setNewStatus] = useState<string>("");
  const [statusNote, setStatusNote] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<IssueDetail>(`/api/issues/${issueId}`, projectId);
      setIssue(data);
      setNewStatus(data.status);
    } catch (err: any) {
      setError(err.message || "Failed to load issue details");
    } finally {
      setLoading(false);
    }
  }, [issueId, projectId]);

  useEffect(() => {
    fetchDetail();
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [fetchDetail, onClose]);

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue || newStatus === issue.status) return;

    setUpdating(true);
    setUpdateMsg(null);

    try {
      await apiClient(`/api/issues/${issueId}/status`, projectId, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus, note: statusNote || undefined }),
      });
      
      setUpdateMsg({ type: "success", text: "Status updated successfully" });
      setStatusNote("");
      onUpdate(); // refresh parent table
      fetchDetail(); // refresh detail view
    } catch (err: any) {
      setUpdateMsg({ type: "error", text: err.message || "Failed to update status" });
    } finally {
      setUpdating(false);
    }
  };

  const renderBadge = (value: string, type: "severity" | "status") => {
    const isClosed = type === "status" && ["fixed", "closed_false_positive", "resolved"].includes(value);
    const className = `${tableStyles.badge} ${isClosed ? tableStyles.strikethrough : ""}`;
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

  return (
    <div className={styles.overlay} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>Issue Details</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        
        <div className={styles.content}>
          {loading ? (
            <div className="skeleton" style={{ height: "100%", width: "100%" }} />
          ) : error || !issue ? (
            <div style={{ color: "var(--severity-high)" }}>{error || "Issue not found"}</div>
          ) : (
            <>
              <div className={styles.section}>
                <h3 style={{ marginBottom: "var(--spacing-sm)", fontSize: "1.25rem" }}>{issue.title}</h3>
                <p style={{ color: "var(--text-muted)", marginBottom: "var(--spacing-md)" }}>
                  {issue.summary}
                </p>

                <LifecycleChart clusterId={issue.id} projectId={projectId} />

                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Category</span>
                    <span>{issue.category}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Severity</span>
                    <div>{renderBadge(issue.severity, "severity")}</div>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Current Status</span>
                    <div>{renderBadge(issue.status, "status")}</div>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Last Reported</span>
                    <span>{new Date(issue.last_reported_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Update Status</h4>
                <form className={styles.statusForm} onSubmit={handleStatusUpdate}>
                  <div className={styles.inputGroup}>
                    <label>New Status</label>
                    <select 
                      value={newStatus} 
                      onChange={(e) => setNewStatus(e.target.value)}
                    >
                      <option value="new">New</option>
                      <option value="active">Active</option>
                      <option value="escalated">Escalated</option>
                      <option value="fixed">Fixed</option>
                      <option value="closed_false_positive">Closed (False Positive)</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Note (Optional)</label>
                    <textarea 
                      placeholder="Why is this status changing?"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                    />
                  </div>
                  
                  <div style={{ display: "flex", gap: "var(--spacing-md)", alignItems: "center" }}>
                    <button 
                      type="submit" 
                      className={styles.submitBtn}
                      disabled={updating || newStatus === issue.status}
                    >
                      {updating ? "Updating..." : "Update Status"}
                    </button>
                    {updateMsg && (
                      <span className={updateMsg.type === "success" ? styles.successMsg : styles.errorMsg}>
                        {updateMsg.text}
                      </span>
                    )}
                  </div>
                </form>
              </div>

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Status History</h4>
                {(!issue.status_history || issue.status_history.length === 0) ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No history available.</p>
                ) : (
                  <div>
                    {issue.status_history.map((h) => (
                      <div key={h.id} className={styles.historyItem}>
                        <div className={styles.historyHeader}>
                          {renderBadge(h.status, "status")}
                          <span className={styles.historyTime}>
                            {new Date(h.changed_at).toLocaleString()}
                          </span>
                        </div>
                        {h.note && (
                          <div className={styles.historyNote}>{h.note}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Raw Posts ({issue.raw_posts.length})</h4>
                {issue.raw_posts.map((post) => (
                  <div key={post.id} className={styles.postItem}>
                    <div className={styles.postHeader}>
                      <span><strong>{post.author}</strong> via {post.source}</span>
                      <span>
                        <a href={post.url} target="_blank" rel="noreferrer" title="View original post">
                          {new Date(post.posted_at).toLocaleString()} ↗
                        </a>
                      </span>
                    </div>
                    <div className={styles.postContent}>{post.content}</div>
                  </div>
                ))}
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}
