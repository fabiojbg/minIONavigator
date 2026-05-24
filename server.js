require('dotenv').config();
const express = require('express');
const Minio = require('minio');
const path = require('path');

const app = express();
app.use(express.json()); // support json encoded bodies
const PORT = process.env.PORT || 4000;

// Parse MinIO Connection config
const endpoint = process.env.MINIO_ENDPOINT || 'localhost:9000';
let host = endpoint;
let minioPort = 9000;

if (endpoint.includes(':')) {
  const parts = endpoint.split(':');
  host = parts[0];
  minioPort = parseInt(parts[1], 10);
}

const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
const defaultBucket = process.env.MINIO_BUCKET || '';

console.log('Initializing MinIO client:');
console.log(`- Host: ${host}`);
console.log(`- Port: ${minioPort}`);
console.log(`- SSL: ${useSSL}`);
console.log(`- Default Bucket: ${defaultBucket || '(none)'}`);

const minioClient = new Minio.Client({
  endPoint: host,
  port: minioPort,
  useSSL: useSSL,
  accessKey: accessKey,
  secretKey: secretKey
});

// Helper to remove parent prefix and return relative name
function getRelativeName(fullPath, parentPrefix) {
  let rel = fullPath;
  if (parentPrefix && fullPath.startsWith(parentPrefix)) {
    rel = fullPath.substring(parentPrefix.length);
  }
  if (rel.endsWith('/')) {
    rel = rel.slice(0, -1);
  }
  return rel;
}

// Endpoint to list directories and files
app.get('/api/files', async (req, res) => {
  const bucket = req.query.bucket || defaultBucket;
  const prefix = req.query.prefix || '';

  // If there is no bucket specified, list the available buckets as top-level items
  if (!bucket) {
    try {
      const buckets = await minioClient.listBuckets();
      const result = buckets.map(b => ({
        name: b.name,
        path: '',
        bucket: b.name,
        isDir: true,
        isBucket: true
      }));
      result.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      return res.json(result);
    } catch (err) {
      console.error('Error listing buckets:', err);
      return res.status(500).json({ error: 'Failed to list buckets: ' + err.message });
    }
  }

  // If we have a bucket, list objects inside it under the specified prefix
  try {
    const objectsList = [];
    const stream = minioClient.listObjectsV2(bucket, prefix, false);

    stream.on('data', (obj) => {
      objectsList.push(obj);
    });

    stream.on('end', () => {
      const folders = [];
      const files = [];

      objectsList.forEach(obj => {
        const isDir = obj.prefix !== undefined || (obj.name && obj.name.endsWith('/'));
        const fullPath = obj.prefix || obj.name;

        if (!fullPath) return;
        if (fullPath === prefix) return; // skip folder placeholder itself

        const name = getRelativeName(fullPath, prefix);
        if (!name) return; // skip empty names

        if (isDir) {
          folders.push({
            name: name,
            path: fullPath,
            bucket: bucket,
            isDir: true
          });
        } else {
          files.push({
            name: name,
            path: fullPath,
            bucket: bucket,
            isDir: false,
            size: obj.size,
            lastModified: obj.lastModified
          });
        }
      });

      // Sort folders and files alphabetically (case-insensitive)
      folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

      res.json([...folders, ...files]);
    });

    stream.on('error', (err) => {
      console.error('Stream error while listing objects:', err);
      res.status(500).json({ error: 'Failed to list bucket contents: ' + err.message });
    });

  } catch (err) {
    console.error('Error listing objects:', err);
    res.status(500).json({ error: 'Failed to read bucket objects: ' + err.message });
  }
});

// Endpoint to retrieve file contents
app.get('/api/file', async (req, res) => {
  const bucket = req.query.bucket || defaultBucket;
  const filePath = req.query.path;

  if (!bucket) {
    return res.status(400).send('Bucket is required');
  }
  if (!filePath) {
    return res.status(400).send('Path is required');
  }

  try {
    const stream = await minioClient.getObject(bucket, filePath);
    
    // Set appropriate headers based on extension
    const ext = filePath.split('.').pop().toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === 'txt') contentType = 'text/plain; charset=utf-8';
    else if (ext === 'json') contentType = 'application/json; charset=utf-8';
    else if (ext === 'md') contentType = 'text/markdown; charset=utf-8';
    else if (ext === 'html') contentType = 'text/html; charset=utf-8';
    else if (ext === 'pdf') contentType = 'application/pdf';
    else if (ext === 'png') contentType = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'gif') contentType = 'image/gif';
    else if (ext === 'svg') contentType = 'image/svg+xml';
    
    res.setHeader('Content-Type', contentType);
    stream.pipe(res);
  } catch (err) {
    console.error(`Error retrieving object ${filePath}:`, err);
    res.status(404).send('File not found: ' + err.message);
  }
});

// Helper to delete folder (prefix) recursively
function deletePrefixRecursively(bucket, prefix) {
  return new Promise((resolve, reject) => {
    const objectsList = [];
    const stream = minioClient.listObjectsV2(bucket, prefix, true);
    
    stream.on('data', (obj) => {
      if (obj.name) {
        objectsList.push(obj.name);
      }
    });
    
    stream.on('error', (err) => {
      reject(err);
    });
    
    stream.on('end', async () => {
      try {
        if (objectsList.length > 0) {
          await minioClient.removeObjects(bucket, objectsList);
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Endpoint to delete a file or folder recursively
app.delete('/api/file', async (req, res) => {
  const bucket = req.query.bucket || defaultBucket;
  const filePath = req.query.path;
  const isDir = req.query.isDir === 'true';

  if (!bucket) {
    return res.status(400).send('Bucket is required');
  }
  if (!filePath) {
    return res.status(400).send('Path is required');
  }

  try {
    if (isDir) {
      // Ensure folder path ends with '/' for safety
      const folderPrefix = filePath.endsWith('/') ? filePath : filePath + '/';
      await deletePrefixRecursively(bucket, folderPrefix);
      res.json({ success: true, message: `Folder ${folderPrefix} deleted recursively` });
    } else {
      await minioClient.removeObject(bucket, filePath);
      res.json({ success: true, message: `File ${filePath} deleted` });
    }
  } catch (err) {
    console.error(`Error deleting object ${filePath}:`, err);
    res.status(500).json({ error: 'Failed to delete: ' + err.message });
  }
});

// Endpoint to save file content
app.post('/api/save', express.json({ limit: '10mb' }), async (req, res) => {
  const bucket = req.body.bucket || defaultBucket;
  const filePath = req.body.path;
  const content = req.body.content;

  if (!bucket) {
    return res.status(400).send('Bucket is required');
  }
  if (!filePath) {
    return res.status(400).send('Path is required');
  }

  try {
    const buffer = Buffer.from(content || '', 'utf-8');
    await minioClient.putObject(bucket, filePath, buffer);
    res.json({ success: true, message: `File ${filePath} saved successfully` });
  } catch (err) {
    console.error(`Error saving object ${filePath}:`, err);
    res.status(500).json({ error: 'Failed to save: ' + err.message });
  }
});

// Serve static assets from public/ folder
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route to serve UI index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`MinIO Navigator server running on http://localhost:${PORT}`);
});
