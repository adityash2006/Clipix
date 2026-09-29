const compressor = new Worker('../js/workers/compressor.js');
const input = document.getElementById('pic');
const dropzone = document.getElementById('dropzone');
const resultPanel = document.getElementById('result-panel');
const resultImage = document.getElementById('result-image');
const emptyPreview = document.getElementById('empty-preview');
const resultMeta = document.getElementById('result-meta');
const resultTitle = document.getElementById('result-title');
const statusPill = document.getElementById('status-pill');
const fileName = document.getElementById('file-name');
const originalSize = document.getElementById('original-size');
const fileSize = document.getElementById('file-size');
const downloadLink = document.getElementById('download-link');
let resultUrl;

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function setStatus(label, state = '') {
    statusPill.textContent = label;
    statusPill.className = `status-pill${state ? ` is-${state}` : ''}`;
}

function processFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        setStatus('Choose an image', 'error');
        resultTitle.textContent = 'That file is not an image';
        return;
    }

    resultPanel.setAttribute('aria-busy', 'true');
    setStatus('Working', 'processing');
    resultTitle.textContent = `Compressing ${file.name}`;
    resultMeta.hidden = true;
    resultImage.hidden = true;
    emptyPreview.hidden = false;
    originalSize.textContent = `Original: ${formatBytes(file.size)}`;
    compressor.postMessage({ file, quality: 0.72, maxWidth: 1600, outputFormat: 'jpeg' });
}

input.addEventListener('change', () => processFile(input.files[0]));

['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add('is-dragging');
    });
});

['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove('is-dragging');
    });
});

dropzone.addEventListener('drop', (event) => processFile(event.dataTransfer.files[0]));

compressor.onmessage = (event) => {
    const { blob, error } = event.data;
    resultPanel.setAttribute('aria-busy', 'false');

    if (error) {
        setStatus('Could not process', 'error');
        resultTitle.textContent = error;
        return;
    }

    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    resultImage.src = resultUrl;
    resultImage.hidden = false;
    emptyPreview.hidden = true;
    resultTitle.textContent = 'Your compressed image is ready';
    setStatus('Ready', 'ready');
    fileName.textContent = `compressed.${blob.type}`;
    fileSize.textContent = `Now ${formatBytes(blob.size)}`;
    downloadLink.href = resultUrl;
    resultMeta.hidden = false;
};

compressor.onerror = () => {
    resultPanel.setAttribute('aria-busy', 'false');
    setStatus('Error', 'error');
    resultTitle.textContent = 'Something went wrong while processing the image';
};
