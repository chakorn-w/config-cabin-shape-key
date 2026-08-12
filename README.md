# Cabin Configurator

A Vite and Three.js cabin configurator driven by Blender Shape Keys and relational object transforms.

## Local development

Requires Node.js 20.19+ or 22.12+.

```bash
npm ci
npm run dev
```

## Verification

```bash
npm test
npm run build
npm run preview
```

The production output is written to `dist/`. Deploy the contents of that directory to a static host. Asset paths use Vite's deployment base, so root and configured subpath deployments are supported.

## Search-engine exclusion

The site includes `noindex` metadata, a restrictive `robots.txt`, and a static-host `_headers` file with `X-Robots-Tag`. The `_headers` convention is supported by hosts such as Netlify and Cloudflare Pages; configure the same header manually on other hosts.

Search-engine exclusion is not access control. Use authentication or deployment-level access restrictions if the configurator must remain private.
