// ---------- KONFIGURASI ----------
const MAP_CENTER = [-0.0430, 109.3330];
const MAP_ZOOM = 14;

const WARNA = {
  indomaret: '#e74c3c',
  alfamart: '#2980b9',
  lainnya: '#27ae60'
};

// ---------- STATE TERPUSAT ----------
const state = {
  filters: { indomaret: true, alfamart: true, lainnya: true },
  cluster: false
};

// ---------- DATA & LAYER AKTIF ----------
const rawData = { retail: null };
const activeLayers = { retail: null };

// ---------- INISIALISASI PETA ----------
const map = L.map('map', {
  center: MAP_CENTER,
  zoom: MAP_ZOOM,
  zoomControl: true
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

// ---------- HELPER ----------
// Indomaret / Alfamart tetap, sisanya (Swalayan, Minimarket) = lainnya
function kelompok(merek) {
  const m = (merek || '').toLowerCase();
  return (m === 'indomaret' || m === 'alfamart') ? m : 'lainnya';
}

// Ikon lingkaran (divIcon) untuk mode cluster
function createCircleIcon(color) {
  return L.divIcon({
    className: 'custom-circle-marker',
    html: `<span style="display:block;width:16px;height:16px;background:${color};` +
          `border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8]
  });
}

// Ikon cluster (divIcon) berisi jumlah titik
function createClusterIcon(cluster) {
  const n = cluster.getChildCount();
  let ukuran = 'small';
  if (n >= 10) ukuran = 'large';
  else if (n >= 5) ukuran = 'medium';
  return L.divIcon({
    html: `<div><span>${n}</span></div>`,
    className: `marker-cluster marker-cluster-${ukuran}`,
    iconSize: L.point(40, 40)
  });
}

function buildPopupHTML(feature) {
  const p = feature.properties || {};
  let html = '<div style="min-width:200px">';
  html += `<h4>${p.nama || 'Tanpa Nama'}</h4><table>`;
  Object.keys(p).forEach((key) => {
    if (key === 'nama') return;
    html += `<tr><td>${key}</td><td>${p[key]}</td></tr>`;
  });
  html += '</table></div>';
  return html;
}

// ---------- RENDER RETAIL (dipanggil ulang saat state berubah) ----------
function renderRetail() {
  if (activeLayers.retail) map.removeLayer(activeLayers.retail);
  if (!rawData.retail) return;

  const container = state.cluster
    ? L.markerClusterGroup({
        maxClusterRadius: 50,
        showCoverageOnHover: false,
        iconCreateFunction: createClusterIcon
      })
    : L.layerGroup();

  rawData.retail.features.forEach((f) => {
    const grup = kelompok(f.properties.merek);

    // FILTER: lewati jika merek tidak dicentang
    if (!state.filters[grup]) return;

    const [lon, lat] = f.geometry.coordinates;
    const warna = WARNA[grup];

    // Cluster butuh L.marker + divIcon, mode biasa pakai L.circleMarker
    const marker = state.cluster
      ? L.marker([lat, lon], { icon: createCircleIcon(warna) })
      : L.circleMarker([lat, lon], {
          radius: 8,
          fillColor: warna,
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        });

    marker.bindTooltip(f.properties.merek);  // hover: merek
    marker.bindPopup(buildPopupHTML(f));     // klik: detail lengkap
    container.addLayer(marker);
  });

  container.addTo(map);
  activeLayers.retail = container;
}

// ---------- STATISTIK ----------
function renderStatistik(stats) {
  const box = document.getElementById('stats');
  let html = `<p style="font-size:.82rem;margin-bottom:6px">Total gerai: <strong>${stats.total}</strong></p><ul>`;
  Object.entries(stats.per_merek).forEach(([merek, jumlah]) => {
    const warna = WARNA[kelompok(merek)];
    html += `<li><span style="display:inline-block;width:10px;height:10px;` +
            `background:${warna};border-radius:50%;margin-right:6px"></span>` +
            `${merek}: <strong>${jumlah}</strong></li>`;
  });
  html += '</ul>';
  box.innerHTML = html;
}

// ---------- MUAT DATA (async/await) ----------
async function muatData() {
  try {
    const [retail, stats] = await Promise.all([
      fetch('/api/data/retail').then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }),
      fetch('/api/stats/merek').then((r) => r.json())
    ]);

    rawData.retail = retail;
    renderRetail();
    renderStatistik(stats);
  } catch (err) {
    console.error('Gagal memuat data:', err);
    document.getElementById('stats').innerHTML =
      '<p style="color:#c62828">Gagal memuat. Pastikan server berjalan.</p>';
  }
}

// ---------- EVENT ----------
document.querySelectorAll('.filter-merek').forEach((cb) => {
  cb.addEventListener('change', (e) => {
    state.filters[e.target.value] = e.target.checked;
    renderRetail();
  });
});

document.getElementById('toggleCluster').addEventListener('change', (e) => {
  state.cluster = e.target.checked;
  renderRetail();
});

// ---------- JALANKAN ----------
muatData();