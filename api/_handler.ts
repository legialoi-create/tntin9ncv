import app from '../server.ts';

export default function handler(req: any, res: any) {
  return new Promise<void>((resolve) => {
    // Ensure Vercel serverless runtime waits for the response stream to complete
    let finished = false;
    const onComplete = () => {
      if (!finished) {
        finished = true;
        resolve();
      }
    };

    res.once('finish', onComplete);
    res.once('close', onComplete);
    res.once('error', onComplete);

    try {
      // 1. Normalize URL for Vercel Rewrites
      let targetPath = '';
      const queryParam = req.query?.__path || req.query?.path;
      if (queryParam) {
        targetPath = Array.isArray(queryParam) ? queryParam.join('/') : String(queryParam);
      } else if (req.url && req.url.includes('__path=')) {
        const match = req.url.match(/__path=([^&]+)/);
        if (match && match[1]) {
          targetPath = decodeURIComponent(match[1]);
        }
      }

      if (targetPath) {
        req.url = '/api/' + targetPath.replace(/^\//, '');
      } else {
        const headerUrl = req.headers['x-forwarded-uri'] || req.headers['x-original-url'] || req.headers['x-matched-path'];
        if (headerUrl && typeof headerUrl === 'string' && headerUrl.startsWith('/api')) {
          req.url = headerUrl;
        } else if (req.url && !req.url.startsWith('/api')) {
          req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
        }
      }
      req.originalUrl = req.url;

      // 2. Prevent body-parser stream deadlock on Vercel Serverless
      if (req.body !== undefined && req.body !== null) {
        if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
          try {
            req.body = JSON.parse(req.body);
          } catch (e) {}
        }
        req._body = true;
      } else if (req.complete || req.readableEnded) {
        req.body = {};
        req._body = true;
      }

      // 3. Delegate to Express app
      app(req, res);
    } catch (err: any) {
      console.error('[Vercel Handler Root Error]:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Lỗi hệ thống máy chủ: ' + (err?.message || 'Không thể xử lý yêu cầu')
        });
      }
      onComplete();
    }
  });
}
