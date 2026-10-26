/* Settings for the Spain trip guide.
   The schedule is read from the Google Sheet below; js/sheet-snapshot.js is the
   saved copy used when the sheet can't be reached. */
window.TRIP_CONFIG = {
  sheetId: '1ecaiZcdZVr3sYVD46p4rvK5DGhHFoa52Oeg7y4tvObM',
  sheetUrl: 'https://docs.google.com/spreadsheets/d/1ecaiZcdZVr3sYVD46p4rvK5DGhHFoa52Oeg7y4tvObM/edit',

  // Tab names in the sheet. City tabs are listed in travel order.
  summaryTab: 'Summary',
  cityTabs: ['Seville', 'Setenil De.', 'Ronda', 'Granada', 'Frigiliana', 'Malaga', 'Barcelona'],
  linksTab: 'Misc',
  todoTab: 'TODO',

  year: 2026,                 // the sheet's dates ("Nov 22") don't include a year
  timeZone: 'Europe/Madrid',  // "today" and "next up" follow Spain time

  liveSync: true,             // false = always use the saved copy in js/sheet-snapshot.js
  liveTimeoutMs: 9000,
  weather: true               // live forecast from Open-Meteo once a day is within ~2 weeks
};
