import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(root, 'public', 'images');

const albums = [
  { title: 'Afroskankin', artist: 'PayBac Iboro', id: '6815015788', file: 'album-afroskankin.jpg' },
  { title: 'African Gangsta', artist: '2groovy', id: '1849686329', file: 'album-african-gangsta.jpg' },
  { title: 'Ipseity', artist: 'Oba Lurge', spotifyUrl: 'https://open.spotify.com/album/6UHvFOg145XZEyq4lnFbLA', file: 'album-ipseity.jpg' },
  { title: 'Jagaban Times Vol. 1', artist: 'Mainland Boyz', id: '6790496720', file: 'album-jagaban-times.jpg', displayTitle: 'Jagaban Times' },
  { title: 'Best Ever', artist: 'Oba Lurge', id: '1801519411', file: 'album-best-ever.jpg' },
  { title: 'No Sign of Weakness', artist: 'Burna Boy', id: '1828535197', file: 'album-no-sign-of-weakness.jpg' },
  { title: 'Oriade', artist: 'Davido', id: '6784220944', file: 'album-oriade.jpg', aliases: ['oriade', 'oriadé'] },
  { title: 'Morayo', artist: 'Wizkid', id: '1780459822', file: 'album-morayo.jpg' },
  { title: 'Album of the Year', artist: 'PayBac Iboro', id: '1660196071', file: 'album-of-the-year.jpg' },
  { title: 'West African Goat', artist: 'PayBac Iboro', spotifyUrl: 'https://open.spotify.com/album/0S4UEzDdqEgQQ0KKR5EUQ7', acceptedSpotifyTitle: 'West African Goat DELUXE', file: 'album-west-african-goat.jpg' },
];

function norm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\[(explicit|clean)\]/g, ' ')
    .replace(/\b(explicit|clean version)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function titleMatches(actual, album) {
  const title = norm(actual);
  return title === norm(album.title) ||
    (album.aliases || []).some(alias => title === norm(alias)) ||
    (album.acceptedSpotifyTitle && title === norm(album.acceptedSpotifyTitle));
}
function artistMatches(actual, album) {
  return norm(actual).includes(norm(album.artist));
}
async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'AThousandUnitsAlbumArtwork/5.0' } });
  if (!res.ok) throw new Error(`catalog returned HTTP ${res.status}`);
  return res.json();
}
async function spotifyArtwork(album) {
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(album.spotifyUrl)}`;
  const metadata = await getJson(oembedUrl);
  const pageTitle = metadata.title || '';
  const author = metadata.author_name || '';
  if (!titleMatches(pageTitle, album)) {
    throw new Error(`Spotify title mismatch: expected "${album.acceptedSpotifyTitle || album.title}", received "${pageTitle || 'no title'}"`);
  }
  if (!artistMatches(author, album)) {
    throw new Error(`Spotify artist mismatch: expected "${album.artist}", received "${author || 'no artist'}"`);
  }
  if (!metadata.thumbnail_url) throw new Error('Spotify did not provide album artwork URL');
  const imageResponse = await fetch(metadata.thumbnail_url, { headers: { 'User-Agent': 'AThousandUnitsAlbumArtwork/5.0' } });
  if (!imageResponse.ok) throw new Error(`Spotify artwork returned HTTP ${imageResponse.status}`);
  return { bytes: Buffer.from(await imageResponse.arrayBuffer()), artistName: author, actualTitle: pageTitle };
}
async function appleAlbum(album) {
  if (album.id) {
    try {
      const data = await getJson(`https://itunes.apple.com/lookup?id=${encodeURIComponent(album.id)}`);
      const item = (data.results || []).find(x => x.collectionName && x.artworkUrl100);
      if (item && titleMatches(item.collectionName, album) && artistMatches(item.artistName, album)) return item;
      if (item) console.warn(`Catalog ID for ${album.title} returned "${item.collectionName}" by "${item.artistName}"; trying search.`);
    } catch (e) { console.warn(`Direct lookup for ${album.title}: ${e.message}; trying search.`); }
  }
  const data = await getJson(`https://itunes.apple.com/search?entity=album&limit=200&term=${encodeURIComponent(album.query || `${album.title} ${album.artist}`)}`);
  const candidates = (data.results || []).filter(x => x.artworkUrl100 && x.collectionName);
  const matches = candidates.filter(x => titleMatches(x.collectionName, album) && artistMatches(x.artistName, album));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const exact = matches.filter(x => norm(x.collectionName) === norm(album.title));
    if (exact.length === 1) return exact[0];
    throw new Error(`Multiple exact title + artist matches; refusing to guess: ${matches.map(x => `${x.collectionName} — ${x.artistName}`).join('; ')}`);
  }
  const near = candidates.slice(0, 10).map(x => `${x.collectionName} — ${x.artistName}`).join('; ');
  throw new Error(`No exact title + artist match. Catalog results: ${near || 'none'}`);
}
function validateImage(bytes) {
  if (bytes.length < 5000) throw new Error(`image file unexpectedly small (${bytes.length} bytes)`);
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  const webp = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!jpeg && !png && !webp) throw new Error('download is not a recognised image');
}

await mkdir(outputDir, { recursive: true });
let failed = 0;
for (const album of albums) {
  const label = album.displayTitle || album.title;
  try {
    let bytes, artistName, actualTitle;
    if (album.spotifyUrl) {
      ({ bytes, artistName, actualTitle } = await spotifyArtwork(album));
      console.log(`Spotify verified title: "${actualTitle}"`);
    } else {
      const match = await appleAlbum(album);
      const imageUrl = match.artworkUrl100.replace(/\/\d+x\d+bb\.(jpg|webp)$/i, '/1200x1200bb.jpg');
      const response = await fetch(imageUrl, { headers: { 'User-Agent': 'AThousandUnitsAlbumArtwork/5.0' } });
      if (!response.ok) throw new Error(`Apple artwork returned HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      artistName = match.artistName;
      actualTitle = match.collectionName;
    }
    validateImage(bytes);
    await writeFile(path.join(outputDir, album.file), bytes);
    console.log(`OK  ${label} — ${artistName} -> public/images/${album.file} (${Math.round(bytes.length / 1024)} KB)`);
  } catch (error) {
    failed++;
    console.error(`FAILED  ${label}: ${error.message}`);
  }
}
if (failed) {
  console.error(`\n${failed} of ${albums.length} covers could not be verified/downloaded. No placeholder art was generated.`);
  process.exitCode = 1;
} else {
  console.log(`\nSUCCESS: all ${albums.length} album covers were verified and downloaded.`);
}
