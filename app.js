const API_URL = "https://script.google.com/macros/s/AKfycbzWHBQ1M6233yznvYwzTavI-rW21ceUswPtyrbF1EA1wlpU9VQUAyHE8bTXZ0rRANvm/exec";
const DEFAULT_VIDEO = "https://www.w3schools.com/html/mov_bbb.mp4";
async function cargarSpotiflix() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    const usuarioActual = (data.usuarios && data.usuarios.length > 0)
      ? (data.usuarios.find(u => u.correo && u.correo.trim().toLowerCase() === "ivanglopezp@gmail.com") || data.usuarios[0])
      : null;

    if (usuarioActual) {
      // Cargar foto de perfil en la navbar
      const avatarImg = document.getElementById("user-avatar");
      if (usuarioActual.foto_perfil && usuarioActual.foto_perfil.trim() !== "") {
        avatarImg.src = usuarioActual.foto_perfil;
        avatarImg.style.display = "block";
      }

      if (usuarioActual.nombre) {
        document.getElementById("user-name").textContent = `Perfil de ${usuarioActual.nombre}`;
        document.getElementById("nombreOnTop").innerHTML = `${usuarioActual.nombre}`;
      }
    }

    // 1. Películas
    if (usuarioActual && usuarioActual.peliculas_fav && data.cat_peliculas) {
      const peliIds = usuarioActual.peliculas_fav.toString().split(",");
      const pelisFavoritas = peliIds.map(id => {
        return data.cat_peliculas.find(p => p.id && p.id.toString().trim() === id.trim());
      }).filter(Boolean);
      renderCards("fav-movies", pelisFavoritas, false);
      if (pelisFavoritas.length > 0) reproducirElemento(pelisFavoritas[0], false);
    }

    // 2. Series
    if (usuarioActual && usuarioActual.series_fav && data.cat_series) {
      const serieIds = usuarioActual.series_fav.toString().split(",");
      const seriesFavoritas = serieIds.map(id => {
        return data.cat_series.find(s => s.id && s.id.toString().trim() === id.trim());
      }).filter(Boolean);
      renderCards("fav-series", seriesFavoritas, true);
    }

    // 3. Canciones
    if (usuarioActual && usuarioActual.canciones_fav && data.cat_canciones) {
      const cancionIds = usuarioActual.canciones_fav.toString().split(",");
      const cancionesFavoritas = cancionIds.map(id => {
        return data.cat_canciones.find(c => c.id && c.id.toString().trim() === id.trim());
      }).filter(Boolean);
      renderSongs(cancionesFavoritas);
    } else if (data.cat_canciones) {
      // Fallback: mostrar todo el catálogo de canciones si no hay filtro de favoritas
      renderSongs(data.cat_canciones);
    }
    // 3. Libros
    if (usuarioActual && usuarioActual.libros_fav && data.cat_libros) {
      const libroIds = usuarioActual.libros_fav.toString().split(",");
      const librosFavoritos = libroIds.map(id => {
        return data.cat_libros.find(l => l.id && l.id.toString().trim() === id.trim());
      }).filter(Boolean);    
      renderBooks("fav-books", librosFavoritos);
    } else if (data.cat_libros) {
      renderBooks("fav-books", data.cat_libros);
    }
    // 4. Bandas      
    if (usuarioActual && usuarioActual.bandas_fav && data.cat_bandas) {
      const bandasIds = usuarioActual.bandas_fav.toString().split(",").map(id => id.trim());
      const bandasFavoritas = bandasIds.map(id => {
        return data.cat_bandas.find(b => b.id && b.id.toString().trim() === id);
      }).filter(Boolean);
      renderBandas(bandasFavoritas, data.cat_canciones || []);
    } else if (data.cat_bandas) {
      renderBandas(data.cat_bandas, data.cat_canciones || []);
    }
    
    // 5. Deportes
   
    if (usuarioActual && usuarioActual.personajes_fav && data.cat_deportes) {
      const personajesIds = usuarioActual.personajes_fav.toString().split(",");
      const personajesFavoritos = personajesIds.map(id => {
        return data.cat_deportes.find(l => l.id && l.id.toString().trim() === id.trim());
      }).filter(Boolean);    
      renderDeportes("deportes-tooltip", personajesFavoritos);
    } else if (data.cat_deportes) {
      renderDeportes("deportes-tooltip", data.cat_deportes);
    }
    
    // 6. Albums
    if (usuarioActual && usuarioActual.albums && data.cat_albums) {
      // Obtener los 15 IDs separados por comas
      const idsAlbumsFav = usuarioActual.albums.toString().split(",").map(id => id.trim());
    
      // Filtrar los álbumes respetando el orden exacto especificado en la celda del usuario
      const albumsFavoritos = idsAlbumsFav.map(id => {
        return data.cat_albums.find(a => a.id && a.id.toString().trim() === id);
      }).filter(Boolean).slice(0, 15); // Garantiza un máximo de 15
    
      renderAlbums(albumsFavoritos);
    } else if (data.cat_albums) {
      renderAlbums(data.cat_albums.slice(0, 15));
    }

  } catch (error) {
    console.error("Error al cargar los datos:", error);
    document.getElementById("user-name").textContent = "";
  }
}
const nombreOnTop = document.getElementById("nombreOnTop");

// Lógica de reproducción de video
function reproducirElemento(item, autoPlay = true) {
  const videoPlayer = document.getElementById("main-video-player");
  const playingTitle = document.getElementById("playing-title");
  const playingInfo = document.getElementById("playing-info");

  const videoSrc = (item.video && item.video.trim() !== "") ? item.video : DEFAULT_VIDEO;

  videoPlayer.poster = item.poster || "";
  videoPlayer.src = videoSrc;
  playingTitle.textContent = item.nombre || "Sin título";

  const subtitulo = item.temporada 
    ? `Serie • ${item.temporada} Temporadas • ${item.genero || ""}`
    : `Película • ${item.genero || ""} • ${item.year || ""}`;

  playingInfo.textContent = `${subtitulo} ${item.resumen ? "— " + item.resumen : ""}`;

  if (autoPlay) videoPlayer.play().catch(() => {});
}

// Lógica para reproducir canción en la barra inferior
function reproducirCancion(cancion) {
  const audioPlayer = document.getElementById("main-audio-player");
  const titleElem = document.getElementById("audio-track-title");
  const artistElem = document.getElementById("audio-track-artist");

  titleElem.textContent = cancion.cancion || cancion.nombre || "Sin título";
  artistElem.textContent = cancion.artista || "Artista desconocido";

  if (cancion.audio) {
    audioPlayer.src = cancion.audio;
    audioPlayer.play().catch(err => console.log("Error al reproducir audio:", err));
  }
}

// Renderizado de la tabla de canciones
function renderSongs(canciones) {
  const tbody = document.getElementById("songs-list");
  tbody.innerHTML = "";

  if (!canciones || canciones.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">No hay canciones disponibles.</td></tr>`;
    return;
  }

  canciones.forEach(cancion => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="play-btn-cell">▶</td>
      <td><a href="#" class="song-link">${cancion.cancion || cancion.nombre}</a></td>
      <td>${cancion.artista || "-"}</td>
      <td>${cancion.album || "-"}</td>
    `;

    // Asignar clic tanto al botón play como al nombre de la canción
    tr.querySelector(".play-btn-cell").addEventListener("click", () => reproducirCancion(cancion));
    tr.querySelector(".song-link").addEventListener("click", (e) => {
      e.preventDefault();
      reproducirCancion(cancion);
    });

    tbody.appendChild(tr);
  });
}

function renderBooks(containerId, libros) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (!libros || libros.length === 0) {
    container.innerHTML = `<p style="color: #888;">No hay libros disponibles.</p>`;
    return;
  }

  libros.forEach(libro => {
    const card = document.createElement("article");
    card.className = "book-card";

    const linkPdf = libro.link || libro.pdf || "#";

    card.innerHTML = `
      <img src="${libro.poster}" alt="${libro.nombre}" loading="lazy">
      <a href="${linkPdf}" target="_blank" rel="noopener noreferrer" class="btn-read">Leer</a>
    `;

    container.appendChild(card);
  });
}

// Renderizado de carruseles
function renderCards(containerId, items, esSerie = false) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (!items || items.length === 0) {
    container.innerHTML = `<p style="color: #888;">No hay elementos seleccionados.</p>`;
    return;
  }

  items.forEach(item => {
    const subtitulo = esSerie 
      ? `${item.temporada} Temp. • ${item.genero}`
      : `${item.genero} • ${item.year}`;

    const card = document.createElement("article");
    card.className = "card";
    card.addEventListener("click", () => reproducirElemento(item, true));

    card.innerHTML = `
      <img src="${item.poster}" alt="${item.nombre}" loading="lazy">
      <h4>${item.nombre}</h4>
      <p>${subtitulo}</p>
    `;

    container.appendChild(card);
  });
}

function moverCarrusel(containerId, direccion) {
  const track = document.getElementById(containerId);
  if (!track) return;
  track.scrollBy({ left: direccion * 175 * 3, behavior: 'smooth' });
}

// Función aux para convertir cualquier link de Google Drive a Stream directo de audio
function fixDriveUrl(url) {
  if (!url) return "";
  const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}

function renderBandas(bandas, catálogoCanciones) {
  const container = document.getElementById("panels-container");
  if (!container) return;

  container.innerHTML = "";
  const cincoBandas = bandas.slice(0, 5);

  cincoBandas.forEach((banda, index) => {
    const panel = document.createElement("div");
    panel.className = `panel panel${index + 1}`;

    if (banda.photo && banda.photo.trim() !== "") {
      panel.style.backgroundImage = `url('${banda.photo.trim()}')`;
    }

    const palabras = (banda.nombre || 'Banda').split(" ");
    const textoTop = palabras[0] || "";
    const textoBottom = palabras.slice(1).join(" ") || banda.Pais || "";

    let htmlCanciones = "";
    for (let i = 1; i <= 7; i++) {
      const nombreCancion = banda[`cancion_${i}`];
      const idCancion = banda[`cancion_${i}_id`];

      if (nombreCancion && nombreCancion !== "#N/A") {
        const cancionObj = catálogoCanciones.find(c => c.id && c.id.toString().trim() === (idCancion || "").toString().trim());
        
        // Obtener la URL original de la BD y convertirla a stream directo
        const rawUrl = cancionObj ? (cancionObj.audio || "") : "";
        const audioUrl = fixDriveUrl(rawUrl);

        htmlCanciones += `
          <div class="box box${i}" data-src="${audioUrl}" data-title="${nombreCancion}">
            ${nombreCancion}
          </div>
        `;
      }
    }

    panel.innerHTML = `
      <p>${textoTop}</p>
      <div class="centro">
        ${htmlCanciones}
      </div>
      <p>${textoBottom}</p>
    `;

    container.appendChild(panel);
  });

  activarEventosPaneles();
}
function activarEventosPaneles() {
  const paneletes = document.querySelectorAll('.panel');
  const caja_colores = ['#ef1df3', '#5ae6e6', '#f99a0d', '#f9186b', '#42e25d', '#1db954'];

  paneletes.forEach(panel => {
    // Escuchar clic en el panel
    panel.onclick = function(e) {
      // Si el clic fue en una canción (.box), no abrir/cerrar el panel
      if (e.target.classList.contains('box')) return;

      // Alternar estado de apertura
      this.classList.toggle('open');
    };

    // Transición para desplegar texto superior e inferior
    panel.ontransitionend = function(e) {
      if (e.propertyName.includes('flex')) {
        this.classList.toggle('open-active');
      }
    };
  });

  // Evento individual para cada casilla de canción
  const cajas = document.querySelectorAll('.centro .box');
  cajas.forEach(caja => {
    caja.onclick = function(e) {
      e.stopPropagation(); // Evita que se colapse/expanda el panel

      // Cambiar color aleatorio de la variable CSS --color
      const colorAzar = caja_colores[Math.floor(Math.random() * caja_colores.length)];
      document.documentElement.style.setProperty('--color', colorAzar);

      const src = this.getAttribute('data-src');
      const title = this.getAttribute('data-title');
      const mainAudioPlayer = document.getElementById('main-audio-player');

      if (src && src.trim() !== "" && mainAudioPlayer) {
        mainAudioPlayer.src = src;
        mainAudioPlayer.currentTime = 0;
        
        // Intentar reproducir el audio
        mainAudioPlayer.play()
          .then(() => {
            const titleElem = document.getElementById('audio-track-title');
            if (titleElem) titleElem.textContent = title || "Canción Seleccionada";
          })
          .catch(err => console.error("Error al reproducir audio:", err));
      } else {
        alert("Esta canción no tiene una URL de audio válida asignada.");
      }
    };
  });
}

function renderDeportes(deportistas) {
  const stage = document.getElementById("sports-stage");
  const tooltip = document.getElementById("deportes-tooltip");
  if (!stage || !tooltip) return;

  // Limpiar recortes previos si existen
  stage.querySelectorAll('.athlete-cutout').forEach(el => el.remove());

  deportistas.forEach(deportista => {
    if (!deportista.photo) return;

    const imgdep = document.createElement("img");
    imgdep.src = deportista.photo.trim();
    imgdep.alt = deportista.nombre || "Deportista";
    imgdep.className = "athlete-cutout";

    // Aplicar posicionamiento desde la hoja de cálculo
    imgdep.style.bottom = deportista.pos_bottom || "0%";
    imgdep.style.left = deportista.pos_left || "50%";
    imgdep.style.height = deportista.height || "70%";
    imgdep.style.zIndex = deportista.z_index || "5";

    // HOVER: MOSTRAR Y MOVER TOOLTIP
    imgdep.addEventListener("mouseenter", () => {
      tooltip.textContent = deportista.nombre || "Atleta";
      tooltip.classList.add("active");
    });

    imgdep.addEventListener("mousemove", (e) => {
      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y - 10}px`;
    });

    imgdep.addEventListener("mouseleave", () => {
      tooltip.classList.remove("active");
    });

    // CLICK: ABRIR LINK (WIKIPEDIA / EXTERNO)
    imgdep.addEventListener("click", () => {
      const url = deportista.link || `https://es.wikipedia.org/wiki/${encodeURIComponent(deportista.nombre)}`;
      window.open(url, "_blank");
    });

    stage.appendChild(imgdep);
  });
}
function renderAlbums(albums) {
  const grid = document.getElementById("albums-grid");
  if (!grid) return;

  grid.innerHTML = "f";

  albums.forEach((album, index) => {
    if (!album.poster) return;

    const card = document.createElement("div");
    
    // Los primeros 4 álbumes (índices 0, 1, 2 y 3) reciben la clase 'item-big'
    const esTop4 = index < 4;
    card.className = `album-card ${esTop4 ? 'item-big' : ''}`;

    card.innerHTML = `
      <img src="${album.poster.trim()}" alt="${album.nombre || 'Álbum'}" >
      <div class="album-tag">
        <span class="album-title">${album.nombre || ''}</span>
        <span class="album-artist">${album.artista || ''}</span>
        <span class="album-year">${album.year || ''}</span>
      </div>
    `;

    // REPRODUCCIÓN DE AUDIO AL HACER CLIC
    card.addEventListener("click", () => {
      const mainAudioPlayer = document.getElementById("main-audio-player");
      const titleElem = document.getElementById("audio-track-title");

      if (album.audio && mainAudioPlayer) {
        mainAudioPlayer.src = album.audio.trim();
        mainAudioPlayer.currentTime = 0;
        mainAudioPlayer.play();

        if (titleElem) {
          titleElem.textContent = `${album.nombre} - ${album.artista}`;
        }
      }
    });

    grid.appendChild(card);
  });
}

cargarSpotiflix();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBanner.style.display = 'flex';
});

installBtn.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') installBanner.style.display = 'none';
    deferredPrompt = null;
  }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => {
                console.log('Service Worker registrado con éxito:', reg.scope);
            })
            .catch((err) => {
                console.error('Error al registrar Service Worker:', err);
            });
    });
}
