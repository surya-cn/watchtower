"use client";

import { usePathname, useSearchParams } from "next/navigation";
import React, { Suspense } from "react";
import Sidebar from "./Sidebar";
import TextType from "@/components/TextType/TextType";
import styles from "./SidebarLayout.module.css";

function ActiveProjectIndicator() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  
  if (!projectId) return null;
  return (
    <span className={styles.activeProjectText}>
      Project: {projectId}
    </span>
  );
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }
  
  return (
    <div className={styles.container}>
       <Suspense fallback={null}>
         <Sidebar />
       </Suspense>
       <main className={styles.mainContent}>
         <header className={styles.header}>
           <img src="/lighthouse.png" alt="Logo" className={styles.headerLogo} />
           <TextType 
             text="WatchTower"
             as="span"
             className={styles.headerTitle}
             typingSpeed={100}
             pauseDuration={5000}
             loop={true}
             showCursor={true}
             cursorCharacter="|"
           />
           <Suspense fallback={null}>
             <ActiveProjectIndicator />
           </Suspense>
         </header>
         <div className={styles.pageContent}>
           {children}
         </div>
       </main>
    </div>
  );
}
