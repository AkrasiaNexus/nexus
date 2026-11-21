import { Check, Clock, Trash2, RotateCw, Sparkles, BookOpen, Target, Dumbbell, Search } from "lucide-react";
import { formatDistanceToNow, isPast } from "date-fns";
import { itemStore } from "../stores/itemStore";

const CATEGORY_CONFIG = {
  skill: { icon: BookOpen, color: "text-blue-400", bg: "bg-blue-400/10" },
  idea: { icon: Sparkles, color: "text-purple-400", bg: "bg-purple-400/10" },
  task: { icon: Target, color: "text-green-400", bg: "bg-green-400/10" },
  habit: { icon: Dumbbell, color: "text-orange-400", bg: "bg-orange-400/10" },
  explore: { icon: Search, color: "text-cyan-400", bg: "bg-cyan-400/10" },
};

function ProgressBar({ createdAt, deadline }) {
  const start = new Date(createdAt).getTime();
  const end = new Date(deadline).getTime();
  const now = Date.now();
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const isOverdue = pct >= 100;

  return (
    <div className="w-full h-1.5 bg-donna-border rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          isOverdue ? "bg-donna-red" : pct > 75 ? "bg-donna-orange" : "bg-donna-accent"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function ItemCard({ item }) {
  const { icon: Icon, color, bg } = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.task;
  const isOverdue = isPast(new Date(item.deadline));
  const isDone = item.status === "done";

  return (
    <div
      className={`group relative bg-donna-surface border border-donna-border rounded-xl p-4 transition-all hover:border-donna-accent/30 ${
        isDone ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${bg}`}>
          <Icon size={16} className={color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDone ? "line-through text-donna-muted" : ""}`}>
            {item.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full ${bg} ${color}`}>
              {item.category}
            </span>
            <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-donna-red" : "text-donna-muted"}`}>
              <Clock size={11} />
              {isOverdue ? "overdue" : formatDistanceToNow(new Date(item.deadline), { addSuffix: true })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isDone && (
            <>
              <button
                onClick={() => itemStore.complete(item.id)}
                className="p-1.5 rounded-lg hover:bg-green-500/10 text-donna-muted hover:text-green-400 transition-colors"
                title="Mark done"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => itemStore.extend(item.id)}
                className="p-1.5 rounded-lg hover:bg-donna-accent/10 text-donna-muted hover:text-donna-accent transition-colors"
                title="Extend 7 days"
              >
                <RotateCw size={14} />
              </button>
            </>
          )}
          <button
            onClick={() => itemStore.remove(item.id)}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-donna-muted hover:text-red-400 transition-colors"
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {!isDone && (
        <div className="mt-3">
          <ProgressBar createdAt={item.createdAt} deadline={item.deadline} />
        </div>
      )}
    </div>
  );
}
