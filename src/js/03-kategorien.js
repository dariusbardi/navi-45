// ---------- Kategorien ----------
const IC = {
  fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10M14 8l3 3v6a1.5 1.5 0 0 0 3 0V9l-3-3"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.5 11h10L20 7H6.5"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/></svg>',
  bread:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M5 11a4 4 0 0 1 2-7.5c1.5 0 2.5.5 5 .5s3.5-.5 5-.5a4 4 0 0 1 2 7.5V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/></svg>',
  cup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M7 2.5v2.5M11 2.5v2.5"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>',
  fork: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.5 1.5-3.5 4-3.5 8h3.5"/></svg>',
  pizza:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M3 5c6-3 12-3 18 0L12 22z"/><circle cx="10" cy="9" r="1.2" fill="currentColor"/><circle cx="14.5" cy="11" r="1.2" fill="currentColor"/><circle cx="12" cy="15" r="1.2" fill="currentColor"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  euro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6.5A7 7 0 1 0 18 17.5M4 10h9M4 14h9"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M3 15h18M8 5v4M16 5v4M8 15v4M16 15v4"/></svg>',
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  house: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 11.5h3V21h5.5v-6h3v6H19v-9.5h3z"/></svg>',
  work: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 4h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V6a2 2 0 0 1 2-2zm0 3h6V6H9z"/></svg>',
  plusc:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>'
};
const CATS = [
  {
    id: 'charge',
    label: 'Laden',
    bg: '#30b0c7',
    fg: '#fff',
    svg: 'bolt',
    tag: 'amenity:charging_station',
    q: ['Ladestation', 'Ladesäule', 'Ladepunkt', 'SWM', 'EnBW', 'Allego', 'E.ON', 'Stadtwerke', 'Aldi', 'Lidl', 'Kaufland'],
    scout: ['charging_station']
  },
  {
    id: 'mc',
    subs: ['fast_food', 'restaurant'],
    label: "McDonald's",
    bg: '#ffbc0d',
    fg: '#da291c',
    glyph: 'M',
    tag: 'amenity:fast_food',
    q: ["McDonald's"],
    match: /mc ?donald/i,
    dt: true
  },
  {
    id: 'bk',
    subs: ['fast_food', 'restaurant'],
    label: 'Burger King',
    bg: '#d62300',
    fg: '#ffe5b4',
    glyph: 'BK',
    tag: 'amenity:fast_food',
    q: ['Burger King'],
    match: /burger king/i,
    dt: true
  },
  {
    id: 'kfc',
    subs: ['fast_food', 'restaurant'],
    label: 'KFC',
    bg: '#a3080c',
    fg: '#fff',
    glyph: 'KFC',
    tag: 'amenity:fast_food',
    q: ['KFC'],
    match: /kfc|kentucky/i,
    dt: true
  },
  {
    id: 'subway',
    subs: ['fast_food', 'restaurant'],
    label: 'Subway',
    bg: '#008c15',
    fg: '#ffc600',
    glyph: 'S',
    tag: 'amenity:fast_food',
    q: ['Subway'],
    match: /subway/i
  },
  {
    id: 'doener',
    subs: ['fast_food', 'restaurant'],
    label: 'Döner',
    bg: '#b03a2e',
    fg: '#fff',
    svg: 'fork',
    tag: 'amenity',
    q: ['Döner', 'Kebab', 'Kebap'],
    match: /d[öo]ner|kebab|kebap/i
  },
  {
    id: 'pizza',
    subs: ['fast_food', 'restaurant'],
    label: 'Pizza',
    bg: '#e74c3c',
    fg: '#fff',
    svg: 'pizza',
    tag: 'amenity',
    q: ['Pizza', 'Pizzeria'],
    match: /pizz/i
  },
  {
    id: 'rest',
    subs: ['restaurant', 'biergarten'],
    label: 'Restaurant',
    bg: '#ff6b35',
    fg: '#fff',
    svg: 'fork',
    tag: 'amenity:restaurant',
    q: ['Restaurant', 'Gasthof', 'Gasthaus', 'Wirtshaus', 'Ristorante', 'Trattoria', 'Brauhaus', 'Bistro', 'Biergarten']
  },
  {
    id: 'fuel',
    subs: ['fuel'],
    label: 'Tankstelle',
    bg: '#34c759',
    fg: '#fff',
    svg: 'fuel',
    tag: 'amenity:fuel',
    q: ['Aral', 'Shell', 'Esso', 'JET', 'TotalEnergies', 'Agip', 'OMV', 'BayWa', 'Avia', 'Tankstelle']
  },
  {
    id: 'super',
    subs: ['supermarket'],
    label: 'Supermarkt',
    bg: '#ff9500',
    fg: '#fff',
    svg: 'cart',
    tag: 'shop:supermarket',
    q: ['Edeka', 'Rewe', 'Aldi', 'Lidl', 'Netto', 'Penny', 'Kaufland', 'Norma', 'Supermarkt']
  },
  {
    id: 'baker',
    subs: ['bakery'],
    label: 'Bäckerei',
    bg: '#a2845e',
    fg: '#fff',
    svg: 'bread',
    tag: 'shop:bakery',
    q: ['Bäckerei', 'Bäcker', 'Backhaus', 'Backstube', 'Café']
  },
  {
    id: 'cafe',
    subs: ['cafe'],
    label: 'Café',
    bg: '#8e5a2b',
    fg: '#fff',
    svg: 'cup',
    tag: 'amenity:cafe',
    q: ['Café', 'Cafe', 'Starbucks', 'Coffee']
  },
  {
    id: 'drug',
    subs: ['chemist'],
    label: 'Drogerie',
    bg: '#5856d6',
    fg: '#fff',
    svg: 'drop',
    tag: 'shop:chemist',
    q: ['dm', 'Rossmann', 'Müller', 'Drogerie']
  },
  {
    id: 'pharm',
    subs: ['pharmacy'],
    label: 'Apotheke',
    bg: '#e30613',
    fg: '#fff',
    svg: 'plus',
    tag: 'amenity:pharmacy',
    q: ['Apotheke']
  },
  {
    id: 'bank',
    subs: ['bank'],
    label: 'Bank',
    bg: '#0a84ff',
    fg: '#fff',
    svg: 'euro',
    tag: 'amenity:bank',
    q: [
      'Sparkasse',
      'Volksbank',
      'Raiffeisenbank',
      'Deutsche Bank',
      'Commerzbank',
      'HypoVereinsbank',
      'Postbank',
      'Sparda',
      'Bank'
    ]
  },
  {
    id: 'cinema',
    subs: ['cinema'],
    label: 'Kino',
    bg: '#1c1c1e',
    fg: '#fff',
    svg: 'film',
    tag: 'amenity:cinema',
    q: ['Kino', 'Cinema', 'Cineplex', 'Kinopolis', 'Mathäser']
  }
];
const catIcon = (c, cls = '') => `<i class="${cls}" style="background:${c.bg};color:${c.fg}">${c.glyph || IC[c.svg]}</i>`;
const glyphOf = c => (c ? c.glyph || IC[c.svg] : IC.pin);
