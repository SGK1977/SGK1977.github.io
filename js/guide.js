/* Extra context layered on top of the Google Sheet: places, stays, tips and links.
   The schedule itself always comes from the sheet; nothing here changes times or plans.
   Edit freely. Matching is done with the regular expressions in "match". */
(function () {
  var gm = function (q) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  };

  window.TRIP_GUIDE = {
    mapsSearch: gm,

    /* One entry per city tab, keyed by the tab name in the sheet. */
    stops: {
      'Seville': {
        name: 'Seville', short: 'Seville', match: /sevill|sevilla/i, mapName: 'Seville, Spain',
        lat: 37.3891, lon: -5.9845,
        climate: 'Typical late-November weather: mild days, cool evenings.',
        about: 'Andalusia’s capital. The hotel is in the old centre, a few minutes from Las Setas (Metropol Parasol) and about 15 minutes on foot from the cathedral.',
        sections: [
          { title: 'Also worth seeing', items: [
            'Seville Cathedral and the Giralda bell tower, beside the Alcázar',
            'Barrio Santa Cruz, the lanes of the old Jewish quarter behind the Alcázar',
            'Las Setas (Metropol Parasol), with a rooftop walkway over the old town',
            'Plaza de España in María Luisa Park'
          ] }
        ],
        links: [
          { label: 'Visit Seville', url: 'https://visitasevilla.es/en/' },
          { label: 'Map', url: gm('Seville, Spain') }
        ]
      },

      'Setenil De.': {
        name: 'Setenil de las Bodegas', short: 'Setenil', match: /setenil/i, mapName: 'Setenil de las Bodegas, Spain',
        lat: 36.8636, lon: -5.1797,
        climate: 'Typical late-November weather: inland and cool, with chilly mornings.',
        key: 'The streets are very narrow. Park at the car park at the entrance to the village (turn in at the first roundabout) and walk in.',
        about: 'A white village built into a river gorge, where whole streets of houses sit under overhanging rock.',
        sections: [
          { title: 'What to see', items: [
            'Calle Cuevas del Sol and Calle Cuevas de la Sombra, the streets under the rock',
            'Mirador del Carmen viewpoint, with the big Setenil sign',
            'The castle tower (Torreón) next to the Church of the Incarnation'
          ] }
        ],
        links: [
          { label: 'About Setenil', url: 'https://en.wikipedia.org/wiki/Setenil_de_las_Bodegas' },
          { label: 'Map', url: gm('Setenil de las Bodegas') }
        ]
      },

      'Ronda': {
        name: 'Ronda', short: 'Ronda', match: /ronda/i, mapName: 'Ronda, Spain',
        lat: 36.7423, lon: -5.1671,
        climate: 'Typical late-November weather: cool, up in the mountains.',
        key: 'Park underground in the centre: Plaza del Socorro or La Merced (Calle Carlos Cobo), both a few minutes’ walk from the bridge.',
        about: 'A cliff-top town split by the El Tajo gorge and joined by the 18th-century Puente Nuevo bridge.',
        sections: [
          { title: 'Bridge viewpoints', items: [
            'Mirador de Aldehuela, right beside the bridge, with no climbing',
            'Jardines de Cuenca, terraced gardens facing the bridge, down a few flights of stairs',
            'With more time: a stepped path from Plaza María Auxiliadora drops into the gorge for the classic view, 15–20 minutes down and the same back up'
          ] }
        ],
        links: [
          { label: 'About Ronda', url: 'https://en.wikipedia.org/wiki/Ronda' },
          { label: 'Map', url: gm('Puente Nuevo, Ronda') }
        ]
      },

      'Granada': {
        name: 'Granada', short: 'Granada', match: /granada/i, mapName: 'Granada, Spain',
        lat: 37.1773, lon: -3.5986,
        climate: 'Typical late-November weather: cool days and cold nights, sometimes near freezing.',
        key: 'The old centre has camera-controlled restricted streets, and GPS apps often route through them. Ask your host where to park and whether they can register your number plate.',
        about: 'Home of the Alhambra, with the old Moorish quarter, the Albaicín, on the hill opposite.',
        sections: [
          { title: 'Evening ideas', items: [
            'Mirador de San Nicolás in the Albaicín has the classic view across to the Alhambra.',
            'Many Granada bars still bring a free tapa with each drink.'
          ] },
          { title: 'Driving', items: [
            'Granada has a low-emission zone. Rental cars carry the DGT environmental label that lets them in.'
          ] }
        ],
        links: [
          { label: 'Granada tourism', url: 'https://turismo.granada.org/en' },
          { label: 'Map', url: gm('Granada, Spain') }
        ]
      },

      'Frigiliana': {
        name: 'Frigiliana', short: 'Frigiliana', match: /frigiliana/i, mapName: 'Frigiliana, Spain',
        lat: 36.7900, lon: -3.8960,
        climate: 'Typical late-November weather: mild, close to the coast.',
        key: 'Use the underground public car park at the entrance to the old village, or the free roadside spaces on the road up (they fill up around lunchtime).',
        about: 'A whitewashed hill village above Nerja and the sea, with steep lanes in its Moorish-era old quarter.',
        sections: [
          { title: 'What to see', items: [
            'The old quarter (Barrio Mudéjar) and Calle Real',
            'Twelve ceramic plaques on the old-quarter walls telling the story of the 1569 Morisco uprising'
          ] },
          { title: 'Tonight', items: [
            'The stay is in Nerja, about 15 minutes’ drive down the hill. Its clifftop promenade, the Balcón de Europa, makes a good sunset walk.'
          ] }
        ],
        links: [
          { label: 'About Frigiliana', url: 'https://en.wikipedia.org/wiki/Frigiliana' },
          { label: 'Map', url: gm('Frigiliana') }
        ]
      },

      'Malaga': {
        name: 'Málaga', short: 'Málaga', match: /m[aá]laga/i, mapName: 'Málaga, Spain',
        lat: 36.7213, lon: -4.4214,
        climate: 'Typical late-November weather: the mildest stop of the trip.',
        key: 'Central car parks: Plaza de la Marina (Plaza de la Marina 5) and Alcazaba (Calle Muro de Santa Ana 4).',
        about: 'The Costa del Sol’s main city. The Alcazaba fortress, a Roman theatre, the cathedral and pedestrian Calle Larios are all close together.',
        sections: [],
        links: [
          { label: 'About Málaga', url: 'https://en.wikipedia.org/wiki/M%C3%A1laga' },
          { label: 'Map', url: gm('Málaga historic centre') }
        ]
      },

      'Barcelona': {
        name: 'Barcelona', short: 'Barcelona', match: /barcelona/i, mapName: 'Barcelona, Spain',
        lat: 41.3874, lon: 2.1686,
        climate: 'Typical late-November weather: mild days, cool evenings.',
        key: 'Nearest stations to the apartment: FGC Provença (2 minutes’ walk) and Diagonal on metro lines L3 and L5 (about 7 minutes).',
        about: 'Catalonia’s capital. The apartment is in the Eixample, a few minutes from Passeig de Gràcia and Gaudí’s Casa Milà and Casa Batlló.',
        sections: [
          { title: 'Getting around', items: [
            'The metro is the quickest way around. A T-casual card gives 10 rides for one person; a Hola Barcelona card gives unlimited rides for 2–5 days. Both are sold at station machines.'
          ] },
          { title: 'Pickpockets', items: [
            'Common on Las Ramblas, in the Gothic Quarter and on the metro. Keep bags zipped and phones out of back pockets.'
          ] }
        ],
        links: [
          { label: 'Barcelona tourism', url: 'https://thisisbarcelona.com/' },
          { label: 'Metro and buses (TMB)', url: 'https://www.tmb.cat/en/' },
          { label: 'Map', url: gm('Barcelona') }
        ]
      }
    },

    /* Typical drive times for legs where the sheet doesn't give one. Key: "from tab>to tab". */
    legs: {
      'Granada>Frigiliana': 'About 1 hour 15 minutes by car (roughly 100 km).',
      'Frigiliana>Malaga': 'About an hour along the coast from Nerja.'
    },

    /* Matched against the stay names in the Summary tab. */
    stays: [
      {
        match: /mercer/i, name: 'Mercer Residences Sevilla', area: 'Seville',
        address: 'Calle Amor de Dios 6, 41002 Seville',
        notes: ['No on-site garage. Listings mention valet parking at about €30 a night, so ask at the desk once you have the rental car.'],
        links: [{ label: 'Expedia trips', url: 'https://www.expedia.com/trips' }]
      },
      {
        match: /celi/i, name: 'Apartamentos Celi', area: 'Granada',
        addressNote: 'The address and check-in steps are in the Airbnb reservation.',
        notes: [],
        links: [{ label: 'Airbnb trips', url: 'https://www.airbnb.com/trips' }]
      },
      {
        match: /nerja/i, name: 'Home in Nerja', area: 'Nerja',
        addressNote: 'The address and check-in steps are in the Airbnb reservation.',
        notes: ['Nerja is about 15 minutes’ drive from Frigiliana.'],
        links: [{ label: 'Airbnb trips', url: 'https://www.airbnb.com/trips' }]
      },
      {
        match: /aspasios/i, name: 'Aspasios Garden Apartments', area: 'Barcelona',
        address: 'Carrer de Provença 205, 08008 Barcelona',
        notes: ['Arriving in the evening? The Expedia confirmation explains how to collect the keys.'],
        links: [{ label: 'Expedia trips', url: 'https://www.expedia.com/trips' }]
      }
    ],

    /* Matched against each plan in the sheet. "key" lines show under the plan;
       everything else sits behind "More about…". "plaque" names the day in the date strip. */
    activities: [
      {
        match: /alc[aá]zar/i, title: 'Real Alcázar', plaque: 'Alcázar',
        key: ['About 20 minutes’ walk from the hotel.'],
        about: 'A royal palace still used by the Spanish royal family: Mudéjar courtyards, tiled halls and large gardens. The cathedral and Giralda tower are right next door.',
        links: [
          { label: 'Official site', url: 'https://alcazarsevilla.org/' },
          { label: 'Map', url: gm('Real Alcázar de Sevilla') }
        ]
      },
      {
        match: /flamenco/i, title: 'Teatro Flamenco Sevilla',
        key: ['Calle Cuna 15, about 10 minutes’ walk from the hotel. Arrive 20–30 minutes early.'],
        about: 'About an hour of live flamenco (song, guitar and dance) in a small theatre.',
        links: [{ label: 'Map', url: gm('Teatro Flamenco Sevilla, Calle Cuna 15, Sevilla') }]
      },
      {
        match: /rental car|pick ?up.*\bcar\b/i, title: 'Rental car',
        key: ['Spain requires an International Driving Permit along with a US licence. AAA issues them.'],
        todo: /car rental|rental car|rent a car/i
      },
      {
        match: /bridge|puente nuevo|viewpoint/i, stop: 'Ronda', title: 'the viewpoints',
        key: ['Mirador de Aldehuela, right beside the bridge, needs no climbing.'],
        about: 'Jardines de Cuenca, a few flights of stairs down, faces the bridge. For the classic view from below, a stepped path from Plaza María Auxiliadora drops into the gorge: 15–20 minutes down and the same back up.',
        links: [
          { label: 'Mirador de Aldehuela', url: gm('Mirador de Aldehuela, Ronda') },
          { label: 'Jardines de Cuenca', url: gm('Jardines de Cuenca, Ronda') }
        ]
      },
      {
        match: /alhambra/i, title: 'The Alhambra', plaque: 'Alhambra',
        key: ['Bring passports. The Alhambra checks original ID against the names on the tickets.'],
        about: 'The Nasrid Palaces, the Alcazaba fortress and the Generalife gardens, on the hill above the city.',
        links: [
          { label: 'Official site', url: 'https://www.alhambra-patronato.es/en' },
          { label: 'Map', url: gm('Alhambra, Granada') }
        ]
      },
      {
        match: /g[uü]ell/i, title: 'Park Güell', plaque: 'Park Güell',
        key: ['From the apartment: taxi about 15 minutes, or metro L3 from Diagonal to Lesseps or Vallcarca, then a 15–20 minute uphill walk.'],
        about: 'Gaudí’s hillside park: the mosaic terrace, the dragon stairway and the gatehouses.',
        links: [
          { label: 'About Park Güell', url: 'https://en.wikipedia.org/wiki/Park_G%C3%BCell' },
          { label: 'Map', url: gm('Park Güell, Barcelona') }
        ]
      },
      {
        match: /plaza de espa[nñ]a|pla[cç]a d.?espanya/i, stop: 'Barcelona', title: 'Plaça d’Espanya',
        key: ['From Park Güell, metro L3 runs straight to Espanya with no change.'],
        about: 'A grand square at the foot of Montjuïc: the two Venetian towers, the steps up to the National Art Museum’s palace with its view over the city, and Las Arenas, a former bullring turned shopping centre with a rooftop terrace. The Magic Fountain’s light shows usually pause in late November; none were scheduled for November 2026 when this guide was made.',
        links: [{ label: 'Map', url: gm('Plaça d’Espanya, Barcelona') }]
      },
      {
        match: /sagrada/i, title: 'Sagrada Família', plaque: 'Sagrada',
        key: [
          'Metro L5 from Diagonal, two stops to Sagrada Família, or about 30 minutes on foot.',
          'Dress code: nothing see-through, shorts and skirts at least mid-thigh, no bare feet.'
        ],
        about: 'Gaudí’s basilica, under construction since 1882.',
        links: [
          { label: 'Official site', url: 'https://sagradafamilia.org/en/' },
          { label: 'Map', url: gm('Sagrada Família, Barcelona') }
        ]
      },
      {
        match: /barcelon+et+a|\bbeach\b/i, stop: 'Barcelona', title: 'Barceloneta',
        key: ['Metro L4 to Barceloneta.'],
        about: 'The city beach and the old fishermen’s quarter behind it, known for seafood and paella.',
        links: [{ label: 'Map', url: gm('Barceloneta Beach, Barcelona') }]
      },
      {
        match: /gothic|g[oò]tic/i, title: 'Gothic Quarter', plaque: 'Gothic Qtr',
        key: [{ text: 'On Sundays the cathedral’s tourist visit runs 2–5 PM (mornings are for Mass), and La Boqueria market is closed.', weekdays: [0] }],
        about: 'Barcelona’s medieval centre: narrow lanes, Roman walls and the cathedral. Look for the Carrer del Bisbe bridge, Plaça del Rei, Plaça Sant Felip Neri and Plaça Reial.',
        links: [
          { label: 'Barcelona Cathedral', url: 'https://catedralbcn.org/en/' },
          { label: 'Map', url: gm('Barri Gòtic, Barcelona') }
        ]
      },
      {
        match: /shopping/i, stop: 'Barcelona', title: 'Shopping',
        key: [
          { text: 'November 29 is one of Catalonia’s authorised shopping Sundays: malls and large stores can open, though smaller shops may not.', dates: ['2026-11-29'] },
          'Passeig de Gràcia is about 7 minutes’ walk from the apartment.'
        ],
        about: 'Portal de l’Àngel and El Corte Inglés are at Plaça de Catalunya, about 15 minutes’ walk from the apartment.'
      },
      {
        match: /arrive (in )?(seville|sevilla)/i, title: 'Arriving in Seville',
        key: ['Seville Airport (SVQ) is about 30 minutes from the hotel by taxi.']
      },
      {
        match: /(fly|flight) to barcelona/i, title: 'Málaga Airport (AGP)',
        key: ['Return the rental car at the airport and aim to be there about 2 hours before the flight.'],
        links: [{ label: 'Málaga Airport', url: 'https://www.aena.es/en/malaga-costa-del-sol.html' }]
      },
      {
        match: /arrive (in )?barcelona/i, title: 'Barcelona Airport to the apartment',
        key: ['Taxi about 30 minutes. Or the Aerobus to Plaça de Catalunya (about 35 minutes), then a 15-minute walk.'],
        links: [{ label: 'Aerobus', url: 'https://aerobusbarcelona.es/en/' }]
      },
      {
        match: /houston|fly out|airport/i, title: 'Getting to Barcelona Airport',
        key: ['Book a taxi the night before. The Aerobus also runs all night from Plaça de Catalunya: A1 goes to Terminal 1, A2 to Terminal 2, so check your airline’s terminal.'],
        links: [{ label: 'Aerobus', url: 'https://aerobusbarcelona.es/en/' }]
      }
    ],

    /* Tips that belong to a whole day rather than one plan. */
    days: {
      '2026-11-22': { tips: [
        'Las Setas (Metropol Parasol) is a few minutes from the hotel and makes an easy first-evening walk.',
        'Most restaurants start serving dinner around 8:30 PM.'
      ] },
      '2026-11-24': { tips: ['Fill the tank before leaving Seville.'] },
      '2026-11-30': { tips: ['Leave the keys the way the apartment asks before you head out.'] }
    },

    /* Sunrise and sunset where you'll be in the evening (Spain time). */
    sun: {
      '2026-11-22': { place: 'Seville', rise: '8:10 AM', set: '6:09 PM' },
      '2026-11-23': { place: 'Seville', rise: '8:11 AM', set: '6:08 PM' },
      '2026-11-24': { place: 'Granada', rise: '8:02 AM', set: '5:59 PM' },
      '2026-11-25': { place: 'Nerja', rise: '8:03 AM', set: '6:00 PM' },
      '2026-11-26': { place: 'Málaga', rise: '8:06 AM', set: '6:02 PM' },
      '2026-11-27': { place: 'Barcelona', rise: '7:53 AM', set: '5:23 PM' },
      '2026-11-28': { place: 'Barcelona', rise: '7:54 AM', set: '5:23 PM' },
      '2026-11-29': { place: 'Barcelona', rise: '7:55 AM', set: '5:23 PM' },
      '2026-11-30': { place: 'Barcelona', rise: '7:57 AM', set: '5:22 PM' }
    },

    /* Booking sites listed in the Misc tab. */
    sites: [
      { match: /expedia/i, label: 'Expedia', url: 'https://www.expedia.com/trips' },
      { match: /airbnb/i, label: 'Airbnb', url: 'https://www.airbnb.com/trips' },
      { match: /viator/i, label: 'Viator', url: 'https://www.viator.com/' },
      { match: /flamenco/i, label: 'Teatro Flamenco Sevilla', url: 'https://teatroflamencosevilla.com' }
    ],

    /* The "Good to know" page. */
    info: [
      { title: 'Emergencies', items: [
        { text: 'Call 112 for police, ambulance or fire anywhere in Spain.', tel: '112' },
        { text: 'U.S. Embassy Madrid, Calle de Serrano 75. Emergency line for U.S. citizens, 24 hours: +34 91 587 2200.', tel: '+34915872200' },
        { text: 'U.S. Embassy and consulates in Spain', url: 'https://es.usembassy.gov/' }
      ] },
      { title: 'Time and money', items: [
        'Spain is 7 hours ahead of Houston in late November.',
        'The currency is the euro. Cards and tap-to-pay work almost everywhere.',
        'Tipping is modest: round up, or leave 5–10% for good table service.',
        'Plugs have two round pins (types C and F) at 230 volts. Bring adapters; most phone and laptop chargers handle 230 volts.'
      ] },
      { title: 'Eating', items: [
        'Lunch is the main meal, roughly 1:30 to 4 PM. Dinner starts around 8:30 PM.',
        'In Granada, many bars bring a free tapa with each drink.'
      ] },
      { title: 'Driving', items: [
        'Spain requires an International Driving Permit along with a US licence. AAA issues them.',
        'Old town centres have narrow and restricted streets. Park in a public car park and walk in.',
        'Granada has a low-emission zone. Rental cars carry the DGT label that lets them in.'
      ] },
      { title: 'Barcelona transport', items: [
        'The metro is the quickest way around. A T-casual card gives 10 rides for one person; a Hola Barcelona card gives unlimited rides for 2–5 days.',
        { text: 'Metro and bus maps (TMB)', url: 'https://www.tmb.cat/en/' },
        'Taxis are easy to hail, and Cabify and Uber both work in the city.'
      ] },
      { title: 'Weather and packing', items: [
        'Late November is usually mild on the coast and in Seville, cooler in Barcelona, and cold at night in Granada and Ronda.',
        'Pack layers, a warm jacket, an umbrella and comfortable shoes for cobblestones and hills.',
        'Days are short: sunrise is around 8 AM, sunset around 6 PM in Andalusia and 5:20 PM in Barcelona.'
      ] }
    ],

    phrases: [
      ['Hola', 'Hello'],
      ['Gracias', 'Thank you'],
      ['Por favor', 'Please'],
      ['La cuenta, por favor', 'The bill, please'],
      ['¿Dónde está el baño?', 'Where is the restroom?'],
      ['Bon dia', 'Good morning, in Catalan (Barcelona)'],
      ['Gràcies', 'Thank you, in Catalan']
    ]
  };
})();
