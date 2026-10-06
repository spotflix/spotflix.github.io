// REEMPLAZA CON LA URL DE TU WEB APP DE GOOGLE APPS SCRIPT
const API_URL = "https://script.google.com/macros/s/AKfycbw_jjfqWdYmN_YjHwtlbldJyWtdjMCynvQaPtFaop3vNQAU9EjaoEhcJAchmyCrzgLC/exec"; 

let deferredPrompt;

document.addEventListener("DOMContentLoaded", () => {
  // Manejo de Instalación de PWA
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
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('PWA instalada');
          }
          deferredPrompt = null;
        });
      }
    });
  }

  // Verificar si hay una sesión guardada
  const userEmail = localStorage.getItem("spotflix_user_email");
  if (userEmail) {
    document.getElementById("login-screen").style.display = "none";
    cargarDatosUsuario(userEmail);
  }
});

// Decodificar el token JWT que devuelve Google Sign-In
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch (e) {
    return null;
  }
}

// Callback de Google Identity Services
function handleCredentialResponse(response) {
  const data = parseJwt(response.credential);
  if (data && data.email) {
    iniciarSesion(data.email);
  }
}

function loginConEmailManual() {
  const emailInput = document.getElementById("email-input").value.trim();
  if (emailInput) {
    iniciarSesion(emailInput);
  } else {
    alert("Ingresa un correo válido");
  }
}

function iniciarSesion(email) {
  localStorage.setItem("spotflix_user_email", email);
  document.getElementById("login-screen").style.display = "none";
  cargarDatosUsuario(email);
}

function logout() {
  localStorage.removeItem("spotflix_user_email");
  location.reload();
}

// Carga principal de datos desde Apps Script
function cargarDatosUsuario(email) {
  fetch(`${API_URL}?email=${encodeURIComponent(email)}`)
    .then(res => res.json())
    .then(data => {
      // 1. Perfil
      if (data.usuario) {
        document.getElementById("user-name").innerText = `Perfil de ${data.usuario.nombre}`;
        document.getElementById("nombreOnTop").innerText = data.usuario.nombre.toUpperCase();
        if (data.usuario.foto_perfil) {
          const avatar = document.getElementById("user-avatar");
          avatar.src = data.usuario.foto_perfil;
          avatar.style.display = "block";
        }
      }

      // 2. Películas
      renderCarrusel('fav-movies', data.cat_peliculas, 'pelicula');

      // 3. Series
      renderCarrusel('fav-series', data.cat_series, 'serie');

      renderCarrusel('fav-animes', data.cat_animes, 'anime');

      // 4. Canciones
      renderCanciones(data.cat_canciones);

      renderBandas(data.cat_bandas, data.cat_canciones);

      // 5. Álbumes
      renderAlbums(data.cat_albums);

      // 6. Libros
      renderCarrusel('fav-books', data.cat_libros, 'libro');

      // 7. Personajes
      renderPersonajes(data.cat_deportes);
    })
    .catch(err => console.error("Error al cargar datos:", err));
}

// Renderizado de carruseles (Películas, Series, Animes, Libros)
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
          <img src="${poster}" alt="${titulo}" />
          <h4>${titulo}</h4>
          ${link}
        </div>
      `;
    }

    return `
      <div class="card" onclick="reproducirMedia('${item.video || ''}', '${titulo}')">
        <img src="${poster}" alt="${titulo}" />
        <h4>${titulo}</h4>
        <p>${item.genero || item.year || ''}</p>
      </div>
    `;
  }).join('');
}

// Renderizado de canciones
function renderCanciones(canciones) {
  const tbody = document.getElementById("songs-list");
  if (!tbody || !canciones) return;

  tbody.innerHTML = canciones.map(c => `
    <tr>
      <td class="play-btn-cell" onclick="reproducirAudio('${c.audio || ''}', '${c.cancion || c.nombre}', '${c.artista || ''}')">▶</td>
      <td>${c.cancion || c.nombre || '-'}</td>
      <td>${c.artista || '-'}</td>
      <td>${c.album || '-'}</td>
    </tr>
  `).join('');
}

function renderBandas(bandas, canciones) {
  const container = document.getElementById("panels-container");
  const section = document.getElementById("bandas");
  if (!container || !bandas || bandas.length === 0) return;

  // Mostrar la sección si tiene bandas
  if (section) section.style.display = "block";

  // Mapear cada banda a un panel vertical
  container.innerHTML = bandas.map(b => {
    // Buscar las canciones pertenecientes a esta banda o coincidencia por IDs
    const listaCancionesBanda = [
      { id: b['cancion_1_id'] || b.sng_1, nombre: b.cancion_1 || 'Canción 1' },
      { id: b['cancion_2_id'] || b.sng_2, nombre: b['cancion_2'] || 'Canción 2' },
      { id: b['cancion_3_id'] || b.sng_3, nombre: b['cancion_3'] || 'Canción 3' },
      { id: b['cancion_4_id'] || b.sng_4, nombre: b['cancion_4'] || 'Canción 4' },
      { id: b['cancion_5_id'] || b.sng_5, nombre: b['cancion_5'] || 'Canción 5' },
      { id: b['cancion_6_id'] || b.sng_6, nombre: b['cancion_6'] || 'Canción 6' }
    ].filter(item => item.nombre && item.nombre !== '#N/A');

    const centroHTML = listaCancionesBanda.map((item, idx) => {
      // Buscar la URL del audio en el catálogo global de canciones si coincide el nombre o id
      const cancionObj = canciones ? canciones.find(c => (c.id === item.id || c.cancion === item.nombre)) : null;
      const audioUrl = cancionObj ? cancionObj.audio : '';

      return `
        <div class="box box${idx + 1}" 
             onclick="event.stopPropagation(); reproducirAudio('${audioUrl}', '${item.nombre}', '${b.nombre}')">
          ${item.nombre}
        </div>
      `;
    }).join('');

    const bgPhoto = b.photo || b.poster || 'https://via.placeholder.com/600x800';

    return `
      <div class="panel" style="background-image: url('${bgPhoto}');">
        <p>${b.nombre}</p>
        <div class="centro">
          ${centroHTML}
        </div>
        <p>${b.Pais || b.pais || ''}</p>
      </div>
    `;
  }).join('');

  // Activar la interactividad de flex grow al hacer click
  initPanelsEvents();
}

// Eventos de apertura/cierre de los paneles
function initPanelsEvents() {
  const panels = document.querySelectorAll('.panel');

  function toggleOpen() {
    // Si ya está abierto, se cierra; si no, cierra los demás y abre este
    const isOpen = this.classList.contains('open');
    panels.forEach(panel => panel.classList.remove('open'));
    if (!isOpen) {
      this.classList.add('open');
    }
  }

  function toggleActive(e) {
    if (e.propertyName.includes('flex')) {
      this.classList.toggle('open-active', this.classList.contains('open'));
    }
  }

  panels.forEach(panel => {
    panel.addEventListener('click', toggleOpen);
    panel.addEventListener('transitionend', toggleActive);
  });
}

// Renderizado de Álbumes
function renderAlbums(albums) {
  const container = document.getElementById("albums-grid");
  if (!container || !albums) return;

  container.innerHTML = albums.map((alb, i) => {
    const isBig = i < 4 ? 'item-big' : '';
    return `
      <div class="album-card ${isBig}" onclick="reproducirAudio('${alb.audio || ''}', '${alb.nombre}', '${alb.artista}')">
        <img src="${alb.poster || 'https://via.placeholder.com/180'}" alt="${alb.nombre}" />
        <div class="album-tag">
          <span class="album-title">${alb.nombre}</span>
          <span class="album-artist">${alb.artista}</span>
          <span class="album-year">${alb.year || ''}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Renderizado de Personajes
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
             style="left: ${leftPos}%; bottom: 10%; height: 220px;"
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

function reproducirAudio(url, titulo, artista) {
  if (!url) return;
  const audio = document.getElementById("main-audio-player");
  document.getElementById("audio-track-title").innerText = titulo;
  document.getElementById("audio-track-artist").innerText = artista || '-';

  audio.src = url;
  audio.play();
}

function moverCarrusel(id, direccion) {
  const elem = document.getElementById(id);
  if (elem) {
    elem.scrollBy({ left: direccion * 300, behavior: 'smooth' });
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(reg => console.log('Service Worker registrado:', reg))
    .catch(err => console.error('Error en Service Worker:', err));
}
