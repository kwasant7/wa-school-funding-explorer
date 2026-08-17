/**
 * The assistant's grounding corpus: this site's own explanations, its
 * methodology, and the statutes it cites - as short retrievable passages with
 * source attribution.
 *
 * Two rules shape what is in here.
 *
 * First, nothing in this file restates a number that is computed elsewhere.
 * District figures, statewide totals, and simulator outputs are injected at
 * request time from the real data modules, so there is no second copy to drift
 * out of date. What lives here is the durable prose: what a term means, how a
 * formula works, which caveat applies.
 *
 * Second, every chunk names its sources by ID. The model is handed the ID list
 * and told to cite IDs, never URLs - so a citation can only ever resolve to a
 * link that already appears on this site.
 */
import type { AssistantSource, AssistantKnowledgeChunk } from '@/lib/assistant/types';

export const ASSISTANT_SOURCES: readonly AssistantSource[] = [
  // Internal pages
  {
    id: 'site-home',
    label: 'How It Works',
    url: '/',
    type: 'internal',
    description: "This site's explainer of the prototypical school funding model.",
  },
  {
    id: 'site-prototypical-model',
    label: 'The prototypical school funding model',
    url: '/prototypical-school-funding-model/',
    type: 'internal',
    description: 'The full walkthrough: prototype sizes, class sizes, all eleven staff roles, the district-wide tier, and how positions become dollars.',
  },
  {
    id: 'site-districts',
    label: 'District Explorer',
    url: '/districts',
    type: 'internal',
    description: 'Funding, enrollment, and demographics for every Washington district.',
  },
  {
    id: 'site-simulator',
    label: 'Policy Simulator',
    url: '/simulator',
    type: 'internal',
    description: 'An educational model of what changing each funding lever would cost.',
  },
  {
    id: 'site-take-action',
    label: 'Take Action',
    url: '/take-action',
    type: 'internal',
    description: 'Your legislators, 2026 funding bills, and message templates.',
  },
  {
    id: 'site-sources',
    label: 'Sources & Methodology',
    url: '/sources',
    type: 'internal',
    description: 'Every dataset, statute, and court record behind this site.',
  },
  {
    id: 'site-lea',
    label: 'Local Effort Assistance, step by step',
    url: '/lea',
    type: 'internal',
    description: 'The LEA formula worked through in full.',
  },

  // Official data sources
  {
    id: 'ospi-safs',
    label: 'OSPI SAFS data files',
    url: 'https://ospi.k12.wa.us/safs-data-files',
    type: 'official',
    description: 'F-196 financial actuals and enrollment summaries.',
  },
  {
    id: 'data-wa-enrollment',
    label: 'OSPI Report Card Enrollment (data.wa.gov)',
    url: 'https://data.wa.gov/resource/2rwv-gs2e',
    type: 'official',
    description: 'District October headcount and student-group counts, 2024-25.',
  },
  {
    id: 'ospi-report-card',
    label: 'Washington State Report Card',
    url: 'https://washingtonstatereportcard.ospi.k12.wa.us/',
    type: 'official',
    description: 'OSPI’s browsable enrollment and demographics viewer.',
  },
  {
    id: 'fiscal-wa-k12',
    label: 'fiscal.wa.gov K-12 district finance',
    url: 'https://fiscal.wa.gov/K12/K12FinanceDistrict',
    type: 'official',
    description: 'Statewide school-finance workbook, fund balance and reserve ratio.',
  },
  {
    id: 'ospi-apportionment',
    label: 'OSPI School Apportionment guidance',
    url: 'https://ospi.k12.wa.us/policy-funding/school-apportionment/guidance-and-tools',
    type: 'official',
    description: 'Enrollment reporting and allocation tools.',
  },
  {
    id: 'ospi-understanding-funding',
    label: 'OSPI: Understanding Public School Funding',
    url: 'https://ospi.k12.wa.us/policy-funding/legislative-priorities/understanding-public-school-funding',
    type: 'official',
    description: 'State, local, and federal funding explained by OSPI.',
  },
  {
    id: 'ospi-oversight',
    label: 'OSPI district budget challenges and insolvency',
    url: 'https://ospi.k12.wa.us/policy-funding/school-apportionment/guidance-and-tools/school-district-budget-challenges-and-financial-insolvency',
    type: 'official',
    description: 'Which districts are on binding conditions or enhanced oversight.',
  },
  {
    id: 'citizens-guide',
    label: "Citizen's Guide to K-12 Finance",
    url: 'https://leg.wa.gov/media/jyxir1tw/citizens-guide-to-k-12-financing-2024.pdf',
    type: 'official',
    description: 'Plain-language guide from Washington legislative staff.',
  },

  // Statutes and case law
  {
    id: 'rcw-28a-150-260',
    label: 'RCW 28A.150.260',
    url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.150.260',
    type: 'official',
    description: 'Prototypical school sizes, class sizes, and staffing allocations.',
  },
  {
    id: 'rcw-84-52-0531',
    label: 'RCW 84.52.0531',
    url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=84.52.0531',
    type: 'official',
    description: 'The enrichment levy cap.',
  },
  {
    id: 'rcw-28a-500-015',
    label: 'RCW 28A.500.015',
    url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.500.015',
    type: 'official',
    description: 'Local Effort Assistance threshold and proration.',
  },
  {
    id: 'rcw-28a-505-110',
    label: 'RCW 28A.505.110',
    url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.505.110',
    type: 'official',
    description: 'Binding conditions for districts without a balanced budget.',
  },
  {
    id: 'mccleary',
    label: 'McCleary v. State court records',
    url: 'https://www.courts.wa.gov/appellate_trial_courts/supremecourt/?fa=supremecourt.mccleary_education',
    type: 'official',
    description: 'The 2012 decision through the 2018 termination order.',
  },
  {
    id: 'ehb-2242',
    label: 'EHB 2242 (2017)',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=2242&Year=2017',
    type: 'official',
    description: 'The McCleary funding fix: salary allocations, state property tax, levy caps.',
  },
  {
    id: 'eshb-2261',
    label: 'ESHB 2261 (2009)',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=2261&Year=2009',
    type: 'official',
    description: "Washington's core prototypical-school funding law.",
  },
  {
    id: 'eshb-2049',
    label: 'ESHB 2049 (2025)',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=2049&Year=2025',
    type: 'official',
    description: 'Raised the enrichment levy lid on a schedule.',
  },
  {
    id: 'hb-2050',
    label: 'HB 2050 (2025)',
    url: 'https://app.leg.wa.gov/billsummary?BillNumber=2050&Year=2025',
    type: 'official',
    description: 'Changed the enrollment counted in LEA calculations.',
  },
  {
    id: 'leg-bill-info',
    label: 'Washington Legislature bill information',
    url: 'https://app.leg.wa.gov/billinfo/',
    type: 'official',
    description: 'Official bill pages, histories, amendments, and votes.',
  },
  {
    id: 'leg-testify',
    label: 'How to testify at a committee meeting',
    url: 'https://leg.wa.gov/bills-meetings-and-session/session/how-to-testify-at-a-committee-meeting/',
    type: 'official',
    description: 'Official instructions for remote, in-person, and written testimony.',
  },
  {
    id: 'leg-district-finder',
    label: 'Washington District Finder',
    url: 'https://app.leg.wa.gov/DistrictFinder/',
    type: 'official',
    description: 'Find your exact legislative district from your home address.',
  },
] as const;

const SOURCES_BY_ID = new Map(ASSISTANT_SOURCES.map((source) => [source.id, source]));

export function assistantSource(id: string): AssistantSource | null {
  return SOURCES_BY_ID.get(id) ?? null;
}

export function isKnownSourceId(id: string): boolean {
  return SOURCES_BY_ID.has(id);
}

/* ------------------------------------------------------------------ *
 * Knowledge chunks
 * ------------------------------------------------------------------ */

type Chunk = AssistantKnowledgeChunk & {
  /** Extra retrieval terms that do not appear verbatim in the text. */
  keywords: string[];
};

export const KNOWLEDGE: readonly Chunk[] = [
  {
    id: 'prototypical-model',
    title: 'The prototypical school funding model',
    text: "Washington does not fund the schools that actually exist. It funds a theoretical 'prototypical school' and uses it as a recipe. The state counts students in funding FTE by grade span and divides each span by its prototype size - model elementary schools hold 400 students, middle schools 432, high schools 600 - so 600 elementary FTE is 1.5 model elementary schools and generates 1.5 times the elementary staffing. Each model school generates classroom teachers at a funded class size plus fractional positions for eleven other roles: principals, paraeducators, office staff, custodians, teacher-librarians, counselors, nurses, social workers, psychologists, student-safety staff and parent involvement coordinators. Teachers are not simply enrollment divided by class size; the statute also funds the teachers who cover everyone else's planning period, which OSPI adds as 15.5% in K-6 and 20% in grades 7-12, so students per funded teacher is lower than the class size. A second district-wide tier funds technology, facilities and warehouse staff per 1,000 students, plus central administration at 5.30% of every other staff unit. Positions are then priced at statewide salary allocations, multiplied by the district's regionalization factor, and benefits, materials and operating costs and the categorical programs are added. These are funding allocations, not a required staffing plan: districts may organize schools differently, but must cover anything beyond the formula from other revenue. Two exceptions do bind: K-3 class size money is paid only in proportion to the class sizes a district demonstrates it actually runs, and the money for nurses, counselors, social workers, psychologists, safety staff and parent involvement coordinators is paid only in proportion to the staff it actually employs.",
    sourceIds: ['site-prototypical-model', 'rcw-28a-150-260', 'eshb-2261'],
    keywords: ['prototypical', 'model', 'formula', 'staffing', 'allocation', 'recipe', 'basic education', 'class size', 'planning time', 'central administration'],
  },
  {
    id: 'funding-fte-vs-headcount',
    title: 'Funding FTE versus October headcount',
    text: "This site shows two different student counts and they do not match. October headcount is the Report Card's count of bodies enrolled in October. Funding FTE is OSPI's final annual-average full-time-equivalent enrollment from the P-223 system, which counts part-time participation proportionally - a half-time student is 0.5 FTE - and includes Running Start at college and Open Doors FTE. Every per-student dollar figure on this site divides by funding FTE, because that is the denominator the state actually funds on. Student totals displayed alongside funding are also funding FTE; the enrollment trend chart uses October headcount, so the two will not agree exactly.",
    sourceIds: ['site-sources', 'ospi-safs', 'fiscal-wa-k12'],
    keywords: ['fte', 'headcount', 'enrollment', 'aafte', 'p-223', 'per student', 'denominator', 'running start'],
  },
  {
    id: 'revenue-sources',
    title: 'State, local, federal and other revenue',
    text: 'District general-fund revenue is grouped into four sources from F-196 revenue codes. State (codes 3000 general-purpose apportionment and 4000 special-purpose categorical programs) is the largest share for nearly every district. Local (1000 local property tax levies and 2000 non-tax local support) depends on local property wealth and what voters approved. Federal (5000 general purpose and 6000 special purpose such as Title I and IDEA) is a small share that bulged during the pandemic with ESSER money and has fallen back as that expired. Other (7000-9000) covers revenue from other districts, other agencies, and transfers.',
    sourceIds: ['site-districts', 'site-sources', 'ospi-safs'],
    keywords: ['revenue', 'state', 'local', 'federal', 'other', 'f-196', 'sources', 'esser', 'title i', 'idea', 'apportionment'],
  },
  {
    id: 'levy-cap',
    title: 'The enrichment levy cap',
    text: "Local school levies are capped by state law. A district may collect the lesser of a rate limit ($2.50 per $1,000 of assessed value) and a per-student limit. The per-student cap reaches $4,077 in 2027, then a flat $5,035 in 2031, when the statute drops the district-size split. Until then districts of 40,000 or more students - Seattle is the only one - get a higher cap, $4,787 in 2027. Because the cap binds after voters vote, 75 districts have approved levies larger than they may legally collect: raising the cap would release money voters already approved without any new election. Beyond that point, collecting more would take a new levy vote.",
    sourceIds: ['site-simulator', 'rcw-84-52-0531', 'eshb-2049', 'ehb-2242'],
    keywords: ['levy', 'levy cap', 'levy lid', 'enrichment', 'local levy', 'cap', 'ballot', 'voters', 'election'],
  },
  {
    id: 'local-effort-assistance',
    title: 'Local Effort Assistance (levy equalization)',
    text: "Local Effort Assistance is state money that partly compensates districts whose property wealth cannot raise what a wealthier district's can. It is a wealth test, not a match on the district's actual levy. The state calculates what the district's assessed value could raise at $1.50 per $1,000, compares that per-student capacity with a statewide goal (about $2,432 per student in 2027), and pays the shortfall. The payment is then prorated by local effort: a district levying below $1.50 per $1,000 receives only that fraction of what it otherwise qualifies for. LEA is sometimes called levy equalization.",
    sourceIds: ['site-lea', 'rcw-28a-500-015', 'hb-2050'],
    keywords: ['lea', 'local effort assistance', 'levy equalization', 'equalization', 'property wealth', 'assessed value', 'threshold', 'proration'],
  },
  {
    id: 'special-education',
    title: 'Special education funding',
    text: 'Special education is funded as a multiplier on top of basic education: the state currently allocates about 1.16 times the basic-education rate for a student receiving services. Districts routinely spend more than that allocation and cover the difference from their general fund, which means it is paid out of general education money that would otherwise serve every student. A separate safety net exists for individually high-cost placements, but districts must claim it and it does not close the gap. Serving students with disabilities is a federal and state obligation, not a local option.',
    sourceIds: ['site-simulator', 'site-districts'],
    keywords: ['special education', 'sped', 'disabilities', 'multiplier', 'safety net', 'iep', 'idea', 'excess cost'],
  },
  {
    id: 'msoc',
    title: 'MSOC: materials, supplies and operating costs',
    text: 'MSOC is the state allocation for everything that is not salaries: technology, utilities, insurance, curriculum and textbooks, instructional supplies, library and office costs. It is paid as a flat per-student rate, about $1,614 per student under current law. Because heating an old building, insuring it and running its network do not scale with headcount, the flat rate fits some districts and badly misses others - small districts spend far more per student since fixed costs spread over few of them.',
    sourceIds: ['site-simulator', 'site-districts'],
    keywords: ['msoc', 'materials', 'supplies', 'operating', 'utilities', 'insurance', 'technology', 'textbooks', 'curriculum'],
  },
  {
    id: 'transportation',
    title: 'Student transportation funding',
    text: 'The state funds pupil transportation operations through a separate allocation, about $708 per student statewide in 2024-25 when the whole program is spread across all students. Actual cost depends on route length, geography, and how many students need individualized routes - students with disabilities, students experiencing homelessness, and students in foster care are the most expensive to transport. Bus purchases run through the separate Transportation Vehicle Fund, not the general fund.',
    sourceIds: ['site-simulator', 'site-districts', 'ospi-safs'],
    keywords: ['transportation', 'bus', 'buses', 'routes', 'depreciation', 'homeless', 'foster'],
  },
  {
    id: 'english-learners',
    title: 'English learner and bilingual funding',
    text: "The Transitional Bilingual Instruction Program funds students learning English as a supplement on top of basic education, roughly $1,800 per English learner under current law. The funding is time-limited: it follows a student only until they test out of the program. Districts with continuous newcomer arrivals therefore run a permanent program on funding designed to be temporary. Costs include certificated bilingual and ESL teachers, translated materials, and interpreters for families - none of which the prototypical school model carries a line for.",
    sourceIds: ['site-simulator', 'site-districts', 'eshb-2261'],
    keywords: ['ell', 'english learner', 'english language learner', 'bilingual', 'tbip', 'multilingual', 'newcomer', 'esl', 'translation'],
  },
  {
    id: 'poverty-lap',
    title: 'Poverty and the Learning Assistance Program',
    text: 'The Learning Assistance Program is the main state response to concentrated student poverty, allocated as a modest per-student supplement to districts based on their low-income counts. The prototypical model funds a school, not a caseload, so it adjusts only weakly for poverty. Concentrated poverty raises the cost of the same academic result: more counselors, more family outreach, more food service, and more summer and after-school programming.',
    sourceIds: ['site-simulator', 'site-districts'],
    keywords: ['poverty', 'low income', 'lap', 'learning assistance', 'free and reduced', 'frpl', 'title i'],
  },
  {
    id: 'regionalization',
    title: 'Regionalization and salary allocations',
    text: "State salary allocations are adjusted by a regionalization factor that raises the allocation in higher-cost parts of the state. EHB 2242 (2017), the McCleary funding fix, set the state salary allocation structure, raised the state property tax, and capped local levies at the same time - the state took over more of the salary bill and limited what districts could raise locally to supplement it.",
    sourceIds: ['site-sources', 'ehb-2242', 'rcw-28a-150-260'],
    keywords: ['regionalization', 'salary', 'salaries', 'cola', 'experience', 'staff mix', 'compensation'],
  },
  {
    id: 'mccleary-history',
    title: 'McCleary and the paramount duty',
    text: "The Washington Constitution, Article IX section 1, makes amply funding education the state's paramount duty. In McCleary v. State (2012) the Supreme Court held the state was failing that duty, held the state in contempt in 2014, imposed sanctions in 2015, and terminated the case in 2018 after EHB 2242 and follow-on budgets. The prototypical school model and the current salary and levy structure are the direct result of that litigation.",
    sourceIds: ['site-sources', 'mccleary', 'ehb-2242'],
    keywords: ['mccleary', 'paramount duty', 'constitution', 'court', 'contempt', 'sanctions', 'lawsuit', 'history'],
  },
  {
    id: 'fund-balance',
    title: 'Fund balance, reserves and the reserve ratio',
    text: "The general fund is where a district's day-to-day money flows. If it spends more than it takes in, it draws down its fund balance - its savings. The reserve ratio is fund balance as a share of annual spending. Experts treat 4-5% as a safe minimum; below that a single bad year can force cuts, and a negative ratio means no cushion is left. A district that cannot adopt a balanced budget must request binding conditions from OSPI, which then sets fund-balance targets and requires more frequent reporting. Two consecutive years, or a rejected financial plan, can escalate to a Financial Oversight Committee and then to a state-appointed special administrator.",
    sourceIds: ['site-districts', 'fiscal-wa-k12', 'rcw-28a-505-110', 'ospi-oversight'],
    keywords: ['fund balance', 'reserves', 'reserve ratio', 'deficit', 'surplus', 'savings', 'binding conditions', 'oversight', 'insolvency', 'balanced budget'],
  },
  {
    id: 'simulator-scope',
    title: 'What the Policy Simulator does and does not do',
    text: "The Policy Simulator is an educational approximation, not an official fiscal projection. Every slider starts at current Washington law, and moving one estimates what that change would cost statewide and what it would send a selected district. The estimates scale published statewide program totals and district-level data; they do not replicate OSPI's apportionment engine, do not model behavioural responses, and do not account for phase-in schedules or interactions between levers. Values above the starting point are policy proposals, not current law. Treat the outputs as an order of magnitude for understanding tradeoffs.",
    sourceIds: ['site-simulator'],
    keywords: ['simulator', 'estimate', 'projection', 'model', 'proposal', 'approximation', 'caveat', 'accuracy'],
  },
  {
    id: 'simulator-controls',
    title: 'The seven simulator levers',
    text: 'The simulator has seven levers grouped in three families. Local levies and state match: the per-student levy cap, and an increase to the Local Effort Assistance goal. Student needs: dollars per English learner, the special education multiplier, and a high-poverty school bonus. School operations: the MSOC per-student rate, and per-student transportation funding. Each begins at current law and can only be raised, because the site models expanding funding rather than cutting it.',
    sourceIds: ['site-simulator'],
    keywords: ['sliders', 'levers', 'controls', 'simulator', 'options', 'settings'],
  },
  {
    id: 'district-comparison',
    title: 'Comparing districts and reading per-student figures',
    text: "Per-student funding varies widely across Washington, and a high figure does not mean a district is well off. Higher-need districts receive more because categorical programs - special education, LAP, bilingual education - and federal Title dollars follow need. Small rural districts also cost more per student because fixed costs spread over few students. The District Explorer's scatter chart plots state revenue per student against student need so this relationship can be read directly, using state revenue only, since local levy capacity is what the formula is meant to be correcting for.",
    sourceIds: ['site-districts'],
    keywords: ['compare', 'comparison', 'per student', 'average', 'median', 'range', 'need', 'scatter', 'rural', 'small district'],
  },
  {
    id: 'take-action',
    title: 'Contacting legislators and testifying',
    text: 'A Washington school district usually sits inside several legislative districts, and every one of those delegations votes on school funding, so the Take Action page lists all of them for a selected district along with the share of the district area each covers. It also provides an email template and a roughly one-minute public testimony template. Anyone may testify on a bill remotely, in person, or in writing, or simply sign in to record support or opposition; students can and do testify. Verify your exact delegation from your home address with the Legislature District Finder.',
    sourceIds: ['site-take-action', 'leg-testify', 'leg-district-finder', 'leg-bill-info'],
    keywords: ['legislator', 'legislators', 'contact', 'testify', 'testimony', 'advocacy', 'representative', 'senator', 'email', 'hearing', 'committee', 'bill'],
  },
  {
    id: 'district-brief',
    title: "The Take Action district brief",
    text: "The Take Action page generates a short brief for the selected district: the funding problems that are unusual for that district ranked against the other 314, with the district's own numbers and a specific ask for each. It scores issues such as state financial oversight, an unbalanced budget, the levy cap blocking approved money, dependence on levy equalization, special education and MSOC gaps, transportation, multilingual learners, concentrated poverty, falling enrollment, and small-district scale. Severity is a percentile rank against all districts, so 'unusually high' means unusual for Washington. Districts whose numbers are unremarkable get a short brief saying so rather than a manufactured problem.",
    sourceIds: ['site-take-action', 'site-sources'],
    keywords: ['brief', 'district brief', 'what needs to change', 'issues', 'problems', 'ranked', 'severity'],
  },
  {
    id: 'data-coverage',
    title: 'Data coverage and how to verify a number',
    text: 'This site covers school years 2019-20 through 2024-25 for 315 districts and charter schools. Enrollment and demographics come from OSPI Report Card datasets on data.wa.gov, one per year. Funding enrollment comes from OSPI final enrollment summaries on the SAFS page. Finances are F-196 General Fund actuals, also from SAFS. Fund balance and reserve ratio come from the fiscal.wa.gov school-finance workbook. Oversight status is transcribed by hand from OSPI and dated. Every dataset ID, CSV URL, statute and court record is listed on the Sources page so any figure can be traced back to its original.',
    sourceIds: ['site-sources', 'ospi-safs', 'data-wa-enrollment', 'fiscal-wa-k12', 'ospi-report-card'],
    keywords: ['sources', 'verify', 'methodology', 'data', 'coverage', 'years', 'where', 'citation', 'dataset', 'download'],
  },
  {
    id: 'site-navigation',
    title: 'How this website is organised',
    text: 'The site has five main sections plus a set of topic explainers. How It Works explains the prototypical school model and lets you personalise it to a district. District Explorer shows funding, enrollment, revenue mix, demographics and trends for every district and charter, in any year since 2019-20. Policy Simulator lets you raise each funding lever and see the estimated cost. Take Action gives your legislators, a generated district brief, 2026 funding bills, and message templates. Sources & Methodology lists every dataset and statute. Alongside those, one explainer page each covers the prototypical school funding model, how Washington funds K-12 overall, MSOC, special education, levies and Local Effort Assistance, and student transportation.',
    sourceIds: ['site-home', 'site-districts', 'site-simulator', 'site-take-action', 'site-sources', 'site-lea', 'site-prototypical-model'],
    keywords: ['navigate', 'navigation', 'pages', 'sections', 'menu', 'tabs', 'where', 'find', 'how to use', 'help'],
  },
  {
    id: 'disclaimer',
    title: 'What this site is and is not',
    text: 'This is an independent civic education project. It is not affiliated with OSPI, any school district, or the Washington State Legislature. Simulator results are educational estimates, not official fiscal projections. The generated district brief and trend readings are computed from public data as a starting point for interpretation, not a formal fiscal assessment. For anything official, use the OSPI and Legislature sources listed on the Sources page.',
    sourceIds: ['site-sources', 'ospi-understanding-funding', 'citizens-guide'],
    keywords: ['disclaimer', 'official', 'affiliation', 'accuracy', 'trust', 'independent', 'who made'],
  },
] as const;

/** The allow-list handed to the model so it cites IDs instead of inventing URLs. */
export function sourceCatalogue() {
  return ASSISTANT_SOURCES.map((source) => ({
    id: source.id,
    label: source.label,
    type: source.type,
  }));
}
