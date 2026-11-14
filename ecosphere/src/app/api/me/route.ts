import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// "Download my data": everything we hold about the signed-in user (GDPR-style access right).
export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const profile = { ...user, passwordHash: undefined };
  const [scans, purchases, listings, notifications, rsvps, tasks] = await Promise.all([
    db.scan.findMany({ where: { userId: user.id } }),
    db.purchase.findMany({ where: { userId: user.id }, include: { listing: { select: { title: true } } } }),
    db.listing.findMany({ where: { ownerId: user.id } }),
    db.notification.findMany({ where: { userId: user.id } }),
    db.eventRsvp.findMany({ where: { userId: user.id }, include: { event: { select: { title: true, startsAt: true } } } }),
    db.taskDone.findMany({ where: { userId: user.id }, include: { task: { select: { title: true } } } }),
  ]);
  const body = JSON.stringify({ exportedAt: new Date(), profile, scans, purchases, listings, notifications, rsvps, tasks }, null, 2);
  return new Response(body, { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="my-ecosphere-data.json"' } });
}
