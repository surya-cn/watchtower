"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectConfig } from "@/lib/schemas";

type ConfigFormProps = {
  initialData?: {
    id: string;
    display_name: string;
    config: ProjectConfig;
  };
  isEditMode?: boolean;
};

// Simple TagInput component for array fields
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
    <div className="flex flex-col gap-1">
      <label className="font-medium text-sm text-gray-300">{label}</label>
      <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-800 border border-gray-600 rounded-md focus-within:border-blue-500">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 bg-blue-900/50 text-blue-200 px-2 py-1 rounded text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-blue-400 hover:text-blue-100 font-bold"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          type="text"
          className="flex-1 bg-transparent outline-none text-white min-w-[120px] text-sm"
          placeholder={value.length === 0 ? placeholder : ""}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {error && <span className="text-red-400 text-xs">{error}</span>}
      <p className="text-xs text-gray-500">Press enter or comma to add</p>
    </div>
  );
}

const DEFAULT_CONFIG: ProjectConfig = {
  sources: {
    reddit: null,
    twitter: null,
    ea_forum: null,
    discord: null,
  },
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

  // Generate slug
  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setDisplayName(name);
    if (!isEditMode) {
      setId(
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccess("");
    setLoading(true);

    try {
      const url = isEditMode ? `/api/projects/${id}/config` : `/api/projects`;
      const method = isEditMode ? "PUT" : "POST";
      const body = isEditMode
        ? config
        : { id, display_name: displayName, config };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSuccess(isEditMode ? "Configuration saved." : "Project created.");
        router.push(`/?project=${id}`);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-gray-900 text-white p-6 rounded-xl border border-gray-700">
      
      {/* Project Meta */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold border-b border-gray-700 pb-2">Project Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-medium text-sm text-gray-300">Display Name</label>
            <input
              type="text"
              required
              disabled={isEditMode}
              className="bg-gray-800 border border-gray-600 rounded-md p-2"
              value={displayName}
              onChange={handleDisplayNameChange}
            />
            {errors["display_name"] && <span className="text-red-400 text-xs">{errors["display_name"]}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-medium text-sm text-gray-300">Project ID (Slug)</label>
            <input
              type="text"
              required
              disabled={isEditMode}
              className="bg-gray-800 border border-gray-600 rounded-md p-2"
              value={id}
              onChange={(e) => setId(e.target.value)}
            />
            {errors["id"] && <span className="text-red-400 text-xs">{errors["id"]}</span>}
          </div>
        </div>
      </section>

      {/* Sources */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold border-b border-gray-700 pb-2">Sources (Optional)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TagInput
            label="Reddit (Subreddits)"
            placeholder="e.g. anticheat, gamehacking"
            value={config.sources.reddit?.subreddits || []}
            error={errors["config.sources.reddit.subreddits"]}
            onChange={(val) =>
              updateConfig(["sources", "reddit"], val.length ? { subreddits: val } : null)
            }
          />
          <TagInput
            label="Twitter (Search Terms)"
            placeholder="e.g. game cheat"
            value={config.sources.twitter?.search_terms || []}
            error={errors["config.sources.twitter.search_terms"]}
            onChange={(val) =>
              updateConfig(["sources", "twitter"], val.length ? { search_terms: val } : null)
            }
          />
          <TagInput
            label="EA Forum URLs"
            placeholder="e.g. https://forum.ea.com/..."
            value={config.sources.ea_forum?.urls || []}
            error={errors["config.sources.ea_forum.urls"]}
            onChange={(val) =>
              updateConfig(["sources", "ea_forum"], val.length ? { urls: val } : null)
            }
          />
          <TagInput
            label="Discord Server IDs"
            placeholder="e.g. 123456789"
            value={config.sources.discord?.server_ids || []}
            error={errors["config.sources.discord.server_ids"]}
            onChange={(val) =>
              updateConfig(["sources", "discord"], val.length ? { server_ids: val } : null)
            }
          />
        </div>
      </section>

      {/* Keywords */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold border-b border-gray-700 pb-2">Keywords</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* Classification */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold border-b border-gray-700 pb-2">Classification</h2>
        <div className="space-y-4">
          <TagInput
            label="Categories"
            value={config.classification.categories}
            error={errors["config.classification.categories"]}
            onChange={(val) => updateConfig(["classification", "categories"], val)}
          />
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div className="flex flex-col gap-1">
              <label className="font-medium text-sm text-gray-300">High Severity Threshold</label>
              <input
                type="number"
                min="0"
                className="bg-gray-800 border border-gray-600 rounded-md p-2 text-white"
                value={config.classification.severity_thresholds.high}
                onChange={(e) => updateConfig(["classification", "severity_thresholds", "high"], parseInt(e.target.value))}
              />
              {errors["config.classification.severity_thresholds.high"] && <span className="text-red-400 text-xs">{errors["config.classification.severity_thresholds.high"]}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-medium text-sm text-gray-300">Medium Severity Threshold</label>
              <input
                type="number"
                min="0"
                className="bg-gray-800 border border-gray-600 rounded-md p-2 text-white"
                value={config.classification.severity_thresholds.medium}
                onChange={(e) => updateConfig(["classification", "severity_thresholds", "medium"], parseInt(e.target.value))}
              />
              {errors["config.classification.severity_thresholds.medium"] && <span className="text-red-400 text-xs">{errors["config.classification.severity_thresholds.medium"]}</span>}
            </div>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold border-b border-gray-700 pb-2">Integrations (Optional)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-medium text-sm text-gray-300">Bug Tracker</label>
            <input
              type="text"
              className="bg-gray-800 border border-gray-600 rounded-md p-2 text-white"
              value={config.integrations.bug_tracker || ""}
              onChange={(e) => updateConfig(["integrations", "bug_tracker"], e.target.value || null)}
            />
            {errors["config.integrations.bug_tracker"] && <span className="text-red-400 text-xs">{errors["config.integrations.bug_tracker"]}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-medium text-sm text-gray-300">Project Key</label>
            <input
              type="text"
              className="bg-gray-800 border border-gray-600 rounded-md p-2 text-white"
              value={config.integrations.bug_tracker_project_key || ""}
              onChange={(e) => updateConfig(["integrations", "bug_tracker_project_key"], e.target.value || null)}
            />
            {errors["config.integrations.bug_tracker_project_key"] && <span className="text-red-400 text-xs">{errors["config.integrations.bug_tracker_project_key"]}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-medium text-sm text-gray-300">Webhook URL</label>
            <input
              type="url"
              className="bg-gray-800 border border-gray-600 rounded-md p-2 text-white"
              value={config.integrations.webhook_url || ""}
              onChange={(e) => updateConfig(["integrations", "webhook_url"], e.target.value || null)}
            />
            {errors["config.integrations.webhook_url"] && <span className="text-red-400 text-xs">{errors["config.integrations.webhook_url"]}</span>}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold border-b border-gray-700 pb-2">Team</h2>
        <TagInput
          label="Team Contacts (Emails)"
          value={config.team_contacts}
          error={errors["config.team_contacts"]}
          onChange={(val) => updateConfig(["team_contacts"], val)}
        />
      </section>

      {errors.root && (
        <div className="p-4 bg-red-900/50 border border-red-700 text-red-200 rounded">
          {errors.root}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-900/50 border border-green-700 text-green-200 rounded">
          {success}
        </div>
      )}

      <div className="flex justify-end border-t border-gray-700 pt-6">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Configuration"}
        </button>
      </div>
    </form>
  );
}
