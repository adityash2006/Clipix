import { saveDownload } from './history.js';

const input = document.getElementById('pic');
const dropzone = document.getElementById('dropzone');
const resultPanel = document.getElementById('result-panel');
const resultTitle = document.getElementById('result-title');
const statusPill = document.getElementById('status-pill');
const resultImage = document.getElementById('result-image');
const emptyPreview = document.getElementById('empty-preview');
const processingArt = document.getElementById('processing-art');
const processingCaption = document.getElementById('processing-caption');
const resultMeta = document.getElementById('result-meta');
const fileName = document.getElementById('file-name');
const downloadLink = document.getElementById('download-link');
const errorMessage = document.getElementById('error-message');
const wrap = document.getElementById('progress-wrap');
const label = document.getElementById('progress-label');
const bar = document.getElementById('dl');

let bg;
let resultUrl;
let resultBlob;
let sourceFile;
let requestId = 0;
let pencilAnimation;

function setStatus(text, state = '') {
    statusPill.textContent = text;
    statusPill.className = `status-pill${state ? ` is-${state}` : ''}`;
}

function updateBar({ phase, fraction = 0 }) {
    wrap.hidden = false;
    processingArt.hidden = false;
    emptyPreview.hidden = true;
    if (phase === 'download') {
        label.textContent = `Downloading model… ${Math.round(fraction * 100)}%`;
        processingCaption.textContent = `Downloading model… ${Math.round(fraction * 100)}%`;
        bar.value = fraction;
    } else {
        label.textContent = 'Removing background…';
        processingCaption.textContent = 'Removing background…';
        bar.removeAttribute('value');
    }
}

function hideBar() {
    wrap.hidden = true;
    bar.value = 0;
    processingArt.hidden = true;
    pencilAnimation?.cancel();
    pencilAnimation = null;
}
function startProcessingAnimation() {
    pencilAnimation?.cancel();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const pencil = document.querySelector('.floating-pencil');
    if (!pencil) return;

    // Adjust if your pencil art points a different way (0 = tip points right)
    const TIP_OFFSET = 0;

    const clockwise = Math.random() > 0.5;
    const offset = Math.floor(Math.random() * 4);
    const corners = [
        { left: '8%',  top: '8%'  },
        { left: '92%', top: '8%'  },
        { left: '92%', top: '92%' },
        { left: '8%',  top: '92%' }
    ];
    const baseRoute = clockwise ? corners : [...corners].reverse();
    const route = Array.from({ length: 4 }, (_, i) => baseRoute[(i + offset) % 4]);
    route.push(route[0]);

    // Point along the direction of travel, turning 90° at each corner
    const step = clockwise ? 90 : -90;
    const startHeading = clockwise
        ? [0, 90, 180, 270][offset]
        : [180, 90, 0, 270][offset];

    const keyframes = route.map((point, index, points) => ({
        left: point.left,
        top: point.top,
        transform: `translate(-50%, -50%) rotate(${TIP_OFFSET + startHeading + index * step}deg)`,
        offset: index / (points.length - 1)
    }));

    pencilAnimation = pencil.animate(keyframes, {
        duration: 9000 + Math.random() * 4000,
        easing: 'linear',
        iterations: Infinity
    });
}

async function loadBgModule() {
    if (!bg) bg = await import('./workers/bgRemover.js');
    return bg;
}

async function removeBackground(file) {
    sourceFile = file;
    const currentRequest = ++requestId;
    errorMessage.hidden = true;
    resultPanel.setAttribute('aria-busy', 'true');
    resultMeta.hidden = true;
    resultImage.hidden = true;
    emptyPreview.hidden = true;
    processingArt.hidden = false;
    processingCaption.textContent = 'Preparing the model…';
    startProcessingAnimation();
    resultTitle.textContent = `Removing the background from ${file.name}`;
    setStatus('Working', 'processing');

    try {
        const module = await loadBgModule();
        const blob = await module.removeBg(file, updateBar);
        if (currentRequest !== requestId) return;

        if (resultUrl) URL.revokeObjectURL(resultUrl);
        resultBlob = blob;
        resultUrl = URL.createObjectURL(blob);
        resultImage.src = resultUrl;
        resultImage.hidden = false;
        emptyPreview.hidden = true;
        resultTitle.textContent = 'Your background-free image is ready';
        fileName.textContent = file.name.replace(/\.[^.]+$/, '') + '.png';
        downloadLink.href = resultUrl;
        downloadLink.download = fileName.textContent;
        resultMeta.hidden = false;
        setStatus('Ready', 'ready');
        processingArt.hidden = true;
    } catch (error) {
        if (currentRequest !== requestId) return;
        resultTitle.textContent = 'Background removal failed';
        errorMessage.textContent = error instanceof Error ? error.message : 'Could not process that image. Please try again.';
        errorMessage.hidden = false;
        setStatus('Error', 'error');
        processingArt.hidden = true;
    } finally {
        if (currentRequest === requestId) {
            hideBar();
            resultPanel.setAttribute('aria-busy', 'false');
        }
    }

}

downloadLink.addEventListener('click', () => {
    if (!resultBlob || !sourceFile) return;
    saveDownload({
        operation: 'remove-background',
        sizes: { before: sourceFile.size, after: resultBlob.size },
        format: resultBlob.type,
        result: resultBlob
    }).catch((error) => {
        setStatus('Could not save', 'error');
        errorMessage.textContent = 'Could not save this download to history.';
        errorMessage.hidden = false;
        console.error('Could not save download history:', error);
    });
});

function processFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        errorMessage.textContent = 'Choose a JPG, PNG, or WebP image.';
        errorMessage.hidden = false;
        setStatus('Choose an image', 'error');
        return;
    }
    removeBackground(file);
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
