// 오늘 날씨 어때 — OpenWeather 날씨 앱

const API_BASE = 'https://api.openweathermap.org/data/2.5';
const ICON_BASE = 'https://openweathermap.org/img/wn';
const DEFAULT_CITY = '서울';
const MAX_RECENT = 5;
const FORECAST_DAYS = 5;
const STORAGE_KEY = 'myweather-prefs';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const CITY_MAP = {
  '서울': 'Seoul',
  '부산': 'Busan',
  '제주': 'Jeju',
  '인천': 'Incheon',
  '대구': 'Daegu',
  '대전': 'Daejeon',
  '광주': 'Gwangju',
  '울산': 'Ulsan',
};

const state = {
  unit: 'C',          // 'C' | 'F'
  current: null,      // 현재 날씨 응답
  forecast: null,     // 5일 예보 응답
  recent: [],         // 최근 검색 도시 (최대 5)
  loading: false,
};

const el = {
  unitBtns: document.querySelectorAll('.unit-btn'),
  searchForm: document.getElementById('searchForm'),
  cityInput: document.getElementById('cityInput'),
  searchBtn: document.getElementById('searchBtn'),
  spinner: document.querySelector('#searchBtn .spinner-border'),
  searchIcon: document.querySelector('#searchBtn .bi-search'),
  locBtn: document.getElementById('locBtn'),
  errorMsg: document.getElementById('errorMsg'),
  recentWrap: document.getElementById('recentWrap'),
  recentList: document.getElementById('recentList'),
  weatherArea: document.getElementById('weatherArea'),
  iconCircle: document.getElementById('iconCircle'),
  currentIcon: document.getElementById('currentIcon'),
  cityName: document.getElementById('cityName'),
  currentTemp: document.getElementById('currentTemp'),
  description: document.getElementById('description'),
  feelsLike: document.getElementById('feelsLike'),
  tempMax: document.getElementById('tempMax'),
  tempMin: document.getElementById('tempMin'),
  updatedAt: document.getElementById('updatedAt'),
  humidity: document.getElementById('humidity'),
  wind: document.getElementById('wind'),
  pop: document.getElementById('pop'),
  sunset: document.getElementById('sunset'),
  forecastList: document.getElementById('forecastList'),
};

// ---------- API ----------

class WeatherError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

function buildUrl(endpoint, params) {
  const query = new URLSearchParams({
    ...params,
    appid: API_KEY,
    units: 'metric',
    lang: 'kr',
  });
  return `${API_BASE}/${endpoint}?${query}`;
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new WeatherError(res.status);
  return res.json();
}

// 성공하면 true, 실패하면 오류 메시지를 표시하고 false
async function fetchWeather(params, label) {
  if (state.loading) return false;
  setLoading(true);
  clearError();

  try {
    const [current, forecast] = await Promise.all([
      getJson(buildUrl('weather', params)),
      getJson(buildUrl('forecast', params)),
    ]);
    state.current = current;
    state.forecast = forecast;
    render(true);
    return true;
  } catch (err) {
    if (err.status === 404) {
      showError(`'${label}'을(를) 찾지 못했어요. 도시 이름을 확인해 주세요`);
    } else if (err.status === 401) {
      showError('API 키를 확인해 주세요 (js/config.js)');
    } else {
      showError('날씨를 불러오지 못했어요. 잠시 후 다시 시도해 주세요');
    }
    return false;
  } finally {
    setLoading(false);
  }
}

async function searchCity(name) {
  const city = name.trim();
  if (!city) {
    showError('도시 이름을 입력해 주세요');
    return;
  }

  const ok = await fetchWeather({ q: CITY_MAP[city] || city }, city);
  if (ok) addRecent(city);
}

function searchMyLocation() {
  if (!navigator.geolocation) {
    showError('위치를 가져오지 못했어요. 도시 이름으로 검색해 주세요');
    return;
  }

  clearError();
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      fetchWeather({ lat: latitude, lon: longitude }, '내 위치');
    },
    () => showError('위치를 가져오지 못했어요. 도시 이름으로 검색해 주세요'),
    { timeout: 10000 }
  );
}

// ---------- 데이터 가공 ----------

// Unix 초 + 도시 시차(초) → 그 도시의 현지 시각을 UTC 필드에 담은 Date
function toLocalDate(unix, tz) {
  return new Date((unix + tz) * 1000);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatLocalTime(unix, tz) {
  const d = toLocalDate(unix, tz);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function formatUpdated(unix, tz) {
  const d = toLocalDate(unix, tz);
  const date = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS[d.getUTCDay()]})`;
  return `${date} ${formatLocalTime(unix, tz)} 기준`;
}

function dateKey(unix, tz) {
  const d = toLocalDate(unix, tz);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// 3시간 예보 → 날짜별 { day, icon, desc, max, min } (오늘 제외, 최대 5일)
function summarizeForecast(list, tz, todayKey) {
  const groups = new Map();

  list.forEach((item) => {
    const key = dateKey(item.dt, tz);
    if (key === todayKey) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  return [...groups.values()].slice(0, FORECAST_DAYS).map((items) => {
    const noon = items.reduce((best, item) => {
      const diff = Math.abs(toLocalDate(item.dt, tz).getUTCHours() - 12);
      const bestDiff = Math.abs(toLocalDate(best.dt, tz).getUTCHours() - 12);
      return diff < bestDiff ? item : best;
    });

    return {
      day: WEEKDAYS[toLocalDate(items[0].dt, tz).getUTCDay()],
      icon: noon.weather[0].icon,
      desc: noon.weather[0].description,
      max: Math.max(...items.map((i) => i.main.temp_max)),
      min: Math.min(...items.map((i) => i.main.temp_min)),
    };
  });
}

function getIconTheme(icon) {
  const code = icon.slice(0, 2);
  if (code === '01') return 'is-sun';
  if (['09', '10', '11', '13'].includes(code)) return 'is-rain';
  return 'is-cloud';
}

// ---------- 단위 ----------

function formatTemp(c) {
  const value = state.unit === 'C' ? c : (c * 9) / 5 + 32;
  return `${Math.round(value)}°`;
}

function formatWind(ms) {
  return state.unit === 'C'
    ? `${ms.toFixed(1)} m/s`
    : `${(ms * 2.237).toFixed(1)} mph`;
}

function setUnit(unit) {
  if (state.unit === unit) return;
  state.unit = unit;
  savePrefs();
  renderUnitToggle();
  render(false);
}

// ---------- 렌더링 ----------

function render(animate) {
  if (!state.current || !state.forecast) return;
  renderCurrent();
  renderForecast();

  el.weatherArea.hidden = false;
  if (animate) {
    el.weatherArea.classList.remove('fade-in');
    void el.weatherArea.offsetWidth; // 애니메이션 다시 시작
    el.weatherArea.classList.add('fade-in');
  }
}

function renderCurrent() {
  const c = state.current;
  const w = c.weather[0];
  const tz = c.timezone;

  el.iconCircle.className = `icon-circle ${getIconTheme(w.icon)}`;
  el.currentIcon.src = `${ICON_BASE}/${w.icon}@2x.png`;
  el.currentIcon.alt = w.description;
  el.cityName.textContent = c.sys.country ? `${c.name}, ${c.sys.country}` : c.name;
  el.currentTemp.textContent = formatTemp(c.main.temp);
  el.description.textContent = w.description;
  el.feelsLike.textContent = formatTemp(c.main.feels_like);
  el.tempMax.textContent = formatTemp(c.main.temp_max);
  el.tempMin.textContent = formatTemp(c.main.temp_min);
  el.updatedAt.textContent = formatUpdated(c.dt, tz);

  el.humidity.textContent = `${c.main.humidity}%`;
  el.wind.textContent = formatWind(c.wind.speed);
  const firstPop = state.forecast.list[0] ? state.forecast.list[0].pop : 0;
  el.pop.textContent = `${Math.round((firstPop || 0) * 100)}%`;
  el.sunset.textContent = formatLocalTime(c.sys.sunset, tz);
}

function renderForecast() {
  const tz = state.forecast.city.timezone;
  const todayKey = dateKey(state.current.dt, tz);
  const days = summarizeForecast(state.forecast.list, tz, todayKey);

  el.forecastList.innerHTML = '';
  days.forEach((d) => {
    const item = document.createElement('div');
    item.className = 'day';

    const name = document.createElement('div');
    name.className = 'day-name';
    name.textContent = d.day;

    const img = document.createElement('img');
    img.src = `${ICON_BASE}/${d.icon}@2x.png`;
    img.alt = d.desc;

    const temps = document.createElement('div');
    const max = document.createElement('span');
    max.className = 'day-max';
    max.textContent = formatTemp(d.max);
    const min = document.createElement('span');
    min.className = 'day-min';
    min.textContent = formatTemp(d.min);
    temps.append(max, min);

    item.append(name, img, temps);
    el.forecastList.appendChild(item);
  });
}

function renderRecent() {
  el.recentList.innerHTML = '';
  el.recentWrap.hidden = state.recent.length === 0;

  state.recent.forEach((city) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.city = city;
    chip.textContent = city;
    el.recentList.appendChild(chip);
  });
}

function renderUnitToggle() {
  el.unitBtns.forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.unit === state.unit));
  });
}

function setLoading(isLoading) {
  state.loading = isLoading;
  el.searchBtn.disabled = isLoading;
  el.locBtn.disabled = isLoading;
  el.spinner.hidden = !isLoading;
  el.searchIcon.hidden = isLoading;
  el.weatherArea.classList.toggle('is-loading', isLoading);
}

function showError(message) {
  el.errorMsg.textContent = message;
}

function clearError() {
  el.errorMsg.textContent = '';
}

// ---------- 최근 검색 / 저장 ----------

function addRecent(city) {
  state.recent = [city, ...state.recent.filter((c) => c !== city)].slice(0, MAX_RECENT);
  savePrefs();
  renderRecent();
}

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    if (saved.unit === 'C' || saved.unit === 'F') state.unit = saved.unit;
    if (Array.isArray(saved.recent)) state.recent = saved.recent.slice(0, MAX_RECENT);
  } catch (e) {
    // 저장소를 쓸 수 없으면 기본값으로 동작
  }
}

function savePrefs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      unit: state.unit,
      recent: state.recent,
    }));
  } catch (e) {
    // 저장소를 쓸 수 없으면 저장하지 않음
  }
}

// ---------- 시작 ----------

function init() {
  loadPrefs();
  renderUnitToggle();
  renderRecent();

  el.searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    searchCity(el.cityInput.value);
  });
  el.cityInput.addEventListener('input', clearError);
  el.locBtn.addEventListener('click', searchMyLocation);
  el.unitBtns.forEach((btn) => {
    btn.addEventListener('click', () => setUnit(btn.dataset.unit));
  });
  el.recentList.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    el.cityInput.value = chip.dataset.city;
    searchCity(chip.dataset.city);
  });

  searchCity(state.recent[0] || DEFAULT_CITY);
}

init();
