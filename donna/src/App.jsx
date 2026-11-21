import { useState, useMemo } from "react";
import CaptureInput from "./components/CaptureInput";
import WeekPlanner from "./components/WeekPlanner";
import ItemCard from "./components/ItemCard";
import Sidebar from "./components/Sidebar";
import Orb from "./components/Orb";
import { itemStore } from "./stores/itemStore";
import { useStore } from "./hooks/useStore";
import { useNudgeTicker } from "./hooks/useNudgeTicker";

const isOrb = new URLSearchParams(window.location.search).get("view") === "orb";

// The orb window is transparent, so its page must be too, or the circle sits on a black square.
if (isOrb) document.documentElement.dataset.view = "orb";

export default function App() {
  return isOrb ? <Orb /> : <MainWindow />;
}

function MainWindow() {
  const items = useStore(itemStore);
  const [view, setView] = useState("week");
  useNudgeTicker(items);

  const stats = useMemo(() => ({
    week: itemStore.getWeekItems().length,
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
              {view === "all" && "Everything"}
              {view === "done" && "Completed"}
              {view === "skipped" && "Skipped"}
            </h2>
            <p className="text-sm text-donna-muted">
              {view === "week" && "What you're tackling this week"}
              {view === "all" && "On your radar"}
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
                <p className="text-donna-muted text-center py-12">Nothing here yet</p>
              ) : (
                viewItems.map((item) => <ItemCard key={item.id} item={item} />)
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
