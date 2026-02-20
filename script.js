// ────────────────────────────────────────────────────────────────
// EARLY THEME APPLICATION – place this as FIRST script in <head>
// Prevents most flash-of-unstyled-content (FOUC)
// ────────────────────────────────────────────────────────────────
const earlyThemeScript = document.createElement('script');
earlyThemeScript.textContent = `
  (function() {
    try {
      let theme = localStorage.getItem('theme');
      if (!theme) {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch(e) {}
  })();
`;
document.head.insertBefore(earlyThemeScript, document.head.firstChild);

// ────────────────────────────────────────────────────────────────
// CONSTANTS & CONFIG
// ────────────────────────────────────────────────────────────────
const LAST_CITY_KEY = 'weather_last_city';
const DEFAULT_FALLBACK_CITY = 'Lagos';
const DEFAULT_API_TIMEOUT_MS = 12000; // default for most requests
const FORECAST_API_TIMEOUT_MS = 16000; // longer for /forecast
const FALLBACK_DELAY_SHORT = 3800; // short delay before retrying last city
const FALLBACK_DELAY_DEFAULT = 4200; // longer delay before loading default city
const GEO_CACHE_KEY = 'weather_geo_cache';
const GEO_CACHE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

// ─── GLOBAL STATE ───────────────────────────────────────────────
let isCelsius = true;
let currentTempF = 72;
let feelsLikeF = 74;
let lastForecastData = null;
let lastCityTimezone = null;
// Chart instance – MUST be declared here (fixes initialization error)
let tempChartInstance = null;

// ─── DOM ELEMENTS ───────────────────────────────────────────────
const searchInput = document.querySelector('input[placeholder="Search city..."]');
const toggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const html = document.documentElement;
const tempToggle = document.getElementById('temp-toggle');
const mainTemp = document.getElementById('main-temp');
const rainValue = document.getElementById('rain-value');
const rainBars = document.getElementById('rain-bars');
const feelsLikeSpan = document.getElementById('feels-like');
const feelsText = document.getElementById('feels-text');
const visibilityValue = document.getElementById('visibility-value');
const tempTrendIcon = document.querySelector('iconify-icon[icon="solar:thermometer-linear"]');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const scrollContainer = document.getElementById('hourly-scroll');
if (!scrollContainer) {
  console.warn('Hourly scroll container not found');
}
const scrollAmount = 100;
// Cache air quality card elements once (they are static)
const airQualityCard = document.querySelector('.air-quality-card');
const aqiNumberEl = airQualityCard?.querySelector('span.block');
const aqiLabelEl = airQualityCard?.querySelector('span.uppercase');
const aqiDescEl = airQualityCard?.querySelector('div.mt-4.text-xs');
const aqiArcEl = airQualityCard?.querySelector('svg path:nth-child(2)');
// Optional safety check (only log once)
if (!airQualityCard || !aqiArcEl) {
  console.warn('Air quality card elements not found – gauge will not update');
}

// ─── UTILITY: Debounce ──────────────────────────────────────────
function debounce(func, wait = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
// Debounced refresh for chart / forecast to prevent flicker on rapid toggle
const debouncedRefresh = debounce(refreshTemperatureDisplays, 300);

// ─── UI HELPERS ─────────────────────────────────────────────────
function showLoading(show = true) {
  document.getElementById('loading')?.classList.toggle('hidden', !show);
}
function showError(msg) {
  const container = document.getElementById('error-display');
  const messageEl = document.getElementById('error-message');
  if (container && messageEl) {
    messageEl.textContent = msg;
    container.classList.remove('hidden');
  } else {
    alert(msg);
  }
}
function clearError() {
  document.getElementById('error-display')?.classList.add('hidden');
}
function resetUIOnError() {
  document.getElementById('main-temp').textContent = '--';
  document.getElementById('main-desc').textContent = '—';
  document.getElementById('city-name').textContent = '—';
  document.getElementById('city-region').textContent = '';
  document.getElementById('feels-like').textContent = '--°';
  document.getElementById('feels-text').textContent = '—';
  document.getElementById('wind').textContent = '— mph';
  document.getElementById('humidity').textContent = '—%';
  document.getElementById('uv').textContent = '--:--';
}

// ─── THEME MANAGEMENT ───────────────────────────────────────────
function applyTheme(theme) {
  const isDark = theme === 'dark';
  html.classList.add('theme-transitioning');
  if (isDark) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  if (themeIcon) {
    themeIcon.setAttribute('icon', isDark ? 'solar:sun-linear' : 'solar:moon-linear');
  }
  localStorage.setItem('theme', theme);
  setTimeout(() => {
    html.classList.remove('theme-transitioning');
  }, 450);
  // Dispatch event for chart update
  window.dispatchEvent(new CustomEvent('theme-changed'));
}
function initTheme() {
  let theme = localStorage.getItem('theme');
  if (!theme) {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(theme);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}
initTheme();
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    const current = html.classList.contains('dark') ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}
// Listen for theme changes and update chart if it exists
window.addEventListener('theme-changed', () => {
  if (tempChartInstance) {
    const isDark = html.classList.contains('dark');
    tempChartInstance.data.datasets[0].borderColor = isDark ? '#a5b4fc' : '#4f46e5';
    tempChartInstance.data.datasets[0].backgroundColor = isDark ? 'rgba(165,180,252,0.2)' : 'rgba(79,70,229,0.25)';
    tempChartInstance.data.datasets[0].pointBackgroundColor = isDark ? '#fff' : '#1f2937';
    tempChartInstance.data.datasets[0].pointBorderColor = isDark ? '#a5b4fc' : '#4f46e5';
    tempChartInstance.options.scales.x.grid.color = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    tempChartInstance.options.scales.y.grid.color = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    tempChartInstance.update();
  }
});

// ─── SCROLL BUTTONS ─────────────────────────────────────────────
if (prevBtn && nextBtn && scrollContainer) {
  prevBtn.addEventListener('click', () => scrollContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' }));
  nextBtn.addEventListener('click', () => scrollContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' }));
}
if (tempTrendIcon) {
  tempTrendIcon.setAttribute('icon', 'mdi:thermometer-lines');
  tempTrendIcon.setAttribute('width', '18');
}

// ─── TEMPERATURE UNIT TOGGLE ────────────────────────────────────
if (tempToggle) {
  tempToggle.addEventListener('click', () => {
    isCelsius = !isCelsius;
    tempToggle.querySelector('span.unit-display').textContent = isCelsius ? '°C' : '°F';
    mainTemp.textContent = isCelsius
      ? Math.round((currentTempF - 32) * 5 / 9).toString()
      : currentTempF.toString();
    feelsLikeSpan.textContent = isCelsius
      ? Math.round((feelsLikeF - 32) * 5 / 9).toString() + '°'
      : feelsLikeF.toString() + '°';
    // Use debounced refresh to prevent flicker on rapid clicks
    debouncedRefresh();
  });
}

// ─── SEARCH HANDLERS ────────────────────────────────────────────
if (searchInput) {
  searchInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const city = searchInput.value.trim();
      debouncedFetchWeather(city);
    }
  });
}
document.getElementById('search-icon')?.addEventListener('click', () => {
  const city = searchInput.value.trim();
  debouncedFetchWeather(city);
  searchInput?.focus();
});
const debouncedFetchWeather = debounce((city) => {
  if (city) {
    fetchWeather(city);
    searchInput.value = '';
  }
}, 400);

// ─── FETCH WITH TIMEOUT ─────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutError = new Error('Request timed out – slow or unstable connection');
      timeoutError.isTimeout = true;
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── MAIN WEATHER FETCH ─────────────────────────────────────────
async function fetchWeather(city) {
  if (!city || city.trim().length < 2) {
    showError("Please enter a valid city name (at least 2 characters)");
    return;
  }
  clearError();
  showLoading(true);
  resetUIOnError();
  let fallbackTriggered = false;
  try {
    const weatherRes = await fetchWithTimeout(
      `/api/weather?q=${encodeURIComponent(city)}`
    );
    if (!weatherRes.ok) {
      let userMsg = `Error ${weatherRes.status}`;
      switch (weatherRes.status) {
        case 400: userMsg = "Invalid request – check city name"; break;
        case 401: userMsg = "Invalid or expired API key"; break;
        case 404: userMsg = `City "${city}" not found`; break;
        case 429: userMsg = "Too many requests – wait a minute"; break;
        default: userMsg = "Weather service error"; break;
      }
      throw new Error(userMsg);
    }
    const data = await weatherRes.json();
    if (!data?.main || !data?.weather?.[0] || !data?.coord) {
      throw new Error("Incomplete weather data");
    }
    updateCurrentWeather(data);
    fetchAirQuality(data.coord.lat, data.coord.lon);
    const forecastRes = await fetchWithTimeout(
      `/api/forecast?q=${encodeURIComponent(city)}`,
      {},
      FORECAST_API_TIMEOUT_MS
    );
    if (forecastRes.ok) {
      const forecastData = await forecastRes.json();
      lastForecastData = forecastData;
      lastCityTimezone = forecastData.city?.timezone ?? 0;
      debouncedRefresh(); // Use debounced version
    } else {
      console.warn("Forecast fetch failed", forecastRes.status);
    }
    localStorage.setItem(LAST_CITY_KEY, city);
  } catch (err) {
    console.error("Weather fetch failed:", err);
    let displayMsg = "Could not load weather data";
    const isNetworkError =
      err.name === 'TypeError' ||
      err.name === 'AbortError' ||
      err.message?.toLowerCase().includes('network') ||
      err.message?.toLowerCase().includes('fetch') ||
      err.message?.toLowerCase().includes('timed out') ||
      !navigator.onLine;
    if (isNetworkError) {
      displayMsg = "Network error – poor or no internet connection. Loading your last searched city in a few seconds...";
    } else if (err.message?.includes('not found') || err.message?.includes('404')) {
      displayMsg = `City "${city}" not found. Loading your last searched city...`;
    } else {
      displayMsg = err.message || "Something went wrong. Loading last city...";
    }
    showError(displayMsg);
    const savedCity = localStorage.getItem(LAST_CITY_KEY);
    if (savedCity && savedCity !== city) {
      fallbackTriggered = true;
      setTimeout(() => {
        clearError();
        fetchWeather(savedCity);
      }, FALLBACK_DELAY_SHORT);
    } else if (isNetworkError || !savedCity) {
      fallbackTriggered = true;
      setTimeout(() => {
        clearError();
        showError(`No previous location saved. Loading default city (${DEFAULT_FALLBACK_CITY})...`);
        fetchWeather(DEFAULT_FALLBACK_CITY);
      }, FALLBACK_DELAY_DEFAULT);
    }
  } finally {
    if (!fallbackTriggered) {
      showLoading(false);
    }
  }
}

// ─── REVERSE GEOCODING ──────────────────────────────────────────
async function getCityFromCoords(lat, lon) {
  try {
    const res = await fetchWithTimeout(
      `/api/reverse?lat=${lat}&lon=${lon}`
    );
    if (!res.ok) return 'Unknown Location';
    const data = await res.json();
    return data[0]?.name || 'Unknown Location';
  } catch {
    return 'Unknown Location';
  }
}

// ─── LOAD WEATHER FROM COORDINATES ──────────────────────────────
async function loadWeatherFromCoords(lat, lon) {
  showLoading(true);
  clearError();
  let fallbackTriggered = false;
  try {
    const cityName = await getCityFromCoords(lat, lon);
    document.getElementById('city-name').textContent = cityName || 'Your location';
    const res = await fetchWithTimeout(
      `/api/weather?lat=${lat}&lon=${lon}`
    );
    if (!res.ok) {
      let msg = `Location weather fetch failed (${res.status})`;
      if (res.status === 404) msg = "Could not find weather for this location";
      throw new Error(msg);
    }
    const data = await res.json();
    if (!data?.main || !data?.weather?.[0]) {
      throw new Error("Incomplete data from coordinates");
    }
    updateCurrentWeather(data);
    fetchAirQuality(lat, lon);
    const forecastRes = await fetchWithTimeout(
      `/api/forecast?lat=${lat}&lon=${lon}`,
      {},
      FORECAST_API_TIMEOUT_MS
    );
    if (forecastRes.ok) {
      const forecastData = await forecastRes.json();
      lastForecastData = forecastData;
      lastCityTimezone = forecastData.city?.timezone ?? 0;
      debouncedRefresh();
    }
    localStorage.setItem(LAST_CITY_KEY, cityName || 'Your location');
  } catch (err) {
    console.error('Location-based weather failed:', err);
    let msg = "Could not load weather for your location";
    const isNetworkError =
      err.name === 'TypeError' ||
      err.name === 'AbortError' ||
      err.message?.includes('network') ||
      err.message?.includes('fetch') ||
      err.message?.includes('timed out') ||
      !navigator.onLine;
    if (isNetworkError) {
      msg = "Network error – poor connection. Loading your last searched city...";
    } else {
      msg = err.message || "Location fetch failed. Loading last city...";
    }
    showError(msg);
    const savedCity = localStorage.getItem(LAST_CITY_KEY);
    if (savedCity) {
      fallbackTriggered = true;
      setTimeout(() => {
        clearError();
        fetchWeather(savedCity);
      }, FALLBACK_DELAY_SHORT);
    } else {
      fallbackTriggered = true;
      setTimeout(() => {
        clearError();
        showError(`No saved location. Loading default (${DEFAULT_FALLBACK_CITY})...`);
        fetchWeather(DEFAULT_FALLBACK_CITY);
      }, FALLBACK_DELAY_DEFAULT);
    }
  } finally {
    if (!fallbackTriggered) showLoading(false);
  }
}

// ─── AIR QUALITY – FIXED VERSION ────────────────────────────────
async function fetchAirQuality(lat, lon) {
  try {
    const res = await fetchWithTimeout(
      `/api/air-pollution?lat=${lat}&lon=${lon}`,
      {},
      DEFAULT_API_TIMEOUT_MS
    );
    if (!res.ok) return;
    const data = await res.json();
    if (!aqiNumberEl || !aqiLabelEl || !aqiDescEl || !aqiArcEl) {
      return;
    }
    let aqi = 0, label = 'No Data', desc = 'Air quality data not available.', color = '#6b7280', percent = 0;
    if (data.list?.length > 0 && data.list[0].main?.aqi) {
      aqi = data.list[0].main.aqi;
      const map = {
        1: { label: 'Good', desc: 'Air quality is satisfactory. Little to no risk.', color: '#22c55e', percent: 20 },
        2: { label: 'Fair', desc: 'Acceptable quality. Minor concerns for sensitive people.', color: '#84cc16', percent: 40 },
        3: { label: 'Moderate', desc: 'Sensitive groups may experience effects.', color: '#facc15', percent: 60 },
        4: { label: 'Poor', desc: 'Health effects possible. Reduce prolonged outdoor activity.', color: '#fb923c', percent: 80 },
        5: { label: 'Very Poor', desc: 'Serious health risk. Everyone should avoid outdoor exertion.', color: '#ef4444', percent: 100 }
      };
      const info = map[aqi] || { label: 'Unknown', desc: 'Invalid AQI value.', color: '#6b7280', percent: 0 };
      label = info.label;
      desc = info.desc;
      color = info.color;
      percent = info.percent;
    }
    aqiNumberEl.textContent = aqi || '--';
    aqiLabelEl.textContent = label;
    aqiDescEl.textContent = desc;
    const arcLength = 126;
    const targetOffset = arcLength * (1 - percent / 100);
    const currentOffset = parseFloat(aqiArcEl.style.strokeDashoffset) || arcLength;
    aqiArcEl.style.strokeDashoffset = currentOffset;
    aqiArcEl.style.stroke = color;
    aqiArcEl.style.strokeDasharray = arcLength;
    setTimeout(() => {
      aqiArcEl.style.strokeDashoffset = targetOffset;
    }, 80);
  } catch (e) {
    console.error('AQI error:', e);
  }
}

// ─── UPDATE CURRENT WEATHER ─────────────────────────────────────
function updateCurrentWeather(data) {
  document.getElementById('city-name').textContent = data.name ?? '—';
  document.getElementById('city-region').textContent = data.sys?.country ?? '—';
  currentTempF = Math.round(data.main?.temp ?? 72);
  feelsLikeF = Math.round(data.main?.feels_like ?? currentTempF);
  mainTemp.textContent = isCelsius
    ? Math.round((currentTempF - 32) * 5 / 9).toString()
    : currentTempF.toString();
  feelsLikeSpan.textContent = isCelsius
    ? Math.round((feelsLikeF - 32) * 5 / 9).toString() + '°'
    : feelsLikeF.toString() + '°';
  feelsText.textContent =
    feelsLikeF > currentTempF ? 'Humidity is making it feel warmer.' :
    feelsLikeF < currentTempF ? 'Feels cooler due to wind.' :
    'Feels just like the actual temperature.';
  document.getElementById('main-desc').textContent = data.weather?.[0]?.description ?? '—';
  document.getElementById('wind').textContent = `${Math.round(data.wind?.speed ?? 0)} mph`;
  document.getElementById('humidity').textContent = `${data.main?.humidity ?? '—'}%`;
  const lastUpdate = new Date(data.dt * 1000);
  document.getElementById('uv').textContent = lastUpdate.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  });
  const mainIconContainer = document.getElementById('main-weather-icon');
  if (mainIconContainer && data.weather?.[0]?.icon) {
    mainIconContainer.innerHTML = `
      <img src="https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png"
           alt="${data.weather[0].description ?? 'Weather'}"
           class="w-24 drop-shadow-2xl opacity-90">
    `;
  } else if (!mainIconContainer) {
    console.warn('Main weather icon container (#main-weather-icon) not found');
  }
  const visKm = data.visibility ? (data.visibility / 1000).toFixed(1) : '--';
  visibilityValue.innerHTML = `${visKm} <span class="text-base text-zinc-500">km</span>`;
  updateRainBars();
}

// ─── RAIN BARS ──────────────────────────────────────────────────
function updateRainBars() {
  if (!lastForecastData?.list?.length) {
    rainValue.textContent = '--';
    rainBars.innerHTML = '';
    return;
  }
  const list = lastForecastData.list;
  const nowUnix = Date.now() / 1000;
  let closestIndex = 0;
  let minDiff = Infinity;
  list.forEach((item, i) => {
    const diff = Math.abs(item.dt - nowUnix);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  });
  const startIdx = Math.max(0, closestIndex - 2);
  const rainSlots = list.slice(startIdx, startIdx + 7);
  const rainValues = rainSlots.map(slot => slot.rain?.['3h'] || 0);
  const recentRainSum = rainValues.slice(0, 3).reduce((sum, v) => sum + v, 0);
  rainValue.textContent = recentRainSum.toFixed(1);
  const maxRain = Math.max(...rainValues, 0.1);
  const heights = rainValues.map(v => Math.min(100, (v / maxRain) * 100));
  rainBars.innerHTML = '';
  const bars = [];
  heights.forEach((h, i) => {
    const bar = document.createElement('div');
    bar.className = 'w-full bg-indigo-500/60 rounded-t-sm transition-all duration-700 ease-out';
    if (i < 3) bar.classList.add('bg-indigo-600/80');
   
    bar.style.height = '0%';
    rainBars.appendChild(bar);
    bars.push({ bar, targetHeight: h, startTime: performance.now() + (i * 60) });
  });
  rainBars.classList.remove('animate-pulse-once');
  void rainBars.offsetWidth;
  rainBars.classList.add('animate-pulse-once');
  setTimeout(() => rainBars.classList.remove('animate-pulse-once'), 1800);
  function animateBars(now) {
    let allDone = true;
    bars.forEach(({ bar, targetHeight, startTime }) => {
      if (now < startTime) {
        allDone = false;
        return;
      }
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / 700);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentHeight = targetHeight * easedProgress;
      bar.style.height = `${currentHeight}%`;
      if (progress < 1) allDone = false;
    });
    if (!allDone) {
      requestAnimationFrame(animateBars);
    }
  }
  requestAnimationFrame(animateBars);
}

// ─── REFRESH TEMPERATURE DISPLAYS ───────────────────────────────
function refreshTemperatureDisplays() {
  if (!lastForecastData?.list?.length) return;
  const list = lastForecastData.list;
  const cityTimezone = lastCityTimezone;
  const now = new Date();
  // 5-Day Forecast
  const forecastHeading = Array.from(document.querySelectorAll('.glass-card h3'))
    .find(h => h.textContent.includes('5-Day Forecast'));
  const forecastContainer = forecastHeading?.closest('.glass-card')?.querySelector('.flex.flex-col.gap-1');
  if (forecastContainer) {
    forecastContainer.innerHTML = '';
    const dailyGroups = {};
    list.forEach(item => {
      const utcDate = new Date(item.dt * 1000);
      const localDate = new Date(utcDate.getTime() + cityTimezone * 1000);
      const dateKey = localDate.toISOString().split('T')[0];
      if (!dailyGroups[dateKey]) dailyGroups[dateKey] = [];
      dailyGroups[dateKey].push(item);
    });
    const forecastDays = [];
    const nowLocal = new Date(now.getTime() + cityTimezone * 1000);
    for (const dateKey in dailyGroups) {
      const dayItems = dailyGroups[dateKey];
      const firstItem = dayItems[0];
      const date = new Date(firstItem.dt * 1000 + cityTimezone * 1000);
      if (date > nowLocal) {
        const dayName = date.toLocaleString('en-US', { weekday: 'short' });
        if (forecastDays.some(d => d.dayName === dayName)) continue;
        let minTemp = Infinity, maxTemp = -Infinity, maxPop = 0, iconCode = '03d';
        dayItems.forEach(slot => {
          minTemp = Math.min(minTemp, slot.main?.temp ?? Infinity);
          maxTemp = Math.max(maxTemp, slot.main?.temp ?? -Infinity);
          if (slot.pop > maxPop) maxPop = slot.pop;
          const hour = parseInt(slot.dt_txt.split(' ')[1].split(':')[0], 10);
          if (hour >= 9 && hour <= 18 && slot.weather?.[0]?.icon) iconCode = slot.weather[0].icon;
        });
        forecastDays.push({
          dayName,
          iconUrl: `https://openweathermap.org/img/wn/${iconCode}@2x.png`,
          pop: Math.round(maxPop * 100),
          min: Math.round(minTemp),
          max: Math.round(maxTemp)
        });
      }
    }
    const displayDays = forecastDays.slice(0, 5);
    if (displayDays.length > 0) {
      const allMin = Math.min(...displayDays.map(d => d.min));
      const allMax = Math.max(...displayDays.map(d => d.max));
      const range = allMax - allMin || 1;
      displayDays.forEach(day => {
        let minDisp = isCelsius ? Math.round((day.min - 32) * 5 / 9) : day.min;
        let maxDisp = isCelsius ? Math.round((day.max - 32) * 5 / 9) : day.max;
        const left = ((day.min - allMin) / range) * 100;
        const right = 100 - ((day.max - allMin) / range) * 100;
        const row = document.createElement('div');
        row.className = 'day-item';
        row.innerHTML = `
          <span class="text-sm text-zinc-700 dark:text-zinc-400 w-12 font-normal">${day.dayName}</span>
          <div class="flex items-center gap-2">
            <img src="${day.iconUrl}" alt="Weather" class="w-6 h-6">
            ${day.pop > 0 ? `<span class="text-xs text-indigo-400 font-medium">${day.pop}%</span>` : ''}
          </div>
          <div class="flex items-center gap-3 w-28">
            <span class="text-xs text-zinc-600 dark:text-zinc-500 w-6 text-right">${minDisp}°</span>
            <div class="flex-1 h-1 bg-zinc-800 rounded-full relative">
              <div class="absolute h-full bg-zinc-500 rounded-full" style="left: ${left}%; right: ${right}%;"></div>
            </div>
            <span class="text-xs text-zinc-900 dark:text-zinc-200 w-6 text-right">${maxDisp}°</span>
          </div>
        `;
        forecastContainer.appendChild(row);
      });
    }
  }
  // Hourly Forecast
  const hourlyHeading = Array.from(document.querySelectorAll('.glass-card h3'))
    .find(h => h.textContent.includes('Hourly Forecast'));
  const hourlyContainer = hourlyHeading?.closest('.glass-card')?.querySelector('#hourly-scroll');
  if (hourlyContainer) {
    hourlyContainer.innerHTML = '';
    const futureSlots = list.filter(item => (item.dt * 1000) > now.getTime()).slice(0, 8);
    futureSlots.forEach((slot, index) => {
      const slotTime = new Date(slot.dt * 1000 + cityTimezone * 1000);
      const hour = slotTime.getHours();
      let timeText;
      if (index === 0 && Math.abs(slotTime.getTime() - now.getTime()) < 3 * 60 * 60 * 1000) {
        timeText = 'Now';
      } else {
        const isMidnightOrNoon = hour === 0 || hour === 12;
        const displayHour = isMidnightOrNoon ? 12 : hour % 12;
        const ampm = hour < 12 ? 'AM' : 'PM';
        timeText = `${displayHour}${ampm}`;
      }
      const isNow = timeText === 'Now';
      const temp = Math.round(slot.main?.temp ?? 0);
      const tempDisp = isCelsius ? Math.round((temp - 32) * 5 / 9) : temp;
      const iconUrl = slot.weather?.[0]?.icon
        ? `https://openweathermap.org/img/wn/${slot.weather[0].icon}@2x.png`
        : '';
      const item = document.createElement('div');
      item.className = `flex flex-col items-center gap-3 min-w-[60px] snap-center group cursor-pointer ${isNow ? 'opacity-100' : 'opacity-60 hover:opacity-100 transition-opacity'}`;
      item.innerHTML = `
        <span class="text-xs ${isNow ? 'text-zinc-950 dark:text-zinc-100 font-medium' : 'text-zinc-700 dark:text-zinc-400 font-medium'}">${timeText}</span>
        <div class="h-16 w-10 rounded-full ${isNow ? 'bg-indigo-500/20 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-zinc-800/50 border border-transparent group-hover:border-white/10'} flex items-center justify-center">
          ${iconUrl ? `<img src="${iconUrl}" alt="${slot.weather?.[0]?.description ?? 'Weather'}" class="w-8 h-8">` : '<span>—</span>'}
        </div>
        <span class="text-sm ${isNow ? 'text-black dark:text-white font-medium' : 'text-zinc-800 dark:text-zinc-300'}">${tempDisp}°</span>
      `;
      hourlyContainer.appendChild(item);
    });
  }
  // Temperature Chart
  const tempChartCanvas = document.getElementById('tempTrendChart');
  if (tempChartCanvas && list?.length > 0) {
    const futureSlots = list.filter(item => (item.dt * 1000) > now.getTime()).slice(0, 8);
    if (futureSlots.length > 0) {
      const labels = [];
      const temps = [];
      futureSlots.forEach((slot, index) => {
        const slotTime = new Date(slot.dt * 1000 + cityTimezone * 1000);
        const hour = slotTime.getHours();
        labels.push(index === 0 ? 'Now' : `${hour % 12 || 12}${hour < 12 ? 'AM' : 'PM'}`);
        let temp = Math.round(slot.main?.temp ?? 0);
        if (isCelsius) temp = Math.round((temp - 32) * 5 / 9);
        temps.push(temp);
      });
      document.getElementById('tempUnitInChart').textContent = isCelsius ? 'C' : 'F';
      const isDark = html.classList.contains('dark');
      const chartConfig = {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Temperature',
            data: temps,
            borderColor: isDark ? '#a5b4fc' : '#4f46e5',
            backgroundColor: isDark ? 'rgba(165,180,252,0.2)' : 'rgba(79,70,229,0.25)',
            tension: 0.4,
            pointBackgroundColor: isDark ? '#fff' : '#1f2937',
            pointBorderColor: isDark ? '#a5b4fc' : '#4f46e5',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' } },
            y: { grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }, ticks: { callback: value => `${value}°` } }
          }
        }
      };
      if (tempChartInstance) {
        tempChartInstance.data.labels = labels;
        tempChartInstance.data.datasets[0].data = temps;
        tempChartInstance.data.datasets[0].borderColor = isDark ? '#a5b4fc' : '#4f46e5';
        tempChartInstance.data.datasets[0].backgroundColor = isDark ? 'rgba(165,180,252,0.2)' : 'rgba(79,70,229,0.25)';
        tempChartInstance.data.datasets[0].pointBackgroundColor = isDark ? '#fff' : '#1f2937';
        tempChartInstance.data.datasets[0].pointBorderColor = isDark ? '#a5b4fc' : '#4f46e5';
        tempChartInstance.options.scales.x.grid.color = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
        tempChartInstance.options.scales.y.grid.color = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
        tempChartInstance.update();
      } else if (tempChartCanvas) {
        tempChartInstance = new Chart(tempChartCanvas, chartConfig);
      }
    }
  }
  updateRainBars();
}

// ─── HEADER DATE ────────────────────────────────────────────────
function updateHeaderDate() {
  const dateElement = document.getElementById('current-date');
  if (dateElement) {
    dateElement.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}
// Run once on load
updateHeaderDate();
// Schedule next midnight update
function scheduleNextMidnight() {
  const now = new Date();
 
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const msUntilMidnight = tomorrow - now;
  setTimeout(() => {
    updateHeaderDate();
    scheduleNextMidnight();
  }, msUntilMidnight);
}
scheduleNextMidnight();

// ─── AUTO-LOAD ──────────────────────────────────────────────────
async function tryLoadFromCachedGeo() {
  const cached = localStorage.getItem(GEO_CACHE_KEY);
  if (cached) {
    try {
      const { lat, lon, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < GEO_CACHE_MAX_AGE_MS) {
        document.getElementById('city-name').textContent = 'Using cached location...';
        await loadWeatherFromCoords(lat, lon);
        return true;
      }
    } catch (e) {
      console.warn('Invalid geo cache', e);
    }
  }
  return false;
}
// Auto-load logic
(async () => {
  const loadedFromCache = await tryLoadFromCachedGeo();
  if (loadedFromCache) {
    return;
  }
  if (navigator.geolocation) {
    document.getElementById('city-name').textContent = 'Detecting your location...';
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lon } = position.coords;
        localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({
          lat,
          lon,
          timestamp: Date.now()
        }));
        await loadWeatherFromCoords(lat, lon);
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        showError("Couldn't access your location – loading last saved city");
        const savedCity = localStorage.getItem(LAST_CITY_KEY);
        fetchWeather(savedCity || DEFAULT_FALLBACK_CITY);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  } else {
    const savedCity = localStorage.getItem(LAST_CITY_KEY);
    fetchWeather(savedCity || DEFAULT_FALLBACK_CITY);
  }
})();