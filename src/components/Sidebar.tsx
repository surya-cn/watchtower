'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './Sidebar.module.css';
import { apiClient } from '../lib/apiClient';

// --- Icons ---
const IconDashboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IconProject = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z"/>
  </svg>
);
const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
  </svg>
);
const IconAddProject = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);
const IconLogout = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export default function Sidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  let currentProject = searchParams.get('project') || '';
  if (!currentProject && pathname.startsWith('/settings/')) {
    const parts = pathname.split('/');
    if (parts.length >= 3 && parts[1] === 'settings' && parts[2] !== 'new') {
      currentProject = parts[2];
    }
  }

  const [projects, setProjects] = useState<{ id: string }[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [projectPanelOpen, setProjectPanelOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.user?.role === 'admin');
        }
      } catch (err) {
        console.error('Failed to fetch user', err);
      }
    }
    fetchUser();
  }, []);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const data = await apiClient<{ id: string }[]>('/api/projects', '');
        setProjects(data || []);
        if (!currentProject && data && data.length > 0 && pathname === '/') {
          router.replace(`/?project=${data[0].id}`);
        }
      } catch (err) {
        console.error('Failed to fetch projects', err);
      } finally {
        setLoadingProjects(false);
      }
    }
    fetchProjects();
  }, [currentProject, router, pathname]);

  // Close project panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setProjectPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleProjectSelect = (projectId: string) => {
    router.push(`/?project=${projectId}`);
    setProjectPanelOpen(false);
  };

  // Gear icon → jump straight to the current project's edit/config page
  const handleSettingsClick = () => {
    if (currentProject) {
      router.push(`/settings/${currentProject}/edit`);
    } else {
      router.push('/settings');
    }
  };

  return (
    <div className={styles.sidebarRoot} ref={sidebarRef}>
      <aside className={styles.rail}>
        {/* Logo / Home Button */}
        <div className={styles.railLogo}>
          <Link
            href={currentProject ? `/?project=${currentProject}` : '/'}
            onClick={() => setProjectPanelOpen(false)}
            title="Dashboard"
            className={styles.railLogoLink}
          >
            <img src="/lighthouse.png" alt="WatchTower Home" className={styles.railLogoImg} />
          </Link>
        </div>

        {/* Nav Icons */}
        <nav className={styles.railNav}>
          <button
            className={`${styles.railBtn} ${projectPanelOpen ? styles.railBtnActive : ''}`}
            title="Select Project"
            onClick={() => setProjectPanelOpen(prev => !prev)}
          >
            <IconProject />
          </button>

          {isAdmin && (
            <>
              <button
                className={`${styles.railBtn} ${pathname.startsWith('/settings') && !pathname.endsWith('/new') ? styles.railBtnActive : ''}`}
                title="Project Config"
                onClick={handleSettingsClick}
              >
                <IconSettings />
              </button>

              <Link
                href="/settings/new"
                className={`${styles.railBtn} ${pathname === '/settings/new' ? styles.railBtnActive : ''}`}
                title="Add Project"
                onClick={() => setProjectPanelOpen(false)}
              >
                <IconAddProject />
              </Link>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className={styles.railFooter}>
          <button
            className={`${styles.railBtn} ${styles.railBtnLogout}`}
            title="Logout"
            onClick={handleLogout}
          >
            <IconLogout />
          </button>
        </div>
      </aside>

      {/* Project Selector Panel */}
      <div className={`${styles.panel} ${projectPanelOpen ? styles.panelOpen : ''}`}>
        <div className={styles.panelContent}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Select Project</span>
            <button className={styles.panelClose} onClick={() => setProjectPanelOpen(false)}>
              <IconChevronLeft />
            </button>
          </div>

          <div className={styles.projectList}>
            {loadingProjects ? (
              <>
                <div className="skeleton" style={{ height: '40px', borderRadius: '8px', marginBottom: '6px' }} />
                <div className="skeleton" style={{ height: '40px', borderRadius: '8px', marginBottom: '6px' }} />
                <div className="skeleton" style={{ height: '40px', borderRadius: '8px' }} />
              </>
            ) : projects.length === 0 ? (
              <p className={styles.emptyState}>
                No projects yet.<br />Use the <strong>+</strong> button to add one.
              </p>
            ) : (
              projects.map((p) => (
                <button
                  key={p.id}
                  className={`${styles.projectItem} ${currentProject === p.id ? styles.projectItemActive : ''}`}
                  onClick={() => handleProjectSelect(p.id)}
                >
                  <span className={styles.projectItemLabel}>{p.id}</span>
                  {currentProject === p.id && (
                    <span className={styles.projectItemCheck}><IconCheck /></span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
