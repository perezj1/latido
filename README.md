# 🌎 LatinoSuiza.ch — Plataforma integral para latinos en Suiza

PWA + Web con landing page, tablón de anuncios con privacidad configurable, comunidades, trámites, directorio de eventos y más. React + Supabase + Vercel.

---

## ⚡ Arrancar en 4 pasos

### 1. Instalar y abrir en VS Code

```bash
cd latinosuiza2
npm install
code .            # abre VS Code
npm run dev       # → http://localhost:8080
```

### 2. Crear proyecto en Supabase (gratis)

1. Ve a [supabase.com](https://supabase.com) → **New Project** → Región: **West EU (Frankfurt)**
2. Espera ~2 min
3. **SQL Editor → New Query** → pega el contenido de `supabase/schema.sql` → **RUN**
4. **Settings → API** → copia:
   - `Project URL`
   - `anon public key`

### 3. Crear `.env.local` en la raíz

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

> Sin Supabase la app funciona con datos mock. Conectarla activa persistencia real.

### 4. Deploy en Vercel

```bash
# Sube a GitHub
git init
git add .
git commit -m "🌎 LatinoSuiza v1"
git remote add origin https://github.com/TU-USUARIO/latinosuiza.git
git push -u origin main
```

En [vercel.com](https://vercel.com):
1. **New Project → Import** tu repo
2. **Environment Variables** → añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
3. **Deploy** → URL pública en ~60 segundos

---

## 🏗️ Arquitectura — Dual Landing / PWA

```
/                ← Si no está instalada como PWA → muestra Landing page (web)
/                ← Si está instalada como PWA → muestra Home app
/tablon          ← Tablón de anuncios con filtros
/publicar        ← Formulario de publicación (requiere cuenta)
/comunidades     ← Grupos de latinos en Suiza
/documentos      ← Guías de trámites suizos
/familias        ← Cuidadoras, grupos de mamás, recursos
/foro            ← Preguntas y respuestas
/empleos         ← Ofertas de trabajo
/directorio      ← Proveedores de eventos
/perfil          ← Perfil de usuario
/auth            ← Login / Registro (2 pasos)
```

### Detección PWA

El hook `usePWA.js` detecta si la app está instalada usando `display-mode: standalone` o el parámetro `?pwa=1` en la URL de inicio. Si está instalada, salta directamente al Home. Si no, muestra la Landing.

---

## 🔒 Sistema de privacidad en anuncios

| Tipo | Visible para | Contacto visible para |
|------|-------------|----------------------|
| 🌐 Público | Todo el mundo | Todo el mundo |
| 🔒 Privado | Todo el mundo | Solo usuarios con cuenta |

En la BD: campo `privacy = 'public' | 'private'`
En el frontend: si el anuncio es privado y el usuario no está autenticado, se oculta el contacto con un CTA de registro.
La tabla `contact_reveals` registra qué usuarios han desbloqueado qué anuncios (para analytics y control).

---

## 📁 Estructura del proyecto

```
src/
├── components/
│   ├── Header.jsx       ← Nav desktop + hamburger mobile
│   ├── BottomNav.jsx    ← Nav inferior PWA (5 tabs + FAB)
│   ├── Footer.jsx       ← Footer completo
│   └── UI.jsx           ← Librería: Btn, Card, Tag, Avatar, Modal, Sheet,
│                           Input, Select, ProgressBar, PillFilters,
│                           SegmentedTabs, InfoBanner, EmptyState, AdCard, PrivacyTag
├── hooks/
│   ├── useAuth.jsx      ← Contexto de autenticación Supabase
│   └── usePWA.js        ← Detección PWA + prompt de instalación
├── lib/
│   ├── supabase.js      ← Cliente Supabase
│   ├── constants.js     ← Datos mock + categorías + cantones
│   └── theme.js         ← Tokens de diseño (colores, fuente)
├── pages/
│   ├── Landing.jsx      ← Landing page pública (web, no PWA)
│   ├── Home.jsx         ← Home app (PWA)
│   ├── Tablon.jsx       ← Tablón con filtros canton/PLZ/privacidad
│   ├── Publicar.jsx     ← Formulario 4 pasos + selector privacidad
│   ├── Auth.jsx         ← Login + registro 2 pasos
│   ├── Comunidades.jsx
│   ├── Documentos.jsx
│   ├── Familias.jsx
│   ├── Foro.jsx
│   ├── Empleos.jsx
│   ├── Directorio.jsx   ← Con modal de registro de proveedores
│   └── Perfil.jsx
├── App.jsx              ← Router dual: Landing vs AppShell
└── main.jsx
public/
├── manifest.json        ← Config PWA
├── sw.js                ← Service worker (offline + cache)
└── favicon.svg
supabase/
└── schema.sql           ← 7 tablas + RLS + trigger auto-profile
```

---

## 💰 Modelo de monetización

### Fase 1 — Gratis (meses 1–4)
Todo gratis. Objetivo: 500+ usuarios, 200+ anuncios activos.

### Fase 2 — Anuncios destacados (CHF vía TWINT)
| Producto | Precio | Descripción |
|---------|--------|-------------|
| Anuncio destacado | CHF 5 | Tu anuncio aparece primero 7 días |
| Proveedor básico | CHF 29/mes | Badge verificado, posición media |
| Proveedor premium | CHF 59/mes | Primero en búsquedas, badge dorado |

### Fase 3 — Publicidad
Marcas latinas, fintechs (Wise, Remitly): CHF 200–500/mes por banner.

---

## 🛠️ Gestión con Supabase

```sql
-- Ver anuncios pendientes/activos
SELECT id, title, cat, privacy, canton, created_at FROM ads ORDER BY created_at DESC LIMIT 20;

-- Aprobar proveedor
UPDATE providers SET active=TRUE, verified=TRUE WHERE id='UUID-AQUI';

-- Destacar proveedor (plan premium)
UPDATE providers SET featured=TRUE WHERE id='UUID-AQUI';

-- Ver usuarios registrados hoy
SELECT id, name, email, canton, created_at FROM profiles ORDER BY created_at DESC;

-- Ver revelaciones de contacto (analytics)
SELECT ad_id, COUNT(*) as reveals FROM contact_reveals GROUP BY ad_id ORDER BY reveals DESC;
```

---

## 📱 Instalar como PWA

- **iPhone (Safari):** Compartir → "Añadir a pantalla de inicio"
- **Android (Chrome):** Menú → "Instalar app" (aparece banner automático)
- **PC Chrome/Edge:** Icono de instalación en la barra de dirección

Al instalar, el `manifest.json` configura `start_url: "/?pwa=1"` para que la app detecte el modo instalado y muestre el Home en vez de la Landing.

---

## ⚙️ Comandos

```bash
npm run dev      # Servidor local en localhost:8080
npm run build    # Build optimizado para producción
npm run preview  # Preview del build
```

## 🔧 Stack

| Capa | Tech |
|------|------|
| Framework | React 18 + Vite |
| Estilos | Tailwind CSS + inline styles |
| Fuente | Poppins (Google Fonts) |
| Auth | Supabase Auth |
| Base de datos | Supabase (PostgreSQL + RLS) |
| PWA | Service Worker + Web App Manifest |
| Deploy | Vercel |
| Pagos (futuro) | TWINT + Stripe |

---

*Hecho con 💙 para la comunidad latina en Suiza · LatinoSuiza.ch*
