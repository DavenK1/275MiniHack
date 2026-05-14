# Verdant

Verdant is a front-end React idle/clicker game where you evolve an alien ocean ecosystem from a single cell on an animated HTML5 canvas.

## Scripts

- `npm run dev` - start local development server
- `npm run lint` - run ESLint
- `npm run build` - build production assets
- `npm run deploy` - deploy `dist` to GitHub Pages using `gh-pages` (optional local/manual deploy)

## Deployment

The repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that builds and deploys the site to GitHub Pages on every push to `main`.

The app uses `HashRouter` for GitHub Pages compatibility and stores progression in `localStorage`.
