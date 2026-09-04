# Munan.hub

Personal link-hub, portfolio and project showcase for **Abdullah All Munan** — built with plain HTML, CSS and JavaScript, hosted on GitHub Pages.

🔗 Live: [abamunan.github.io](https://abamunan.github.io/) *(update if you use a custom domain)*

---

## ✨ What's on the site

- **Hero / intro** — profile photo, typing-animation tagline
- **Quick Links** — About Me, My Toolbox, GitHub Profile, Files, Blog, WebComics, Get in Touch
- **My Projects** — browser-based tools built from scratch (TypeMaster, Money Tracker, Photo Resizer, Diary, PDF Toolkit), plus a **View All Projects** card linking to the full collection
- **Academic** — study notes viewer
- **Blog preview** — latest posts, pulled from `posts.js`
- **WebComics preview** — latest strips, pulled from `webcomic.js`
- **Dark / light theme toggle** — shared logic across all pages via `theme.js`

## 📁 File structure

```
├── index.html            # Homepage (hero, quick links, projects, academic, blog & comic previews)
├── projects.html         # Full "All Projects" listing (linked from index's "View All")
├── about.html            # About Me
├── tools.html             # My Toolbox
├── contact.html          # Get in Touch
├── part1.html             # Files
├── blog.html              # Full blog listing
├── webcomic.html          # Full webcomic listing
├── notes.html              # Study notes viewer (Academic section)
├── login.html / dashboard.html   # Auth pages
│
├── TypeMaster.html         # Typing speed/accuracy tracker
├── moneytracker.html       # Income/expense tracker
├── photo-resizer.html      # Batch photo resize & compress
├── diary.html               # Private diary with PDF export
├── pdf-toolkit.html         # Split / rotate / merge / unlock PDFs
├── booklet-maker.html       # Saddle-stitch PDF page imposition
│
├── style.css                # Shared site-wide styles
├── theme.js                  # Shared dark/light theme logic (blocking, runs before first paint)
├── footer.js                 # Shared footer
├── posts.js                  # Blog post data
├── webcomic.js                # Webcomic strip data
│
├── icon.png                   # Favicon
├── Image.jpeg                  # Profile photo
│
├── sitemap.xml                 # Search-engine sitemap
└── robots.txt                   # Crawler rules
```

> Some file names above (e.g. `posts.js`, `webcomic.js`, individual project pages) are referenced by `index.html`/`projects.html` but maintained separately — make sure they're present in the repo root alongside these files.

## 🚀 Deploying (GitHub Pages)

1. Push all files to the repo's default branch (root, not a subfolder).
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`, pick the branch and `/ (root)`.
4. Save — your site will be live at `https://<username>.github.io/<repo>/` (or `https://<username>.github.io/` if the repo is named `<username>.github.io`).
5. If you use a **custom domain**, update the URLs in `index.html`, `projects.html`, `sitemap.xml` (currently set to `https://abamunan.github.io/`) to match.

## ➕ Adding a new project

1. Build the tool as a standalone `.html` file and add it to the repo root.
2. Add a card to `projects.html`'s `.projects-grid` (copy an existing `.project-card` block) and, if it should also appear on the homepage, to `index.html` too.
3. If the page should be indexed by search engines, add it to `sitemap.xml`.

## 🔍 SEO

- Unique `<title>`, meta description, canonical URL, Open Graph & Twitter Card tags on `index.html` / `projects.html`
- `Person` / `CollectionPage` structured data (JSON-LD)
- Semantic heading hierarchy (h1 → h2 → h3, via `role="heading"` where the visual markup uses non-heading tags)
- `sitemap.xml` + `robots.txt` for crawlers

## 🛠 Tech

No build step, no framework — plain HTML/CSS/JS. Fonts via Google Fonts, icons via Font Awesome (CDN).
