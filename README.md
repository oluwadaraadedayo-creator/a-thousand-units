# A Thousand Units MVP

## Why opening `index.html` directly shows a white page
This is a React + TypeScript + Vite project. The files in `src/` are source code, not browser-ready JavaScript. Chrome cannot execute the TSX entry point from a `file://` URL. The index page now explains this instead of appearing blank.

## Run locally on Windows
1. Install Node.js (LTS) if it is not already installed.
2. Extract this ZIP using **Extract All**.
3. Open the extracted `a-thousand-units` folder.
4. Double-click `start-local.bat`. It installs dependencies if needed, downloads the album covers and demo images, then starts the website.
5. Open the local URL Vite prints, usually `http://localhost:5173/`. Keep the Command Prompt window open while using the site.

You can also run the steps manually from a Command Prompt opened inside this folder:

```cmd
npm install
npm run download:album-covers
npm run download:images
npm run dev
```

Do not open `index.html` directly to preview the React app. The project requires Vite. The first install and artwork download require an internet connection.

## Build for hosting
Run:

```bash
npm install
npm run build
```

Upload the **contents of `dist/`**, not the project source folder, to your hosting document root. The Vite config uses relative asset paths for subdirectory hosting.

## Important
This MVP includes demo data and prepared integration points. Review the original project notes before enabling real payments or deploying to production. Never expose a Supabase service-role key in browser code.


## White-page repair
The "Fresh off the press" sort now safely handles older browser-stored release records that have no `date` field. If the browser still shows a blank page after replacing the project, clear this app's local storage in Chrome DevTools > Application > Local Storage > `http://localhost:5173` and delete `atu_releases`, then reload.


## Download image assets locally
The app now references local image paths under `/images/` instead of remote Unsplash URLs. From this project folder, run:

```bash
npm run download:images
npm run dev
```

The first command downloads the referenced Unsplash photos into `public/images/`. It requires an internet connection on your computer. Once downloaded, Vite serves them locally and the site no longer needs to request those photos from Unsplash at runtime. If any download fails, rerun `npm run download:images` and check the reported filename/status.


## Logo
The supplied logo is stored at `public/1000-units-logo.webp` and is used in the header, footer, and sign-in page.


## Album cover artwork
The release list contains these 10 albums: Afroskankin, African Gangsta, Ipseity, Jagaban Times, Best Ever, No Sign Of Weakness, Oriade, Morayo, Album of The Year, and West African Goat. The `start-local.bat` file automatically runs the artwork downloader. It searches Apple's public iTunes catalog and saves matching cover images in `public/images/`.

The downloader reports any album it cannot confidently match or download. Check the Command Prompt output if a cover is missing, ensure your computer is online, and run `start-local.bat` again. The app updates old browser-stored sample releases to the current 10-album seed when necessary.


## Official album artwork verification update

The album-cover downloader now requires an exact album-title and artist match from Apple's public catalog before saving an image. It refuses to invent covers or silently substitute a different album. If any cover cannot be confidently matched or downloaded, `start-local.bat` stops rather than opening the site with missing album artwork.

Run `start-local.bat` on a Windows computer with Node.js and internet access. The verified files are saved in `public/images/` using the filenames already referenced by the album cards and detail pages. For GitHub Pages subfolder hosting, album and demo image paths use Vite's `BASE_URL`.


### Album downloader v3

This version uses direct catalog IDs for releases that have been verified on Apple Music and broader searches for the remaining releases. It still refuses to substitute an album with a similar name. If an album is unavailable or the exact artist/title cannot be verified in the Apple catalog, it reports the failure instead of generating a placeholder.


### Album artwork downloader v4

This update corrects the Ipseity search to include Oba Lurge's name. For the original West African Goat release, it checks PayBac Iboro's Audiomack album page and downloads the page's own artwork only if the page metadata verifies the release. It will not silently substitute the Deluxe cover.


### Album artwork downloader v5 — supplied Spotify sources

The downloader now uses the exact Spotify album URLs supplied for Ipseity and West African Goat. It retrieves Spotify's public oEmbed metadata, verifies the album title and artist, then downloads the associated thumbnail. The West African Goat link resolves to the Spotify release titled **West African Goat DELUXE**, so that release's own cover is used for the website's West African Goat card. The other eight covers continue using the previously verified Apple Music IDs.
