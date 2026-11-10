// Loads a GTFS feed folder into a timetable for one service date.
// Spec: https://gtfs.org/schedule/reference/
import fs from "node:fs";
import path from "node:path";
import { buildTimetable } from "./timetable.js";

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  const keys = header.map((h) => h.trim());
  return body.map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? "").trim()])));
}

/** "25:10:00" -> seconds after the service day's midnight (GTFS allows > 24h). */
export function parseTime(hms) {
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Service ids running on `date` ("YYYYMMDD"), from calendar.txt and calendar_dates.txt. */
export function activeServices(calendar, calendarDates, date) {
  const y = +date.slice(0, 4), m = +date.slice(4, 6), d = +date.slice(6, 8);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const active = new Set(
    calendar.filter((c) => c.start_date <= date && date <= c.end_date && c[weekday] === "1").map((c) => c.service_id),
  );
  for (const ex of calendarDates) {
    if (ex.date !== date) continue;
    if (ex.exception_type === "1") active.add(ex.service_id);
    if (ex.exception_type === "2") active.delete(ex.service_id);
  }
  return active;
}

function readTable(dir, name, required = true) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) {
    if (required) throw new Error(`GTFS feed is missing ${name}`);
    return [];
  }
  return parseCsv(fs.readFileSync(file, "utf8"));
}

export function loadGtfs(dir, date, walk) {
  const stopRows = readTable(dir, "stops.txt").filter((s) => !s.location_type || s.location_type === "0");
  const stops = stopRows.map((s) => ({ id: s.stop_id, name: s.stop_name, lat: +s.stop_lat, lon: +s.stop_lon }));
  const stopIndex = new Map(stops.map((s, i) => [s.id, i]));

  const routes = new Map(readTable(dir, "routes.txt").map((r) => [r.route_id, r.route_short_name || r.route_long_name || r.route_id]));
  const services = activeServices(readTable(dir, "calendar.txt", false), readTable(dir, "calendar_dates.txt", false), date);
  const tripMeta = new Map(
    readTable(dir, "trips.txt").filter((t) => services.has(t.service_id)).map((t) => [t.trip_id, { route: t.route_id, headsign: t.trip_headsign }]),
  );

  const byTrip = new Map();
  for (const st of readTable(dir, "stop_times.txt")) {
    if (!tripMeta.has(st.trip_id) || !stopIndex.has(st.stop_id)) continue;
    if (!byTrip.has(st.trip_id)) byTrip.set(st.trip_id, []);
    byTrip.get(st.trip_id).push(st);
  }

  const trips = [];
  for (const [id, rows] of byTrip) {
    rows.sort((a, b) => +a.stop_sequence - +b.stop_sequence);
    if (rows.length < 2 || rows.some((r) => !r.arrival_time && !r.departure_time)) continue; // untimed stops unsupported
    const meta = tripMeta.get(id);
    trips.push({
      id,
      route: meta.route,
      routeName: routes.get(meta.route) ?? meta.route,
      stops: rows.map((r) => stopIndex.get(r.stop_id)),
      arr: rows.map((r) => parseTime(r.arrival_time || r.departure_time)),
      dep: rows.map((r) => parseTime(r.departure_time || r.arrival_time)),
    });
  }
  return buildTimetable({ stops, trips, walk });
}
