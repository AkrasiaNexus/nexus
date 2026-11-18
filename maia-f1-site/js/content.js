// Every fact here comes from Team MAIA's Enterprise and Engineering portfolios. Nothing is added from outside them.

// Constellation chapter: labels from the "Renders and Engineering Drawings" page, specs from "Rules and Regulations".
export const CONSTELLATION = [
  { part: 'front_wing', name: 'Front wing', spec: '25 mm chord · 69.04 mm span' },
  { part: 'sidepods_r', name: 'Side pod', spec: '' },
  { part: 'halo', name: 'Halo', spec: '' },
  { part: 'co2_canister', name: 'CO₂ canister chamber', spec: 'Ø18 mm · 52 mm deep' },
];

// Envelope chapter readouts ("Rules and Regulations").
export const ENVELOPE = [
  { value: 208.54, decimals: 2, unit: 'mm', label: 'Length' },
  { value: 72.51, decimals: 2, unit: 'mm', label: 'Width · limit 90' },
  { value: 38, decimals: 0, unit: 'mm', label: 'Rear wing height · min 35' },
];

// CFD chapter: forces in newtons and the conclusions ("First Model 1 / Model 2 / Current Model 3",
// "What we could conclude from the CFD tests").
export const ITERATIONS = [
  { name: 'Model 1', drag: 0.0603, downforce: -0.00684, total: 2.6684, chosen: false,
    verdict: 'A lot of added weight increased the downforce and slowed the car. Weight reduction became the main priority.' },
  { name: 'Model 2', drag: 0.066, downforce: -0.016, total: 1.916, chosen: false,
    verdict: 'Lighter, but the extra aerofoils in the front wing produced a lot of drag, so they were removed.' },
  { name: 'Hermes V1', drag: 0.071, downforce: -0.01, total: 1.51, chosen: true,
    verdict: 'Selected for major weight reduction: rear pods hollowed outside the no-go zone and a simpler, low-downforce rear wing, accepting a slight drag trade-off.' },
];

// Team chapter ("About our team", "Roles and Responsibilities").
export const TEAM = [
  { name: 'Hiteesh Muvva', roles: ['Project manager', 'Design & manufacturing engineer'],
    does: 'Oversees the project timeline and leads weekly reviews. Develops CAD models, conducts CFD analysis and manages CAM and manufacturing.' },
  { name: 'Dhruv Mahendra Palkhade', roles: ['Marketing manager', 'Finance manager'],
    does: 'Allocates budgets, oversees sponsorship funds and tracks financial usage.' },
  { name: 'Shaurya Gupta', roles: ['Sponsorship & marketing manager', 'Backup graphic designer'],
    does: 'Secures sponsorships, manages marketing and maintains financial records and budgets.' },
  { name: 'Vidaal Kampani', roles: ['Sustainability manager'],
    does: 'Drives environmental compliance, tracks resource efficiency and integrates sustainable practices into the project.' },
  { name: 'Shaun Fernandez', roles: ['Graphic designer'],
    does: 'Creates brand identity, the portfolio, pit displays and social media content.' },
  { name: 'Harinesh Sherven', roles: ['Graphic designer'],
    does: 'Creates brand identity, the portfolio, pit displays and social media content.' },
];

// Partners chapter ("Sponsorship and Marketing", "Budgeting").
export const TIERS = [
  { name: 'Accelerator', price: '500 AED', covers: 'Portfolios, printing and the Abu Dhabi tree-planting sustainability initiative.',
    gets: ['Logo on team portfolios and pit displays'] },
  { name: 'Performance Partner', price: '1200 AED', covers: 'Team uniforms, extra hardware and display materials.',
    gets: ['Prominent logo on team uniforms and pit displays, plus digital features', 'All Accelerator benefits'] },
  { name: 'Apex Title Partner', price: '3050 AED', covers: 'Full car manufacturing, materials and premium custom Foamex pit displays.',
    gets: ['Prime logo placement on the race car body', 'Maximum visibility across all team assets', 'All previous tier benefits'], featured: true },
  { name: 'Product Partner', price: 'Product / material support', covers: 'Recognition as a Technical / Product Partner.',
    gets: ['Logo in portfolio and pit display', 'A social media mention of how the product helped the team'] },
];
