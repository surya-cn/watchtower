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
  Legend,
} from "recharts";
import styles from "./TrendChart.module.css";

type TrendDataPoint = {
  date: string;
  category: string;
  count: number;
};

type TrendResponse = {
  range: string;
  series: TrendDataPoint[];
};

export default function TrendChart({ projectId }: { projectId: string }) {
  const [data, setData] = useState<TrendResponse | null>(null);
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetch(`/api/metrics/trend?range=${range}`, {
      headers: { "X-Project-Id": projectId },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load trend data");
        return res.json();
      })
      .then((json: TrendResponse) => {
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
  }, [range, projectId]);

  const { chartData, categories } = useMemo(() => {
    if (!data) return { chartData: [], categories: [] };
    
    const byDate: Record<string, Record<string, number>> = {};
    const catSet = new Set<string>();

    data.series.forEach((pt) => {
      if (!byDate[pt.date]) {
        byDate[pt.date] = { date: pt.date as unknown as number }; // hack to satisfy recharts types if needed, wait we can just build array
      }
      (byDate[pt.date] as any)[pt.category] = pt.count;
      catSet.add(pt.category);
    });

    // Ensure all dates have all categories (default 0)
    const sortedDates = Object.keys(byDate).sort();
    const result = sortedDates.map(date => {
      const row: any = { date };
      catSet.forEach(cat => {
        row[cat] = (byDate[date] as any)[cat] || 0;
      });
      return row;
    });

    return { chartData: result, categories: Array.from(catSet) };
  }, [data]);

  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#413ea0", "#f44336", "#00bcd4"];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Issue Volume by Category</h3>
        <div className={styles.controls}>
          <button className={range === "7d" ? styles.active : ""} onClick={() => setRange("7d")}>7d</button>
          <button className={range === "30d" ? styles.active : ""} onClick={() => setRange("30d")}>30d</button>
          <button className={range === "90d" ? styles.active : ""} onClick={() => setRange("90d")}>90d</button>
        </div>
      </div>
      
      <div className={styles.chartWrapper}>
        {loading ? (
          <div className={styles.loading}>Loading chart data...</div>
        ) : chartData.length === 0 ? (
          <div className={styles.empty}>No data for this time range</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                {categories.map((cat, i) => (
                  <linearGradient key={cat} id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
              <XAxis dataKey="date" stroke="#888" tick={{ fill: "#888", fontSize: 12 }} />
              <YAxis stroke="#888" tick={{ fill: "#888", fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f8fafc" }}
                itemStyle={{ color: "#f8fafc" }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} />
              {categories.map((cat, i) => (
                <Area 
                  key={cat}
                  type="monotone" 
                  dataKey={cat} 
                  stackId="1" 
                  stroke={colors[i % colors.length]} 
                  fill={`url(#color${i})`} 
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
