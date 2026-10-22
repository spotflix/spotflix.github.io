'use strict';
// Spotflix · app.js

const API_URL = "https://script.google.com/macros/s/AKfycbw_jjfqWdYmN_YjHwtlbldJyWtdjMCynvQaPtFaop3vNQAU9EjaoEhcJAchmyCrzgLC/exec";
const LS_EMAIL = 'spotflix_user_email';
const LS_DATA = 'spotflix_data_v2_';

// ---------- utilidades ----------
const $ = id => document.getElementById(id);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = t => String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const cssUrl = u => String(u).replace(/["'()\\\s]/g, c => encodeURIComponent(c));
const seguro = fn => { try { fn(); } catch (e) { console.error(e); } };

// solo http(s) o rutas relativas (nada de javascript:, data:, etc.)
function urlSegura(u) {
  u = String(u == null ? '' : u).trim();
  if (!u) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) && !/^https?:/i.test(u)) return '';
  return u;
}

// imagen de relleno propia (antes se usaba via.placeholder.com, que ya no responde)
const PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 220"><rect width="160" height="220" fill="#222"/>' +
  '<circle cx="80" cy="100" r="28" fill="none" stroke="#444" stroke-width="6"/><path d="M72 88l22 12-22 12z" fill="#444"/></svg>');

const imgTag = (src, alt) => `<img src="${esc(urlSegura(src) || PLACEHOLDER)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
const tituloDe = it => it.nombre || it.Nombre || it.titulo || it.cancion || it.Personaje || '';

// ---------- estado ----------
const S = {
  items: { movies: [], series: [], animes: [] },
  playlist: [], albums: [], bands: [], athletes: [], covers: {},
  current: -1, hist: [], shuffle: false, repeat: false, errores: 0
};

let audio, video, frame;

// ---------- avisos ----------
let toastT;
function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}
function setEstado(html) {
  const e = $('estado-carga');
  if (!e) return;
  e.innerHTML = html || '';
  e.hidden = !html;
}

// =====================================================================
//  Inicio, menú, instalación PWA
// =====================================================================
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const b = $('pwa-install-banner');
  if (b) b.hidden = false;
});
window.addEventListener('appinstalled', () => { const b = $('pwa-install-banner'); if (b) b.hidden = true; });
window.addEventListener('offline', () => toast('Sin conexión'));
window.addEventListener('online', () => toast('De nuevo en línea'));

function cerrarMenuMovil() {
  $('nav-links').classList.remove('active');
  $('menu-toggle').setAttribute('aria-expanded', 'false');
}

function init() {
  audio = $('main-audio-player');
  video = $('main-video-player');
  frame = $('embed-frame');

  $('menu-toggle').addEventListener('click', () => {
    const abierto = $('nav-links').classList.toggle('active');
    $('menu-toggle').setAttribute('aria-expanded', String(abierto));
  });
  $('install-pwa-btn').addEventListener('click', () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; $('pwa-install-banner').hidden = true; });
  });
  $('install-close-btn').addEventListener('click', () => { $('pwa-install-banner').hidden = true; });
  $('email-input').addEventListener('keydown', e => { if (e.key === 'Enter') loginConEmailManual(); });
  $('song-search').addEventListener('input', filtrarCanciones);

  configurarAudio();
  configurarVideo();

  const email = localStorage.getItem(LS_EMAIL);
  if (email) {
    $('login-screen').hidden = true;
    cargarDatosUsuario(email);
  }
}

// =====================================================================
//  Sesión
// =====================================================================
function parseJwt(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(window.atob(b64))));
  } catch (e) { return null; }
}
function handleCredentialResponse(response) {   // lo llama Google Identity Services por nombre
  const d = parseJwt(response.credential);
  if (d && d.email) iniciarSesion(d.email);
}
function loginConEmailManual() {
  const v = $('email-input').value.trim();
  if (/^\S+@\S+\.\S+$/.test(v)) iniciarSesion(v);
  else toast('Escribe un correo válido');
}
function iniciarSesion(email) {
  email = email.trim().toLowerCase();
  localStorage.setItem(LS_EMAIL, email);
  $('login-screen').hidden = true;
  cargarDatosUsuario(email);
}
function logout() {
  const email = localStorage.getItem(LS_EMAIL);
  localStorage.removeItem(LS_EMAIL);
  if (email) localStorage.removeItem(LS_DATA + email);
  try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) { /* nada */ }
  location.reload();
}

// =====================================================================
//  Carga de datos: primero lo guardado (instantáneo), luego se actualiza de la red
// =====================================================================
async function pedirDatos(email) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(`${API_URL}?email=${encodeURIComponent(email)}`, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    const data = JSON.parse(txt);
    if (data.error) throw new Error(data.error);
    return { data, txt };
  } finally { clearTimeout(t); }
}

function mostrarEsqueletos() {
  const sk = Array.from({ length: 6 }, () => '<div class="card skeleton"></div>').join('');
  ['fav-movies', 'fav-series', 'fav-animes', 'fav-books'].forEach(id => { const c = $(id); if (c) c.innerHTML = sk; });
}

async function cargarDatosUsuario(email) {
  const clave = LS_DATA + email;
  let previo = null;
  try { previo = localStorage.getItem(clave); } catch (e) { /* sin almacenamiento */ }

  if (previo) {
    try { pintarTodo(JSON.parse(previo)); } catch (e) { previo = null; }
  }
  if (!previo) { mostrarEsqueletos(); setEstado('Cargando tu biblioteca…'); }

  try {
    const { data, txt } = await pedirDatos(email);
    if (txt !== previo) {                    // si no cambió nada, no se vuelve a dibujar
      pintarTodo(data);
      try { localStorage.setItem(clave, txt); } catch (e) { /* lleno: no pasa nada */ }
    }
    setEstado('');
  } catch (err) {
    console.error('Error al cargar datos:', err);
    setEstado(previo
      ? 'Sin conexión: mostrando tu última biblioteca guardada.'
      : 'No se pudo cargar la biblioteca. <button class="btn-reintentar" onclick="cargarDatosUsuario(localStorage.getItem(\'' + LS_EMAIL + '\'))">Reintentar</button>');
  }
}

function pintarTodo(data) {
  seguro(() => pintarUsuario(data.usuario));
  S.items.movies = data.cat_peliculas || [];
  S.items.series = data.cat_series || [];
  S.items.animes = data.cat_animes || [];
  S.albums = data.cat_albums || [];
  S.covers = {};
  S.albums.forEach(a => { if (a.nombre && a.poster) S.covers[norm(a.nombre)] = a.poster; });

  seguro(() => renderCarrusel('fav-movies', 'movies'));
  seguro(() => renderCarrusel('fav-series', 'series'));
  seguro(() => renderCarrusel('fav-animes', 'animes'));
  seguro(() => prepararPlaylist(data.cat_canciones));
  seguro(renderCanciones);
  seguro(() => renderBandas(data.cat_bandas));
  seguro(renderAlbums);
  seguro(() => renderLibros(data.cat_libros));
  seguro(() => renderPersonajes(data.cat_deportes));
}

function pintarUsuario(u) {
  u = u || {};
  const nombre = u.nombre || 'Usuario';
  $('user-name').textContent = 'Perfil de ' + nombre;
  $('nombreOnTop').textContent = nombre.toUpperCase();
  const av = $('user-avatar'), foto = urlSegura(u.foto_perfil);
  if (foto) { av.src = foto; av.hidden = false; } else av.hidden = true;
  if (/^#[0-9a-f]{3,8}$/i.test(u.colores || '')) document.documentElement.style.setProperty('--accent', u.colores);
}

// =====================================================================
//  Películas, series, animes, libros
// =====================================================================
function renderCarrusel(containerId, clave) {
  const cont = $(containerId), items = S.items[clave];
  if (!cont) return;
  if (!items.length) { cont.innerHTML = '<p class="empty-msg">Aún no hay títulos aquí.</p>'; return; }
  cont.innerHTML = items.map((it, i) => {
    const t = tituloDe(it);
    return `
      <div class="card" role="button" tabindex="0" data-media="${clave}" data-i="${i}">
        ${imgTag(it.poster || it.photo, t)}
        <h4>${esc(t)}</h4>
        <p>${esc(it.genero || it.year || '')}</p>
      </div>`;
  }).join('');
}

function renderLibros(libros) {
  const cont = $('fav-books');
  libros = libros || [];
  if (!cont) return;
  if (!libros.length) { cont.innerHTML = '<p class="empty-msg">Aún no hay libros aquí.</p>'; return; }
  cont.innerHTML = libros.map(l => {
    const t = tituloDe(l), link = urlSegura(l.link);
    return `
      <div class="book-card">
        ${imgTag(l.poster || l.photo, t)}
        <h4>${esc(t)}</h4>
        ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener" class="btn-read">Leer</a>` : ''}
      </div>`;
  }).join('');
}

function moverCarrusel(id, dir) {
  const el = $(id);
  if (el) el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: 'smooth' });
}

// ---------- video ----------
function urlEmbed(url) {
  let m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0&playsinline=1`;
  m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/i);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (m) return `https://player.vimeo.com/video/${m[1]}?autoplay=1`;
  return '';
}

function configurarVideo() {
  video.addEventListener('play', () => { if (audio && !audio.paused) audio.pause(); }); // no sonar a la vez
  video.addEventListener('error', () => { if (video.getAttribute('src')) toast('No se pudo reproducir este video'); });
}

function reproducirMedia(item) {
  const url = urlSegura(item.video);
  if (!url) { toast('Este título aún no tiene video'); return; }
  $('playing-title').textContent = tituloDe(item);
  $('playing-info').textContent = [item.genero, item.year].filter(Boolean).join(' · ');

  const emb = urlEmbed(url);
  if (emb) {
    video.pause();
    video.removeAttribute('src');
    video.hidden = true;
    frame.hidden = false;
    frame.src = emb;
  } else {
    frame.hidden = true;
    frame.src = 'about:blank';
    video.hidden = false;
    video.src = url;
    video.play().catch(() => { /* el usuario puede tocar ▶ */ });
  }
  $('player-section').scrollIntoView({ behavior: 'smooth', block: 'start' }); // en el teléfono el reproductor queda arriba y no se veía nada
}

// =====================================================================
//  Canciones y reproductor de audio
// =====================================================================
function prepararPlaylist(canciones) {
  const urlActual = S.current >= 0 && S.playlist[S.current] ? S.playlist[S.current].audio : null;
  S.playlist = (canciones || []).filter(c => c && c.audio).map((c, i) => Object.assign({}, c, { _i: i }));
  S.current = urlActual ? S.playlist.findIndex(c => c.audio === urlActual) : -1;
  S.hist = [];
}

const nombreCancion = c => c.cancion || c.nombre || '-';

function renderCanciones() {
  const tbody = $('songs-list');
  if (!tbody) return;
  if (!S.playlist.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">Aún no hay canciones con audio.</td></tr>';
    return;
  }
  tbody.innerHTML = S.playlist.map((c, i) => `
    <tr id="song-row-${i}" data-song="${i}" data-q="${esc(norm(nombreCancion(c) + ' ' + (c.artista || '') + ' ' + (c.album || '')))}">
      <td class="play-btn-cell">▶</td>
      <td>${esc(nombreCancion(c))}<small class="solo-movil">${esc(c.artista || '')}</small></td>
      <td class="col-artista">${esc(c.artista || '-')}</td>
      <td class="col-album">${esc(c.album || '-')}</td>
    </tr>`).join('');
  marcarFilaActiva(false);
  filtrarCanciones();
}

function filtrarCanciones() {
  const q = norm($('song-search').value);
  const palabras = q ? q.split(' ') : [];
  $('songs-list').querySelectorAll('tr[data-q]').forEach(tr => {
    tr.hidden = palabras.length > 0 && !palabras.every(p => tr.dataset.q.indexOf(p) > -1);
  });
}

function marcarFilaActiva(desplazar) {
  const prev = $('songs-list').querySelector('.playing-row');
  if (prev) prev.classList.remove('playing-row');
  const fila = S.current >= 0 ? $('song-row-' + S.current) : null;
  if (!fila) return;
  fila.classList.add('playing-row');
  if (desplazar) { // se mueve solo la tabla, no toda la página
    const cont = $('songs-scroll');
    cont.scrollTop = Math.max(0, fila.offsetTop - cont.clientHeight / 2);
  }
}

function urlAudio(url) {
  const m = String(url).match(/drive\.google\.com\/file\/d\/([\w-]+)/i);
  return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : url;
}

function portadaDe(c) {
  return urlSegura(c.poster || c.portada || c.cover) || urlSegura(S.covers[norm(c.album)]) || '';
}

function cargarPista(p) {
  $('audio-track-title').textContent = p.title;
  $('audio-track-artist').textContent = p.artist || '-';
  const cover = $('audio-cover');
  if (p.cover) { cover.src = p.cover; cover.hidden = false; } else cover.hidden = true;
  document.body.classList.add('has-player');
  audio.src = urlAudio(p.url);
  audio.play().catch(err => { if (err && err.name === 'NotAllowedError') toast('Toca ▶ para reproducir'); });
  actualizarMediaSession(p);
}

function reproducir(i, desdeHistorial) {
  const n = S.playlist.length;
  if (!n) return;
  i = ((i % n) + n) % n;
  if (!desdeHistorial && S.current >= 0 && S.current !== i) S.hist.push(S.current);
  S.current = i;
  const c = S.playlist[i];
  cargarPista({ title: nombreCancion(c), artist: c.artista, album: c.album, cover: portadaDe(c), url: c.audio });
  marcarFilaActiva(true);
}

function siguiente() {
  const n = S.playlist.length;
  if (!n) return;
  let i;
  if (S.shuffle && n > 1) { do { i = Math.floor(Math.random() * n); } while (i === S.current); }
  else i = (S.current + 1) % n;
  reproducir(i);
}

function anterior() {
  const n = S.playlist.length;
  if (!n) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }   // como en cualquier reproductor: primero reinicia la pista
  if (S.hist.length) reproducir(S.hist.pop(), true);
  else reproducir((S.current - 1 + n) % n, true);
}

function toggleShuffle() {
  S.shuffle = !S.shuffle;
  $('btn-shuffle').classList.toggle('active-control', S.shuffle);
  toast(S.shuffle ? 'Aleatorio activado' : 'Aleatorio desactivado');
}
function toggleRepeat() {
  S.repeat = !S.repeat;
  audio.loop = S.repeat;
  $('btn-repeat').classList.toggle('active-control', S.repeat);
  toast(S.repeat ? 'Repetir la canción' : 'Repetir desactivado');
}
function alternarPlay() {
  if (!audio.src) { if (S.playlist.length) reproducir(0); return; }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

const fmt = s => (isFinite(s) && s >= 0) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00';

function configurarAudio() {
  let arrastrando = false;
  const seek = $('seek');

  audio.addEventListener('play', () => { $('btn-play').textContent = '⏸'; if (video && !video.paused) video.pause(); });
  audio.addEventListener('pause', () => { $('btn-play').textContent = '▶'; });
  audio.addEventListener('ended', () => { if (!audio.loop) siguiente(); });
  audio.addEventListener('playing', () => { S.errores = 0; });
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return;
    S.errores++;
    if (S.errores >= Math.min(3, S.playlist.length || 1)) { toast('No se pudo reproducir el audio'); S.errores = 0; return; }
    toast('Esa pista no carga, paso a la siguiente');
    setTimeout(siguiente, 700);
  });
  audio.addEventListener('loadedmetadata', () => { $('t-dur').textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    $('t-cur').textContent = fmt(audio.currentTime);
    if (!arrastrando && isFinite(audio.duration) && audio.duration > 0) seek.value = (audio.currentTime / audio.duration) * 100;
    if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && isFinite(audio.duration) && audio.duration > 0) {
      try { navigator.mediaSession.setPositionState({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration), playbackRate: audio.playbackRate || 1 }); } catch (e) { /* nada */ }
    }
  });

  seek.addEventListener('pointerdown', () => { arrastrando = true; });
  ['pointerup', 'pointercancel', 'change'].forEach(ev => seek.addEventListener(ev, () => { arrastrando = false; }));
  seek.addEventListener('input', () => {
    if (isFinite(audio.duration)) audio.currentTime = (seek.value / 100) * audio.duration;
  });

  $('btn-play').addEventListener('click', alternarPlay);
  $('btn-prev').addEventListener('click', anterior);
  $('btn-next').addEventListener('click', siguiente);
  $('btn-shuffle').addEventListener('click', toggleShuffle);
  $('btn-repeat').addEventListener('click', toggleRepeat);

  // controles de la pantalla de bloqueo / notificación del teléfono
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    const accion = (n, f) => { try { ms.setActionHandler(n, f); } catch (e) { /* no soportada */ } };
    accion('play', () => audio.play());
    accion('pause', () => audio.pause());
    accion('previoustrack', anterior);
    accion('nexttrack', siguiente);
    accion('seekbackward', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
    accion('seekforward', () => { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 10); });
    accion('seekto', d => { audio.currentTime = d.seekTime; });
  }
}

function actualizarMediaSession(p) {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  let artwork = [];
  if (p.cover) { try { artwork = [{ src: new URL(p.cover, location.href).href, sizes: '512x512' }]; } catch (e) { /* nada */ } }
  navigator.mediaSession.metadata = new MediaMetadata({ title: p.title, artist: p.artist || '', album: p.album || '', artwork });
}

// =====================================================================
//  Álbumes
// =====================================================================
function renderAlbums() {
  const cont = $('albums-grid');
  if (!cont) return;
  if (!S.albums.length) { cont.innerHTML = '<p class="empty-msg">Aún no hay álbumes aquí.</p>'; return; }
  cont.innerHTML = S.albums.map((alb, i) => `
    <div class="album-card ${i < 4 ? 'item-big' : ''}" role="button" tabindex="0" data-album="${i}">
      ${imgTag(alb.poster, alb.nombre)}
      <div class="album-tag">
        <span class="album-title">${esc(alb.nombre)}</span>
        <span class="album-artist">${esc(alb.artista)}</span>
        <span class="album-year">${esc(alb.year || '')}</span>
      </div>
    </div>`).join('');
}

function reproducirAlbum(i) {
  const alb = S.albums[i];
  if (!alb) return;
  const url = urlSegura(alb.audio);
  const idxEnLista = url ? S.playlist.findIndex(c => c.audio === url) : S.playlist.findIndex(c => norm(c.album) === norm(alb.nombre));
  if (idxEnLista > -1) { reproducir(idxEnLista); return; }   // así "siguiente" continúa desde esa pista
  if (url) {
    S.current = -1;
    cargarPista({ title: alb.nombre, artist: alb.artista, album: alb.nombre, cover: urlSegura(alb.poster), url });
    marcarFilaActiva(false);
  } else toast('Este álbum aún no tiene audio');
}

// =====================================================================
//  Bandas (paneles que se abren)
// =====================================================================
function cancionesDeBanda(nombre, b) {
  const nb = norm(nombre), idb = String(b.id == null ? '' : b.id);
  return S.playlist.filter(c =>
    (idb && c.id_banda != null && String(c.id_banda) === idb) ||
    (nb && (norm(c.banda) === nb || norm(c.artista) === nb || norm(c.artista).indexOf(nb) > -1)));
}

function renderBandas(bandas) {
  S.bands = bandas || [];
  const sec = $('bandas'), cont = $('panels-container');
  if (!sec || !cont) return;
  sec.hidden = S.bands.length === 0;
  cont.innerHTML = S.bands.map((b, i) => {
    const nombre = b.nombre || b.banda || b.Banda || b.name || '';
    const foto = urlSegura(b.poster || b.photo || b.foto || b.imagen || b.img);
    const fondo = foto ? `url('${cssUrl(foto)}')` : `linear-gradient(135deg, hsl(${(i * 67) % 360} 55% 32%), #111)`;
    const canciones = cancionesDeBanda(nombre, b).slice(0, 7);
    const detalle = b.genero || b.pais || b.year || (canciones.length ? '♪ ' + canciones.length + ' canciones' : '');
    return `
      <div class="panel" role="button" tabindex="0" data-band="${i}" style="background-image: ${esc(fondo)}">
        <p>${esc(nombre)}</p>
        <div class="centro">${canciones.map((c, k) => `<div class="box box${k + 1}" data-bsong="${c._i}">${esc(nombreCancion(c))}</div>`).join('')}</div>
        <p>${esc(detalle)}</p>
      </div>`;
  }).join('');
}

function togglePanel(panel) {
  const abierto = panel.classList.contains('open');
  document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open', 'open-active'));
  if (abierto) return;
  panel.classList.add('open');
  setTimeout(() => panel.classList.add('open-active'), 300);
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 350);
}

// =====================================================================
//  Personajes
// =====================================================================
function renderPersonajes(lista) {
  S.athletes = lista || [];
  const sec = $('deportes-section'), stage = $('sports-stage');
  if (!sec || !stage) return;
  sec.hidden = S.athletes.length === 0;
  const n = S.athletes.length;
  const ancho = Math.min(30, Math.max(16, 150 / Math.max(n, 1)));
  stage.innerHTML = '<div id="deportes-tooltip" class="sports-tooltip"></div>' + S.athletes.map((p, i) => {
    const left = n > 1 ? i * (100 - ancho) / (n - 1) : (100 - ancho) / 2;
    const nombre = p.Personaje || p.nombre || '';
    return `<img src="${esc(urlSegura(p.photo || p.poster) || PLACEHOLDER)}" alt="${esc(nombre)}" class="athlete-cutout" data-athlete="${i}" loading="lazy" decoding="async" style="left:${left.toFixed(1)}%;width:${ancho.toFixed(1)}%;z-index:${i + 1}">`;
  }).join('');
}

function mostrarTooltip(img) {
  const tip = $('deportes-tooltip');
  const p = S.athletes[+img.dataset.athlete];
  if (!tip || !p) return;
  const desc = p.deporte || p.Pais || '';
  tip.textContent = (p.Personaje || p.nombre || '') + (desc ? ` (${desc})` : '');
  const st = $('sports-stage').getBoundingClientRect(), r = img.getBoundingClientRect();
  const x = Math.min(Math.max(r.left - st.left + r.width / 2, 70), st.width - 70); // que no se salga de la pantalla
  tip.style.left = x + 'px';
  tip.style.top = Math.max(r.top - st.top, 30) + 'px';
  tip.classList.add('active');
}
function ocultarTooltip() {
  const tip = $('deportes-tooltip');
  if (tip) tip.classList.remove('active');
}
function alternarTooltip(img) {
  const tip = $('deportes-tooltip');
  if (tip && tip.classList.contains('active') && tip.dataset.para === img.dataset.athlete) { ocultarTooltip(); return; }
  mostrarTooltip(img);
  if (tip) tip.dataset.para = img.dataset.athlete;
  clearTimeout(alternarTooltip.t);
  alternarTooltip.t = setTimeout(ocultarTooltip, 3000); // en táctil no hay "salir con el mouse"
}

// =====================================================================
//  Eventos delegados (un solo oyente para todo: más rápido y sin onclick en línea)
// =====================================================================
document.addEventListener('click', e => {
  const t = e.target;
  let el;
  if ((el = t.closest('[data-bsong]'))) { reproducir(+el.dataset.bsong); return; }
  if ((el = t.closest('[data-band]'))) { togglePanel(el); return; }
  if ((el = t.closest('[data-media]'))) { const it = S.items[el.dataset.media][+el.dataset.i]; if (it) reproducirMedia(it); return; }
  if ((el = t.closest('[data-song]'))) { reproducir(+el.dataset.song); return; }
  if ((el = t.closest('[data-album]'))) { reproducirAlbum(+el.dataset.album); return; }
  if ((el = t.closest('[data-athlete]'))) { alternarTooltip(el); return; }
  if (!t.closest('.sports-stage')) ocultarTooltip();
  if (t.closest('#nav-links a')) cerrarMenuMovil();
  else if (!t.closest('.navbar')) cerrarMenuMovil();
});

document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-media],[data-band],[data-album]')) {
    e.preventDefault();
    e.target.click();
  }
});

if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
  document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-athlete]'); if (el) mostrarTooltip(el); });
  document.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('[data-athlete]')) ocultarTooltip(); });
}

// una imagen que no carga se cambia por el recuadro de relleno (una sola vez)
document.addEventListener('error', e => {
  const el = e.target;
  if (!el || el.tagName !== 'IMG' || el.dataset.fallido) return;
  el.dataset.fallido = '1';
  if (el.id === 'user-avatar' || el.id === 'audio-cover') { el.hidden = true; return; }
  el.src = PLACEHOLDER;
}, true);

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.error('Error en Service Worker:', err)));
}

