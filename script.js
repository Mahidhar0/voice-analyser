/**
 * APPLICATION STATE
 */
const AppState = {
    mode: 'idle', // 'idle', 'recording', 'playing'
    audioContext: null,
    analyser: null,
    source: null,
    stream: null,
    animationId: null,
    currentPitch: 0,
    
    // Statistics
    pitchSamples: [], 

    // File Playback
    audioElement: null,
    fileLoaded: false,
    fileNode: null
};

/**
 * UI REFERENCES
 */
const UI = {
    btnRecord: document.getElementById('btn-record'),
    iconRecord: document.getElementById('icon-record'),
    textRecord: document.getElementById('text-record'),
    btnUpload: document.getElementById('btn-upload'),
    fileInput: document.getElementById('file-input'),
    btnPlay: document.getElementById('btn-play'),
    iconPlay: document.getElementById('icon-play'),
    textPlay: document.getElementById('text-play'),
    status: document.getElementById('status-indicator'),
    fileInfo: document.getElementById('file-info'),
    viewerGrid: document.getElementById('viewer-grid'),
    spectrogramContainer: document.getElementById('spectrogram-container'),
    spectrogramLabel: document.getElementById('spectrogram-label'),
    waveformCanvas: document.getElementById('waveform-canvas'),
    spectrogramCanvas: document.getElementById('spectrogram-canvas'),
    valIntensity: document.getElementById('val-intensity'),
    barIntensity: document.getElementById('bar-intensity'),
    valPitch: document.getElementById('val-pitch'),
    sumMax: document.getElementById('sum-max'),
    sumMin: document.getElementById('sum-min'),
    sumAvg: document.getElementById('sum-avg'),
    chkSpectrogram: document.getElementById('chk-spectrogram'),
    chkDarkMode: document.getElementById('chk-dark-mode'),
    chkPitch: document.getElementById('chk-pitch'),
    chkFormants: document.getElementById('chk-formants'),
    legendPitch: document.getElementById('legend-pitch'),
    legendFormants: document.getElementById('legend-formants')
};

let waveformChartInstance = null;
let spectroCtx = null;
let spectroWidth = 0;
let spectroHeight = 0;
let timeBuffer;
let freqBuffer;

/**
 * INITIALIZATION
 */
window.addEventListener('load', () => {
    initUI();
    resizeCanvases();
});

window.addEventListener('resize', () => {
    resizeCanvases();
    if (waveformChartInstance) waveformChartInstance.resize();
});

function initUI() {
    UI.btnRecord.addEventListener('click', toggleRecording);
    UI.btnUpload.addEventListener('click', () => UI.fileInput.click());
    UI.fileInput.addEventListener('change', handleFileUpload);
    UI.btnPlay.addEventListener('click', togglePlayback);
    
    // Settings Listeners
    UI.chkSpectrogram.addEventListener('change', updateLayout);
    UI.chkDarkMode.addEventListener('change', updateTheme);
    UI.chkPitch.addEventListener('change', updateOverlays);
    UI.chkFormants.addEventListener('change', updateOverlays);

    // Init Waveform
    const ctx = UI.waveformCanvas.getContext('2d');
    waveformChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(128).fill(''),
            datasets: [{
                data: Array(128).fill(128),
                borderColor: '#38bdf8',
                borderWidth: 1.5,
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                fill: true,
                pointRadius: 0,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { display: false },
                y: { display: false, min: 0, max: 255 }
            },
            layout: { padding: 0 }
        }
    });

    // Init Spectrogram
    spectroCtx = UI.spectrogramCanvas.getContext('2d', { alpha: false });
    updateTheme(); // Set initial theme colors
}

// --- Layout & Theme Helpers ---
function updateLayout() {
    if (UI.chkSpectrogram.checked) {
        UI.viewerGrid.classList.remove('only-waveform');
        UI.spectrogramContainer.classList.remove('hidden');
    } else {
        UI.viewerGrid.classList.add('only-waveform');
        UI.spectrogramContainer.classList.add('hidden');
    }
    setTimeout(resizeCanvases, 305); 
}

function updateTheme() {
    const isDark = UI.chkDarkMode.checked;
    
    // 1. Canvas Background
    const bgColor = isDark ? '#000000' : '#ffffff';
    if(spectroCtx) {
        spectroCtx.fillStyle = bgColor;
        spectroCtx.fillRect(0, 0, spectroWidth, spectroHeight);
    }

    // 2. UI Updates (Labels)
    if (isDark) {
        UI.spectrogramLabel.classList.remove('bg-white/80', 'text-slate-800');
        UI.spectrogramLabel.classList.add('bg-black/60', 'text-pink-400', 'border-white/10');
        
        UI.legendPitch.classList.remove('bg-white/90', 'text-blue-600');
        UI.legendPitch.classList.add('bg-black/50', 'text-yellow-400');
        UI.legendPitch.textContent = "Pitch (Yellow)";
        
        UI.legendFormants.classList.remove('bg-white/90', 'text-red-600');
        UI.legendFormants.classList.add('bg-black/50', 'text-red-400');
    } else {
        UI.spectrogramLabel.classList.add('bg-white/80', 'text-slate-800');
        UI.spectrogramLabel.classList.remove('bg-black/60', 'text-pink-400', 'border-white/10');
        
        UI.legendPitch.classList.add('bg-white/90', 'text-blue-600');
        UI.legendPitch.classList.remove('bg-black/50', 'text-yellow-400');
        UI.legendPitch.textContent = "Pitch (Blue)";
        
        UI.legendFormants.classList.add('bg-white/90', 'text-red-600');
        UI.legendFormants.classList.remove('bg-black/50', 'text-red-400');
    }
}

function updateOverlays() {
    UI.legendPitch.style.display = UI.chkPitch.checked ? 'inline' : 'none';
    UI.legendFormants.style.display = UI.chkFormants.checked ? 'inline' : 'none';
}

function resizeCanvases() {
    const parent = UI.spectrogramContainer;
    if (parent.offsetParent !== null) {
        UI.spectrogramCanvas.width = parent.clientWidth;
        UI.spectrogramCanvas.height = parent.clientHeight;
        spectroWidth = parent.clientWidth;
        spectroHeight = parent.clientHeight;
        
        // Clear to correct theme color
        const isDark = UI.chkDarkMode.checked;
        if(spectroCtx) {
            spectroCtx.fillStyle = isDark ? '#000000' : '#ffffff';
            spectroCtx.fillRect(0, 0, spectroWidth, spectroHeight);
        }
    }
}

function initAudioContext() {
    if (!AppState.audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        AppState.audioContext = new AudioContext();
        
        AppState.analyser = AppState.audioContext.createAnalyser();
        AppState.analyser.fftSize = 2048;
        AppState.analyser.smoothingTimeConstant = 0.5;
        
        timeBuffer = new Uint8Array(AppState.analyser.fftSize);
        freqBuffer = new Uint8Array(AppState.analyser.frequencyBinCount);
    }
    if (AppState.audioContext.state === 'suspended') {
        AppState.audioContext.resume();
    }
}

function stopAllAudio() {
    if (AppState.stream) {
        AppState.stream.getTracks().forEach(t => t.stop());
        AppState.stream = null;
    }
    if (AppState.audioElement) {
        AppState.audioElement.pause();
        AppState.audioElement.currentTime = 0;
    }
    if (AppState.source) {
        AppState.source.disconnect();
        AppState.source = null;
    }
    if (AppState.audioContext && AppState.audioContext.state === 'running') {
        AppState.audioContext.suspend();
    }
    
    if (AppState.animationId) cancelAnimationFrame(AppState.animationId);
    
    calculateSummary();

    AppState.mode = 'idle';
    resetUI();
    
    UI.valIntensity.textContent = "0.0 dB";
    UI.barIntensity.style.width = "0%";
    UI.valPitch.textContent = "-- Hz";
}

function calculateSummary() {
    const samples = AppState.pitchSamples;
    
    if (samples.length > 0) {
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        const sum = samples.reduce((a, b) => a + b, 0);
        const avg = sum / samples.length;
        
        UI.sumMin.textContent = Math.round(min);
        UI.sumMax.textContent = Math.round(max);
        UI.sumAvg.textContent = Math.round(avg);
    } else {
        UI.sumMin.textContent = "--";
        UI.sumMax.textContent = "--";
        UI.sumAvg.textContent = "--";
    }
}

function resetUI() {
    UI.status.textContent = "READY";
    UI.status.className = "text-xs font-mono text-sky-500 font-bold";
    
    UI.textRecord.textContent = "MIC REC";
    UI.iconRecord.classList.replace('bg-white', 'bg-red-500');
    UI.iconRecord.classList.remove('animate-pulse');
    UI.btnRecord.classList.remove('recording-active');

    UI.textPlay.textContent = "PLAY";
    UI.iconPlay.className = "w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-green-400 border-b-[5px] border-b-transparent";
    UI.btnPlay.classList.remove('playing-active');
}

async function toggleRecording() {
    if (AppState.mode === 'recording') {
        stopAllAudio();
    } else {
        if(AppState.mode === 'playing') stopAllAudio();
        await startMic();
    }
}

async function startMic() {
    try {
        UI.status.textContent = "INITIALIZING MIC...";
        initAudioContext();
        
        AppState.pitchSamples = [];
        clearSummaryUI();

        AppState.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        AppState.source = AppState.audioContext.createMediaStreamSource(AppState.stream);
        AppState.source.connect(AppState.analyser);
        
        AppState.mode = 'recording';
        UI.status.textContent = "RECORDING (MIC)";
        UI.status.className = "text-xs font-mono text-red-500 font-bold";
        
        UI.textRecord.textContent = "STOP";
        UI.iconRecord.classList.replace('bg-red-500', 'bg-white');
        UI.iconRecord.classList.add('animate-pulse');
        UI.btnRecord.classList.add('recording-active');

        loop();
    } catch (e) {
        console.error(e);
        alert("Microphone access denied.");
        stopAllAudio();
    }
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (AppState.fileNode) {
        AppState.fileNode.disconnect();
        AppState.fileNode = null;
    }

    const tempAudio = new Audio(URL.createObjectURL(file));
    
    tempAudio.addEventListener('loadedmetadata', () => {
        const duration = tempAudio.duration;
        if (duration > 300) {
            alert("File too long! Please upload a file shorter than 5 minutes.");
            UI.fileInput.value = ""; 
            return;
        }

        AppState.audioElement = tempAudio;
        AppState.fileLoaded = true;
        
        UI.btnPlay.classList.remove('hidden');
        UI.fileInfo.classList.remove('hidden');
        UI.fileInfo.textContent = `${file.name.substring(0, 20)}... (${formatTime(duration)})`;
        UI.status.textContent = "FILE LOADED";
        
        if (AppState.mode === 'recording') stopAllAudio();
    });
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function togglePlayback() {
    if (AppState.mode === 'playing') {
        stopAllAudio();
    } else {
        if(AppState.mode === 'recording') stopAllAudio();
        startFilePlayback();
    }
}

function startFilePlayback() {
    if (!AppState.audioElement) return;

    initAudioContext();
    
    AppState.pitchSamples = [];
    clearSummaryUI();
    
    if (!AppState.fileNode) {
            AppState.fileNode = AppState.audioContext.createMediaElementSource(AppState.audioElement);
    }
    
    AppState.source = AppState.fileNode;
    
    AppState.source.connect(AppState.analyser);
    AppState.analyser.connect(AppState.audioContext.destination);

    AppState.audioElement.play();
    
    AppState.audioElement.onended = () => {
        stopAllAudio(); 
        UI.status.textContent = "FILE ENDED";
    };

    AppState.mode = 'playing';
    UI.status.textContent = "PLAYING FILE";
    UI.status.className = "text-xs font-mono text-green-500 font-bold";
    
    UI.textPlay.textContent = "STOP";
    UI.iconPlay.className = "w-3 h-3 bg-white rounded-sm"; 
    UI.btnPlay.classList.add('playing-active');

    loop();
}

function clearSummaryUI() {
    UI.sumMin.textContent = "--";
    UI.sumMax.textContent = "--";
    UI.sumAvg.textContent = "--";
}

function loop() {
    if (AppState.mode === 'idle') return;
    AppState.animationId = requestAnimationFrame(loop);

    AppState.analyser.getByteTimeDomainData(timeBuffer);
    AppState.analyser.getByteFrequencyData(freqBuffer);

    updateAnalysis();
    updateWaveform();
    updateSpectrogram();
}

function updateWaveform() {
    const step = Math.floor(timeBuffer.length / 128);
    const data = [];
    for (let i = 0; i < 128; i++) {
        data.push(timeBuffer[i * step]);
    }
    waveformChartInstance.data.datasets[0].data = data;
    waveformChartInstance.update('none');
}

function updateSpectrogram() {
    if (!UI.chkSpectrogram.checked || spectroWidth <= 0) return;

    const sliceWidth = 3;
    spectroCtx.drawImage(UI.spectrogramCanvas, -sliceWidth, 0);

    const bins = freqBuffer.length;
    const activeBins = Math.floor(bins * 0.7); 
    const isDark = UI.chkDarkMode.checked;

    for (let i = 0; i < spectroHeight; i++) {
        const percent = 1 - (i / spectroHeight);
        const binIndex = Math.floor(percent * activeBins);
        const value = freqBuffer[binIndex];
        
        if (value > 10) {
            if (isDark) {
                // DARK THEME: Neon Colors (Black BG)
                const r = value;
                const g = value * 0.4;
                const b = value * 0.7;
                spectroCtx.fillStyle = `rgb(${r},${g},${b})`;
            } else {
                // SCIENTIFIC THEME: Grayscale (White BG)
                const darkness = value; 
                const color = 255 - darkness; 
                spectroCtx.fillStyle = `rgb(${color},${color},${color})`;
            }
            spectroCtx.fillRect(spectroWidth - sliceWidth, i, sliceWidth, 1);
        } else {
            spectroCtx.fillStyle = isDark ? '#000000' : '#ffffff';
            spectroCtx.fillRect(spectroWidth - sliceWidth, i, sliceWidth, 1);
        }
    }

    // Overlays
    if (AppState.currentPitch > 0) {
        const maxFreq = AppState.audioContext.sampleRate / 2;
        const pitchY = spectroHeight - ((AppState.currentPitch / (maxFreq * 0.7)) * spectroHeight);

        // Pitch Overlay Color
        if (UI.chkPitch.checked && pitchY > 0 && pitchY < spectroHeight) {
            spectroCtx.fillStyle = isDark ? '#facc15' : '#2563eb'; // Yellow vs Blue
            spectroCtx.fillRect(spectroWidth - sliceWidth, pitchY - 2, sliceWidth, 4); 
        }

        // Formant Overlay Color
        if (UI.chkFormants.checked && pitchY > 0 && pitchY < spectroHeight) {
            const f2 = pitchY - 30; 
            spectroCtx.fillStyle = isDark ? '#f87171' : '#dc2626'; // Light Red vs Dark Red
            spectroCtx.fillRect(spectroWidth - sliceWidth, f2 - 2, sliceWidth, 4); 
        }
    }
}

function updateAnalysis() {
    let sum = 0;
    for(let i=0; i<timeBuffer.length; i++) {
        const x = (timeBuffer[i] - 128) / 128;
        sum += x * x;
    }
    const rms = Math.sqrt(sum / timeBuffer.length);
    const db = 20 * Math.log10(rms);
    
    let displayDb = db + 100;
    if (displayDb < 0) displayDb = 0;
    
    UI.valIntensity.textContent = displayDb.toFixed(1) + " dB";
    const percent = Math.min(100, displayDb);
    UI.barIntensity.style.width = percent + "%";

    AppState.currentPitch = 0; 
    if (displayDb > 40) {
        let cycles = 0;
        for(let i=1; i<timeBuffer.length; i++) {
            if ((timeBuffer[i-1] - 128) < 0 && (timeBuffer[i] - 128) >= 0) {
                cycles++;
            }
        }
        const fundFreq = cycles * (AppState.audioContext.sampleRate / AppState.analyser.fftSize);
        
        if (fundFreq > 50 && fundFreq < 1000) {
            AppState.currentPitch = fundFreq;
            UI.valPitch.textContent = fundFreq.toFixed(0) + " Hz";
            AppState.pitchSamples.push(fundFreq);
        } else {
            UI.valPitch.textContent = "-- Hz";
        }
    } else {
        UI.valPitch.textContent = "-- Hz";
    }
}