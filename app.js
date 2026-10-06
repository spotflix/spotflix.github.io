const API_URL = "https://script.google.com/macros/s/AKfycby-OLncoEAoMC8IvOAjriq_Il74ChyLJ0Hl6MXXUKrOfL1hw_q59aVbRf0b88d-B0V9/exec"; 

let deferredPrompt;
let playlist = [];
let currentIndex = -1;
let isShuffle = false;
let isRepeat = false;

document.addEventListener("DOMContentLoaded", () => {
  // Manejo menú hamburguesa
  const menuToggle = document.getElementById("menu-toggle");
  const navLinks = document.getElementById("nav-links");
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      navLinks.classList.toggle("active");
    });
  }

  // Eventos de fin de reproducción para continuar la lista en orden, aleatorio o repetir
  const audioElem = document.getElementById("main-audio-player");
  if (audioElem) {
    audioElem.addEventListener("ended", () => {
      if (isRepeat) {
        audioElem.play();
      } else {
        audioSiguiente();
      }
    });
  }

  // Instalación PWA
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'flex';
  });

  const installBtn = document.getElementById('install-pwa-btn');
  if (installBtn) {
    installBtn.addEventListener('click', () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
      }
    });
  }

  const userEmail = localStorage.getItem("spotflix_user_email");
  if (userEmail) {
    document.getElementById("login-screen").style.display = "none";
    cargarDatosUsuarioAsincronico(userEmail);
  }
});

function cerrarMenuMovil() {
  const navLinks = document.getElementById("nav-links");
  if (navLinks) navLinks.classList.remove("active");
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch (e) {
    return null;
  }
}

function handleCredentialResponse(response) {
  const data = parseJwt(response.credential);
  if (data && data.email) iniciarSesion(data.email);
}

function loginConEmailManual() {
  const emailInput = document.getElementById("email-input").value.trim();
  if (emailInput) iniciarSesion(emailInput);
  else alert("Ingresa un correo válido");
}

function iniciarSesion(email) {
  localStorage.setItem("spotflix_user_email", email);
  document.getElementById("login-screen").style.display = "none";
  cargarDatosUsuarioAsincronico(email);
}

function logout() {
  localStorage.removeItem("spotflix_user_email");
  location.reload();
}

/* CARGA ASINCRÓNICA PROGRESIVA PARA EVITAR BLOQUEOS Y TIEMPOS DE ESPERA LARGOS */
// Carga principal optimizada y asincrónica desde Apps Script
function cargarDatosUsuarioAsincronico(email) {
  fetch(`${API_URL}?email=${encodeURIComponent(email)}`)
    .then(res => res.json())
    .then(data => {
      // 1. Perfil del usuario
      if (data.usuario) {
        document.getElementById("user-name").innerText = `Perfil de ${data.usuario.nombre}`;
        document.getElementById("nombreOnTop").innerText = data.usuario.nombre.toUpperCase();
        if (data.usuario.foto_perfil) {
          const avatar = document.getElementById("user-avatar");
          avatar.src = data.usuario.foto_perfil;
          avatar.style.display = "block";
        }
      }

      // 2. Carga por bloques para agilizar el renderizado visual y evitar bloqueos
      setTimeout(() => {
        renderCarrusel('fav-movies', data.cat_peliculas, 'pelicula');
        renderCarrusel('fav-series', data.cat_series, 'serie');
        renderCarrusel('fav-animes', data.cat_animes, 'anime');
      }, 50);

      setTimeout(() => {
        if (data.cat_canciones) {
          playlist = data.cat_canciones.filter(c => c.audio);
          renderCanciones(playlist);
        }
        renderAlbums(data.cat_albums);
        renderBandas(data.cat_bandas, data.cat_canciones);
      }, 150);

      setTimeout(() => {
        renderCarrusel('fav-books', data.cat_libros, 'libro');
        renderPersonajes(data.cat_deportes);
      }, 250);
    })
    .catch(err => console.error("Error al cargar datos:", err));
}
function renderCarrusel(containerId, items, tipo) {
  const container = document.getElementById(containerId);
  if (!container || !items) return;

  container.innerHTML = items.map(item => {
    const poster = item.poster || item.photo || "https://via.placeholder.com/160x220";
    const titulo = item.nombre || item.Personaje || item.cancion || "";

    if (tipo === 'libro') {
      const link = item.link ? `<a href="${item.link}" target="_blank" class="btn-read">Leer</a>` : '';
      return `
        <div class="book-card">
          <img src="${poster}" alt="${titulo}" loading="lazy" />
          <h4>${titulo}</h4>
          ${link}
        </div>
      `;
    }

    return `
      <div class="card" onclick="reproducirMedia('${item.video || ''}', '${titulo}')">
        <img src="${poster}" alt="${titulo}" loading="lazy" />
        <h4>${titulo}</h4>
        <p>${item.genero || item.year || ''}</p>
      </div>
    `;
  }).join('');
}

function renderCanciones(canciones) {
  const tbody = document.getElementById("songs-list");
  if (!tbody || !canciones) return;

  tbody.innerHTML = canciones.map((c, index) => `
    <tr id="song-row-${index}">
      <td class="play-btn-cell" onclick="reproducirAudioPorIndice(${index})">▶</td>
      <td>${c.cancion || c.nombre || '-'}</td>
      <td>${c.artista || '-'}</td>
      <td>${c.album || '-'}</td>
    </tr>
  `).join('');
}

function reproducirAudioPorIndice(index) {
  if (index < 0 || index >= playlist.length) return;
  currentIndex = index;
  const c = playlist[currentIndex];
  
  // Actualizar estilos de la tabla activa
  document.querySelectorAll('.songs-table tr').forEach(tr => tr.classList.remove('playing-row'));
  const activeRow = document.getElementById(`song-row-${currentIndex}`);
  if (activeRow) activeRow.classList.add('playing-row');

  const audio = document.getElementById("main-audio-player");
  document.getElementById("audio-track-title").innerText = c.cancion || c.nombre;
  document.getElementById("audio-track-artist").innerText = c.artista || '-';

  audio.src = c.audio;
  audio.play();
}

function audioSiguiente() {
  if (playlist.length === 0) return;
  if (isShuffle) {
    currentIndex = Math.floor(Math.random() * playlist.length);
  } else {
    currentIndex = (currentIndex + 1) % playlist.length;
  }
  reproducirAudioPorIndice(currentIndex);
}

function audioAnterior() {
  if (playlist.length === 0) return;
  currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
  reproducirAudioPorIndice(currentIndex);
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  const btn = document.getElementById("btn-shuffle");
  if (btn) btn.classList.toggle("active-control", isShuffle);
}

function toggleRepeat() {
  isRepeat = !isRepeat;
  const btn = document.getElementById("btn-repeat");
  if (btn) btn.classList.toggle("active-control", isRepeat);
}

function renderAlbums(albums) {
  const container = document.getElementById("albums-grid");
  if (!container || !albums) return;

  container.innerHTML = albums.map((alb, i) => {
    const isBig = i < 4 ? 'item-big' : '';
    return `
      <div class="album-card ${isBig}" onclick="reproducirAudioDirecto('${alb.audio || ''}', '${alb.nombre}', '${alb.artista}')">
        <img src="${alb.poster || 'https://via.placeholder.com/180'}" alt="${alb.nombre}" loading="lazy" />
        <div class="album-tag">
          <span class="album-title">${alb.nombre}</span>
          <span class="album-artist">${alb.artista}</span>
          <span class="album-year">${alb.year || ''}</span>
        </div>
      </div>
    `;
  }).join('');
}

function reproducirAudioDirecto(url, titulo, artista) {
  if (!url) return;
  const audio = document.getElementById("main-audio-player");
  document.getElementById("audio-track-title").innerText = titulo;
  document.getElementById("audio-track-artist").innerText = artista || '-';
  audio.src = url;
  audio.play();
}

function renderPersonajes(personajes) {
  const stage = document.getElementById("sports-stage");
  if (!stage || !personajes) return;

  stage.innerHTML = `<div id="deportes-tooltip" class="sports-tooltip"></div>` + 
    personajes.map((p, idx) => {
      const img = p.photo || p.poster || '';
      const leftPos = (idx * 15) % 85; 
      return `
        <img src="${img}" 
             alt="${p.Personaje || p.nombre}" 
             class="athlete-cutout" 
             style="left: ${leftPos}%; bottom: 10%;"
             onmouseenter="mostrarTooltip('${p.Personaje || p.nombre}', '${p.deporte || p.Pais || ''}')"
             onmouseleave="ocultarTooltip()" />
      `;
    }).join('');
}

function mostrarTooltip(nombre, desc) {
  const tooltip = document.getElementById("deportes-tooltip");
  if (tooltip) {
    tooltip.innerText = `${nombre} (${desc})`;
    tooltip.classList.add("active");
  }
}

function ocultarTooltip() {
  const tooltip = document.getElementById("deportes-tooltip");
  if (tooltip) tooltip.classList.remove("active");
}

function reproducirMedia(url, titulo) {
  if (!url) return;
  const player = document.getElementById("main-video-player");
  const source = document.getElementById("video-source");
  const titleElem = document.getElementById("playing-title");

  source.src = url;
  player.load();
  player.play();
  if (titleElem) titleElem.innerText = titulo;
}

function moverCarrusel(id, direccion) {
  const elem = document.getElementById(id);
  if (elem) {
    elem.scrollBy({ left: direccion * 250, behavior: 'smooth' });
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(reg => console.log('Service Worker registrado:', reg))
    .catch(err => console.error('Error en Service Worker:', err));
}

if (tipo === 'serie') {
      // Codificamos y escapamos los episodios para pasarlos de forma segura al evento
      const episodiosData = JSON.stringify(item.episodios || []).replace(/"/g, '&quot;');
      return `
        <div class="card" onclick="abrirModalEpisodios('${titulo}', '${episodiosData}')">
          <img src="${poster}" alt="${titulo}" loading="lazy" />
          <h4>${titulo}</h4>
          <p>${item.genero || item.year || ''}</p>
        </div>
      `;
    }
