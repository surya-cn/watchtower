"use client";

import React, { useEffect, useState } from "react";
import styles from "./IssueDetailSlideOver.module.css";
import { apiClient } from "../lib/apiClient";
import SpecularButton from "./SpecularButton/SpecularButton";

interface RawPost {
  id: string;
  content: string;
  url: string;
  author: string | null;
  source: string;
  posted_at: string;
}

interface Props {
  projectId: string;
  issueId: string;
  onClose: () => void;
}

export default function SimilarPostsSlideOver({ projectId, issueId, onClose }: Props) {
  const [posts, setPosts] = useState<RawPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchSimilarPosts = async () => {
      setLoading(true);
      try {
        const response = await apiClient<RawPost[]>(`/api/issues/${issueId}/similar`, projectId);
        if (isMounted) {
          setPosts(response);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to load similar posts");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchSimilarPosts();
    return () => { isMounted = false; };
  }, [projectId, issueId]);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.slideOver}>
        <div className={styles.header}>
          <h2>Similar Posts</h2>
          <SpecularButton
            size="sm"
            radius={8}
            tint="#ffffff"
            tintOpacity={0.1}
            lineColor="#555"
            baseColor="#222"
            intensity={1}
            followMouse
            onClick={onClose}
          >
            Close
          </SpecularButton>
        </div>
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Loading posts...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : posts.length === 0 ? (
            <div className={styles.empty}>No similar posts found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {posts.map((post) => (
                <div key={post.id} style={{ 
                  padding: "16px", 
                  backgroundColor: "rgba(255,255,255,0.03)", 
                  border: "1px solid rgba(255,255,255,0.1)", 
                  borderRadius: "8px" 
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    <span style={{ textTransform: "capitalize", fontWeight: "bold", color: "var(--text-main)" }}>{post.source}</span>
                    <span>{new Date(post.posted_at).toLocaleString()}</span>
                  </div>
                  {post.author && (
                    <div style={{ fontSize: "0.85rem", marginBottom: "8px" }}>
                      Author: <span style={{ color: "var(--text-main)" }}>{post.author}</span>
                    </div>
                  )}
                  <p style={{ margin: "0 0 12px 0", fontSize: "0.95rem", lineHeight: "1.4", wordBreak: "break-word", color: "var(--text-main)" }}>
                    {post.content}
                  </p>
                  <a 
                    href={post.url} 
                    target="_blank" 
                    rel="noreferrer" 
                    style={{ 
                      display: "inline-block", 
                      fontSize: "0.85rem", 
                      color: "var(--primary-color, #4C6FFF)", 
                      textDecoration: "underline" 
                    }}
                  >
                    View Original Post ↗
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
