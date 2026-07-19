import React, { useState } from 'react';
import { useRouter } from "next/navigation";
import BlurText from "@/components/BlurText/BlurText";
import SpecularButton from '@/components/SpecularButton/SpecularButton';
import styles from './LoginCard.module.css';

interface Props {
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

export default function LoginCard({ isHovered, onHoverStart, onHoverEnd }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleBlur = (e: React.FocusEvent) => {
    // If the new focus target is inside the card, do nothing
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    onHoverEnd();
  };

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
    <div 
      className={`${styles.card} ${isHovered ? styles.cardHovered : ''}`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={handleBlur}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>
          <BlurText className={styles.blurText} text="Sign in to WatchTower" delay={50} animateBy="words" direction="top" />
        </h2>
        <p className={styles.subtitle}>
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
          <SpecularButton
            type="submit"
            disabled={loading}
            size="md"
            radius={10}
            tint="#4C6FFF"
            tintOpacity={0.18}
            lineColor="#a0b4ff"
            baseColor="#3a5acc"
            intensity={1.2}
            followMouse
            proximity={180}
            style={{ width: '100%' }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </SpecularButton>
        </div>
      </form>
    </div>
  );
}
