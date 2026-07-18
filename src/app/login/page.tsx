"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./Login.module.css";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            Sign in to Anticheat Dashboard
          </h2>
          <p className={styles.subtitle}>
            {/* Placeholder comment per requirements */}
            Note: This is a placeholder auth system for testing. Must be replaced with real per-user authentication (e.g. company SSO) before production use.
          </p>
        </div>
        <form className={styles.form} onSubmit={handleSubmit} action="#">
          <div className={styles.inputGroup}>
            <label htmlFor="username" style={{ display: 'none' }}>
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className={`${styles.input} ${styles.inputTop}`}
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <label htmlFor="password" style={{ display: 'none' }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className={`${styles.input} ${styles.inputBottom}`}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className={styles.submitBtn}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
