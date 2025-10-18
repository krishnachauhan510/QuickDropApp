// --- 1. Supabase Setup ---
// IMPORTANT: Replace with your Supabase project's URL and Anon Key
const supabaseUrl = 'YOUR_SUPABASE_URL'; 
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

// --- DO NOT EDIT BELOW THIS LINE (unless you know what you're doing) ---

const { createClient } = supabase;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// DOM Elements
const views = {
    upload: document.getElementById('upload-view'),
    link: document.getElementById('link-view'),
    download: document.getElementById('download-view'),
    error: document.getElementById('error-view'),
    loading: document.getElementById('loading-view'),
};

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileNameDisplay = document.getElementById('file-name');
const uploadOptions = document.getElementById('upload-options');
const uploadButton = document.getElementById('upload-button');
const progressWrapper = document.getElementById('progress-wrapper');
const progressText = document.getElementById('progress-text');

const shareLinkInput = document.getElementById('share-link');
const copyButton = document.getElementById('copy-button');
const copyFeedback = document.getElementById('copy-feedback');
const uploadAnotherButton = document.getElementById('upload-another-button');

const passwordPrompt = document.getElementById('password-prompt');
const fileDetails = document.getElementById('file-details');
const downloadPasswordInput = document.getElementById('download-password');
const passwordSubmitButton = document.getElementById('password-submit-button');
const passwordError = document.getElementById('password-error');
const downloadFileName = document.getElementById('download-file-name');
const downloadFileSize = document.getElementById('download-file-size');
const downloadButton = document.getElementById('download-button');
const downloadTimer = document.getElementById('download-timer');

const errorHomeButton = document.getElementById('error-home-button');
const errorTitle = document.getElementById('error-title');
const errorMessage = document.getElementById('error-message');

let selectedFile = null;
let countdownInterval = null;

// --- UTILITY FUNCTIONS ---
const switchView = (viewName) => {
    Object.values(views).forEach(v => v.classList.remove('active'));
    if (views[viewName]) {
        views[viewName].classList.add('active');
    }
};

const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// --- ROUTER ---
const handleRouteChange = async () => {
    const hash = window.location.hash;
    clearInterval(countdownInterval);

    if (hash.startsWith('#download/')) {
        const docId = hash.substring(10);
        await loadDownloadPage(docId);
    } else if (hash.startsWith('#success/')) {
        const docId = hash.substring(9);
        loadLinkPage(docId);
    } else {
        resetUploadView();
        switchView('upload');
    }
};

// --- UPLOAD LOGIC ---
const resetUploadView = () => {
    selectedFile = null;
    fileInput.value = '';
    fileNameDisplay.textContent = '';
    uploadOptions.classList.add('hidden');
    progressWrapper.classList.add('hidden');
    uploadButton.disabled = true;
    document.getElementById('password').value = '';
    document.getElementById('one-time-download').checked = false;
};

const handleFileSelect = (file) => {
    if (!file) return;
    selectedFile = file;
    fileNameDisplay.textContent = file.name;
    uploadOptions.classList.remove('hidden');
    uploadButton.disabled = false;
};

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
});

['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('dropzone-active'));
});

['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('dropzone-active'));
});

dropzone.addEventListener('drop', (e) => {
    handleFileSelect(e.dataTransfer.files[0]);
});

uploadButton.addEventListener('click', async () => {
    if (!selectedFile) return;

    // Validate Supabase credentials
    if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL' || !supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
        showError("Configuration Error", "Supabase URL or Anon Key is missing. Please check the app.js file.");
        return;
    }

    uploadButton.disabled = true;
    uploadOptions.classList.add('hidden');
    progressWrapper.classList.remove('hidden');

    const expirationSeconds = parseInt(document.getElementById('expiration').value, 10);
    const password = document.getElementById('password').value;
    const oneTimeDownload = document.getElementById('one-time-download').checked;
    
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000).toISOString();
    const uniqueId = generateUUID();
    const storagePath = `${uniqueId}/${selectedFile.name}`;

    try {
        // 1. Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('files')
            .upload(storagePath, selectedFile);

        if (uploadError) {
            throw uploadError;
        }

        // 2. Create a record in the Supabase database
        const { error: dbError } = await supabase
            .from('files')
            .insert({
                id: uniqueId,
                original_name: selectedFile.name,
                size: selectedFile.size,
                expires_at: expiresAt,
                password: password || null,
                one_time_download: oneTimeDownload,
                storage_path: storagePath
            });

        if (dbError) {
            throw dbError;
        }

        window.location.hash = `#success/${uniqueId}`;
    } catch (error) {
        console.error("Upload process failed:", error);
        showError("Operation Failed", `Could not upload file: ${error.message}`);
    }
});


// --- LINK PAGE LOGIC ---
const loadLinkPage = (docId) => {
    const link = `${window.location.origin}${window.location.pathname}#download/${docId}`;
    shareLinkInput.value = link;
    switchView('link');
};

copyButton.addEventListener('click', () => {
    shareLinkInput.select();
    document.execCommand('copy');
    copyFeedback.textContent = 'Link copied!';
    copyButton.querySelector('span').textContent = 'Copied!';
    setTimeout(() => {
        copyFeedback.textContent = '';
        copyButton.querySelector('span').textContent = 'Copy Link';
    }, 2000);
});

uploadAnotherButton.addEventListener('click', () => {
    window.location.hash = '';
});

errorHomeButton.addEventListener('click', () => {
    window.location.hash = '';
});

// --- DOWNLOAD PAGE LOGIC ---
const loadDownloadPage = async (docId) => {
    switchView('loading');

    const { data: fileData, error } = await supabase
        .from('files')
        .select('*')
        .eq('id', docId)
        .single();
    
    if (error || !fileData) {
        showError("Not Found", "This file does not exist or has been deleted.");
        return;
    }

    const now = new Date();
    const expires = new Date(fileData.expires_at);

    if (expires < now) {
        showError("Link Expired", "This file is no longer available.");
        await supabase.storage.from('files').remove([fileData.storage_path]);
        await supabase.from('files').delete().eq('id', docId);
        return;
    }

    if (fileData.password) {
        fileDetails.classList.add('hidden');
        passwordPrompt.classList.remove('hidden');
        switchView('download');

        const handlePasswordSubmit = () => {
            const enteredPassword = downloadPasswordInput.value;
            if (enteredPassword === fileData.password) {
                passwordPrompt.classList.add('hidden');
                fileDetails.classList.remove('hidden');
                renderFileDetails(docId, fileData);
            } else {
                passwordError.textContent = 'Incorrect password. Please try again.';
                setTimeout(() => passwordError.textContent = '', 3000);
            }
        }
        
        passwordSubmitButton.onclick = handlePasswordSubmit;
        downloadPasswordInput.onkeydown = (e) => {
            if (e.key === 'Enter') handlePasswordSubmit();
        };

    } else {
        passwordPrompt.classList.add('hidden');
        fileDetails.classList.remove('hidden');
        renderFileDetails(docId, fileData);
        switchView('download');
    }
};

const renderFileDetails = (docId, fileData) => {
    downloadFileName.textContent = fileData.original_name;
    downloadFileSize.textContent = formatBytes(fileData.size);

    const updateTimer = () => {
        const now = new Date();
        const expires = new Date(fileData.expires_at);
        const remaining = expires - now;

        if (remaining <= 0) {
            downloadTimer.textContent = 'Link has expired.';
            clearInterval(countdownInterval);
            downloadButton.classList.add('disabled');
        } else {
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
            downloadTimer.textContent = `Link expires in ${hours}h ${minutes}m ${seconds}s`;
        }
    };
    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);

    const { data: { publicUrl } } = supabase
        .storage
        .from('files')
        .getPublicUrl(fileData.storage_path);
    
    downloadButton.href = publicUrl;
    // Add download attribute to force download instead of navigating
    downloadButton.setAttribute('download', fileData.original_name);

    if (fileData.one_time_download) {
        downloadButton.onclick = async () => {
            // Give the browser a moment to start the download
            setTimeout(async () => {
                await supabase.storage.from('files').remove([fileData.storage_path]);
                await supabase.from('files').delete().eq('id', docId);
                showError("Download Started", "This link has now been destroyed.");
            }, 1000);
        };
    }
};

// --- ERROR HANDLING ---
const showError = (title, message) => {
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    switchView('error');
};

// --- INITIALIZATION ---
window.addEventListener('hashchange', handleRouteChange);
window.addEventListener('load', handleRouteChange);

