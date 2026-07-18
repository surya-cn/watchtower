"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./AIChatBar.module.css";
import { apiClient } from "../lib/apiClient";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AIChatBarProps {
  projectId: string;
  onOpenIssue: (id: string) => void;
}

export default function AIChatBar({ projectId, onOpenIssue }: AIChatBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Clear chat history when project switches
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    
    // Add user message immediately
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await apiClient<any>("/api/chat", projectId, {
        method: "POST",
        body: JSON.stringify({
          message: userMessage,
          // Send only valid user/assistant history to backend
          conversation_history: newMessages.filter(m => m.role !== "system")
        })
      });

      const { type, data, natural_language_response } = response;

      let assistantContent = natural_language_response || "";

      if (type === "issues") {
        // Apply filters to URL
        const params = new URLSearchParams(searchParams.toString());
        if (data.status) params.set("status", data.status);
        else params.delete("status");
        if (data.severity) params.set("severity", data.severity);
        else params.delete("severity");
        if (data.category) params.set("category", data.category);
        else params.delete("category");
        
        router.push(`/?${params.toString()}`);
        assistantContent = "I've applied those filters to the dashboard.";
      } else if (type === "detail") {
        onOpenIssue(data.id);
        assistantContent = "Here are the details for that issue.";
      }
      
      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);

    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error processing your request." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.chatContainer}>
      {messages.length > 0 && (
        <div className={styles.messageList}>
          {messages.map((msg, idx) => (
            <div key={idx} className={`${styles.message} ${styles[msg.role]}`}>
              <div className={styles.messageContent}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className={`${styles.message} ${styles.assistant}`}>
              <div className={styles.messageContent}>
                <span className={styles.typingIndicator}>...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
      
      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI to filter, summarize, or explain issues..."
          className={styles.input}
          disabled={loading}
        />
        <button type="submit" className={styles.sendButton} disabled={!input.trim() || loading}>
          Send
        </button>
      </form>
    </div>
  );
}
