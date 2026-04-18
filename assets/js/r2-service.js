// Cloudflare R2 upload service via Worker proxy
// Worker URL: https://alp-r2-uploader.pandapotanandi.workers.dev
// Public bucket: https://pub-c0d3845dc39d4b56a078a2b8c7199bb9.r2.dev

const R2_WORKER_URL = 'https://alp-r2-uploader.pandapotanandi.workers.dev';
const R2_TOKEN = 'a8fab19b928ac0b619b235088ebcdadd';
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function isImageFile(file) {
  return !!file && typeof file.type === 'string' && file.type.startsWith('image/');
}

function blobToFile(blob, name) {
  return new File([blob], name, {
    type: blob.type || 'application/octet-stream',
    lastModified: Date.now(),
  });
}

async function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const maxW = 1920;
      const maxH = 1920;
      let { width, height } = img;
      const scale = Math.min(1, maxW / width, maxH / height);

      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Gagal memproses gambar (canvas tidak tersedia).'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Gagal mengompres gambar.'));
            return;
          }
          const compressedName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          resolve(blobToFile(blob, compressedName));
        },
        'image/jpeg',
        0.82,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal membaca file gambar.'));
    };

    img.src = url;
  });
}

async function prepareUploadFile(file) {
  if (!file) return file;
  if (file.size <= MAX_UPLOAD_BYTES) return file;

  if (!isImageFile(file)) {
    throw new Error('Ukuran file terlalu besar. Maksimal 4MB untuk upload non-gambar.');
  }

  const compressed = await compressImageFile(file);
  if (compressed.size > MAX_UPLOAD_BYTES) {
    throw new Error('Ukuran foto masih terlalu besar setelah kompresi. Gunakan foto < 4MB.');
  }

  return compressed;
}

/**
 * Upload a file to Cloudflare R2 via the Worker proxy.
 * @param {File} file   - The File object from an <input type="file">
 * @param {string} folder - Destination folder ('fasilitas' | 'laporan')
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
async function uploadToR2(file, folder) {
  const preparedFile = await prepareUploadFile(file);
  const ext = (preparedFile.name.split('.').pop() || 'bin').toLowerCase();
  const uniqueKey = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const formData = new FormData();
  formData.append('key', uniqueKey);
  formData.append('file', preparedFile);

  const response = await fetch(`${R2_WORKER_URL}/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${R2_TOKEN}` },
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error('Upload ditolak server (413). Ukuran foto terlalu besar. Gunakan gambar < 4MB.');
    }
    throw new Error(`Upload gagal: HTTP ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.error || 'Upload gagal (server error)');
  }

  // workerFileUrl is used — R2 public bucket access is served via Worker
  return result.workerFileUrl || result.publicUrl;
}

/**
 * Delete a file from Cloudflare R2 via the Worker proxy.
 * Fire-and-forget — failures are logged but not thrown.
 * @param {string} key - The file key (path) to delete
 */
async function deleteFromR2(key) {
  try {
    await fetch(`${R2_WORKER_URL}/delete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${R2_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key }),
    });
  } catch (err) {
    console.warn('R2 delete failed (non-critical):', err);
  }
}
