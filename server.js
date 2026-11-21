const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

const FILE_RETAIL = path.join(__dirname, 'data', 'retail_south.geojson');
const FILE_ZONA = path.join(__dirname, 'data', 'zona_retail.geojson');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const bacaGeoJSON = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

// GET /api/data/retail -> seluruh GeoJSON retail
app.get('/api/data/retail', async (req, res) => {
  try {
    res.json(await bacaGeoJSON(FILE_RETAIL));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/merek -> jumlah gerai per merek
app.get('/api/stats/merek', async (req, res) => {
  try {
    const data = await bacaGeoJSON(FILE_RETAIL);
    const stats = {};
    data.features.forEach((f) => {
      const merek = (f.properties && f.properties.merek) || 'lainnya';
      stats[merek] = (stats[merek] || 0) + 1;
    });
    res.json({ total: data.features.length, per_merek: stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/feature/zona -> simpan poligon zona baru
// Menerima Feature langsung, atau { feature: {...} }
app.post('/api/feature/zona', async (req, res) => {
  const feature = req.body.feature || req.body;

  if (!feature || feature.type !== 'Feature' ||
      !feature.geometry || feature.geometry.type !== 'Polygon') {
    return res.status(400).json({ error: 'Body harus berupa GeoJSON Feature bertipe Polygon' });
  }

  try {
    let zona;
    try {
      zona = await bacaGeoJSON(FILE_ZONA);
    } catch {
      zona = { type: 'FeatureCollection', features: [] };
    }
    zona.features.push(feature);
    await fs.writeFile(FILE_ZONA, JSON.stringify(zona, null, 2));
    res.status(201).json({ success: true, total: zona.features.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));