export default {
  htmlLang: 'en',

  meta: {
    title: 'Relax Bridge — Massage in Tilburg | Studio & at your home',
    description:
      'Relaxation massage, neck-shoulder-back, facial and foot massage in Tilburg. Visit the studio, or I come to your home by bicycle. From € 40.',
  },

  tagline: 'The bridge between tension and relaxation.',

  accessibility: {
    skipToContent: 'Skip to main content',
  },

  nav: {
    home: 'Home',
    services: 'Services',
    studio: 'Studio Visit',
    homeService: 'Home service',
    prices: 'Prices',
    about: 'About me',
    contact: 'Contact',
    questionnaire: 'Questionnaire',
    bookingsOpen: 'Bookings open',
    bookingsOpenShort: 'Open',
    bookingsToday: 'Available today',
    bookingsTodayShort: 'Today',
    bookingsNext: 'Next availability: {day}',
    bookingsNextShort: '{day}',
    bookingsNone: 'No availability',
    bookingsNoneShort: 'Full',
    menu: 'Menu',
    language: 'Language',
  },

  hero: {
    title: 'Massage in Tilburg',
    intro:
      'Take some time to completely unwind in my peaceful studio in Tilburg. Prefer your own surroundings? Home service is also available.',
    primaryCta: 'Book an appointment',
    secondaryCta: 'See the prices',
  },

  heroProfile: {
    name: 'Brigitta',
    role: 'Massage therapist',
  },

  images: {
    profile:
      'Portrait of the Relax Bridge massage therapist, sitting on a bench in the woods.',
    studio:
      'The Relax Bridge massage room in Tilburg, with massage table, towels and massage oil.',
    homeService:
      'The bicycle with the trailer that carries the massage table to your home.',
  },

  options: {
    studio: {
      label: 'Studio Visit',
      title: 'You are welcome in my home.',
      body: 'A quiet place in Tilburg where you do not have to do anything.',
      subtitle:
        'Choose from four treatments, or create your own treatment with the Massage Creator.',
      cta: 'See the treatments',
      bookingCta: 'Book a Studio Visit',
      personalization: {
        title: 'Massage Creator',
        intro:
          'Make your Studio Visit even more personal with a few small details. You can choose these while booking your appointment.',
        items: [
          {
            title: 'Scent',
            body: 'Choose a scent you enjoy, or request a fragrance-free treatment.',
          },
          {
            title: 'Music',
            body: 'Choose music that suits your mood, listen to your own music or enjoy the massage in complete silence.',
          },
          {
            title: 'Bio & vegan',
            body: 'The treatment is also available with organic and vegan massage oil.',
          },
        ],
      },
    },
    homeService: {
      label: 'Home service',
      title: 'I come to your home by bicycle.',
      body: 'In Tilburg and Reeshof. The price includes travel time, preparation and the treatment.',
      cta: 'See the treatments',
      bookingCta: 'Book a Home Service',
    },
  },

  prices: {
    heading: 'Prices',
    intro: 'Payment is made by card after the treatment.',
    duration: 'Duration',
    price: 'Price',
    minutes: 'minutes',
    from: 'from',
    studioHeading: 'Studio Visit',
    homeHeading: 'Home service',
  },

  goodToKnow: {
    heading: 'Good to know',
    items: [
      {
        title: 'Booking an appointment',
        body: 'Choose your preferred type of massage under Studio Visit or Home service, and pick a suitable time slot. Prefer personal contact? Feel free to send me a message on WhatsApp. Does the time no longer suit you? Just let me know to reschedule or cancel.',
      },
      {
        title: 'Prices and payment',
        body: 'Payment takes place after the treatment and can easily be made by card on location. Payment by card is also possible for home service.',
      },
      {
        title: 'Home service',
        body: 'I come to your home and bring everything needed — you only need to relax. The price includes travel time, preparation and the treatment. I will ask for your exact address and phone number so I can reach you easily. Please note: shorter treatments are not available for home service.',
      },
      {
        title: 'Short questionnaire',
        body: 'Which times and options matter to you when booking a massage? Four short, anonymous questions help me shape Relax Bridge around what people need.',
      },
    ],
    questionnaireCta: 'Take the questionnaire',
  },

  service: {
    pricesHeading: 'Prices',
    bookCta: 'Book an appointment',
    whatsappCta: 'Ask a question on WhatsApp',
    backToAll: 'All treatments',
    studioBadge: 'At the studio, Tilburg',
    homeBadge: 'At your home, Tilburg and Reeshof',
    otherServices: 'Other treatments',
  },

  contact: {
    heading: 'Contact',
    intro:
      'A question, or ready to book? WhatsApp is the quickest way to reach me.',
    whatsapp: 'WhatsApp',
    whatsappCta: 'Send a WhatsApp message',
    googleReview: 'Google review',
    googleReviewCta: 'Leave a Google review',
    email: 'Email',
    area: 'Service area',
    areaBody: 'Studio in Tilburg. Home service in Tilburg and Reeshof.',
    follow: 'Follow me',
    playlists: 'My playlists',
  },

  footer: {
    rights: 'All rights reserved.',
    cookies: 'Cookie policy',
    privacy: 'Privacy notice',
  },
} as const;
