import React from "react";
import styles from "./MetricCardsRow.module.css";

export type MetricData = {
  open_issues: number;
  posts_last_7d: number;
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

  const totalIssuesCount = metrics.open_issues; // If this is 0 and no breakdown, could mean entirely empty
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
        <div className={styles.card}>
          <span className={styles.label}>Open Issues</span>
          <span className={styles.value}>{metrics.open_issues}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.label}>Posts (Last 7d)</span>
          <span className={styles.value}>{metrics.posts_last_7d}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.label}>New Today</span>
          <span className={styles.value}>{metrics.new_today}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.label}>Escalated</span>
          <span className={styles.value}>{metrics.escalated_count}</span>
        </div>
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
