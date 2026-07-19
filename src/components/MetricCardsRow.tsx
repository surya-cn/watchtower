import React from "react";
import styles from "./MetricCardsRow.module.css";
import SpotlightCard from "@/components/SpotlightCard/SpotlightCard";

export type MetricData = {
  open_issues_count: number;
  posts_last_7_days: number;
  new_today: number;
  escalated_count: number;
  category_breakdown: { category: string; count: number }[];
};

interface Props {
  metrics: MetricData | null;
  loading: boolean;
}

export default function MetricCardsRow({ metrics, loading }: Props) {
  if (loading) {
    return (
      <div className={styles.container}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`skeleton ${styles.card}`} style={{ height: "100px" }} />
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const totalIssuesCount = metrics.open_issues_count; // If this is 0 and no breakdown, could mean entirely empty
  const isEmpty = totalIssuesCount === 0 && metrics.category_breakdown.length === 0;

  if (isEmpty) {
    return (
      <div className={styles.emptyState}>
        <h3>No Data Yet</h3>
        <p>This project has zero issues.</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.container}>
        <SpotlightCard className={styles.card} spotlightColor="rgba(99, 140, 255, 0.15)">
          <div className={styles.badge} style={{ background: "rgba(255, 107, 107, 0.15)", color: "#FF6B6B" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
          </div>
          <span className={styles.label}>Open Issues</span>
          <span className={styles.value}>{metrics.open_issues_count}</span>
        </SpotlightCard>
        
        <SpotlightCard className={styles.card} spotlightColor="rgba(99, 140, 255, 0.15)">
          <div className={styles.badge} style={{ background: "rgba(76, 111, 255, 0.15)", color: "#4C6FFF" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <span className={styles.label}>Posts (Last 7d)</span>
          <span className={styles.value}>{metrics.posts_last_7_days}</span>
        </SpotlightCard>
        
        <SpotlightCard className={styles.card} spotlightColor="rgba(99, 140, 255, 0.15)">
          <div className={styles.badge} style={{ background: "rgba(51, 154, 240, 0.15)", color: "#339AF0" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <span className={styles.label}>New Today</span>
          <span className={styles.value}>{metrics.new_today}</span>
        </SpotlightCard>
        
        <SpotlightCard className={styles.card} spotlightColor="rgba(99, 140, 255, 0.15)">
          <div className={styles.badge} style={{ background: "rgba(255, 169, 77, 0.15)", color: "#FFA94D" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
          </div>
          <span className={styles.label}>Escalated</span>
          <span className={styles.value}>{metrics.escalated_count}</span>
        </SpotlightCard>
      </div>
      
      {metrics.category_breakdown.length > 0 && (
        <div className={styles.card} style={{ marginBottom: '1.5rem', flexDirection: 'row', alignItems: 'center' }}>
          <span className={styles.label} style={{ margin: 0 }}>Category Breakdown:</span>
          <div className={styles.breakdown} style={{ marginTop: 0 }}>
            {metrics.category_breakdown.map((b) => (
              <div key={b.category} className={styles.breakdownItem}>
                {b.category}: <strong>{b.count}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
