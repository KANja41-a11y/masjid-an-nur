"use strict";

/* =========================================================
   AN-NUR MASJID DIGITAL DISPLAY
   APP.JS — FINAL
   ========================================================= */

const DEFAULT_CONFIG = {
  app: {
    name: "An-Nur Masjid Digital Display",
    version: "2.1.0"
  },

  mosque: {
    name: "Masjid An-Nur",
    location: "Ciangsana, Gunung Putri, Kabupaten Bogor, Jawa Barat"
  },

  location: {
    latitude: -6.3523,
    longitude: 106.9556,
    label: "Ciangsana, Gunung Putri, Bogor"
  },

  prayer: {
    provider: "AlAdhan",
    method: 20,
    school: 0,
    timezone: "Asia/Jakarta"
  },

  display: {
    autoRefreshMinutes: 15,
    announcementIntervalSeconds: 10
  },

  content: {
    ticker:
      "Mari merapatkan dan meluruskan shaf. • Mohon menjaga kebersihan, ketenangan, dan kenyamanan masjid.",

    quran: {
      text:
        "Sesungguhnya salat itu adalah kewajiban yang ditentukan waktunya atas orang-orang beriman.",
      reference: "QS. An-Nisa: 103"
    }
  }
};


/* =========================================================
   STATE
   ========================================================= */

const state = {
  config: DEFAULT_CONFIG,

  latitude: DEFAULT_CONFIG.location.latitude,
  longitude: DEFAULT_CONFIG.location.longitude,
  locationLabel: DEFAULT_CONFIG.location.label,

  timings: null,
  metadata: null,

  lastPrayerDate: null,

  announcementIndex: 0,

  settings: loadSettings(),

  usingDeviceLocation: false
};


/* =========================================================
   DOM
   ========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   SAFE TEXT
   ========================================================= */

function setText(id, value) {
  const element = $(id);

  if (element) {
    element.textContent = value;
  }
}


/* =========================================================
   SETTINGS
   ========================================================= */

function loadSettings() {
  try {
    const raw = localStorage.getItem("annur-settings");

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
  } catch (error) {
    console.warn("Settings tidak dapat dibaca:", error);
    return {};
  }
}


function applySettings() {
  const settings = state.settings;
  const config = state.config;

  const mosqueName =
    settings.mosqueName ||
    config.mosque?.name ||
    "Masjid An-Nur";

  const ticker =
    settings.ticker ||
    config.content?.ticker ||
    "Mari merapatkan dan meluruskan shaf.";

  document.title =
    `${mosqueName} — Digital Display`;

  const heading =
    document.querySelector(".welcome h1");

  if (heading) {
    heading.innerHTML =
      `Selamat Datang<br>di ${escapeHtml(mosqueName)}`;
  }

  setText("tickerText", ticker);

  setText(
    "locationText",
    state.locationLabel
  );
}


function saveSettings() {
  const mosqueInput =
    $("mosqueNameInput");

  const locationInput =
    $("fallbackLocationInput");

  const offsetInput =
    $("offsetInput");

  const tickerInput =
    $("tickerInput");

  const mosqueName =
    mosqueInput?.value.trim() ||
    "Masjid An-Nur";

  const fallbackLabel =
    locationInput?.value.trim() ||
    DEFAULT_CONFIG.location.label;

  let offset =
    Number(offsetInput?.value);

  if (!Number.isFinite(offset)) {
    offset = 0;
  }

  offset =
    Math.max(
      -30,
      Math.min(30, offset)
    );

  const ticker =
    tickerInput?.value.trim() ||
    DEFAULT_CONFIG.content.ticker;

  state.settings = {
    mosqueName,
    fallbackLabel,
    offset,
    ticker
  };

  localStorage.setItem(
    "annur-settings",
    JSON.stringify(state.settings)
  );

  /*
    Jika user sebelumnya memakai GPS,
    jangan ubah lokasi GPS hanya karena setting fallback.
  */
  if (!state.usingDeviceLocation) {
    state.locationLabel =
      fallbackLabel;
  }

  applySettings();

  closeSettings();

  loadPrayerTimes(true);
}


/* =========================================================
   LOAD CONFIG.JSON
   ========================================================= */

async function loadConfig() {
  try {
    const response = await fetch(
      `config.json?v=${Date.now()}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const externalConfig =
      await response.json();

    state.config =
      deepMerge(
        DEFAULT_CONFIG,
        externalConfig
      );

  } catch (error) {
    console.warn(
      "config.json gagal dimuat. Menggunakan konfigurasi bawaan.",
      error
    );

    state.config =
      DEFAULT_CONFIG;
  }


  state.latitude =
    Number(
      state.config.location.latitude
    ) ||
    DEFAULT_CONFIG.location.latitude;

  state.longitude =
    Number(
      state.config.location.longitude
    ) ||
    DEFAULT_CONFIG.location.longitude;

  state.locationLabel =
    state.config.location.label ||
    DEFAULT_CONFIG.location.label;


  applySettings();

  renderStaticContent();
}


/* =========================================================
   DEEP MERGE
   ========================================================= */

function deepMerge(base, extra) {
  const result = {
    ...base
  };

  for (const key of Object.keys(extra || {})) {
    if (
      extra[key] &&
      typeof extra[key] === "object" &&
      !Array.isArray(extra[key]) &&
      base[key] &&
      typeof base[key] === "object"
    ) {
      result[key] =
        deepMerge(
          base[key],
          extra[key]
        );
    } else {
      result[key] =
        extra[key];
    }
  }

  return result;
}


/* =========================================================
   JAKARTA DATE
   ========================================================= */

function getJakartaParts(date = new Date()) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    );

  const parts =
    formatter.formatToParts(date);

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] =
        part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day)
  };
}


function getJakartaDateString(
  date = new Date()
) {
  const parts =
    getJakartaParts(date);

  return [
    String(parts.year),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0")
  ].join("-");
}


/* =========================================================
   CLOCK
   ========================================================= */

function updateClock() {
  const now =
    new Date();

  const clock =
    new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }
    ).format(now);

  setText(
    "clock",
    clock
  );


  const date =
    new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    ).format(now);

  setText(
    "dateText",
    date
  );


  const year =
    new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone: "Asia/Jakarta",
        year: "numeric"
      }
    ).format(now);

  setText(
    "year",
    year
  );


  /*
    Jika hari Jakarta berubah,
    ambil jadwal baru.
  */

  const currentPrayerDate =
    getJakartaDateString(now);

  if (
    state.lastPrayerDate &&
    state.lastPrayerDate !==
      currentPrayerDate
  ) {
    loadPrayerTimes(true);
  }


  updateCountdown();
}


/* =========================================================
   NORMALIZE TIME
   ========================================================= */

function normalizeTime(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const match =
    String(value).match(
      /(\d{1,2}):(\d{2})(?::(\d{2}))?/
    );

  if (!match) {
    return null;
  }

  const hour =
    Number(match[1]);

  const minute =
    Number(match[2]);

  const second =
    Number(match[3] || 0);


  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second)
  ) {
    return null;
  }


  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }


  return {
    hour,
    minute,
    second,

    text:
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  };
}


/* =========================================================
   CREATE JAKARTA TIMESTAMP
   ========================================================= */

/*
  Mengubah HH:mm dari jadwal menjadi timestamp
  yang konsisten dengan Asia/Jakarta.

  Tidak bergantung timezone komputer.
*/

function jakartaTimestamp(
  dateString,
  timeObject
) {
  if (
    !dateString ||
    !timeObject
  ) {
    return NaN;
  }

  const match =
    String(dateString).match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    return NaN;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);


  /*
    Asia/Jakarta = UTC+7.
  */

  return Date.UTC(
    year,
    month - 1,
    day,
    timeObject.hour - 7,
    timeObject.minute,
    timeObject.second
  );
}


/* =========================================================
   FORMAT COUNTDOWN
   ========================================================= */

function formatCountdown(
  milliseconds
) {
  if (
    !Number.isFinite(milliseconds)
  ) {
    return "--:--:--";
  }

  if (milliseconds < 0) {
    milliseconds = 0;
  }

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
   PRAYER EVENTS
   ========================================================= */

function getPrayerEvents() {
  if (!state.timings) {
    return [];
  }

  const dateString =
    state.lastPrayerDate ||
    getJakartaDateString();


  const prayers = [
    ["Subuh", "Fajr"],
    ["Dzuhur", "Dhuhr"],
    ["Ashar", "Asr"],
    ["Maghrib", "Maghrib"],
    ["Isya", "Isha"]
  ];


  const offset =
    Number(
      state.settings.offset
    ) || 0;


  const events = [];


  for (
    const [name, key]
    of prayers
  ) {
    const parsed =
      normalizeTime(
        state.timings[key]
      );


    if (!parsed) {
      continue;
    }


    let timestamp =
      jakartaTimestamp(
        dateString,
        parsed
      );


    if (!Number.isFinite(timestamp)) {
      continue;
    }


    /*
      Penyesuaian manual.
    */

    timestamp +=
      offset * 60 * 1000;


    events.push({
      name,
      key,
      timestamp,
      timeText:
        parsed.text
    });
  }


  return events;
}


/* =========================================================
   COUNTDOWN
   ========================================================= */

function updateCountdown() {
  const events =
    getPrayerEvents();


  if (!events.length) {
    setText(
      "nextPrayer",
      "Menunggu jadwal"
    );

    setText(
      "countdown",
      "--:--:--"
    );

    return;
  }


  const now =
    Date.now();


  let next =
    events.find(
      event =>
        event.timestamp >
        now
    );


  /*
    Kalau seluruh jadwal hari ini lewat,
    countdown menuju Subuh besok.
  */

  if (!next) {
    const first =
      events[0];

    next = {
      ...first,
      timestamp:
        first.timestamp +
        24 * 60 * 60 * 1000
    };
  }


  const difference =
    next.timestamp -
    now;


  setText(
    "nextPrayer",
    next.name
  );


  setText(
    "countdown",
    formatCountdown(
      difference
    )
  );


  document
    .querySelectorAll(
      ".prayer-row"
    )
    .forEach(row => {
      row.classList.toggle(
        "active",
        row.dataset.key ===
          next.key
      );
    });
}


/* =========================================================
   LOAD PRAYER TIMES
   ========================================================= */

async function loadPrayerTimes(
  showLoadingState = true
) {
  if (showLoadingState) {
    showLoading();
  }


  const dateString =
    getJakartaDateString();


  const latitude =
    Number(state.latitude);

  const longitude =
    Number(state.longitude);


  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    showError(
      "Koordinat lokasi tidak valid."
    );

    return;
  }


  const method =
    Number(
      state.config?.prayer?.method
    ) || 20;

  const school =
    Number(
      state.config?.prayer?.school
    ) || 0;


  const api =
    state.config?.prayer?.provider ===
    "AlAdhan"
      ? "https://api.aladhan.com/v1/timings"
      : "https://api.aladhan.com/v1/timings";


  const url =
    `${api}/${dateString}` +
    `?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    `&method=${encodeURIComponent(method)}` +
    `&school=${encodeURIComponent(school)}`;


  try {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        12000
      );


    const response =
      await fetch(
        url,
        {
          method: "GET",
          cache: "no-store",
          signal:
            controller.signal,
          headers: {
            Accept:
              "application/json"
          }
        }
      );


    clearTimeout(timeout);


    if (!response.ok) {
      throw new Error(
        `API HTTP ${response.status}`
      );
    }


    const json =
      await response.json();


    if (
      !json ||
      json.code !== 200 ||
      !json.data ||
      !json.data.timings
    ) {
      throw new Error(
        "Format data API tidak valid."
      );
    }


    state.timings =
      json.data.timings;

    state.metadata =
      json.data;

    state.lastPrayerDate =
      dateString;


    renderPrayerTimes();

    renderHijri();

    await loadQibla();


    setStatusOnline();


  } catch (error) {
    console.error(
      "Gagal mengambil jadwal salat:",
      error
    );


    showError(
      "Jadwal belum dapat dimuat. Periksa koneksi internet."
    );
  }
}


/* =========================================================
   RENDER PRAYER
   ========================================================= */

function renderPrayerTimes() {
  const container =
    $("prayerList");


  if (!container) {
    return;
  }


  container.innerHTML = "";


  const list = [
    ["Imsak", "Imsak"],
    ["Subuh", "Fajr"],
    ["Terbit", "Sunrise"],
    ["Dzuhur", "Dhuhr"],
    ["Ashar", "Asr"],
    ["Maghrib", "Maghrib"],
    ["Isya", "Isha"]
  ];


  for (
    const [name, key]
    of list
  ) {
    const parsed =
      normalizeTime(
        state.timings?.[key]
      );


    if (!parsed) {
      continue;
    }


    const row =
      document.createElement(
        "div"
      );


    row.className =
      "prayer-row";


    row.dataset.key =
      key;


    row.innerHTML = `
      <div class="prayer-name">
        ${escapeHtml(name)}
      </div>

      <div>
        <span class="prayer-time">
          ${parsed.text}
        </span>
      </div>
    `;


    container.appendChild(row);
  }


  if (!container.children.length) {
    showError(
      "Data jadwal kosong."
    );

    return;
  }


  updateCountdown();
}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading() {
  const container =
    $("prayerList");


  if (container) {
    container.innerHTML = `
      <div class="loading">
        Mengambil jadwal salat...
      </div>
    `;
  }


  setText(
    "nextPrayer",
    "Memuat..."
  );

  setText(
    "countdown",
    "--:--:--"
  );
}


/* =========================================================
   ERROR
   ========================================================= */

function showError(message) {
  const container =
    $("prayerList");


  if (container) {
    container.innerHTML = `
      <div class="error">
        ${escapeHtml(message)}
        <br><br>
        Tekan tombol ↻ untuk mencoba lagi.
      </div>
    `;
  }


  setText(
    "nextPrayer",
    "Tidak tersedia"
  );

  setText(
    "countdown",
    "--:--:--"
  );


  setStatusOffline();
}


/* =========================================================
   STATUS
   ========================================================= */

function setStatusOnline() {
  const element =
    document.querySelector(
      ".quick-item .online"
    );

  if (element) {
    element.textContent =
      "ONLINE";
  }
}


function setStatusOffline() {
  const element =
    document.querySelector(
      ".quick-item .online"
    );

  if (element) {
    element.textContent =
      "OFFLINE";
  }
}


/* =========================================================
   HIJRI
   ========================================================= */

function renderHijri() {
  const hijri =
    state.metadata?.date?.hijri;


  if (!hijri) {
    setText(
      "hijriDate",
      "—"
    );

    return;
  }


  const month =
    hijri.month?.en ||
    hijri.month?.ar ||
    "";


  setText(
    "hijriDate",
    `${hijri.day || ""} ${month} ${hijri.year || ""} H`
  );
}


/* =========================================================
   QIBLA
   ========================================================= */

async function loadQibla() {
  const latitude =
    Number(state.latitude);

  const longitude =
    Number(state.longitude);


  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    setText(
      "qiblaDirection",
      "—"
    );

    return;
  }


  try {
    const controller =
      new AbortController();


    const timeout =
      setTimeout(
        () => controller.abort(),
        10000
      );


    const response =
      await fetch(
        `https://api.aladhan.com/v1/qibla/${latitude}/${longitude}`,
        {
          cache: "no-store",
          signal:
            controller.signal
        }
      );


    clearTimeout(timeout);


    if (!response.ok) {
      throw new Error(
        "Qibla API error"
      );
    }


    const json =
      await response.json();


    const direction =
      Number(
        json?.data?.direction
      );


    if (
      !Number.isFinite(direction)
    ) {
      throw new Error(
        "Arah kiblat tidak valid"
      );
    }


    setText(
      "qiblaDirection",
      `${Math.round(direction)}°`
    );

  } catch (error) {
    console.warn(
      "Qibla:",
      error
    );

    setText(
      "qiblaDirection",
      "—"
    );
  }
}


/* =========================================================
   GEOLOCATION
   ========================================================= */

function requestLocation() {
  if (!navigator.geolocation) {
    alert(
      "Browser ini tidak mendukung GPS."
    );

    return;
  }


  setText(
    "locationText",
    "Mendeteksi lokasi..."
  );


  navigator.geolocation.getCurrentPosition(
    position => {
      const latitude =
        Number(
          position.coords.latitude
        );

      const longitude =
        Number(
          position.coords.longitude
        );


      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        useFallbackLocation(
          "Koordinat GPS tidak valid."
        );

        return;
      }


      state.latitude =
        latitude;

      state.longitude =
        longitude;

      state.locationLabel =
        "Lokasi perangkat";

      state.usingDeviceLocation =
        true;


      setText(
        "locationText",
        "Lokasi perangkat"
      );


      loadPrayerTimes(true);
    },

    error => {
      console.warn(
        "GPS tidak tersedia:",
        error
      );


      useFallbackLocation(
        "Lokasi perangkat tidak diberikan. Menggunakan Ciangsana."
      );
    },

    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    }
  );
}


/* =========================================================
   FALLBACK LOCATION
   ========================================================= */

function useFallbackLocation(
  message = ""
) {
  state.latitude =
    Number(
      state.config.location.latitude
    );

  state.longitude =
    Number(
      state.config.location.longitude
    );

  state.locationLabel =
    state.settings.fallbackLabel ||
    state.config.location.label;

  state.usingDeviceLocation =
    false;


  setText(
    "locationText",
    state.locationLabel
  );


  loadPrayerTimes(true);


  if (message) {
    console.info(message);
  }
}


/* =========================================================
   ANNOUNCEMENTS
   ========================================================= */

const announcements = [
  {
    title: "Kajian Rutin An-Nur",
    text:
      "Mari hadir dan belajar bersama setelah salat Isya."
  },

  {
    title: "Jaga Kebersihan Masjid",
    text:
      "Mohon menjaga kebersihan dan fasilitas masjid bersama."
  },

  {
    title: "Mari Bersedekah",
    text:
      "Dukung kegiatan dan operasional Masjid An-Nur melalui infaq terbaik."
  },

  {
    title: "Rapatkan Shaf",
    text:
      "Mari merapatkan dan meluruskan shaf sebelum salat dimulai."
  }
];


function renderAnnouncement() {
  const container =
    $("announcementContent");

  const dots =
    $("announcementDots");


  if (!container) {
    return;
  }


  const item =
    announcements[
      state.announcementIndex
    ];


  container.innerHTML = `
    <h3>
      ${escapeHtml(item.title)}
    </h3>

    <p>
      ${escapeHtml(item.text)}
    </p>
  `;


  if (dots) {
    dots.innerHTML =
      announcements
        .map(
          (_, index) => `
            <span
              class="slider-dot ${
                index ===
                state.announcementIndex
                  ? "active"
                  : ""
              }"
            ></span>
          `
        )
        .join("");
  }
}


/* =========================================================
   AGENDA
   ========================================================= */

function renderAgenda() {
  const container =
    $("agendaList");


  if (!container) {
    return;
  }


  const agenda = [
    {
      date: "07",
      title: "Kajian Subuh",
      time: "Setiap Ahad • 05.30 WIB"
    },

    {
      date: "14",
      title: "Kajian Keluarga",
      time: "Sabtu • 19.30 WIB"
    },

    {
      date: "21",
      title: "TPA An-Nur",
      time: "Senin–Jumat • 16.00 WIB"
    }
  ];


  container.innerHTML =
    agenda
      .map(
        item => `
          <div class="agenda">

            <div class="agenda-date">
              ${escapeHtml(item.date)}
            </div>

            <div>
              <strong>
                ${escapeHtml(item.title)}
              </strong>

              <span>
                ${escapeHtml(item.time)}
              </span>
            </div>

          </div>
        `
      )
      .join("");
}


/* =========================================================
   STATIC CONTENT
   ========================================================= */

function renderStaticContent() {
  const config =
    state.config;


  const quranText =
    config.content?.quran?.text;

  const quranReference =
    config.content?.quran?.reference;


  if (quranText) {
    setText(
      "quranText",
      quranText
    );
  }


  if (quranReference) {
    const reference =
      document.querySelector(
        ".quran-card span"
      );

    if (reference) {
      reference.textContent =
        quranReference;
    }
  }


  renderAnnouncement();

  renderAgenda();
}


/* =========================================================
   FULLSCREEN
   ========================================================= */

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.warn(
      "Fullscreen tidak tersedia:",
      error
    );
  }
}


/* =========================================================
   SETTINGS UI
   ========================================================= */

function openSettings() {
  const settings =
    state.settings;


  const config =
    state.config;


  if ($("mosqueNameInput")) {
    $("mosqueNameInput").value =
      settings.mosqueName ||
      config.mosque?.name ||
      "Masjid An-Nur";
  }


  if ($("fallbackLocationInput")) {
    $("fallbackLocationInput").value =
      settings.fallbackLabel ||
      config.location?.label ||
      "Ciangsana, Gunung Putri, Bogor";
  }


  if ($("offsetInput")) {
    $("offsetInput").value =
      Number(settings.offset) || 0;
  }


  if ($("tickerInput")) {
    $("tickerInput").value =
      settings.ticker ||
      config.content?.ticker ||
      "";
  }


  $("settingsModal")
    ?.classList
    .add("show");
}


function closeSettings() {
  $("settingsModal")
    ?.classList
    .remove("show");
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function bindEvents() {
  $("refreshButton")
    ?.addEventListener(
      "click",
      () => loadPrayerTimes(true)
    );


  $("locationButton")
    ?.addEventListener(
      "click",
      requestLocation
    );


  $("fullscreenButton")
    ?.addEventListener(
      "click",
      toggleFullscreen
    );


  $("settingsButton")
    ?.addEventListener(
      "click",
      openSettings
    );


  $("closeSettings")
    ?.addEventListener(
      "click",
      closeSettings
    );


  $("saveSettings")
    ?.addEventListener(
      "click",
      saveSettings
    );


  $("settingsModal")
    ?.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          $("settingsModal")
        ) {
          closeSettings();
        }
      }
    );


  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape"
      ) {
        closeSettings();
      }

      if (
        event.key === "f" ||
        event.key === "F"
      ) {
        toggleFullscreen();
      }
    }
  );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function init() {
  bindEvents();

  updateClock();

  await loadConfig();

  /*
    Konfigurasi dari localStorage
    diterapkan setelah config berhasil.
  */

  applySettings();

  /*
    Tampilkan lokasi fallback
    sejak awal.
  */

  setText(
    "locationText",
    state.locationLabel
  );


  /*
    Ambil jadwal pertama.
  */

  await loadPrayerTimes(true);
}


/* =========================================================
   CLOCK LOOP
   ========================================================= */

setInterval(
  updateClock,
  1000
);


/* =========================================================
   ANNOUNCEMENT LOOP
   ========================================================= */

setInterval(
  () => {
    state.announcementIndex =
      (
        state.announcementIndex + 1
      ) %
      announcements.length;

    renderAnnouncement();
  },
  10000
);


/* =========================================================
   AUTOMATIC API REFRESH
   ========================================================= */

setInterval(
  () => {
    loadPrayerTimes(false);
  },
  15 * 60 * 1000
);


/* =========================================================
   START
   ========================================================= */

init();
