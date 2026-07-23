"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import styles from "./AIChatBar.module.css";
import Button from '@/components/Button/Button';
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
  const pathname = usePathname();
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

      const { type, ui_action, natural_language_response } = response;

      let assistantContent = natural_language_response || "";

      if (ui_action?.type === "filters") {
        const data = ui_action.data;
        const params = new URLSearchParams(searchParams.toString());
        if (data.status) params.set("status", data.status);
        else params.delete("status");
        if (data.severity) params.set("severity", data.severity);
        else params.delete("severity");
        if (data.category) params.set("category", data.category);
        else params.delete("category");
        if (data.search) params.set("search", data.search);
        else params.delete("search");
        
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
                {msg.role === "assistant" && (
                  <img src="/lighthouse.png" alt="WatchTower" style={{ width: '16px', height: '16px', marginRight: '8px', verticalAlign: 'text-bottom' }} />
                )}
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <ReactMarkdown
                    components={{
                      a: ({ node, href, children, ...props }) => {
                        if (href?.startsWith("#issue-")) {
                          return (
                            <a
                              {...props}
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                onOpenIssue(href.replace("#issue-", ""));
                              }}
                              style={{ color: "#3B82F6", textDecoration: "underline", cursor: "pointer" }}
                            >
                              {children}
                            </a>
                          );
                        }
                        return <a href={href} {...props}>{children}</a>;
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className={`${styles.message} ${styles.assistant}`}>
              <div className={styles.messageContent}>
                <img src="/lighthouse.png" alt="WatchTower" style={{ width: '16px', height: '16px', marginRight: '8px', verticalAlign: 'text-bottom' }} />
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
        />
        <Button variant="primary" type="submit" disabled={!input.trim() || loading} size="sm">
          Send
        </Button>
      </form>
    </div>
  );
}
