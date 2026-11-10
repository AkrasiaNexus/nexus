import { useMemo } from "react";
import { format, startOfDay, addDays, isToday, isTomorrow, isBefore } from "date-fns";
import NudgeCard from "./NudgeCard";

function groupByDay(items) {
  const days = {};
  const now = startOfDay(new Date());

  // create 7 day buckets
  for (let i = 0; i < 7; i++) {
    const day = addDays(now, i);
    days[format(day, "yyyy-MM-dd")] = { date: day, items: [] };
  }
  days["overdue"] = { date: null, items: [] };
  days["later"] = { date: null, items: [] };

  for (const item of items) {
    if (item.status !== "active") continue;
    const deadline = new Date(item.deadline);
    const deadlineDay = format(startOfDay(deadline), "yyyy-MM-dd");

    if (isBefore(deadline, now)) {
      days["overdue"].items.push(item);
    } else if (days[deadlineDay]) {
      days[deadlineDay].items.push(item);
    } else {
      days["later"].items.push(item);
    }
  }

  return days;
}

function dayLabel(date) {
  if (!date) return "";
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE, MMM d");
}

export default function WeekPlanner({ items }) {
  const grouped = useMemo(() => groupByDay(items), [items]);

  const sections = [
    { key: "overdue", label: "Overdue", items: grouped.overdue.items, accent: "text-nudge-red" },
    ...Object.entries(grouped)
      .filter(([k]) => k !== "overdue" && k !== "later")
      .map(([key, { date, items: dayItems }]) => ({
        key,
        label: dayLabel(date),
        items: dayItems,
        accent: isToday(date) ? "text-nudge-accent" : "text-nudge-text",
      })),
    { key: "later", label: "Later", items: grouped.later.items, accent: "text-nudge-muted" },
  ].filter((s) => s.items.length > 0);

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-nudge-muted">
        <p className="text-lg font-medium">Nothing on the radar</p>
        <p className="text-sm mt-1">Blurt something above to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map(({ key, label, items: sectionItems, accent }) => (
        <div key={key}>
          <h3 className={`text-sm font-semibold mb-3 ${accent}`}>{label}</h3>
          <div className="space-y-2">
            {sectionItems.map((item) => (
              <NudgeCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
