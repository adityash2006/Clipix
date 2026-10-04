const compressor = new Worker('../js/workers/compressor.js');
const input = document.getElementById('pic');
const dropzone = document.getElementById('dropzone');
const resultPanel = document.getElementById('result-panel');
const controlsCard = document.getElementById('controls-card');
const qualitySlider = document.getElementById('quality-slider');
const widthSlider = document.getElementById('width-slider');
const resultImage = document.getElementById('result-image');
const emptyPreview = document.getElementById('empty-preview');
const resultMeta = document.getElementById('result-meta');
const resultTitle = document.getElementById('result-title');
const statusPill = document.getElementById('status-pill');
const fileName = document.getElementById('file-name');
const originalSize = document.getElementById('original-size');
const fileSize = document.getElementById('file-size');
const downloadLink = document.getElementById('download-link');
const inp = document.getElementById("outputFormat");

let resultUrl;
let selectedFile;
let requestId = 0;

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function setStatus(label, state = '') {
    statusPill.textContent = label;
    statusPill.className = `status-pill${state ? ` is-${state}` : ''}`;
}

function compressSelectedFile() {
    const currentRequest = ++requestId;
    resultPanel.setAttribute('aria-busy', 'true');
    setStatus('Working', 'processing');
    resultTitle.textContent = `Compressing ${selectedFile.name}`;
    resultMeta.hidden = true;
    resultImage.hidden = true;
    emptyPreview.hidden = false;
    compressor.postMessage({
        file: selectedFile,
        quality: Number(qualitySlider.value),
        maxWidth: Number(widthSlider.value),
        outputFormat: inp.value,
        requestId: currentRequest
    });
}

function processFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        setStatus('Choose an image', 'error');
        resultTitle.textContent = 'That file is not an image';
        return;
    }

    selectedFile = file;
    controlsCard.hidden = false;
    qualitySlider.value = '0.7';
    widthSlider.value = '1920';
    originalSize.textContent = `Original: ${formatBytes(file.size)}`;
    compressSelectedFile();
}

input.addEventListener('change', () => processFile(input.files[0]));

qualitySlider.addEventListener('input', () => {
    if (selectedFile) compressSelectedFile();
});
inp.addEventListener('change', () => {
    if (selectedFile) compressSelectedFile();
});
widthSlider.addEventListener('input', () => {
    if (selectedFile) compressSelectedFile();
});

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
    const { blob, error, requestId: responseRequestId } = event.data;
    if (responseRequestId !== requestId) return;
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


