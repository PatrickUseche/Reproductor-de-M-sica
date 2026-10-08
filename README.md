# Reproductor de Música

Aplicación de React y TypeScript que administra una lista doblemente enlazada, reproduce archivos de audio y permite buscar videos musicales en YouTube.

## Requisitos

- Node.js y npm.
- Una clave de Google Cloud con **YouTube Data API v3** habilitada para usar la búsqueda.

## Instalación y configuración

1. Instala las dependencias:

   ```powershell
   npm install
   ```

2. En [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto, habilita **YouTube Data API v3** y crea una API key.
3. Restringe la clave en Google Cloud:
   - Restricción de API: permite únicamente YouTube Data API v3.
   - Restricción de sitio web (HTTP referrers): autoriza el origen que uses, por ejemplo `http://localhost:5173/*` y `http://127.0.0.1:5173/*`.
4. Crea `.env.local` desde la plantilla:

   ```powershell
   Copy-Item .env.example .env.local
   ```

5. Edita `.env.local` y pega tu clave sin comillas:

   ```env
   VITE_YOUTUBE_API_KEY=tu_clave_de_google_cloud
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-publica-anon
   ```

6. En Supabase, ejecuta el contenido de `supabase/schema.sql` desde el SQL Editor una sola vez.
7. Para habilitar la sincronización en vivo, ejecuta `supabase/realtime.sql` desde el SQL Editor una sola vez. No vuelvas a ejecutar `schema.sql` si ya configuraste la tabla y las políticas.
8. Configura la URL desplegada en **Authentication → URL Configuration** como Site URL y URL permitida de redirección.
9. Para el acceso de un clic, habilita Google en **Authentication → Sign In / Providers** de Supabase con las credenciales OAuth de Google. Añade a Google la URL callback que muestra Supabase y permite el dominio desplegado en la configuración de URLs. El formulario de correo y contraseña permanece disponible como alternativa.
10. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` también en las variables de entorno del servicio donde está desplegada la aplicación. Vuelve a compilar y desplegar después de añadirlas.
11. Inicia el servidor:

   ```powershell
   npm run dev
   ```

Vite carga las variables al iniciar. Si modificas `.env.local`, detén y vuelve a iniciar `npm run dev`.

## Uso

- **Tema y cuenta:** la aplicación abre por defecto en modo oscuro con tonos carbón y dorados. Abre el menú desde el perfil para cambiar de tema, revisar el estado de sincronización o cerrar sesión; también se abre al pasar el cursor por el perfil. La preferencia de tema se guarda en el navegador.
- **Audio local:** usa el botón **Añadir canción local** junto al perfil o arrastra archivos sobre él. Se agregan al final sin iniciar la reproducción; el título se toma del nombre del archivo. Se muestra el avance de importación y los errores por archivo. El audio y sus metadatos se guardan en IndexedDB para restaurarlos al volver a abrir la aplicación en el mismo navegador y con la misma cuenta.
- **Controles de audio:** usa el deslizador de posición en audio local y videos de YouTube; el volumen se despliega al pasar el cursor sobre el icono de altavoz y un clic en el icono silencia o restaura el sonido. El volumen se recuerda en este navegador, pero el progreso no: cada pista comienza desde el principio al seleccionarla. Los videos de YouTube también conservan sus controles oficiales; puedes ocultar el video y el audio seguirá reproduciéndose. La preferencia visual se recuerda en el navegador.
- **Atajos del reproductor:** Espacio reproduce o pausa, ← selecciona la pista anterior y → la siguiente. Los atajos no se activan mientras escribes o usas un control interactivo.
- **Repetición:** elige entre desactivada, repetir la playlist o repetir la canción actual. En el modo playlist, al terminar la última pista se vuelve a la primera.
- **Aleatorio:** activa la reproducción aleatoria para recorrer las pistas sin cambiar el orden visible ni el orden guardado de la playlist.
- **Búsqueda de YouTube:** escribe al menos tres caracteres; la búsqueda espera un segundo después de que dejes de escribir y reutiliza resultados recientes en memoria durante 30 minutos para reducir solicitudes. Haz clic en la miniatura o el título para añadir el video y reproducirlo; **Añadir a la lista** lo incorpora sin cambiar la pista seleccionada.
- **Lista:** busca por título o artista y selecciona una tarjeta para hacerla la pista actual; **Anterior** y **Siguiente** navegan por la lista completa. Si YouTube informa que un video no se puede reproducir, el reproductor intenta omitirlo y continuar con la siguiente canción.
- **Cuenta:** crea una cuenta o inicia sesión para cargar y guardar la playlist personal en Supabase. El orden y la canción seleccionada se restauran al volver a iniciar sesión y los cambios se sincronizan en vivo entre sesiones abiertas.
- Los archivos arrastrados se guardan solo en IndexedDB del navegador actual: no se suben a Supabase ni están disponibles en otros dispositivos o navegadores. Al restaurar la aplicación, se añaden después de las pistas sincronizadas con Supabase. Borrar los datos del sitio o del navegador puede eliminarlos.
- Los controles de YouTube son los que proporciona el propio reproductor. No todos los videos permiten reproducción incrustada; también pueden aplicar restricciones regionales, de edad o del propietario. Cuando YouTube notifica un error de reproducción, la aplicación muestra la causa y trata de avanzar a la siguiente canción.

## Estructura del código

| Ruta | Responsabilidad |
| --- | --- |
| `src/main.tsx` | Punto de entrada de React y montaje de la aplicación. |
| `src/App.tsx` | Conecta la playlist, el reproductor, los formularios y la búsqueda. |
| `src/types/Song.ts` | Modelo de canción; distingue audio normal de videos de YouTube. |
| `src/core/TrackNode.ts` | Nodo con enlaces anterior/siguiente para la lista doblemente enlazada. |
| `src/core/SongPlaylist.ts` | Operaciones de inserción, eliminación y navegación de la lista. |
| `src/components/PlayerControls.tsx` | Reproducción de audio directo y reproductor de YouTube con avance al finalizar. |
| `src/components/SongForm.tsx` | Formulario para agregar o eliminar canciones manualmente. |
| `src/components/PlaylistView.tsx` | Vista visual de nodos, cabeza, cola y selección actual. |
| `src/components/YouTubeSearch.tsx` | Formulario de búsqueda, resultados y acciones para añadir canciones. |
| `src/services/youtube.ts` | Solicitud a YouTube Data API v3 y manejo de respuesta. |
| `src/services/supabase.ts` | Configuración del cliente Supabase desde variables de entorno. |
| `src/services/playlistPersistence.ts` | Conversión y persistencia remota de playlists. |
| `src/services/localAudioPersistence.ts` | Almacenamiento de audio local por cuenta en IndexedDB. |
| `src/services/youtubeIframeApi.ts` | Carga de la API oficial de YouTube IFrame Player. |
| `supabase/schema.sql` | Tabla de playlists y políticas RLS por usuario. |
| `supabase/realtime.sql` | Habilita notificaciones en vivo para la tabla de playlists. |
| `src/index.css` | Estilos globales. |

## Comandos

```powershell
npm run dev      # Servidor local de desarrollo
npm run build    # Verificación TypeScript y compilación de producción
npm run lint     # Revisión estática con ESLint
npm run preview  # Vista previa del build
```

## Seguridad de API keys

- No pegues una clave real en `.env.example`, el código fuente, README, capturas o commits.
- `.env.local` y otros archivos `.env.*` están excluidos por `.gitignore`; `.env.example` solo contiene un marcador de posición.
- Las variables que comienzan por `VITE_` se incluyen en el código entregado al navegador. La API key **no es secreta**, aunque se lea desde `.env.local`; las restricciones de Google Cloud reducen el uso no autorizado, pero no la ocultan.
- Para una aplicación pública, sirve las búsquedas desde un backend controlado por ti y protege la clave allí. Si una clave se filtra, revócala en Google Cloud y crea otra.

## Diagnóstico

- **Falta `VITE_YOUTUBE_API_KEY`:** comprueba que `.env.local` esté junto a `package.json`, que el nombre de la variable sea exacto y reinicia Vite.
- **`API key not valid` o `accessNotConfigured`:** revisa que la clave sea del proyecto que tiene YouTube Data API v3 habilitada.
- **`RefererNotAllowedMapError` o error de referrer:** permite exactamente el origen que aparece en la barra del navegador y conserva `/*` al final de la regla.
- **`quotaExceeded`:** se agotó la cuota del proyecto; revisa la cuota de YouTube Data API en Google Cloud.
- **El video no se puede reproducir:** prueba otro resultado; la inserción puede estar deshabilitada por el propietario o el video tener restricciones.
