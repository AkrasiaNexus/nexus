import { useState, useMemo } from "react";
import CaptureInput from "./components/CaptureInput";
import WeekPlanner from "./components/WeekPlanner";
import NudgeCard from "./components/NudgeCard";
import Sidebar from "./components/Sidebar";
import CaptureWindow from "./components/CaptureWindow";
import { nudgeStore } from "./stores/nudgeStore";
import { useStore } from "./hooks/useStore";
import { useNudgeTicker } from "./hooks/useNudgeTicker";

const isCaptureWindow = new URLSearchParams(window.location.search).get("view") === "capture";

export default function App() {
  return isCaptureWindow ? <CaptureWindow /> : <MainWindow />;
}

function MainWindow() {
  const items = useStore(nudgeStore);
  const [view, setView] = useState("week");
  useNudgeTicker(items);

  const stats = useMemo(() => ({
    week: nudgeStore.getWeekItems().length,
    all: items.filter((i) => i.status === "active").length,
    done: items.filter((i) => i.status === "done").length,
    skipped: items.filter((i) => i.status === "skipped").length,
  }), [items]);

  const viewItems = useMemo(() => {
    switch (view) {
      case "week": return items;
      case "all": return items.filter((i) => i.status === "active");
      case "done": return items.filter((i) => i.status === "done");
      case "skipped": return items.filter((i) => i.status === "skipped");
      default: return items;
    }
  }, [items, view]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar active={view} onNavigate={setView} stats={stats} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-1">
              {view === "week" && "This Week"}
              {view === "all" && "All Nudges"}
              {view === "done" && "Completed"}
              {view === "skipped" && "Skipped"}
            </h2>
            <p className="text-sm text-nudge-muted">
              {view === "week" && "What you're tackling this week"}
              {view === "all" && "Everything on your radar"}
              {view === "done" && "Things you actually did — nice"}
              {view === "skipped" && "Maybe next time"}
            </p>
          </div>

          <div className="mb-8">
            <CaptureInput autoFocus />
          </div>

          {view === "week" ? (
            <WeekPlanner items={viewItems} />
          ) : (
            <div className="space-y-2">
              {viewItems.length === 0 ? (
                <p className="text-nudge-muted text-center py-12">Nothing here yet</p>
              ) : (
                viewItems.map((item) => <NudgeCard key={item.id} item={item} />)
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
