"use strict";


/* =========================================================
   AN-NUR MASJID DIGITAL DISPLAY
   ========================================================= */

const CONFIG = {

  prayerApi:
    "https://api.aladhan.com/v1/timings",

  qiblaApi:
    "https://api.aladhan.com/v1/qibla",

  /*
    Method 20 =
    Kementerian Agama Republik Indonesia
  */

  calculationMethod: 20,

  school: 0,

  fallback: {

    latitude: -6.3523,

    longitude: 106.9556,

    label:
      "Ciangsana, Gunung Putri, Bogor"

  },

  prayers: [

    {
      name: "Imsak",
      api: "Imsak"
    },

    {
      name: "Subuh",
      api: "Fajr"
    },

    {
      name: "Terbit",
      api: "Sunrise"
    },

    {
      name: "Dzuhur",
      api: "Dhuhr"
    },

    {
      name: "Ashar",
      api: "Asr"
    },

    {
      name: "Maghrib",
      api: "Maghrib"
    },

    {
      name: "Isya",
      api: "Isha"
    }

  ]

};


/* =========================================================
   STATE
   ========================================================= */

const state = {

  latitude:
    CONFIG.fallback.latitude,

  longitude:
    CONFIG.fallback.longitude,

  locationLabel:
    CONFIG.fallback.label,

  timings: null,

  metadata: null,

  announcementIndex: 0,

  settings: loadSettings()

};


/* =========================================================
   DOM HELPER
   ========================================================= */

const $ = id =>
  document.getElementById(id);


/* =========================================================
   SETTINGS
   ========================================================= */

function loadSettings() {

  try {

    return JSON.parse(
      localStorage.getItem(
        "annur-settings"
      )
    ) || {};

  } catch {

    return {};

  }

}


function applySettings() {

  const settings =
    state.settings;

  if (settings.mosqueName) {

    document.title =
      `${settings.mosqueName} — Digital Display`;

    const heading =
      document.querySelector(".welcome h1");

    if (heading) {

      heading.innerHTML =
        `Selamat Datang<br>di ${escapeHtml(settings.mosqueName)}`;

    }

  }


  if (settings.ticker) {

    $("tickerText").textContent =
      settings.ticker;

  }


  if (settings.fallbackLabel) {

    CONFIG.fallback.label =
      settings.fallbackLabel;

  }

}


function saveSettings() {

  const mosqueName =
    $("mosqueNameInput").value.trim();

  const fallbackLabel =
    $("fallbackLocationInput").value.trim();

  const offset =
    Number(
      $("offsetInput").value
    ) || 0;

  const ticker =
    $("tickerInput").value.trim();


  state.settings = {

    mosqueName:
      mosqueName ||
      "Masjid An-Nur",

    fallbackLabel:
      fallbackLabel ||
      CONFIG.fallback.label,

    offset:
      Math.max(
        -30,
        Math.min(
          30,
          offset
        )
      ),

    ticker:
      ticker ||
      "Mari merapatkan dan meluruskan shaf."

  };


  localStorage.setItem(
    "annur-settings",
    JSON.stringify(
      state.settings
    )
  );


  applySettings();

  closeSettings();

  loadPrayerTimes();

}


/* =========================================================
   DATE
   ========================================================= */

function jakartaDate() {

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Jakarta",

      year: "numeric",

      month: "2-digit",

      day: "2-digit"

    }
  ).format(
    new Date()
  );

}


/* =========================================================
   CLOCK
   ========================================================= */

function updateClock() {

  const now =
    new Date();


  $("clock").textContent =
    new Intl.DateTimeFormat(
      "id-ID",
      {

        timeZone:
          "Asia/Jakarta",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hour12:
          false

      }
    ).format(now);


  $("dateText").textContent =
    new Intl.DateTimeFormat(
      "id-ID",
      {

        timeZone:
          "Asia/Jakarta",

        weekday:
          "long",

        day:
          "numeric",

        month:
          "long",

        year:
          "numeric"

      }
    ).format(now);


  $("year").textContent =
    new Intl.DateTimeFormat(
      "en",
      {

        timeZone:
          "Asia/Jakarta",

        year:
          "numeric"

      }
    ).format(now);


  updateCountdown();

}


/* =========================================================
   TIME PARSER
   ========================================================= */

/*
  API kadang bisa memberikan:

  "04:32 (+07)"
  "04:32"
  "04:32:00"

  Kita hanya mengambil HH:mm.

  Ini yang mencegah NaN.
*/

function normalizeTime(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return null;

  }


  const match =
    String(value).match(
      /(\d{1,2}):(\d{2})(?::\d{2})?/
    );


  if (!match) {

    return null;

  }


  const hour =
    Number(match[1]);

  const minute =
    Number(match[2]);


  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {

    return null;

  }


  return {
    hour,
    minute,

    text:
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`

  };

}


/* =========================================================
   DATE WITH TIME
   ========================================================= */

function prayerDate(
  timeObject,
  addDay = 0
) {

  const date =
    new Date();


  date.setHours(
    timeObject.hour,
    timeObject.minute,
    0,
    0
  );


  date.setDate(
    date.getDate() +
    addDay
  );


  return date;

}


/* =========================================================
   FORMAT COUNTDOWN
   ========================================================= */

function formatCountdown(
  milliseconds
) {

  if (
    !Number.isFinite(
      milliseconds
    )
  ) {

    return "--:--:--";

  }


  milliseconds =
    Math.max(
      0,
      milliseconds
    );


  const totalSeconds =
    Math.floor(
      milliseconds / 1000
    );


  const hours =
    Math.floor(
      totalSeconds / 3600
    );


  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );


  const seconds =
    totalSeconds % 60;


  return [

    String(hours).padStart(2, "0"),

    String(minutes).padStart(2, "0"),

    String(seconds).padStart(2, "0")

  ].join(":");

}


/* =========================================================
   GET PRAYER EVENTS
   ========================================================= */

function getPrayerEvents() {

  if (!state.timings) {

    return [];

  }


  const keys = [

    ["Subuh", "Fajr"],

    ["Dzuhur", "Dhuhr"],

    ["Ashar", "Asr"],

    ["Maghrib", "Maghrib"],

    ["Isya", "Isha"]

 
