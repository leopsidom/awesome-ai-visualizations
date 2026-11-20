/**
 * Every number in the game, taken from the U.S. Department of Education's
 * College Scorecard (raw data release of 19 May 2025).
 *
 *   SCHOOLS  — Most-Recent-Cohorts-Institution.csv, 109 operating schools that
 *              report earnings, net price, completion, debt, size and Pell share.
 *              The pool is the largest schools in each sector plus the top 25
 *              by earnings and a handful of well-known names.
 *   PROGRAMS — Most-Recent-Cohorts-Field-of-Study.csv, Georgia Tech (UNITID
 *              139755) and UC Berkeley (110635), programs with ≥ 30 completers
 *              and a published 4-year earnings figure.
 *   FACTS    — findings from the exploratory analysis of the same release.
 *
 * Earnings and debt cover federally aided students only; dollars are nominal.
 */

// [name, city, state, control(1 public, 2 nonprofit, 3 for-profit),
//  earn10, netPrice, completion, medianDebt, admRate, undergrads, pellShare]
export const SCHOOLS = [
  ["Arizona State","Tempe","AZ",1,62668,13670,0.679,19500,0.902,64398,0.297],
  ["Texas A&M","College Station","TX",1,72097,20924,0.838,17804,0.633,59099,0.192],
  ["University of Central Florida","Orlando","FL",1,58308,10650,0.752,18190,0.395,59095,0.334],
  ["Ohio State University","Columbus","OH",1,60409,18292,0.877,19976,0.508,44617,0.195],
  ["UT Austin","Austin","TX",1,75121,19678,0.876,20500,0.291,42100,0.251],
  ["Penn State","University Park","PA",1,63435,32598,0.857,25000,0.542,41862,0.133],
  ["University of Arizona","Tucson","AZ",1,59979,15960,0.659,19620,0.857,40769,0.262],
  ["Michigan State University","East Lansing","MI",1,67253,20751,0.822,23250,0.839,40243,0.2],
  ["Purdue University","West Lafayette","IN",1,72424,13945,0.831,19500,0.503,39637,0.13],
  ["Kennesaw State University","Kennesaw","GA",1,57552,16972,0.481,23833,0.692,39503,0.354],
  ["Florida International University","Miami","FL",1,60249,9133,0.739,16500,0.588,38761,0.404],
  ["University of Houston","Houston","TX",1,62377,13853,0.649,18194,0.695,37175,0.409],
  ["Cal State Fullerton","Fullerton","CA",1,62951,5646,0.692,13750,0.867,36956,0.471],
  ["Indiana University","Bloomington","IN",1,63742,15342,0.812,19509,0.804,36571,0.167],
  ["Rutgers – New Brunswick","New Brunswick","NJ",1,74479,23519,0.85,21500,0.654,36357,0.272],
  ["University of South Florida","Tampa","FL",1,57743,10043,0.746,17988,0.41,36299,0.299],
  ["UW – Madison","Madison","WI",1,73792,16928,0.893,20484,0.434,35665,0.153],
  ["UIUC","Champaign","IL",1,81054,15201,0.849,19500,0.437,34623,0.238],
  ["Texas State University","San Marcos","TX",1,56906,16438,0.562,21000,0.895,34547,0.362],
  ["Cal State Long Beach","Long Beach","CA",1,64403,8931,0.699,14289,0.471,34131,0.493],
  ["University of Florida","Gainesville","FL",1,71588,6351,0.915,15000,0.24,34102,0.22],
  ["UC San Diego","La Jolla","CA",1,84943,11750,0.876,15500,0.245,33787,0.329],
  ["University of North Texas","Denton","TX",1,57010,14352,0.596,19250,0.725,33680,0.361],
  ["San Diego State University","San Diego","CA",1,64909,16174,0.783,15000,0.344,33654,0.314],
  ["Univ. of Michigan","Ann Arbor","MI",1,83648,14832,0.932,19500,0.179,33488,0.176],
  ["UC Berkeley","Berkeley","CA",1,92446,14979,0.929,13000,0.117,33073,0.273],
  ["UCLA","Los Angeles","CA",1,82511,14013,0.927,14000,0.087,33040,0.271],
  ["Texas Tech University","Lubbock","TX",1,62454,20071,0.675,21500,0.709,32446,0.258],
  ["Cal State Northridge","Northridge","CA",1,59115,7599,0.562,13872,0.932,32357,0.56],
  ["University of Alabama","Tuscaloosa","AL",1,59221,22150,0.737,22750,0.758,32323,0.18],
  ["Florida State University","Tallahassee","FL",1,61675,10997,0.83,18000,0.254,31812,0.238],
  ["UC Davis","Davis","CA",1,80838,15288,0.851,13000,0.416,31777,0.308],
  ["Univ. of Washington","Seattle","WA",1,78466,13485,0.837,14615,0.425,31588,0.155],
  ["CU Boulder","Boulder","CO",1,69738,21480,0.75,19500,0.833,31578,0.148],
  ["Virginia Tech","Blacksburg","VA",1,81698,23790,0.863,21500,0.57,30435,0.15],
  ["UNC Chapel Hill","Chapel Hill","NC",1,72200,12983,0.921,14000,0.187,20556,0.203],
  ["Georgia Tech","Atlanta","GA",1,102772,13289,0.923,21672,0.165,18260,0.137],
  ["Southern New Hampshire Univ.","Manchester","NH",2,50318,33742,0.449,21082,0.961,156755,0.469],
  ["Western Governors University","Salt Lake City","UT",2,60615,10442,0.509,11116,null,135822,0.349],
  ["Liberty University","Lynchburg","VA",2,44813,29552,0.635,24500,0.993,50059,0.391],
  ["BYU–Idaho","Rexburg","ID",2,53406,7131,0.551,13969,0.97,42090,0.249],
  ["Brigham Young University","Provo","UT",2,75790,14487,0.822,11069,0.692,32221,0.323],
  ["New York University","New York","NY",2,82509,35035,0.885,20500,0.094,29430,0.186],
  ["USC","Los Angeles","CA",2,92498,31927,0.92,18000,0.1,20817,0.217],
  ["Boston University","Boston","MA",2,83238,26996,0.9,23250,0.109,17850,0.18],
  ["Keiser University","Fort Lauderdale","FL",2,39696,34439,0.442,26125,0.974,17370,0.576],
  ["Cornell University","Ithaca","NY",2,104043,32337,0.951,14000,0.082,15935,0.182],
  ["Northeastern University","Boston","MA",2,92538,32116,0.904,24250,0.057,15719,0.123],
  ["Syracuse University","Syracuse","NY",2,79164,41026,0.814,26000,0.417,15245,0.162],
  ["Baylor University","Waco","TX",2,65793,41942,0.802,23000,0.51,15007,0.13],
  ["Savannah College of Art & Design","Savannah","GA",2,45954,45450,0.705,25148,0.837,14423,0.185],
  ["DePaul University","Chicago","IL",2,68751,29141,0.7,23168,0.735,14283,0.307],
  ["Drexel University","Philadelphia","PA",2,84648,38428,0.771,25325,0.775,13509,0.252],
  ["Rochester Inst. of Technology","Rochester","NY",2,76571,29694,0.708,26778,0.714,13225,0.261],
  ["University of Miami","Coral Gables","FL",2,75328,36803,0.842,17500,0.185,12570,0.154],
  ["Loyola University Chicago","Chicago","IL",2,71530,35196,0.769,24157,0.814,11576,0.232],
  ["Texas Christian University","Fort Worth","TX",2,68424,33531,0.856,21500,0.426,10919,0.135],
  ["George Washington University","Washington","DC",2,90873,37454,0.852,20449,0.435,10848,0.148],
  ["University of Pennsylvania","Philadelphia","PA",2,111371,31229,0.968,15715,0.059,10768,0.157],
  ["Bellevue University","Bellevue","NE",2,61289,28345,0.559,20000,null,10426,0.289],
  ["Fordham University","Bronx","NY",2,85569,42581,0.803,24300,0.563,10239,0.209],
  ["University of Tampa","Tampa","FL",2,59436,35634,0.619,24211,0.409,10093,0.156],
  ["Boston College","Chestnut Hill","MA",2,103937,39866,0.91,19000,0.157,9865,0.127],
  ["Columbia University","New York","NY",2,102491,20148,0.95,21500,0.042,8899,0.225],
  ["Stanford University","Stanford","CA",2,124080,12136,0.928,12000,0.039,7841,0.192],
  ["Harvard University","Cambridge","MA",2,101817,16816,0.973,14000,0.035,7755,0.158],
  ["University of Chicago","Chicago","IL",2,91885,18967,0.949,15000,0.048,7540,0.145],
  ["Georgetown University","Washington","DC",2,103494,39433,0.943,15500,0.131,7462,0.103],
  ["Carnegie Mellon University","Pittsburgh","PA",2,114862,31671,0.925,21750,0.114,7187,0.152],
  ["Vanderbilt University","Nashville","TN",2,91565,19040,0.927,14000,0.063,7143,0.185],
  ["Yale University","New Haven","CT",2,100533,27818,0.963,12975,0.045,6811,0.192],
  ["Duke University","Durham","NC",2,97800,34454,0.958,13000,0.068,6417,0.127],
  ["Santa Clara University","Santa Clara","CA",2,109183,50959,0.885,19162,0.438,6235,0.109],
  ["Lehigh University","Bethlehem","PA",2,105584,33549,0.892,21960,0.293,5803,0.178],
  ["Princeton University","Princeton","NJ",2,110066,10555,0.971,10320,0.045,5579,0.187],
  ["Worcester Polytechnic Inst.","Worcester","MA",2,103470,43273,0.884,27000,0.585,5344,0.103],
  ["MIT","Cambridge","MA",2,143372,19813,0.961,14768,0.047,4571,0.19],
  ["Rice University","Houston","TX",2,89718,12640,0.957,11000,0.079,4562,0.161],
  ["Bentley University","Waltham","MA",2,120959,38787,0.882,25023,0.484,4288,0.151],
  ["Stevens Inst. of Technology","Hoboken","NJ",2,108772,40468,0.899,27000,0.434,4084,0.205],
  ["MCPHS University","Boston","MA",2,125557,35084,0.633,25000,0.852,3474,0.282],
  ["Babson College","Wellesley","MA",2,123938,38876,0.924,20000,0.197,2696,0.142],
  ["Claremont McKenna College","Claremont","CA",2,104736,27384,0.952,13500,0.111,1379,0.195],
  ["Harvey Mudd College","Claremont","CA",2,138687,32492,0.938,25000,0.131,915,0.141],
  ["Albany College of Pharmacy","Albany","NY",2,131426,26027,0.688,25500,0.591,509,0.293],
  ["Olin College","Needham","MA",2,129455,20575,0.922,19500,0.217,373,0.135],
  ["UHSP St. Louis","Saint Louis","MO",2,137047,33596,0.755,17755,0.751,274,0.288],
  ["University of Phoenix","Phoenix","AZ",3,37752,13571,0.195,31553,null,76996,0.453],
  ["Grand Canyon University","Phoenix","AZ",3,42186,21931,0.43,22114,0.604,68619,0.431],
  ["American Public University","Charles Town","WV",3,44409,9104,0.532,21743,null,38976,0.247],
  ["DeVry University","Lisle","IL",3,45987,30878,0.369,24807,0.433,25975,0.652],
  ["Colorado Technical University","Colorado Springs","CO",3,37180,14954,0.176,29832,null,25932,0.683],
  ["Full Sail University","Winter Park","FL",3,38219,31759,0.496,27000,null,25195,0.567],
  ["Ashford University","San Diego","CA",3,35404,25321,0.088,31250,null,23734,0.311],
  ["Post University","Waterbury","CT",3,38696,19196,0.353,30157,null,18975,0.73],
  ["Capella University","Minneapolis","MN",3,42189,18305,0.333,14968,null,16173,0.366],
  ["Columbia Southern University","Orange Beach","AL",3,63534,14975,0.372,21339,null,13053,0.212],
  ["Chamberlain University","Addison","IL",3,92405,26933,0.5,20919,0.886,12188,0.299],
  ["ECPI University","Virginia Beach","VA",3,42837,20473,0.447,20000,0.829,11270,0.486],
  ["Strayer University","Washington","DC",3,40092,18918,0.2,40621,null,10087,0.528],
  ["Escoffier Culinary – Boulder","Boulder","CO",3,32001,12193,0.459,9653,null,8571,0.485],
  ["Rasmussen University","St. Cloud","MN",3,39080,19071,0.532,20899,null,8033,0.509],
  ["South Florida Inst. of Technology","Miami","FL",3,28570,29731,0.752,9500,null,7800,0.677],
  ["American InterContinental Univ.","Chandler","AZ",3,36144,14449,0.212,31000,null,6734,0.729],
  ["South University Online","Savannah","GA",3,34421,26308,0.051,26123,null,6492,0.763],
  ["West Coast University – OC","Anaheim","CA",3,102672,36836,0.643,32946,null,3168,0.412],
  ["St Paul's School of Nursing","Rego Park","NY",3,104403,31766,0.415,25730,null,945,0.451],
  ["Gnomon (VFX school)","Hollywood","CA",3,114785,45824,0.667,28332,0.397,302,0.143],
  ["Center for Allied Health Ed.","Brooklyn","NY",3,107249,35431,0.25,13626,0.185,113,0.385],
];

// [school, program, credential, earnings 4 yrs after completion, median debt, completers]
export const PROGRAMS = [
  ["Georgia Tech","Computer & Information Sciences","Master's",164999,20500,2076],
  ["Georgia Tech","Business Administration (MBA)","Master's",155081,79015,308],
  ["Georgia Tech","Computer & Information Sciences","BS/BA",127253,20500,739],
  ["Georgia Tech","Electrical Engineering","Master's",125290,25618,334],
  ["Georgia Tech","Computer Science","Master's",119795,40321,174],
  ["Georgia Tech","Aerospace Engineering","Master's",111895,null,110],
  ["Georgia Tech","Computer Engineering","BS/BA",106200,20000,153],
  ["Georgia Tech","Mechanical Engineering","Master's",103362,20500,223],
  ["Georgia Tech","Industrial Engineering","BS/BA",101070,19791,338],
  ["Georgia Tech","Architectural Sciences","Master's",97587,58158,74],
  ["Georgia Tech","Electrical Engineering","BS/BA",96402,22250,164],
  ["Georgia Tech","Chemical Engineering","BS/BA",92771,26250,185],
  ["Georgia Tech","Civil Engineering","Master's",91588,21044,68],
  ["Georgia Tech","Aerospace Engineering","BS/BA",90670,22000,201],
  ["Georgia Tech","Biomedical Engineering","BS/BA",89405,21375,252],
  ["Georgia Tech","Mechanical Engineering","BS/BA",87372,22500,510],
  ["Georgia Tech","Civil Engineering","BS/BA",82297,18750,112],
  ["Georgia Tech","Physics","BS/BA",80433,21500,35],
  ["Georgia Tech","Materials Engineering","BS/BA",79346,16936,55],
  ["Georgia Tech","Business Administration","BS/BA",78313,21500,391],
  ["Georgia Tech","Digital Media & Communication","BS/BA",77892,27840,39],
  ["Georgia Tech","Industrial Design","BS/BA",74666,26354,61],
  ["Georgia Tech","Environmental Engineering","BS/BA",71742,25102,43],
  ["Georgia Tech","Biochemistry & Molecular Biology","BS/BA",63773,24250,62],
  ["Georgia Tech","City & Regional Planning","Master's",63634,47538,40],
  ["Georgia Tech","Architecture","BS/BA",58085,28192,40],
  ["Georgia Tech","Biology","BS/BA",54251,24250,87],
  ["Georgia Tech","Science, Technology & Society","BS/BA",54136,24250,59],
  ["UC Berkeley","Drama & Theatre Arts","BS/BA",29047,15012,38],
  ["UC Berkeley","Film & Photographic Arts","BS/BA",39506,15000,75],
  ["UC Berkeley","Fine & Studio Arts","BS/BA",46596,12464,97],
  ["UC Berkeley","Romance Languages","BS/BA",50767,11593,69],
  ["UC Berkeley","Rhetoric","BS/BA",51969,13000,56],
  ["UC Berkeley","English Literature","BS/BA",52942,12979,247],
  ["UC Berkeley","Philosophy","BS/BA",53357,13345,101],
  ["UC Berkeley","Cell & Molecular Biology","BS/BA",53788,13450,829],
  ["UC Berkeley","Anthropology","BS/BA",54062,12572,96],
  ["UC Berkeley","Ethnic & Gender Studies","BS/BA",54840,15076,118],
  ["UC Berkeley","Linguistics","BS/BA",55407,14000,78],
  ["UC Berkeley","History","BS/BA",56461,13034,131],
  ["UC Berkeley","Legal Studies","BS/BA",56692,13000,216],
  ["UC Berkeley","Social Work","BS/BA",60405,13000,79],
  ["UC Berkeley","Physics","BS/BA",61607,15000,129],
  ["UC Berkeley","Biology","BS/BA",61867,13000,233],
  ["UC Berkeley","Political Science","BS/BA",62430,13000,496],
  ["UC Berkeley","Architecture","BS/BA",63901,15000,115],
  ["UC Berkeley","Sociology","BS/BA",64119,13000,356],
  ["UC Berkeley","Chemistry","BS/BA",64496,11077,113],
  ["UC Berkeley","Nutrition Sciences","BS/BA",64929,14177,99],
  ["UC Berkeley","Public Health","BS/BA",67892,11708,223],
  ["UC Berkeley","Earth Sciences","BS/BA",68030,null,34],
  ["UC Berkeley","Natural Resources","BS/BA",72049,12817,482],
  ["UC Berkeley","Media Studies","BS/BA",76374,11100,268],
  ["UC Berkeley","Interdisciplinary Studies","BS/BA",76643,14500,109],
  ["UC Berkeley","Area Studies","BS/BA",77557,14839,96],
  ["UC Berkeley","Natural Resources","Master's",80426,null,78],
  ["UC Berkeley","Urban Studies","BS/BA",81737,15000,35],
  ["UC Berkeley","Natural Resources","Doctorate",82283,null,44],
  ["UC Berkeley","Civil Engineering","BS/BA",91006,14342,89],
  ["UC Berkeley","Public Health","Master's",91432,null,248],
  ["UC Berkeley","Cognitive Science","BS/BA",91715,14589,265],
  ["UC Berkeley","Civil Engineering","Master's",92372,null,179],
  ["UC Berkeley","Social Sciences (Data/Econ)","BS/BA",97257,15000,217],
  ["UC Berkeley","Mechanical Engineering","BS/BA",98455,13000,170],
  ["UC Berkeley","Statistics","BS/BA",102151,15400,148],
  ["UC Berkeley","Public Policy","Master's",103343,null,108],
  ["UC Berkeley","Economics","BS/BA",106624,12650,758],
  ["UC Berkeley","Chemical Engineering","BS/BA",108067,18155,146],
  ["UC Berkeley","Optometry","Professional",112227,151667,64],
  ["UC Berkeley","Applied Mathematics","BS/BA",120626,14500,275],
  ["UC Berkeley","Business Administration","BS/BA",123780,11300,392],
  ["UC Berkeley","Chemistry","Doctorate",129330,null,53],
  ["UC Berkeley","Mechanical Engineering","Master's",131211,null,116],
  ["UC Berkeley","Electrical Engineering","Master's",158594,null,161],
  ["UC Berkeley","Information Science","Master's",172291,null,370],
  ["UC Berkeley","Computer Science","BS/BA",178867,13750,797],
  ["UC Berkeley","Law (JD)","Professional",182943,155891,327],
  ["UC Berkeley","Electrical Engineering","BS/BA",202911,13674,516],
];

export const FACTS = [
  "For-profit colleges are the most numerous sector (2,420 schools) but enrol only about 8% of undergraduates.",
  "Public institutions enrol about 73% of all undergraduates, at roughly half the median net price of private ones.",
  "For-profit alumni earn about $22K a year less than nonprofit alumni ten years out, at a similar net price.",
  "Net price barely predicts earnings across schools: the correlation is only r = 0.32.",
  "Average SAT and completion rate move together closely (r = 0.80). Schools averaging over 1,450 graduate more than 90% of students.",
  "Schools with more Pell-grant students show lower alumni earnings (r = −0.48). That partly reflects who enrols, not just how good the school is.",
  "Median earnings rise with the credential a school mainly awards: certificate $31K, associate $40K, bachelor's $54K, graduate $65K.",
  "MIT tops the earnings table: $143K median, ten years after entry.",
  "Connecticut ($55K) and Massachusetts ($53K) have the highest state median earnings. Puerto Rico ($24.5K) has the lowest.",
  "The number of schools in the Scorecard peaked at 7,869 in 2013-14. The latest file has 6,429.",
  "Undergraduate enrolment in the Scorecard peaked near 17.3M around 2011 and is now about 14.1M.",
  "Georgia Tech's admission rate fell from 70% in 2004 to 16%, while its completion rate rose from 68% to 92%.",
  "Georgia Tech alumni out-earn alumni of 99.7% of public four-year universities.",
  "UC Berkeley pairs top-1% earnings with median debt lower than 94% of public peers.",
  "A Berkeley electrical-engineering bachelor's earns $203K four years out, more than its law degree ($183K), on about $14K of debt instead of $156K.",
  "First professional degrees (law, medicine, pharmacy) have the highest median earnings, $97K, and the highest median debt, $141K.",
  "Across 6,429 schools, earnings and debt rise together (r = 0.47): schools that cost more also tend to pay more.",
  "Georgia Tech's largest program, the CS master's (2,076 completers), earns a median $165K four years out.",
];

export const SECTOR = { 1: "Public", 2: "Private nonprofit", 3: "For-profit" };
export const SECTOR_HEX = { 1: "#5aa9ff", 2: "#f4b740", 3: "#ff6f6f" };

const money = (v) => "$" + Math.round(v).toLocaleString("en-US");
const pct = (v) => Math.round(v * 100) + "%";

/** better: which end of the scale is the right answer. */
export const METRICS = {
  earn: { key: "earn", tag: "Earnings", ask: "Whose alumni earn more?", sub: "median earnings 10 years after entry", better: "high", get: (s) => s[4], fmt: money },
  price: { key: "price", tag: "Net price", ask: "Which costs less after aid?", sub: "average annual net price", better: "low", get: (s) => s[5], fmt: money },
  comp: { key: "comp", tag: "Completion", ask: "Which graduates more students?", sub: "share completing within 150% of normal time", better: "high", get: (s) => s[6], fmt: pct },
  debt: { key: "debt", tag: "Debt", ask: "Which leaves students with less debt?", sub: "median debt at graduation", better: "low", get: (s) => s[7], fmt: money },
  adm: { key: "adm", tag: "Selectivity", ask: "Which is harder to get into?", sub: "admission rate (lower is harder)", better: "low", get: (s) => s[8], fmt: pct },
  pell: { key: "pell", tag: "Access", ask: "Which enrols more low-income students?", sub: "share of undergrads on Pell grants", better: "high", get: (s) => s[10], fmt: pct },
  prog: { key: "prog", tag: "Programs", ask: "Which program pays more?", sub: "median earnings 4 years after completing", better: "high", get: (p) => p[3], fmt: money },
};

/**
 * Ratio bands between the two values. Easy pairs are far apart, hard pairs
 * are close but never a coin flip (a 4% gap is the floor).
 */
export const DIFFICULTY = {
  easy: { label: "Freshman", min: 1.45, max: 99 },
  normal: { label: "Junior", min: 1.15, max: 1.6 },
  hard: { label: "Grad school", min: 1.04, max: 1.2 },
};

function schoolCard(s) {
  return { title: s[0], line: `${s[1]}, ${s[2]}`, tagline: SECTOR[s[3]], color: SECTOR_HEX[s[3]], sector: s[3] };
}

function programCard(p) {
  return {
    title: p[1],
    line: `${p[0]} · ${p[2]}`,
    tagline: `${p[5].toLocaleString("en-US")} completers`,
    color: p[0] === "Georgia Tech" ? "#d7b46a" : "#3b7ea1",
    sector: 0,
  };
}

/**
 * One gate's worth of question: two cards, which side is right, and the
 * sentence the sidebar shows once it is answered. `recent` is a Set of titles
 * shown lately so the same school does not come round three gates running.
 */
export function makeQuestion(rng, enabled, difficulty, recent) {
  const band = DIFFICULTY[difficulty];
  for (let attempt = 0; attempt < 400; attempt++) {
    const metric = METRICS[rng.pick(enabled)];
    const pool = metric.key === "prog" ? PROGRAMS : SCHOOLS;
    const a = rng.pick(pool);
    const va = metric.get(a);
    if (va == null || recent.has(a[0] + a[1])) continue;

    const candidates = pool.filter((b) => {
      if (b === a || recent.has(b[0] + b[1])) return false;
      const vb = metric.get(b);
      if (vb == null || vb === 0) return false;
      const r = Math.max(va, vb) / Math.min(va, vb);
      return r >= band.min && r < band.max;
    });
    if (!candidates.length) continue;
    const b = rng.pick(candidates);
    const vb = metric.get(b);

    // Randomise which lane the right answer sits in.
    const swap = rng() < 0.5;
    const left = swap ? b : a;
    const right = swap ? a : b;
    const vl = metric.get(left);
    const vr = metric.get(right);
    const leftWins = metric.better === "high" ? vl > vr : vl < vr;

    const card = metric.key === "prog" ? programCard : schoolCard;
    return {
      metric,
      sides: [
        { ...card(left), value: vl, label: metric.fmt(vl) },
        { ...card(right), value: vr, label: metric.fmt(vr) },
      ],
      answer: leftWins ? 0 : 1,
      ids: [left[0] + left[1], right[0] + right[1]],
    };
  }
  return null;
}
