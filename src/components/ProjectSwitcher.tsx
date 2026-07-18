"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./ProjectSwitcher.module.css";
import { apiClient } from "../lib/apiClient";

export default function ProjectSwitcher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentProject = searchParams.get("project") || "";
  
  const [projects, setProjects] = useState<{ id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.user?.role === "admin");
        }
      } catch (err) {
        console.error("Failed to fetch user", err);
      }
    }
    fetchUser();
  }, []);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const data = await apiClient<{ id: string }[]>("/api/projects", "");
        setProjects(data || []);
        
        // If no project is selected but we have projects, auto-select the first one
        if (!currentProject && data && data.length > 0) {
          router.replace(`/?project=${data[0].id}`);
        }
      } catch (err) {
        console.error("Failed to fetch projects", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, [currentProject, router]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProject = e.target.value;
    if (newProject) {
      // Clear all active filters and reset to page 1 to prevent stale data flashes
      router.push(`/?project=${newProject}`);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className={styles.container}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span className={styles.label}>Project</span>
        {loading ? (
          <div className={`skeleton ${styles.select}`} style={{ border: 'none' }} />
        ) : (
          <select
            className={styles.select}
            value={currentProject}
            onChange={handleChange}
          >
            <option value="" disabled>Select a project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        )}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: "15px", alignItems: "center" }}>
        {isAdmin && (
          <>
            <button
              onClick={() => router.push("/settings/new")}
              style={{ background: "transparent", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}
            >
              + Add Project
            </button>
            {currentProject && (
              <button
                onClick={() => router.push(`/settings/${currentProject}/edit`)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                title="Settings"
              >
                ⚙️ Settings
              </button>
            )}
          </>
        )}
        <button
          onClick={handleLogout}
          style={{ background: "transparent", border: "1px solid var(--border-color)", padding: "4px 10px", borderRadius: "4px", color: "var(--text-main)", cursor: "pointer" }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
