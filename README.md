# Mail Merge

Aplicación de mail merge que corre íntegramente en el navegador (Vite + React + TypeScript),
integrada con Google y publicada en GitHub Pages.

## Desarrollo

Requiere Node 22.

```sh
cp .env.example .env.local   # completar con los valores del proyecto de Google Cloud
npm install
npm run dev                  # http://localhost:5173
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Chequeo de tipos y build de producción en `dist/` |
| `npm run lint` | Oxlint |
| `npm run preview` | Sirve `dist/` localmente |

## Deploy en GitHub Pages

El workflow `.github/workflows/deploy.yml` construye y publica la app en cada push a `main`.

Configuración inicial (una sola vez):

1. **Settings → Pages → Source:** GitHub Actions.
2. **Settings → Secrets and variables → Actions → Variables:** crear `VITE_GOOGLE_CLIENT_ID`,
   `VITE_GOOGLE_API_KEY` y `VITE_GOOGLE_APP_ID`. Son valores públicos, por eso van como
   *Variables* y no como *Secrets*.
3. En Google Cloud:
   - **OAuth Client ID → Authorized JavaScript origins:** agregar `https://<usuario>.github.io`
     (solo el origen, sin la ruta del repositorio).
   - **API key → Website restrictions:** agregar `https://<usuario>.github.io/<repo>/*` y
     `https://docs.google.com/*` (requerido por el Picker).
