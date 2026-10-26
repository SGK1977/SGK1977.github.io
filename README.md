# Spain trip guide

A day-by-day guide to the Spain trip (November 22–30, 2026) for the family. It reads the plans from the **Spain Itinerary** Google Sheet and adds maps, directions, parking, opening hours and other tips.

## Opening it

- **Quickest:** double-click `index.html`. Everything works straight from the folder.
- **On localhost:** point any static web server at this folder. There's no server code.
  - **IIS:** add a website or virtual directory whose physical path is this folder. The included `web.config` lets IIS serve the font files and open `index.html` by default.
  - **Python:** run `python -m http.server 8080` in this folder, then open http://localhost:8080
  - **VS Code:** right-click `index.html` and choose "Open with Live Server".

A localhost address only works on this computer (or other devices on your home network, if you allow it). To open the guide on phones while you're in Spain, it needs to be hosted somewhere public.

## What each page shows

- **A day** (tap a tile in the date strip): the plan from the sheet, grouped by town, with directions, parking and tips. It also shows where you're sleeping that night, checkout reminders, and sunrise and sunset times. During the trip the guide opens on today's date (Spain time) and marks what's on now and next.
- **Whole trip:** all the stays, every day's plan, bookings with their cancellation terms, and the TODO tab.
- **Good to know:** emergency numbers, money, driving, Barcelona transport, packing, a few Spanish words, and the booking sites from the Misc tab.

## Where the content comes from

- Plans, stays, booking status, to-dos and booking sites come from the Google Sheet, from the tabs Summary, Seville, Setenil De., Ronda, Granada, Frigiliana, Malaga, Barcelona, Misc and TODO.
- Each time the page opens it reads the sheet live. The sheet must stay shared as "Anyone with the link can view".
- If Google can't be reached (no signal, for example), it shows the last copy that device loaded. On a device that has never loaded it, it shows the copy saved in `js/sheet-snapshot.js` (taken Oct 26, 2026).
- Maps, links, parking and tips live in `js/guide.js`. Edit that file to change them. Nothing in it changes the times or plans; those always come from the sheet.
- Once a day is within about two weeks, the town headings show a live weather forecast from Open-Meteo.

## Keeping the sheet readable for the site

- **Summary tab:** keep the DATE, LOCATION & RESERVATIONS and BOOKING STATUS columns. A row like `Nov 27 (Fri) :` starts a day, and the rows under it belong to that day.
- **Stays:** keep "Stay" in the row name, with the dates in brackets, e.g. `Stay (Nov 22 - Nov 24)` or `Granada Stay (Nov 24 only)`. Put the place in the next column with the site in brackets, e.g. `Mercer Residences (Expedia)`, and add a line like `Check in 3PM, Checkout 12 PM` under it.
- **City tabs:** put the date in the first column (only on the first row of each day), the time in the second and the plan in the third. A row holding just a link attaches to the plan above it.
- A plan that appears in both the Summary and a city tab is shown once, with the Summary's notes and booking status added.
- **New town tab:** add its name to `cityTabs` in `js/config.js`, in travel order.
- **Stop reading the sheet live:** set `liveSync: false` in `js/config.js`.

## Previewing a day of the trip

Add `?today=2026-11-24&now=12:10` to the address to see the guide as it will look at that moment (Spain time), including the "Now" and "Next" markers.

## Updating the saved copy

Open the guide while online, then in the browser's developer console run `downloadSheetSnapshot()`. Replace `js/sheet-snapshot.js` with the file it downloads.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page |
| `css/style.css` | Look and layout |
| `js/config.js` | Sheet ID, tab names, live-sync setting |
| `js/sheet-snapshot.js` | Saved copy of the sheet |
| `js/guide.js` | Maps, links, parking and tips |
| `js/app.js` | Reads the sheet and builds the pages |
| `fonts/` | Ibarra Real Nova and Atkinson Hyperlegible, with their licences (SIL Open Font License) |
| `favicon.svg` | Browser tab icon |
| `web.config` | IIS settings (ignored by other servers) |
