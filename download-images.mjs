import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(root, 'public', 'images');
const sources = {
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1000&q=85": "/images/unsplash-01.jpg",
  "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85": "/images/unsplash-02.jpg",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85": "/images/unsplash-03.jpg",
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=85": "/images/unsplash-04.jpg",
  "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=85": "/images/unsplash-05.jpg",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=85": "/images/unsplash-06.jpg",
  "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=900&q=85": "/images/unsplash-07.jpg",
  "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?auto=format&fit=crop&w=900&q=85": "/images/unsplash-08.jpg",
  "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=500&q=85": "/images/unsplash-09.jpg",
  "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=500&q=85": "/images/unsplash-10.jpg",
  "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=500&q=85": "/images/unsplash-11.jpg"
};
await mkdir(imagesDir, { recursive: true });
let failed = 0;
for (const [url, publicPath] of Object.entries(sources)) {
  const filename = path.basename(publicPath);
  const destination = path.join(imagesDir, filename);
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1000) throw new Error('Downloaded file is unexpectedly small');
    await writeFile(destination, bytes);
    console.log(`Saved public/images/${filename} (${Math.round(bytes.length / 1024)} KB)`);
  } catch (error) {
    failed++;
    console.error(`FAILED ${filename}: ${error.message}`);
  }
}
if (failed) {
  console.error(`\n${failed} image(s) failed. Check your internet connection and rerun: npm run download:images`);
  process.exitCode = 1;
} else {
  console.log('\nAll images are saved locally in public/images.');
}
