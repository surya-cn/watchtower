"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { apiClient } from "../lib/apiClient";
import styles from "./LifecycleChart.module.css";

type PostCount = {
  date: string;
  count: number;
};

type StatusEvent = {
  status: string;
  changed_at: string;
  note: string | null;
};

type LifecycleResponse = {
  post_counts_by_date: PostCount[];
  status_events: StatusEvent[];
};

export default function LifecycleChart({ clusterId, projectId }: { clusterId: string; projectId: string }) {
  const [data, setData] = useState<LifecycleResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    apiClient<LifecycleResponse>(`/api/issues/${clusterId}/lifecycle`, projectId)
      .then((json) => {
        if (active) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [clusterId, projectId]);

  const hasClosureHistory = useMemo(() => {
    if (!data) return false;
    // Check if there's any status history beyond just "new" or if there's any closure status
    return data.status_events.some(e => 
      e.status === "fixed" || 
      e.status === "resolved" || 
      e.status === "closed_false_positive"
    );
  }, [data]);

  if (loading) {
    return <div className={styles.loading}>Loading lifecycle data...</div>;
  }

  if (!data || !hasClosureHistory) {
    // Requirements state: only render if it has at least one closure event
    // Otherwise return nothing or a clear fallback
    return (
      <div className={styles.empty}>
        No closure lifecycle data available. (Issue has never been closed).
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Bug Lifecycle (Post Volume)</h3>
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data.post_counts_by_date} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
            <XAxis dataKey="date" stroke="#888" tick={{ fill: "#888", fontSize: 12 }} />
            <YAxis stroke="#888" tick={{ fill: "#888", fontSize: 12 }} />
            <Tooltip 
              contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f8fafc" }}
              itemStyle={{ color: "#f8fafc" }}
            />
            <Area type="monotone" dataKey="count" stroke="#8884d8" fillOpacity={1} fill="url(#colorCount)" />
            {data.status_events.map((event, idx) => {
              const eventDate = new Date(event.changed_at).toISOString().split("T")[0];
              // Only mark closure events and reopening events to not clutter
              const isClosure = ["fixed", "resolved", "closed_false_positive"].includes(event.status);
              const color = isClosure ? "#4ade80" : "#f87171";
              
              // Verify the eventDate exists in data to attach line properly, but recharts ReferenceLine works anywhere
              return (
                <ReferenceLine 
                  key={idx}
                  x={eventDate} 
                  stroke={color} 
                  strokeDasharray="3 3"
                  label={{ position: 'top', value: event.status, fill: color, fontSize: 10 }}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
