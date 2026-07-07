# Coastal Valet — Website

Static marketing site for Coastal Valet (valet parking, Rehoboth Beach, DE). No build step, no dependencies.

## Preview locally

Open `index.html` directly in a browser, or serve the folder so relative links behave the same as on a real host:

```
cd site/coastal-valet
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Placeholders to replace before publishing

Search for `placeholder` and the sample contact info to find everything that needs a real value:

- Phone: `(302) 555-0100` (in `index.html`, `services.html`, `about.html`, `contact.html`, footers on all pages)
- Email: temporarily set to `dannydewing@icloud.com` (Danny's personal email) so the site is usable now — swap for a real Coastal Valet business email before publishing
- Address: `Rehoboth Beach, DE 19971` (same files)
- Hours table in `contact.html`
- Service area list in `index.html` (`Rehoboth Beach`, `Dewey Beach`, `Lewes`, `Bethany Beach`, `Milton & Nearby`) — adjust to match where Coastal Valet actually operates
- No pricing, client names, or testimonials were included since none were provided — add real ones if/when available rather than inventing them

## Deploying for free

Any static host works since there's no build step:

- **GitHub Pages**: push this repo, enable Pages, and point it at the `site/coastal-valet` folder (or copy the folder to its own repo).
- **Cloudflare Pages / Netlify / Vercel**: create a new project from this repo, set the root/publish directory to `site/coastal-valet`, and leave the build command empty.

## Structure

```
index.html      Home
services.html   Service details (restaurant/hospitality, events/weddings, residential/HOA)
about.html      About / trust signals
contact.html    Contact details, hours, request-service CTA
css/styles.css  Shared styles
js/main.js      Mobile nav toggle + footer year
assets/         favicon
```
