import { WorkerPool } from './pool.js';

const compressor = new Worker(new URL('./workers/compressor.js', import.meta.url));
const multiplePoolSize = Math.min(navigator.hardwareConcurrency || 2, 4);
let multiplePool;
const input = document.getElementById('pic');
const dropzone = document.getElementById('dropzone');
const multipleInput = document.getElementById('multiple-pic');
const multipleDropzone = document.getElementById('multiple-dropzone');
const uploadForm = document.getElementById('upload-form');
const multipleUploadForm = document.getElementById('multiple-upload-form');
const singleMode = document.getElementById('single-mode');
const multipleMode = document.getElementById('multiple-mode');
const resultPanel = document.getElementById('result-panel');
const controlsCard = document.getElementById('controls-card');
const batchPanel = document.getElementById('batch-panel');
const batchList = document.getElementById('batch-list');
const batchTitle = document.getElementById('batch-title');
const batchStatus = document.getElementById('batch-status');
const downloadAllButton = document.getElementById('download-all');
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
let batchRequestId = 0;

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function setStatus(label, state = '') {
    statusPill.textContent = label;
    statusPill.className = `status-pill${state ? ` is-${state}` : ''}`;
}

function setBatchStatus(label, state = '') {
    batchStatus.textContent = label;
    batchStatus.className = `status-pill${state ? ` is-${state}` : ''}`;
}

function setMode(mode) {
    const isMultiple = mode === 'multiple';
    singleMode.classList.toggle('is-active', !isMultiple);
    multipleMode.classList.toggle('is-active', isMultiple);
    singleMode.setAttribute('aria-pressed', String(!isMultiple));
    multipleMode.setAttribute('aria-pressed', String(isMultiple));
    uploadForm.hidden = isMultiple;
    multipleUploadForm.hidden = !isMultiple;
    controlsCard.hidden = isMultiple || !selectedFile;
    resultPanel.hidden = isMultiple;
    batchPanel.hidden = !isMultiple || !batchList.children.length;
    if (!isMultiple) downloadAllButton.hidden = true;
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

function createBatchRow(file, index) {
    const row = document.createElement('article');
    row.className = 'batch-row';
    row.id = `batch-row-${index}`;
    row.innerHTML = `
        <div class="batch-file">
            <strong></strong>
            <span class="batch-file-size"></span>
        </div>
        <span class="batch-row-status">Queued</span>
        <a class="download-button batch-download" hidden download>Download</a>
    `;
    row.querySelector('strong').textContent = file.name;
    row.querySelector('.batch-file-size').textContent = formatBytes(file.size);
    return row;
}

async function processMultipleFiles(files) {
    const imageFiles = [...files].filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) {
        setBatchStatus('Choose images', 'error');
        batchTitle.textContent = 'No image files were selected';
        return;
    }

    const currentBatch = ++batchRequestId;
    if (!multiplePool) {
        multiplePool = new WorkerPool(new URL('./workers/compressor.js', import.meta.url), multiplePoolSize);
    }
    batchList.replaceChildren(...imageFiles.map(createBatchRow));
    batchPanel.hidden = false;
    resultPanel.hidden = true;
    controlsCard.hidden = true;
    batchTitle.textContent = `Compressing ${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'}`;
    setBatchStatus('Working', 'processing');
    downloadAllButton.hidden = true;

    const results = await Promise.allSettled(imageFiles.map((file, index) => multiplePool.run(
        {
            file,
            quality: 0.7,
            maxWidth: 1920,
            outputFormat: 'jpeg',
            requestId: `${currentBatch}-${index}`
        },
        (progress) => {
            const status = document.querySelector(`#batch-row-${index} .batch-row-status`);
            if (status) status.textContent = `${Math.round(progress * 100)}%`;
        }
    )));

    if (currentBatch !== batchRequestId) return;
    let completed = 0;
    results.forEach((result, index) => {
        const row = document.getElementById(`batch-row-${index}`);
        const status = row.querySelector('.batch-row-status');
        if (result.status === 'fulfilled' && result.value.blob) {
            const url = URL.createObjectURL(result.value.blob);
            const download = row.querySelector('.batch-download');
            download.href = url;
            download.download = `compressed-${imageFiles[index].name.replace(/\.[^.]+$/, '')}.jpg`;
            download.hidden = false;
            status.textContent = 'Ready';
            status.className = 'batch-row-status is-ready';
            completed++;
        } else {
            status.textContent = 'Could not process';
            status.className = 'batch-row-status is-error';
        }
    });
    batchTitle.textContent = `${completed} of ${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'} ready`;
    setBatchStatus(completed === imageFiles.length ? 'Ready' : 'Completed with errors', completed === imageFiles.length ? 'ready' : 'error');
    downloadAllButton.hidden = completed === 0;
}

multipleInput.addEventListener('change', () => processMultipleFiles(multipleInput.files));

singleMode.addEventListener('click', () => setMode('single'));
multipleMode.addEventListener('click', () => setMode('multiple'));
downloadAllButton.addEventListener('click', () => {
    const downloads = [...batchList.querySelectorAll('.batch-download:not([hidden])')];
    downloads.forEach((download, index) => {
        setTimeout(() => download.click(), index * 100);
    });
});

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

['dragenter', 'dragover'].forEach((eventName) => {
    multipleDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        multipleDropzone.classList.add('is-dragging');
    });
});

['dragleave', 'drop'].forEach((eventName) => {
    multipleDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        multipleDropzone.classList.remove('is-dragging');
    });
});

multipleDropzone.addEventListener('drop', (event) => processMultipleFiles(event.dataTransfer.files));

compressor.onmessage = (event) => {
    const { blob, error, message, requestId: responseRequestId } = event.data;
    if (responseRequestId !== requestId) return;
    resultPanel.setAttribute('aria-busy', 'false');

    if (error || event.data.type === 'error') {
        setStatus('Could not process', 'error');
        resultTitle.textContent = error || message;
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
