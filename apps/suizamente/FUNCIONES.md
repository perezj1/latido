# Suizamente independiente: decisiones de presentación y acceso

Estas decisiones actualizan la especificación de Suizamente por petición expresa.
No cambian las reglas, los precios ni los premios del juego.

- **Acceso explícito:** cada arranque presenta Crear cuenta gratis, Ya tengo cuenta,
  Entrar con Google y Entrar con cuenta de Latido, aunque haya una sesión guardada.
  No se puede jugar sin cuenta. La selección permanece durante la navegación de esa
  visita. El perfil y su botón «¡A jugar!» aparecen después de identificarse.
- **Identidad:** Latido aporta el nombre y la foto inicial, mediante lectura del
  perfil y el puente SSO existente. Un apodo o foto ya elegidos en Suizamente se
  conservan. Los cambios se guardan solo en el juego; no editan el perfil de Latido.
- **Foto:** botón de cámara accesible junto al avatar, selección de galería/cámara
  según el dispositivo, vista previa y guardado al confirmar el formulario. Recorte
  cuadrado de 512 px, JPEG sin metadatos; originales de hasta 10 MB, JPEG final de
  menos de 200 KB. Archivos únicos en `suizamente-avatars/{usuario}/`; permisos por
  propietario y URL en `ajustes.foto_url` del jugador. Si falla una imagen sigue
  disponible la inicial del apodo. Las fotos son públicas, como los avatares.
- **Apariencia:** siempre clara, incluso con ajustes antiguos o sistema oscuro.
  El selector de tema no se muestra. Sonidos, vibración y menos animaciones siguen
  siendo ajustables.
- **Barra inferior:** estilo de la píldora de Latido copiado en componentes propios:
  64 px, radio de 30 px, tres sombras, márgenes de 12 px y 10 px más área segura,
  máximo de 430 px; Inicio central de 54 px con aro de colores y logo de 30 px.
  Texto de 11 px con contraste AA, áreas táctiles de al menos 44 px, foco visible y
  sin transiciones con menos animaciones. Conserva rutas, globo y ocultación en las
  preguntas. El espacio transparente superior deja pasar los toques.
- **Publicación:** las ramas `suizamente` y `suizamente-social` publican esta app de
  `apps/suizamente`; no se fusionan con `main` ni requieren modificar Latido.
