"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProjectConfig } from "@/lib/schemas";
import styles from "./ConfigForm.module.css";
import Button from '@/components/Button/Button';

type ConfigFormProps = {
  initialData?: {
    id: string;
    display_name: string;
    config: ProjectConfig;
  };
  isEditMode?: boolean;
};

function TagInput({
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  value: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
  error?: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = inputValue.trim().replace(/,$/, "");
      if (val && !value.includes(val)) {
        onChange([...value, val]);
        setInputValue("");
      }
    } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
      <label className={styles.label}>{label}</label>
      <div className={styles.tagContainer}>
        {value.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className={styles.tagRemove}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          type="text"
          className={styles.tagInput}
          placeholder={value.length === 0 ? placeholder : ""}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {error && <span className={styles.error}>{error}</span>}
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Press enter or comma to add</p>
    </div>
  );
}

const DEFAULT_CONFIG: ProjectConfig = {
  sources: [],
  keywords: { include: [], exclude: [] },
  classification: {
    categories: [],
    severity_thresholds: { high: 50, medium: 20 },
  },
  integrations: {
    bug_tracker: null,
    bug_tracker_project_key: null,
    webhook_url: null,
  },
  team_contacts: [],
};

export const generateSlug = (name: string, ids: Set<string>) => {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, "").toLowerCase())
    .filter((w) => w.length > 0);

  if (words.length === 0) return "";

  let baseLetters = "";
  if (words.length === 1) {
    baseLetters = words[0].substring(0, 4);
  } else {
    baseLetters = words[0].substring(0, 2) + words[1].substring(0, 2);
  }

  let counter = 1;
  let attempt = `${baseLetters}-${counter}`;
  while (ids.has(attempt)) {
    counter++;
    attempt = `${baseLetters}-${counter}`;
  }
  return attempt;
};

export default function ConfigForm({ initialData, isEditMode }: ConfigFormProps) {
  const router = useRouter();
  
  const [id, setId] = useState(initialData?.id || "");
  const [displayName, setDisplayName] = useState(initialData?.display_name || "");
  const [config, setConfig] = useState<ProjectConfig>(
    initialData?.config || DEFAULT_CONFIG
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditMode) {
      fetch("/api/projects")
        .then(res => res.json())
        .then(data => {
          if (data.projects) {
            setExistingIds(new Set(data.projects.map((p: any) => p.id)));
          }
        })
        .catch(console.error);
    }
  }, [isEditMode]);

  const updateConfig = (path: string[], value: any) => {
    setConfig((prev) => {
      const newConfig = JSON.parse(JSON.stringify(prev));
      let current = newConfig;
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newConfig;
    });
  };

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setDisplayName(name);
    if (!isEditMode) {
      setId(generateSlug(name, existingIds));
    }
  };

  // Re-run slug generation when existingIds load in case displayName is pre-filled
  useEffect(() => {
    if (!isEditMode && displayName) {
      setId(generateSlug(displayName, existingIds));
    }
  }, [existingIds, isEditMode]); // displayName omitted intentionally to prevent overwrites except on existingIds load


  const checkSlugCollision = async (baseSlug: string) => {
    // If our live client state check missed it somehow (e.g. race condition),
    // we double check against the live API right before POSTing.
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) return baseSlug;
      const data = await res.json();
      const ids = new Set(data.projects.map((p: any) => p.id));
      
      if (!ids.has(baseSlug)) return baseSlug;
      
      const parts = baseSlug.split('-');
      const baseLetters = parts.length > 1 && !isNaN(parseInt(parts[parts.length-1]))
        ? parts.slice(0, -1).join('-') 
        : baseSlug;

      let counter = 1;
      let attempt = `${baseLetters}-${counter}`;
      while (ids.has(attempt)) {
        counter++;
        attempt = `${baseLetters}-${counter}`;
      }
      return attempt;
    } catch {
      return baseSlug;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccess("");
    setLoading(true);

    const newErrors: Record<string, string> = {};
    if (!displayName.trim()) {
      newErrors["display_name"] = "Display Name is required.";
    }
    
    let baseSlug = id;
    if (!isEditMode) {
      baseSlug = generateSlug(displayName, existingIds);
      if (!baseSlug) {
        newErrors["display_name"] = "Display Name must contain at least some letters.";
      }
    }

    if (config.sources.length === 0) {
      newErrors["sources"] = "At least one source is required.";
    } else {
      const invalidSources = config.sources.filter(s => !s.name.trim() || !s.url.trim());
      if (invalidSources.length > 0) {
        newErrors["sources"] = "All sources must have a valid name and URL.";
      }
    }

    if (config.keywords.include.length === 0) {
      newErrors["config.keywords.include"] = "At least one include keyword is required.";
    }

    if (config.classification.categories.length === 0) {
      newErrors["config.classification.categories"] = "At least one category is required.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      let finalId = id;
      if (!isEditMode) {
        finalId = await checkSlugCollision(baseSlug);
        setId(finalId); // Update state for potential re-renders or errors
      }

      const url = isEditMode ? `/api/projects/${finalId}/config` : `/api/projects`;
      const method = isEditMode ? "PUT" : "POST";
      
      let submitConfig = { ...config };
      if (!isEditMode) {
        submitConfig.classification = {
          categories: config.classification.categories,
          severity_thresholds: { high: 50, medium: 20 },
        };
        submitConfig.integrations = {
          bug_tracker: null,
          bug_tracker_project_key: null,
          webhook_url: null,
        };
        submitConfig.team_contacts = [];
      }

      const body = isEditMode
        ? submitConfig
        : { id: finalId, display_name: displayName, config: submitConfig };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSuccess(isEditMode ? "Configuration saved. Syncing..." : "Project created. Syncing...");
        
        // Auto-sync after saving
        await handleSync(finalId);

        router.push(`/?project=${finalId}`);
        router.refresh();
      } else {
        const data = await res.json();
        if (data.details) {
          const newErrors: Record<string, string> = {};
          data.details.forEach((err: { path: string; message: string }) => {
            newErrors[err.path] = err.message;
          });
          setErrors(newErrors);
        } else {
          setErrors({ root: data.error || "Submission failed" });
        }
      }
    } catch (err) {
      setErrors({ root: "An unexpected error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== displayName && deleteConfirmText !== id) {
      return;
    }
    
    setIsDeleting(true);
    setErrors({});
    
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE"
      });
      
      if (res.ok) {
        // Fetch remaining projects to determine where to redirect
        try {
          const projsRes = await fetch('/api/projects');
          const projsData = await projsRes.json();
          const remainingProjects = projsData.data || [];
          const nextProject = remainingProjects.find((p: any) => p.id !== id);
          
          router.refresh(); // Force Next.js router cache reset
          
          if (nextProject) {
            router.push(`/?project=${nextProject.id}`);
          } else {
            router.push("/settings");
          }
        } catch (e) {
          router.refresh();
          router.push("/settings");
        }
      } else {
        const data = await res.json();
        setErrors({ root: data.error || "Failed to delete project" });
        setIsDeleting(false);
        setShowDeleteModal(false);
      }
    } catch (err) {
      setErrors({ root: "An unexpected error occurred during deletion" });
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleSync = async (projectIdToSync: string = id) => {
    if (!projectIdToSync) return;
    setIsSyncing(true);
    setSyncStatus("Syncing...");
    setErrors({});
    setSuccess("");

    try {
      const res = await fetch(`/api/projects/${projectIdToSync}/sync`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`Sync complete: ${data.ingest.postsInserted} new posts ingested, ${data.cluster.newClusters} new clusters created.`);
        setSyncStatus(null);
      } else {
        const data = await res.json();
        setErrors({ root: data.error || "Sync failed" });
        setSyncStatus(null);
      }
    } catch (err) {
      setErrors({ root: "An unexpected error occurred during sync" });
      setSyncStatus(null);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      
      {/* Project Meta */}
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Project Info</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>
          <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
            <label className={styles.label}>Display Name</label>
            <input
              type="text"
              required
              className={styles.input}
              value={displayName}
              onChange={handleDisplayNameChange}
            />
            {errors["display_name"] && <span className={styles.error}>{errors["display_name"]}</span>}
          </div>
          {isEditMode ? (
            <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
              <label className={styles.label}>Project ID (Slug)</label>
              <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-card)', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                {id}
              </div>
            </div>
          ) : (
            <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
              <label className={styles.label}>Project ID (Slug)</label>
              <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-card)', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                {id ? `Project ID: ${id}` : "Project ID: ..."}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Sources */}
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Sources</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
          Add any forum, subreddit, or community page with a URL. WatchTower will monitor it for relevant posts.
        </p>
        {errors["sources"] && <div className={styles.error} style={{ marginBottom: "1rem" }}>{errors["sources"]}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {config.sources.map((source, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '1rem', alignItems: 'end' }}>
              <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label}>Name</label>
                <input
                  type="text"
                  required
                  className={styles.input}
                  placeholder="e.g. Reddit r/Javelin"
                  value={source.name}
                  onChange={(e) => {
                    const newSources = [...config.sources];
                    newSources[index].name = e.target.value;
                    updateConfig(["sources"], newSources);
                  }}
                />
              </div>
              <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label}>URL</label>
                <input
                  type="url"
                  required
                  className={styles.input}
                  placeholder="https://..."
                  value={source.url}
                  onChange={(e) => {
                    const newSources = [...config.sources];
                    newSources[index].url = e.target.value;
                    updateConfig(["sources"], newSources);
                  }}
                />
              </div>
              <Button variant="danger" type="button" size="sm" onClick={() => {
                  const newSources = [...config.sources];
                  newSources.splice(index, 1);
                  updateConfig(["sources"], newSources);
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" onClick={() => {
              updateConfig(["sources"], [...config.sources, { name: "", url: "" }]);
            }}
          >
            + Add Source
          </Button>
        </div>
      </section>

      {/* Categories & Keywords */}
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Categories & Keywords</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <TagInput
              label="Categories"
              value={config.classification.categories}
              error={errors["config.classification.categories"]}
              onChange={(val) => updateConfig(["classification", "categories"], val)}
            />
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.5rem" }}>
              The types of issues or topics this project tracks. The AI uses this exact list when tagging incoming reports — it will not invent categories outside this list.
            </p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <TagInput
            label="Include Keywords"
            value={config.keywords.include}
            error={errors["config.keywords.include"]}
            onChange={(val) => updateConfig(["keywords", "include"], val)}
          />
          <TagInput
            label="Exclude Keywords"
            value={config.keywords.exclude}
            error={errors["config.keywords.exclude"]}
            onChange={(val) => updateConfig(["keywords", "exclude"], val)}
          />
        </div>
      </section>



      {errors.root && (
        <div className={styles.globalError}>
          {errors.root}
        </div>
      )}

      {success && (
        <div style={{ background: 'var(--status-fixed-bg)', color: 'var(--status-fixed)', padding: '1rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--status-fixed)' }}>
          {success}
        </div>
      )}

      {syncStatus && (
        <div style={{ background: 'var(--bg-card)', color: 'var(--text-main)', padding: '1rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={styles.spinner} style={{ width: '16px', height: '16px', border: '2px solid var(--text-muted)', borderTopColor: 'var(--text-main)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          {syncStatus}
        </div>
      )}

      <div className={styles.buttonRow}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button type="button" size="md" onClick={() => router.back()}
          >
            Cancel
          </Button>
          {isEditMode && (
            <Button type="button" disabled={isSyncing} size="md" onClick={() => handleSync(id)}
            >
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
          )}
        </div>
        <Button variant="primary" type="submit" disabled={loading} size="md">
          {loading ? "Saving & Syncing..." : "Save Configuration"}
        </Button>
      </div>

      {isEditMode && (
        <section className={styles.card} style={{ marginTop: '2rem', border: '1px solid var(--status-escalated)' }}>
          <h2 className={styles.sectionTitle} style={{ color: 'var(--status-escalated)' }}>Danger Zone</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
            Deleting a project is irreversible. All associated issue clusters, raw posts, and history will be permanently deleted.
          </p>
          <Button variant="danger" type="button" size="md" onClick={() => setShowDeleteModal(true)}
          >
            Delete Project
          </Button>
        </section>
      )}

      {showDeleteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
        }}>
          <div className={styles.card} style={{ width: '100%', maxWidth: '400px', margin: '1rem', border: '1px solid var(--status-escalated)' }}>
            <h2 className={styles.sectionTitle} style={{ color: 'var(--status-escalated)' }}>Delete Project?</h2>
            <p style={{ color: "var(--text-main)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              This action is <strong>permanent</strong> and cannot be undone. To confirm, please type <strong>{displayName || id}</strong> below.
            </p>
            <input
              type="text"
              className={styles.input}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Project Name or ID"
              style={{ marginBottom: '1.5rem', width: '100%' }}
            />
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Button type="button" size="md" onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" type="button" disabled={isDeleting || (deleteConfirmText !== displayName && deleteConfirmText !== id)} size="md" onClick={handleDelete}>
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
