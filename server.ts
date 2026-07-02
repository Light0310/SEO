import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { analyzeUrl } from './server/analyzer';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure body parsing for JSON payloads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // --- API Routes ---
  
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Server-side proxy to fetch external URLs securely and bypass browser CORS/failed to fetch
  app.get('/api/proxy-fetch', async (req, res) => {
    try {
      const target = req.query.url;
      if (!target || typeof target !== 'string') {
        return res.status(400).json({ error: 'الرجاء تزويد رابط صالح للمعالجة.' });
      }

      try {
        new URL(target);
      } catch (e) {
        return res.status(400).json({ error: 'صيغة الرابط غير صالحة. يرجى التأكد من كتابة رابط صحيح بدون مسافات أو رموز غير مدعومة.' });
      }

      const response = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ExtractorBot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
        },
        signal: AbortSignal.timeout(12000) // 12 second timeout
      });

      if (!response.ok) {
        throw new Error(`فشل جلب الصفحة: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      return res.json({ contents: html });
    } catch (err: any) {
      console.error('Proxy fetch error:', err);
      return res.status(500).json({
        error: err.message || 'حدث خطأ في الخادم أثناء جلب الرابط الخارجي.'
      });
    }
  });

  // Core SEO & Schema extraction endpoint
  app.post('/api/analyze', async (req, res) => {
    try {
      const { url, keyword, rawHtml } = req.body;
      
      if (!rawHtml && (!url || typeof url !== 'string')) {
        return res.status(400).json({ 
          success: false, 
          error: 'الرجاء إدخال رابط صالح أو كتابة كود HTML يدوياً.' 
        });
      }
      
      const report = await analyzeUrl(url || '', keyword, rawHtml);
      return res.json(report);
      
    } catch (err: any) {
      console.error('Analysis error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'حدث خطأ داخلي في الخادم أثناء معالجة طلبك.'
      });
    }
  });

  // --- Vite Dev Middleware / Production Static Asset Routing ---
  
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Dev Server] Vite middleware integrated.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[Prod Server] Serving static dist files.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Web application listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('[Startup Error] Failed to boot full-stack server:', error);
});
