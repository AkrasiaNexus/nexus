import WeekView from "./components/WeekView";
import AskBar from "./components/AskBar";
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

// Your week, and one line to talk to Donna. Nothing else: the orb handles everything
// you'd otherwise open a window for.
function MainWindow() {
  const items = useStore(itemStore);
  useNudgeTicker(items);

  return (
    <div className="h-screen flex flex-col gap-3 px-5 py-4">
      <WeekView />
      <AskBar />
    </div>
  );
}
