"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BlurText from "@/components/BlurText/BlurText";
import styles from "./SettingsList.module.css";
import { apiClient } from "@/lib/apiClient";

export default function SettingsListPage() {
  const [projects, setProjects] = useState<{ id: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const data = await apiClient<{ id: string }[]>("/api/projects", "");
        setProjects(data || []);
      } catch (err) {
        console.error("Failed to fetch projects", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        <BlurText text="Project Settings" delay={30} animateBy="words" direction="top" />
      </h1>
      
      {loading ? (
        <div className={styles.grid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={`skeleton ${styles.card}`} style={{ height: "100px" }} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No projects found.</p>
          <Link href="/settings/new" className={styles.actionBtn}>
            + Add Project
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map((p) => (
            <div key={p.id} className={styles.card}>
              <h3 className={styles.cardTitle}>{p.id}</h3>
              <Link href={`/settings/${p.id}/edit`} className={styles.editBtn}>
                Edit Configuration
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
