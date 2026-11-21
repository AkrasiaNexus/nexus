import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// "Download my data": everything we hold about the signed-in user (GDPR-style access right).
export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const sb = createClient();
  const mine = <T extends string>(table: T, select = "*") => sb.from(table).select(select).eq("userId", user.id);
  const [scans, purchases, listings, notifications, rsvps, tasks] = await Promise.all([
    mine("scans"),
    mine("purchases", "*, listing:listings(title)"),
    sb.from("listings").select("*").eq("ownerId", user.id),
    mine("notifications"),
    mine("event_rsvps", "*, event:events(title, startsAt)"),
    mine("task_dones", "*, task:tasks(title)"),
  ]);
  const body = JSON.stringify({
    exportedAt: new Date(), profile: user,
    scans: scans.data, purchases: purchases.data, listings: listings.data, notifications: notifications.data, rsvps: rsvps.data, tasks: tasks.data,
  }, null, 2);
  return new Response(body, { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="my-ecosphere-data.json"' } });
}
