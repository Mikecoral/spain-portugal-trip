// 依赖：data.js（days）、trip.js（TRIP / HOTELS / CITIES / THEMES / mapsUrlFor）、Leaflet。
(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式等情况下忽略 */ } }
  };

  const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const NUM_CN = ['一', '二', '三', '四', '五', '六', '七', '八'];
  const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobileLayout = () => matchMedia('(max-width: 760px)').matches;

  let day = 0;
  let map = null, routeLayer = null, hotelMarkers = {};
  let weather = store.get('trip-weather-v1') || { t: 0, cities: {} };

  const parseDate = s => new Date(s + 'T12:00:00');
  const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD，取设备当地日期
  const mmdd = s => s.slice(5).replace('-', '.');
  const dayLabel = i => {
    const d = parseDate(TRIP[i].date);
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${WEEKDAY[d.getDay()]}`;
  };

  // ───────────── 地图 ─────────────

  function initMap() {
    try {
      if (typeof L === 'undefined') throw new Error('Leaflet 未加载');
      map = L.map('map', {
        scrollWheelZoom: true, touchZoom: true, doubleClickZoom: true, keyboard: true, zoomControl: true,
        // 手机上单指拖动留给页面滚动，双指才移动/缩放地图，避免"划不动页面"
        dragging: !L.Browser.mobile,
        zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 120, wheelDebounceTime: 40
      }).setView([40.419, -3.702], 14);
      L.tileLayer(TILE_URL, {
        maxZoom: 19, crossOrigin: true,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      routeLayer = L.layerGroup().addTo(map);

      for (const [key, h] of Object.entries(HOTELS)) {
        const madrid = key === 'madrid';
        const link = h.url ? `<br><a href="${esc(h.url)}" target="_blank" rel="noopener noreferrer">在 Google Maps 打开酒店 ↗</a>` : '';
        hotelMarkers[key] = L.marker(h.latlng, {
          zIndexOffset: madrid ? 1000 : 1500,
          icon: L.divIcon({ className: 'hotel-map-icon' + (madrid ? '' : ' bcn-hotel-icon'), html: '<span aria-hidden="true">⌂</span>', iconSize: [42, 42], iconAnchor: [21, 21] }),
          title: h.stayLabel, alt: h.name
        })
          .bindTooltip(h.tooltip, { permanent: true, direction: madrid ? 'top' : 'bottom', offset: [0, madrid ? -27 : 25], className: 'hotel-map-label' })
          .bindPopup(`<strong>${esc(h.name)}</strong><br>${h.popupAddress}${link}`);
      }
    } catch {
      map = null;
      $('#mapFallback').hidden = false;
    }
    $('#mapHint').textContent = typeof L !== 'undefined' && L.Browser.mobile
      ? '双指缩放、移动地图（单指可滚动页面）。连线不是导航。'
      : '地图内滚轮 / 双指缩放，拖动移动。连线不是导航。';
  }

  function boundsPoints() {
    const t = TRIP[day];
    const pts = t.coords.filter(Boolean);
    if (t.hotelOnMap) pts.push(HOTELS[t.hotel].latlng);
    return pts;
  }

  function fit() {
    if (map) map.fitBounds(boundsPoints(), { paddingTopLeft: [45, 80], paddingBottomRight: [55, 110], maxZoom: 15 });
  }

  function drawMap() {
    if (!map) return;
    const t = TRIP[day];
    routeLayer.clearLayers();

    // 只显示当天所住的酒店（托莱多当天往返，不显示）
    for (const [key, m] of Object.entries(hotelMarkers)) {
      const show = t.hotelOnMap && key === t.hotel;
      if (show && !map.hasLayer(m)) m.addTo(map);
      if (!show && map.hasLayer(m)) map.removeLayer(m);
    }

    const off = new Set(t.offRoute || []);
    L.polyline(t.coords.filter((p, i) => p && !off.has(i)), {
      color: THEMES[t.theme].accent, weight: 3, dashArray: '3 10', opacity: .55, lineCap: 'round'
    }).addTo(routeLayer);

    const hotelPos = HOTELS[t.hotel].latlng;
    days[day].stops.forEach((s, i) => {
      const p = t.coords[i];
      if (!p || (t.hotelOnMap && p[0] === hotelPos[0] && p[1] === hotelPos[1])) return; // 与酒店重合的点不重复画
      const optional = (t.optional || []).includes(i);
      L.marker(p, {
        icon: L.divIcon({ className: 'marker' + (optional ? ' optional-marker' : ''), html: `<span class="pin">${i + 1}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] }),
        title: s[1], alt: '查看' + s[1]
      })
        .addTo(routeLayer)
        .bindTooltip(esc(s[1]), { permanent: false, direction: 'top', offset: [0, -20], className: 'place-label' })
        .bindPopup(`<strong>${esc(s[1])}</strong><br><a href="${esc(mapsUrlFor(day, s))}" target="_blank" rel="noopener noreferrer">在 Google Maps 打开 ↗</a>`)
        .on('click', () => { $('#search').value = ''; renderList(); focusStop(i); });
    });
    fit();
  }

  function focusStop(i) {
    const el = $('#stop' + i);
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
    el.querySelector('summary').focus({ preventScroll: true });
    if (map && TRIP[day].coords[i]) map.panTo(TRIP[day].coords[i]);
  }

  function focusHotel() {
    if (!map) return;
    let t = TRIP[day];
    if (!t.hotelOnMap) { setDay(TRIP.findIndex(x => x.hotel === t.hotel && x.hotelOnMap)); t = TRIP[day]; }
    const h = HOTELS[t.hotel];
    map.setView(h.latlng, 16);
    hotelMarkers[t.hotel].openPopup();
    $('#map').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
  }

  // ───────────── 渲染 ─────────────

  function applyTheme(el, name) {
    const th = THEMES[name];
    el.style.setProperty('--t-accent', th.accent);
    el.style.setProperty('--t-pin', th.pin);
    el.style.setProperty('--t-soft', th.soft);
    el.style.setProperty('--t-line', th.line);
    el.style.setProperty('--t-ink', th.ink);
  }

  function renderTabs() {
    const today = todayStr();
    $('#tabs').innerHTML = TRIP.map((t, i) =>
      `<button class="tab" id="tab${i}" type="button" role="tab" aria-controls="panel" aria-label="${mmdd(t.date)} ${esc(t.short)}，${t.tabCount} 个地点${t.date === today ? '，今天' : ''}">` +
      `<i></i>${mmdd(t.date)} · ${esc(t.short)} <small>${t.tabCount}</small>${t.date === today ? '<em class="today">今天</em>' : ''}</button>`
    ).join('');
    document.querySelectorAll('.tab').forEach((el, i) => {
      applyTheme(el, TRIP[i].theme);
      el.addEventListener('click', () => setDay(i));
      el.addEventListener('keydown', e => {
        const target = { ArrowRight: day + 1, ArrowLeft: day - 1, Home: 0, End: TRIP.length - 1 }[e.key];
        if (target === undefined) return;
        e.preventDefault();
        setDay(target);
        $('#tab' + day).focus();
      });
    });
  }

  function renderList() {
    const q = $('#search').value.trim().toLowerCase();
    const html = days[day].stops.map((s, i) => {
      if (q && !s.join(' ').toLowerCase().includes(q)) return '';
      const url = s[2] ? esc(mapsUrlFor(day, s)) : '';
      return `<details class="stop" id="stop${i}"><summary><span class="number">${i + 1}</span><span><strong>` +
        (s[2] ? `<a class="place-map-link" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="在 Google Maps 打开${esc(s[1])}">${esc(s[1])} <span aria-hidden="true">↗</span></a>` : esc(s[1])) +
        `</strong><span class="es">${esc(s[2])}</span></span><time>${esc(s[0])}</time></summary><div class="detail">` +
        (s[2] ? `<a class="google-map-button" href="${url}" target="_blank" rel="noopener noreferrer">在 Google Maps 打开 ↗</a>` : '') +
        `<p class="desc">${esc(s[5])}</p><div class="pills"><span>${esc(s[3])}</span><span>${esc(s[4])}</span></div><p>${esc(s[6])}</p>` +
        (s[7] ? `<a href="${esc(s[7])}" target="_blank" rel="noopener noreferrer">官方信息 / 购票 ↗</a>` : '') +
        '</div></details>';
    }).join('');
    $('#list').innerHTML = html || '<p class="empty">没有匹配的地点，试试中文或西班牙语名称。</p>';
  }

  function render() {
    const d = days[day], t = TRIP[day], h = HOTELS[t.hotel];
    applyTheme(document.body, t.theme);
    document.body.classList.toggle('compact', t.city !== 'madrid'); // 非马德里的日子景点多，标记画小一点

    $('#stayName').textContent = t.stayLabel || h.stayLabel;
    $('#stayAddr').textContent = h.address;
    const maps = $('#stayMaps');
    maps.hidden = !h.url;
    if (h.url) maps.href = h.url;
    $('#legendHotel').hidden = !t.hotelOnMap;

    $('#mapwrap').setAttribute('aria-label', CITIES[t.city].name + '景点地图');
    document.querySelectorAll('.tab').forEach((el, i) => {
      el.setAttribute('aria-selected', String(i === day));
      el.tabIndex = i === day ? 0 : -1;
    });
    $('#panel').setAttribute('aria-labelledby', 'tab' + day);

    $('#title').textContent = d.title;
    $('#subtitle').textContent = d.subtitle;
    $('#count').textContent = t.countText || d.stops.length + ' 个停留点';
    $('#daylabel').textContent = dayLabel(day);
    $('#mapday').textContent = String(day + 1).padStart(2, '0');
    $('#notes').innerHTML = d.notes.map(n => `<div class="notebox"><h3>${esc(n[1])}</h3><p>${esc(n[2])}</p></div>`).join('');
    const nextIdx = (day + 1) % TRIP.length;
    $('#next').textContent = nextIdx === 0
      ? `← 回看第一天 · ${TRIP[0].short}`
      : `看看第${NUM_CN[nextIdx]}天 · ${TRIP[nextIdx].short} →`;

    $('#search').value = '';
    renderList();
    renderWeather();
    drawMap();
  }

  function setDay(i) {
    day = (i + TRIP.length) % TRIP.length;
    render();
    $('#panel').scrollTop = 0;
    $('#tab' + day).scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
    store.set('trip-day', day);
    history.replaceState(null, '', '#d' + (day + 1));
  }

  function initialDay() {
    const m = /^#d([1-8])$/.exec(location.hash);
    if (m) return Number(m[1]) - 1;
    const today = TRIP.findIndex(t => t.date === todayStr());
    if (today >= 0) return today;
    const saved = store.get('trip-day');
    return Number.isInteger(saved) && saved >= 0 && saved < TRIP.length ? saved : 0;
  }

  // ───────────── 天气（Open-Meteo） ─────────────

  const WMO = [
    [[0], '☀️', '晴'], [[1], '🌤️', '大致晴朗'], [[2], '⛅', '多云'], [[3], '☁️', '阴'],
    [[45, 48], '🌫️', '雾'], [[51, 53, 55, 56, 57], '🌦️', '毛毛雨'], [[61, 63, 65, 66, 67], '🌧️', '雨'],
    [[71, 73, 75, 77, 85, 86], '🌨️', '雪'], [[80, 81, 82], '🌦️', '阵雨'], [[95, 96, 99], '⛈️', '雷暴']
  ];
  const wmo = code => WMO.find(w => w[0].includes(code)) || [[], '🌡️', '天气'];

  async function fetchCity(key) {
    const [lat, lng] = CITIES[key].latlng;
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&forecast_days=16';
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather ' + res.status);
    const { daily } = await res.json();
    const out = {};
    daily.time.forEach((date, i) => {
      out[date] = {
        code: daily.weather_code[i], max: daily.temperature_2m_max[i], min: daily.temperature_2m_min[i],
        pop: daily.precipitation_probability_max[i], sunrise: daily.sunrise[i].slice(11), sunset: daily.sunset[i].slice(11)
      };
    });
    return out;
  }

  async function loadWeather() {
    if (Date.now() - weather.t < 3 * 3600e3 || navigator.onLine === false) return renderWeather();
    const keys = [...new Set(TRIP.map(t => t.city))];
    const results = await Promise.allSettled(keys.map(fetchCity));
    let ok = false;
    results.forEach((r, i) => {
      if (r.status !== 'fulfilled') return;
      ok = true;
      weather.cities[keys[i]] = { ...(weather.cities[keys[i]] || {}), ...r.value }; // 保留已过期的日期，离线时也能看
    });
    if (ok) { weather.t = Date.now(); store.set('trip-weather-v1', weather); }
    renderWeather();
  }

  function renderWeather() {
    const box = $('#weather'), t = TRIP[day];
    const w = weather.cities[t.city] && weather.cities[t.city][t.date];
    if (w) {
      const [, icon, text] = wmo(w.code);
      const upd = weather.t ? new Date(weather.t) : null;
      const updText = upd ? `${upd.getMonth() + 1}-${upd.getDate()} ${String(upd.getHours()).padStart(2, '0')}:${String(upd.getMinutes()).padStart(2, '0')}` : '';
      box.innerHTML = `<div class="wx"><span class="wx-icon" aria-hidden="true">${icon}</span><div>` +
        `<strong>${text} · ${Math.round(w.min)}° – ${Math.round(w.max)}°C</strong>` +
        `<span>降水概率 ${w.pop ?? '—'}% · 日出 ${w.sunrise} · 日落 ${w.sunset}</span></div></div>` +
        `<small class="wx-meta">${CITIES[t.city].name}当地预报 · Open-Meteo${updText ? ' · 更新于 ' + updText : ''}${navigator.onLine === false ? '（离线缓存）' : ''}</small>`;
      return;
    }
    const diff = Math.round((parseDate(t.date) - parseDate(todayStr())) / 864e5);
    if (diff < 0) { box.innerHTML = ''; return; }
    box.innerHTML = diff >= 16
      ? `<small class="wx-meta">天气预报约在出发前 15 天开放（${mmdd(new Date(parseDate(t.date) - 15 * 864e5).toLocaleDateString('en-CA').slice(0))} 起可看）</small>`
      : '<small class="wx-meta">天气暂时无法获取，联网后会自动更新</small>';
  }

  // ───────────── 离线准备 ─────────────

  const lon2x = (lng, z) => Math.floor((lng + 180) / 360 * 2 ** z);
  const lat2y = (lat, z) => {
    const r = lat * Math.PI / 180;
    return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z);
  };

  // 每天：整体范围的 z11–15（过大则跳过该级），加每个景点周围 3×3 的 z15/z16。
  function tileUrls() {
    const set = new Set();
    const add = (z, x0, x1, y0, y1) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) set.add(`${z}/${x}/${y}`); };
    TRIP.forEach(t => {
      const pts = t.coords.filter(Boolean).concat(t.hotelOnMap ? [HOTELS[t.hotel].latlng] : []);
      const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
      for (let z = 11; z <= 15; z++) {
        const x0 = lon2x(Math.min(...lngs), z) - 1, x1 = lon2x(Math.max(...lngs), z) + 1;
        const y0 = lat2y(Math.max(...lats), z) - 1, y1 = lat2y(Math.min(...lats), z) + 1;
        if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 150) add(z, x0, x1, y0, y1);
      }
      pts.forEach(([la, ln]) => [15, 16].forEach(z => add(z, lon2x(ln, z) - 1, lon2x(ln, z) + 1, lat2y(la, z) - 1, lat2y(la, z) + 1)));
    });
    return [...set].map(k => { const [z, x, y] = k.split('/'); return TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y); });
  }

  function setOfflineLabel() {
    const o = store.get('trip-offline');
    $('#offline').textContent = o ? '离线已就绪 ✓' : '离线准备';
    $('#offline').title = o ? `已缓存 ${o.n} 张地图瓦片，${new Date(o.t).toLocaleDateString('zh-CN')}` : '';
  }

  let preparing = false;
  async function prepareOffline() {
    if (preparing) return;
    if (!('serviceWorker' in navigator)) return toast('当前浏览器不支持离线缓存');
    try { await navigator.serviceWorker.ready; } catch { return toast('离线功能暂不可用'); }
    if (!navigator.serviceWorker.controller) return toast('离线功能刚启用，请刷新页面后再点一次');
    if (navigator.onLine === false) return toast('需要联网才能准备离线内容');

    preparing = true;
    const btn = $('#offline'), urls = tileUrls();
    let done = 0, failed = 0, next = 0;
    const worker = async () => {
      while (next < urls.length) {
        const u = urls[next++];
        try { const r = await fetch(u, { mode: 'cors' }); if (!r.ok) throw 0; await r.arrayBuffer(); } catch { failed++; }
        btn.textContent = `缓存地图 ${Math.round(++done / urls.length * 100)}%`;
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    weather.t = 0;
    await loadWeather();
    preparing = false;

    if (failed > urls.length * 0.1) {
      toast(`有 ${failed} 张地图没缓存成功，请换个网络再点一次`, 5000);
      btn.textContent = '离线准备';
    } else {
      store.set('trip-offline', { t: Date.now(), n: urls.length - failed });
      toast(`离线已就绪：行程、天气和 ${urls.length - failed} 张地图已存到本机`, 4000);
      setOfflineLabel();
    }
  }

  // ───────────── 杂项 ─────────────

  let toastTimer;
  function toast(msg, ms = 2500) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  async function share() {
    const url = location.href, title = document.title;
    if (isTouch && navigator.share) {
      try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('链接已复制，发给同行朋友吧');
    } catch {
      const input = $('#shareFallback');
      input.hidden = false;
      input.value = url;
      input.select();
    }
  }

  function updateNetBadge() { $('#netBadge').hidden = navigator.onLine !== false; }

  // ───────────── 启动 ─────────────

  renderTabs();
  initMap();
  $('#fit').addEventListener('click', fit);
  $('#hotelFocus').addEventListener('click', focusHotel);
  $('#search').addEventListener('input', renderList);
  $('#next').addEventListener('click', () => { setDay(day + 1); if (isMobileLayout()) window.scrollTo(0, 0); });
  $('#offline').addEventListener('click', prepareOffline);
  $('#share').addEventListener('click', share);
  $('#print').addEventListener('click', () => { document.querySelectorAll('.stop').forEach(el => { el.open = true; }); window.print(); });
  // 展开某个景点时，地图跟着移过去（事件委托，不用每次重绘列表都重新绑定）
  $('#list').addEventListener('toggle', e => {
    const el = e.target;
    if (!el.open || !map) return;
    const p = TRIP[day].coords[Number(el.id.replace('stop', ''))];
    if (p) map.panTo(p);
  }, true);
  window.addEventListener('hashchange', () => { const m = /^#d([1-8])$/.exec(location.hash); if (m && Number(m[1]) - 1 !== day) setDay(Number(m[1]) - 1); });
  window.addEventListener('online', () => { updateNetBadge(); loadWeather(); });
  window.addEventListener('offline', () => { updateNetBadge(); renderWeather(); });

  setDay(initialDay());
  setOfflineLabel();
  updateNetBadge();
  loadWeather();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
