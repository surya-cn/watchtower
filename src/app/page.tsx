import { Suspense } from "react";
import DashboardView from "../components/DashboardView";


export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main>
      <Suspense fallback={<div style={{ padding: '1rem' }}>Loading dashboard...</div>}>
        <DashboardView />
      </Suspense>
    </main>
  );
}
