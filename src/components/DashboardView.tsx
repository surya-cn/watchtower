"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "../lib/apiClient";
import MetricCardsRow, { MetricData } from "./MetricCardsRow";
import IssuesTable from "./IssuesTable";
import TrendChart from "./TrendChart";
import AIChatBar from "./AIChatBar";

export default function DashboardView() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  const [metrics, setMetrics] = useState<MetricData | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    
    let isMounted = true;
    setLoadingMetrics(true);
    setMetrics(null); // Clear previous metrics
    setSelectedIssueId(null); // Clear chat selected issue

    async function fetchMetrics() {
      try {
        const data = await apiClient<MetricData>("/api/metrics/summary", projectId!);
        if (isMounted) {
          setMetrics(data);
        }
      } catch (err) {
        console.error("Failed to fetch metrics", err);
      } finally {
        if (isMounted) setLoadingMetrics(false);
      }
    }

    fetchMetrics();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const categories = metrics?.category_breakdown.map(b => b.category) || [];
  const hasZeroIssuesEver = metrics?.open_issues_count === 0 && metrics?.category_breakdown.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {projectId ? (
        <div style={{ padding: "1.5rem" }}>
          <AIChatBar projectId={projectId} onOpenIssue={(id) => setSelectedIssueId(id)} />
          <MetricCardsRow metrics={metrics} loading={loadingMetrics} />
          {!hasZeroIssuesEver && !loadingMetrics && <TrendChart projectId={projectId} />}
          <IssuesTable 
            projectId={projectId} 
            availableCategories={categories}
            isCompletelyEmpty={hasZeroIssuesEver}
            parentLoading={loadingMetrics}
            selectedIssueId={selectedIssueId}
            setSelectedIssueId={setSelectedIssueId}
          />
        </div>
      ) : (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
          Please select a project to view the dashboard.
        </div>
      )}
    </div>
  );
}
