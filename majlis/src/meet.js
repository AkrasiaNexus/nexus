// Fair meeting points: where should a group meet so that nobody's trip is terrible?
//
// One RAPTOR run per person gives everyone's earliest arrival at every stop.
// Each candidate place is then scored by the group's longest trip (minimax),
// with total travel time as the tie-breaker. Minimising the worst trip is the
// fairness choice: minimising the sum can send one friend on a 70-minute ride
// so three others save five minutes each.
import { distanceMeters, nearbyStops, WALK } from "./geo.js";
import { raptor, journeyTo } from "./raptor.js";

export const OBJECTIVES = {
  fairest: (times) => [Math.max(...times), sum(times)],
  fastest: (times) => [sum(times), Math.max(...times)],
};
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/**
 * @param people     [{ name, lat, lon, depart }]  depart = seconds after midnight
 * @param candidates [{ name, lat, lon }] places to meet; defaults to every stop
 */
export function meetingPoints(timetable, people, { candidates, objective = "fairest", top = 5, walk = WALK, maxRounds = 6 } = {}) {
  const places = candidates ?? timetable.stops.map((s) => ({ name: s.name, lat: s.lat, lon: s.lon }));
  const runs = people.map((p) => {
    const access = nearbyStops(p, timetable.stops, walk);
    const sources = access.map((a) => ({ stop: a.stop, time: p.depart + a.seconds }));
    return { person: p, access, result: raptor(timetable, sources, maxRounds) };
  });

  const scored = [];
  for (const place of places) {
    const egress = nearbyStops(place, timetable.stops, walk);
    const perPerson = runs.map(({ person, result }) => {
      let bestArrival = Infinity;
      let via = null;
      for (const e of egress) {
        const t = result.best[e.stop] + e.seconds;
        if (t < bestArrival) { bestArrival = t; via = e; }
      }
      const direct = walkOnlySeconds(person, place, walk);
      if (direct !== null && person.depart + direct <= bestArrival) return { arrival: person.depart + direct, via: null, walkOnly: true };
      return { arrival: bestArrival, via, walkOnly: false };
    });
    if (perPerson.some((p) => p.arrival === Infinity)) continue;
    const times = perPerson.map((p, i) => p.arrival - people[i].depart);
    scored.push({ place, times, perPerson, score: OBJECTIVES[objective](times) });
  }

  scored.sort((a, b) => a.score[0] - b.score[0] || a.score[1] - b.score[1]);
  return scored.slice(0, top).map((s) => ({
    place: s.place,
    longest: Math.max(...s.times),
    total: sum(s.times),
    spread: Math.max(...s.times) - Math.min(...s.times),
    people: s.perPerson.map((p, i) => ({
      name: people[i].name,
      minutes: Math.round(s.times[i] / 60),
      walkOnly: p.walkOnly,
      journey: p.walkOnly ? null : journeyTo(timetable, runs[i].result, p.via.stop),
      egressSeconds: p.via?.seconds ?? 0,
    })),
  }));
}

// Walking the whole way is allowed for short distances (twice the access limit).
function walkOnlySeconds(a, b, walk) {
  const meters = distanceMeters(a, b);
  return meters <= walk.maxMeters * 2 ? Math.round((meters * walk.detour) / walk.speedMps) : null;
}
