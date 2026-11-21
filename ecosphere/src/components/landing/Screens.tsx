import { buildLeaf } from "@/lib/leaf";
import { Critter } from "@/components/Critter";
import { Glyph } from "@/components/Glyph";
import { ItemArt } from "@/components/ItemArt";
import { LeafLogo } from "@/components/art";

// Phone screens for the landing story: recreations of the real app UI with clearly labelled demo values.
// The scroll timeline drives them through data-* hooks (data-scr, data-count, data-vein, data-tick, data-bar, data-draw, data-card).

const Demo = () => <span className="rounded-full bg-white/10 px-1.5 py-px text-[8px] uppercase tracking-wider text-white/55">Demo</span>;
const Bar = ({ title }: { title: string }) => (
  <div className="flex items-center justify-between px-4 pb-2 pt-10 text-[13px] font-semibold"><span>{title}</span><Demo /></div>
);
const Shell = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <div data-scr={name} className="absolute inset-0 flex flex-col bg-[#0b0d0c] text-white" style={{ opacity: 0 }}>{children}</div>
);
const Count = ({ to, suffix = "", dp = 0 }: { to: number; suffix?: string; dp?: number }) => (
  <span data-count={to} data-dp={dp} data-suffix={suffix} className="tabular-nums">0{suffix}</span>
);

export function WelcomeScreen() {
  return (
    <Shell name="welcome">
      <div className="flex flex-1 flex-col items-center justify-between bg-[radial-gradient(120%_70%_at_50%_30%,#1e3a28,#0b0d0c_70%)] px-6 pb-10 pt-24 text-center">
        <div className="flex flex-col items-center gap-3">
          <span data-w="logo"><LeafLogo size={64} /></span>
          <p data-w="title" className="text-xl font-semibold">EcoSphere <span className="text-leaf">AI</span></p>
          <p data-w="sub" className="text-[11px] text-white/65">A smarter way to make a greener impact.</p>
        </div>
        <div data-w="btns" className="flex w-full flex-col gap-2">
          <span className="rounded-full bg-leaf py-2.5 text-[12px] font-semibold text-ink">Log In</span>
          <span className="rounded-full border border-white/15 py-2.5 text-[12px] font-semibold">Sign Up</span>
        </div>
      </div>
    </Shell>
  );
}

export function HomeScreen() {
  const { blade, veins } = buildLeaf();
  return (
    <Shell name="home">
      <div className="flex items-center gap-2 px-4 pt-10">
        <Critter avatar="c:0-1-2-1-1" size={28} />
        <div className="flex-1 leading-tight"><p className="text-[9px] text-white/55">Welcome back,</p><p className="text-[12px] font-semibold">Ayaan</p></div>
        <Demo />
      </div>
      <p className="mt-3 text-center text-[10px] text-white/55">Your environmental progress</p>
      <div className="relative mx-auto mt-1 h-[190px] w-[150px]">
        <svg viewBox="0 0 200 270" className="h-full w-full overflow-visible" aria-hidden>
          <path d={blade} fill="#13301b" />
          <g fill="none" stroke="#2c5233" strokeLinecap="round">{veins.filter((v) => v.kind !== "margin").map((v, i) => <path key={i} d={v.d} strokeWidth={v.width} />)}</g>
          <g fill="none" stroke="#b6f2a8" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 3px #86d67e)" }}>
            {veins.map((v, i) => <path key={i} data-vein data-start={v.start} data-len={v.len} d={v.d} strokeWidth={v.width} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} />)}
          </g>
        </svg>
        <div className="absolute inset-x-0 top-[44%] text-center"><p className="text-2xl font-bold"><Count to={78} suffix="%" /></p><p className="text-[9px] text-white/70">Green goal</p></div>
      </div>
      <div className="mx-4 mt-2 grid grid-cols-3 gap-1.5 text-center">
        {[["12.5", " kg", "Waste reduced", 1], ["8.2", " kg", "CO₂ avoided", 1], ["42", " L", "Water saved", 0]].map(([v, s, l, dp]) => (
          <div key={l as string} className="rounded-xl bg-[#171a19] py-2"><p className="text-[12px] font-semibold"><Count to={Number(v)} suffix={s as string} dp={dp as number} /></p><p className="text-[8px] text-white/50">{l}</p></div>
        ))}
      </div>
      <p className="mx-4 mt-3 text-[10px] font-semibold">Quick actions</p>
      <div className="mx-4 mt-1.5 grid grid-cols-4 gap-1.5">
        {["Scan", "Stats", "Guide", "Market"].map((a, i) => (
          <div key={a} className="flex flex-col items-center gap-1 rounded-xl bg-[#171a19] py-2 text-[8px] text-white/70">
            <Glyph name={["bottle", "books", "plant", "tote"][i]} className="h-4 w-4 text-leaf" />{a}
          </div>
        ))}
      </div>
      <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-[#171a19] p-2 text-[9px]"><Glyph name="bottle" className="h-4 w-4 text-white/80" /><span className="flex-1">Scanned plastic bottle</span><span className="text-leaf">+10 EC</span></div>
    </Shell>
  );
}

export function ScannerScreen() {
  return (
    <Shell name="scan">
      <Bar title="AI Waste Scanner" />
      <div className="relative mx-4 h-[230px] overflow-hidden rounded-2xl border border-white/70 bg-[radial-gradient(circle_at_50%_40%,#2d3330,#121614)]">
        <Glyph name="bottle" accent="#7cc3d6" className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 -rotate-12 text-[#dcedf2]" />
        <div data-s="beam" className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-leaf/40 to-transparent" />
      </div>
      <div data-s="result" className="mx-4 mt-4 rounded-2xl bg-[#171a19] p-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1e3a28] text-leaf"><Glyph name="bottle" className="h-6 w-6" /></span>
          <div className="flex-1"><p className="text-[13px] font-semibold">Plastic detected</p><p className="text-[10px] text-leaf">Recommended action: Recycle</p></div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[9px] text-white/60">
          <span>Confidence</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><span data-s="conf" className="block h-full w-[87%] origin-left rounded-full bg-leaf" /></span>
          <span className="tabular-nums"><Count to={87} suffix="%" /></span>
        </div>
        <p className="mt-2 text-[8px] text-white/40">Sample result for illustration</p>
      </div>
      <div className="mx-4 mt-3 rounded-full bg-leaf py-2.5 text-center text-[11px] font-semibold text-ink">Log it · +10 EC</div>
    </Shell>
  );
}

const TICKS = 48;
export function StatsScreen() {
  const bars = [0.42, 0.65, 0.5, 0.8, 0.58, 0.92, 0.7];
  return (
    <Shell name="stats">
      <Bar title="Statistics" />
      <div className="mx-4 flex rounded-full bg-[#171a19] p-0.5 text-center text-[9px]">{["Today", "Week", "Month", "Year"].map((t) => <span key={t} className={`flex-1 rounded-full py-1 ${t === "Week" ? "bg-leaf font-semibold text-ink" : "text-white/60"}`}>{t}</span>)}</div>
      <div className="relative mx-auto mt-3 h-[120px] w-[120px]">
        <svg viewBox="-52 -52 104 104" className="h-full w-full" aria-hidden>
          {Array.from({ length: TICKS }, (_, i) => {
            const a = (i / TICKS) * 2 * Math.PI;
            return <line key={i} data-tick={i / TICKS} x1={Math.sin(a) * 38} y1={-Math.cos(a) * 38} x2={Math.sin(a) * 47} y2={-Math.cos(a) * 47} stroke="#2a332d" strokeWidth="2" strokeLinecap="round" />;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center"><div><p className="text-xl font-semibold"><Count to={79} suffix="%" /></p><p className="text-[7px] uppercase tracking-widest text-white/50">Recycling</p></div></div>
      </div>
      <svg viewBox="0 0 260 70" className="mx-4 mt-2 h-[70px] w-[calc(100%-2rem)] overflow-visible" aria-hidden>
        <path data-draw d="M5 58 C40 50 60 30 90 34 S140 52 170 28 S220 12 255 16" fill="none" stroke="#a2d47e" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <div className="mx-4 mt-2 flex h-[60px] items-end gap-1.5">
        {bars.map((h, i) => <span key={i} data-bar className="flex-1 origin-bottom rounded-t-md bg-gradient-to-t from-[#2c5233] to-leaf" style={{ height: `${h * 100}%`, transform: "scaleY(0)" }} />)}
      </div>
      <div className="mx-4 mt-3 grid grid-cols-3 gap-1.5 text-center">
        {[["24.6", " kg", "Waste collected", 1], ["18.4", " kg", "CO₂ avoided", 1], ["310", " L", "Water saved", 0]].map(([v, s, l, dp]) => (
          <div key={l as string} className="rounded-xl bg-[#171a19] py-2"><p className="text-[11px] font-semibold"><Count to={Number(v)} suffix={s as string} dp={dp as number} /></p><p className="text-[7px] text-white/50">{l}</p></div>
        ))}
      </div>
    </Shell>
  );
}

const PRODUCTS = [["🧴", "Reusable Bottle", "200 EC"], ["📚", "Used Books", "Free"], ["👜", "Eco Tote Bag", "150 EC"], ["🎒", "School Bag", "Swap"]] as const;
const PRODUCTS_2 = [["👕", "Uniform Set", "Free"], ["🪴", "Plant Pot", "250 EC"], ["🚲", "Kids' Bike", "Swap"], ["🍳", "Pan", "80 EC"]] as const;
export function MarketScreen() {
  const grid = (items: typeof PRODUCTS | typeof PRODUCTS_2, key: string) => (
    <div data-m={key} className="absolute inset-0 grid auto-rows-min grid-cols-2 content-start gap-2" style={key === "b" ? { opacity: 0 } : undefined}>
      {items.map(([e, t, p], i) => (
        <div key={t} data-card={key === "a" ? i : undefined} className="rounded-xl bg-[#171a19] p-1.5">
          <ItemArt emoji={e} size="h-[78px]" />
          <p className="mt-1 text-[9px] font-medium leading-tight">{t}</p><p className="text-[9px] text-leaf">{p}</p>
        </div>
      ))}
    </div>
  );
  return (
    <Shell name="market">
      <Bar title="Marketplace" />
      <div className="mx-4 rounded-full bg-[#171a19] px-3 py-1.5 text-[9px] text-white/45">Search items…</div>
      <div className="mx-4 mt-2 flex gap-1.5 text-[8px]">{["All", "Reuse", "Donate", "Swap"].map((c, i) => <span key={c} className={`rounded-full px-2.5 py-1 ${i === 0 ? "bg-leaf font-semibold text-ink" : "bg-[#171a19] text-white/60"}`}>{c}</span>)}</div>
      <div className="relative mx-4 mt-2 flex-1">{grid(PRODUCTS, "a")}{grid(PRODUCTS_2, "b")}</div>
    </Shell>
  );
}

export function RewardsScreen() {
  return (
    <Shell name="rewards">
      <Bar title="EcoCred Rewards" />
      <div className="mx-auto mt-1 grid h-[92px] w-[92px] place-items-center rounded-full bg-[radial-gradient(circle,#2c5233,#13301b)] ring-2 ring-leaf/40">
        <div className="text-center"><p className="text-xl font-bold"><Count to={850} /></p><p className="text-[8px] text-white/60">EcoCreds</p></div>
      </div>
      <p className="mx-4 mt-3 text-[10px] font-semibold">Badges</p>
      <div className="mx-4 mt-1.5 flex justify-between">
        {["#a2d47e", "#e9b44c", "#7cc3d6", "#b9a2e6"].map((c, i) => (
          <span key={c} data-badge={i} className="grid h-11 w-11 place-items-center rounded-full" style={{ background: `${c}22`, boxShadow: `inset 0 0 0 1.5px ${c}` }}>
            <Glyph name={["plant", "tree", "can", "battery"][i]} accent={c} className="h-6 w-6 text-white/85" />
          </span>
        ))}
      </div>
      <div data-r="card" className="relative mx-4 mt-3 overflow-hidden rounded-2xl bg-[#171a19] p-3">
        <div className="flex items-center gap-3">
          <span className="relative grid h-11 w-11 place-items-center">
            <span data-r="lock" className="absolute inset-0 grid place-items-center rounded-xl bg-white/10 text-[16px]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            </span>
            <span data-r="prize" className="absolute inset-0 grid place-items-center rounded-xl bg-[#2b2419]" style={{ opacity: 0 }}><Glyph name="tree" accent="#e9b44c" className="h-7 w-7 text-[#f3e9d6]" /></span>
          </span>
          <div className="flex-1"><p className="text-[11px] font-semibold">Golden Sprout border</p><p data-r="label" className="text-[9px] text-white/55">Unlock at 800 EC</p></div>
        </div>
        {Array.from({ length: 8 }, (_, i) => <span key={i} data-spark={i} className="absolute left-[34px] top-1/2 h-1 w-1 rounded-full bg-leaf" style={{ opacity: 0 }} />)}
      </div>
      <p className="mx-4 mt-3 text-[10px] font-semibold">Your character</p>
      <div className="mx-4 mt-1.5 flex items-center gap-3">
        <span className="relative h-14 w-14">
          <span data-av="a" className="absolute inset-0"><Critter avatar="c:0-1-2-1-1" size={56} /></span>
          <span data-av="b" className="absolute inset-0 rounded-full ring-2 ring-[#e9b44c]" style={{ opacity: 0 }}><Critter avatar="c:3-4-2-1-1" size={56} /></span>
        </span>
        <p className="text-[9px] text-white/55">Equip new looks with the EcoCreds you earn.</p>
      </div>
    </Shell>
  );
}

const ROLE_SCREENS: { key: string; title: string; who: string; avatar: string; stats: [string, string][]; rows: string[] }[] = [
  { key: "student", title: "Student Profile", who: "Ayaan · Class 10", avatar: "c:0-1-2-1-1", stats: [["850", "EcoCreds"], ["5", "Challenges"]], rows: ["Class reports", "Achievements", "Customisation"] },
  { key: "parent", title: "Parent Profile", who: "Sara · Parent", avatar: "c:3-3-1-0-3", stats: [["24.6 kg", "Child's waste sorted"], ["2", "Alerts this week"]], rows: ["Child progress", "School messages", "Upcoming events"] },
  { key: "teacher", title: "Teacher Profile", who: "Mr. Daniel · Class 10", avatar: "c:1-5-0-0-0", stats: [["28", "Students"], ["82%", "Participation"]], rows: ["Assign a task", "Class challenge", "Class health"] },
  { key: "community", title: "Community Member", who: "Layla · Dubai Green", avatar: "c:2-6-1-3-0", stats: [["620", "EcoCreds"], ["12", "Activities"]], rows: ["Nearby centres", "Campaigns", "Marketplace"] },
  { key: "cadmin", title: "Community Admin", who: "Omar · Dubai Green", avatar: "c:1-7-3-0-2", stats: [["146", "Members"], ["3", "Collection points"]], rows: ["Manage members", "Collection points", "Announcements"] },
  { key: "admin", title: "Super Admin", who: "Platform overview", avatar: "c:3-4-4-2-3", stats: [["12k", "Users"], ["50", "Schools"]], rows: ["Manage users", "Moderation", "Audit logs"] },
];
export function RoleScreens() {
  return (
    <>
      {ROLE_SCREENS.map((r) => (
        <Shell key={r.key} name={`role-${r.key}`}>
          <Bar title={r.title} />
          <div className="flex flex-col items-center gap-1.5 pt-2"><Critter avatar={r.avatar} size={64} /><p className="text-[12px] font-semibold">{r.who}</p></div>
          <div className="mx-4 mt-3 grid grid-cols-2 gap-1.5 text-center">
            {r.stats.map(([v, l]) => <div key={l} className="rounded-xl bg-[#171a19] py-2.5"><p className="text-[13px] font-semibold">{v}</p><p className="text-[8px] text-white/50">{l}</p></div>)}
          </div>
          <div className="mx-4 mt-3 overflow-hidden rounded-xl bg-[#171a19]">
            {r.rows.map((row) => <p key={row} className="flex items-center justify-between border-b border-white/5 px-3 py-2.5 text-[10px] last:border-0">{row}<span className="text-white/35">›</span></p>)}
          </div>
        </Shell>
      ))}
    </>
  );
}
export const ROLES = ROLE_SCREENS.map((r) => ({ key: r.key, label: r.title.replace(" Profile", "") }));
