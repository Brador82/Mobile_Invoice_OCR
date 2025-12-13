/* ===========================
   MOBILE INVOICE OCR - MAIN APP
   Tesseract.js + Multi-Image Processing (High Contrast)
=========================== */

// Global state
let uploadedImages = [];
let currentPodRow = null;
let currentSigRow = null;
let cameraStream = null;
let podStream = null;
let drawing = false;
let sigCtx = null;
let sigCanvas = null;

/* ===========================
   1. IMAGE PRE-PROCESSING (NEW)
   Converts images to High-Contrast Grayscale for better OCR
=========================== */
function preprocessImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Resize if too large (Max width 1800px)
                const MAX_WIDTH = 1800;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = height * (MAX_WIDTH / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // --- APPLY FILTERS ---
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                const contrast = 100; // High contrast factor
                const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

                for (let i = 0; i < data.length; i += 4) {
                    // Grayscale
                    const gray = (0.299 * data[i]) + (0.587 * data[i + 1]) + (0.114 * data[i + 2]);
                    // Max Contrast
                    let newColor = factor * (gray - 128) + 128;
                    newColor = Math.max(0, Math.min(255, newColor));

                    data[i] = newColor;     // R
                    data[i + 1] = newColor; // G
                    data[i + 2] = newColor; // B
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.onerror = (err) => reject(err);
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/* ===========================
   UTILITY FUNCTIONS
=========================== */
function updateStatus(message = "") {
    const statusMessage = document.getElementById("statusMessage");
    if (statusMessage) statusMessage.textContent = message;
}

function updateRecordCount() {
    const tableBody = document.getElementById("tableBody");
    const count = tableBody?.children.length || 0;
    const countEl = document.getElementById("recordCount");
    if (countEl) {
        countEl.innerHTML = `Total Records: <strong>${count}</strong>`;
    }
}

function updateProgress(current, total) {
    const progressBar = document.getElementById("progressBar");
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");

    if (!progressBar || !progressFill || !progressText) return;
    const percent = Math.round((current / total) * 100);
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `Processing ${current} of ${total} (${percent}%)`;
}

// Appliance options
const applianceOptions = [
    "Washer", "Dryer", "Refrigerator", "Dishwasher", 
    "Freezer", "Range", "Oven", "Microwave", "Stove", "Other"
];

/* ===========================
   DRAG & DROP HANDLER
=========================== */
window.addEventListener("DOMContentLoaded", () => {
    // Initialize Signature Canvas
    initSignaturePad();

    const dropZone = document.getElementById("dropZone");
    if (!dropZone) return;

    ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ["dragenter", "dragover"].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add("drag-over");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove("drag-over");
        }, false);
    });

    dropZone.addEventListener("drop", e => {
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
        if (files.length > 0) {
            handleMultipleFiles(files);
        }
    }, false);

    updateRecordCount();
    updateStatus("Ready. Upload or capture invoice images to begin.");
});

/* ===========================
   FILE UPLOAD HANDLERS
=========================== */
window.addEventListener("DOMContentLoaded", () => {
    const uploadInput = document.getElementById("uploadInput");
    if (uploadInput) {
        uploadInput.addEventListener("change", e => {
            const files = Array.from(e.target.files).filter(f => f.type.startsWith("image/"));
            if (files.length > 0) {
                handleMultipleFiles(files);
            }
            e.target.value = ""; // Reset input
        });
    }
});

// UPDATED: Now uses preprocessImage
async function handleMultipleFiles(files) {
    const previewGallery = document.getElementById("previewGallery");
    const processBtn = document.getElementById("processBtn");

    updateStatus(`Preprocessing ${files.length} image(s)...`);
    uploadedImages = [];
    if (previewGallery) previewGallery.innerHTML = "";

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Apply High Contrast / Grayscale
            const processedDataUrl = await preprocessImage(file);

            uploadedImages.push({
                dataUrl: processedDataUrl,
                fileName: file.name,
                index: i
            });

            // Add preview thumbnail
            if (previewGallery) {
                const previewDiv = document.createElement("div");
                previewDiv.className = "preview-item";
                previewDiv.innerHTML = `
                    <img src="${processedDataUrl}" alt="Processed Invoice ${i + 1}" onclick="expandImage('${processedDataUrl}')">
                    <span class="preview-label">${i + 1}. ${file.name}</span>
                `;
                previewGallery.appendChild(previewDiv);
            }
        }

        if (processBtn) processBtn.disabled = false;
        updateStatus(`${files.length} image(s) optimized & ready for OCR.`);

    } catch (error) {
        console.error("Preprocessing failed", error);
        updateStatus("Error processing images.");
    }
}

/* ===========================
   CAMERA CAPTURE (Main Invoice)
=========================== */
async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
        updateStatus("Camera not supported. Using upload instead.");
        document.getElementById("uploadInput").click();
        return;
    }

    try {
        if (cameraStream) stopStream(cameraStream);
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false
        });
        const modal = document.getElementById("cameraModal");
        const video = document.getElementById("cameraVideo");
        video.srcObject = cameraStream;
        await video.play();
        modal.style.display = "flex";
        updateStatus("Camera ready – tap Capture.");
    } catch (err) {
        console.error("Camera error", err);
        updateStatus("Camera permission denied. Using upload instead.");
        document.getElementById("uploadInput").click();
    }
}

function captureInvoiceImage() {
    const video = document.getElementById("cameraVideo");
    const canvas = document.getElementById("cameraCanvas");
    if (!video.videoWidth) {
        updateStatus("Camera still initializing – try again.");
        return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");

    // Convert to file and handle (this will trigger preprocessing)
    const file = dataURLtoFile(dataUrl, `camera-capture-${Date.now()}.png`);
    handleMultipleFiles([file]);

    closeCameraModal();
}

function closeCameraModal() {
    const modal = document.getElementById("cameraModal");
    modal.style.display = "none";
    if (cameraStream) {
        stopStream(cameraStream);
        cameraStream = null;
    }
}

function stopStream(stream) {
    stream?.getTracks().forEach(track => track.stop());
}

function dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, {type: mime});
}

/* ===========================
   TESSERACT.JS OCR PROCESSING
=========================== */
async function processBatchOCR() {
    const processBtn = document.getElementById("processBtn");
    const progressBar = document.getElementById("progressBar");
    const previewGallery = document.getElementById("previewGallery");

    if (uploadedImages.length === 0) {
        updateStatus("No images to process.");
        alert("Please upload or capture images first.");
        return;
    }

    if (processBtn) processBtn.disabled = true;
    if (progressBar) progressBar.style.display = "block";
    updateStatus("Starting OCR processing...");

    try {
        const worker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    // console.log(`Progress: ${Math.round(m.progress * 100)}%`);
                }
            }
        });

        for (let i = 0; i < uploadedImages.length; i++) {
            const img = uploadedImages[i];
            updateProgress(i + 1, uploadedImages.length);
            updateStatus(`Scanning invoice ${i + 1} of ${uploadedImages.length}...`);

            try {
                // Tesseract now reads the High-Contrast image
                const { data: { text } } = await worker.recognize(img.dataUrl);

                const invoiceData = extractInvoiceData(text);
                invoiceData.image = img.dataUrl;
                invoiceData.rawText = text;

                addInvoiceRow(invoiceData);

            } catch (err) {
                console.error(`Error processing image ${i + 1}:`, err);
                updateStatus(`Error processing image ${i + 1}`);
            }
        }

        await worker.terminate();

        if (progressBar) progressBar.style.display = "none";
        updateStatus(`✅ Processed ${uploadedImages.length} invoices!`);
        updateRecordCount();

        uploadedImages = [];
        if (previewGallery) previewGallery.innerHTML = "";
        if (processBtn) processBtn.disabled = true;

    } catch (error) {
        console.error("OCR error", error);
        if (progressBar) progressBar.style.display = "none";
        updateStatus("OCR failed – please retry.");
        if (processBtn) processBtn.disabled = false;
    }
}

/* ===========================
   DATA EXTRACTION LOGIC
=========================== */
function extractInvoiceData(text) {
    const data = {
        invoiceNumber: extractInvoiceNumber(text),
        name: extractName(text),
        address: extractAddress(text),
        phone: extractPhone(text),
        items: extractItems(text),
        total: extractTotal(text),
        date: extractDate(text)
    };
    return data;
}

function extractInvoiceNumber(text) {
    const patterns = [
        /INVOICE[\s\n]+([A-Z0-9]{8,})/i,
        /Invoice[\s#:]+([A-Z0-9\-]{6,})/i,
        /INV[\s#:]+([A-Z0-9\-]{6,})/i,
        /#\s?(\d{4,})/
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].trim();
    }
    return "";
}

function extractName(text) {
    const patterns = [
        /Name[:\s]+([A-Za-z\s]+?)(?:\s+\(ID:|ID:|\n|Phone)/i,
        /BILL TO[:\s\n]*([A-Za-z]+ [A-Za-z]+)/i,
        /Customer[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].trim();
    }
    return "";
}

function extractAddress(text) {
    // Basic heuristics for address blocks
    const patterns = [
        /Address[:\s]*([^\n]+(?:\n[^Phone]+)?(?=Phone|$))/i,
        /(\d+\s+[A-Za-z\s]+(?:St|Ave|Rd|Blvd|Dr|Ln|Ct)[^\n]*\d{5})/i
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].replace(/\n/g, " ").trim();
    }
    return "";
}

function extractPhone(text) {
    const patterns = [
        /Phone[:\s]*(\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4})/i,
        /(\d{3}[\-\s]?\d{3}[\-\s]?\d{4})/
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].trim();
    }
    return "";
}

function extractItems(text) {
    const items = [];
    const itemPatterns = /\b(Washer|Dryer|Refrigerator|Dishwasher|Freezer|Range|Oven|Microwave|Stove)\b/gi;
    let match;
    while ((match = itemPatterns.exec(text)) !== null) {
        const item = match[1];
        if (!items.includes(item)) items.push(item);
    }
    return items.length > 0 ? items.join(", ") : "";
}

function extractTotal(text) {
    const patterns = [
        /Total[:\s]*\$?[\s]*(\d+(?:[\.,]\d{2})?)/i,
        /\$[\s]*(\d+\.\d{2})(?:\s*$)/
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1];
    }
    return "";
}

function extractDate(text) {
    const patterns = [
        /(\d{1,2}\/\d{1,2}\/\d{2,4})/
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1];
    }
    return "";
}

/* ===========================
   TABLE MANAGEMENT
=========================== */
function addInvoiceRow(data) {
    const tableBody = document.getElementById("tableBody");
    const row = document.createElement("tr");

    // 1. Invoice #
    const invoiceCell = document.createElement("td");
    invoiceCell.textContent = data.invoiceNumber || "N/A";
    row.appendChild(invoiceCell);

    // 2. Name
    const nameCell = document.createElement("td");
    nameCell.textContent = data.name || "Unknown";
    row.appendChild(nameCell);

    // 3. Address (Fixed Google Maps Link)
    const addressCell = document.createElement("td");
    const addressLink = document.createElement("a");
    const resolvedAddress = data.address || "";
    // FIXED LINK HERE:
    addressLink.href = resolvedAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedAddress)}`
        : "#";
    addressLink.textContent = resolvedAddress || "Unknown";
    addressLink.target = "_blank";
    addressCell.appendChild(addressLink);
    row.appendChild(addressCell);

    // 4. Phone
    const phoneCell = document.createElement("td");
    const phoneLink = document.createElement("a");
    const cleanPhone = (data.phone || "").replace(/\D/g, "");
    phoneLink.href = cleanPhone ? `tel:${cleanPhone}` : "#";
    phoneLink.textContent = data.phone || "Unknown";
    phoneCell.appendChild(phoneLink);
    row.appendChild(phoneCell);

    // 5. Items
    const itemsCell = document.createElement("td");
    itemsCell.appendChild(createItemsSelect(data.items));
    row.appendChild(itemsCell);

    // 6. POD
    const podCell = document.createElement("td");
    const podBtn = document.createElement("button");
    podBtn.textContent = "📸 Capture";
    podBtn.className = "btn-cell";
    podBtn.onclick = () => openPodCamera(row);
    podCell.appendChild(podBtn);
    row.appendChild(podCell);

    // 7. Signature
    const sigCell = document.createElement("td");
    const sigBtn = document.createElement("button");
    sigBtn.textContent = "✍️ Sign";
    sigBtn.className = "btn-cell";
    sigBtn.onclick = () => openSignature(row);
    sigCell.appendChild(sigBtn);
    row.appendChild(sigCell);

    // 8. Notes
    const notesCell = document.createElement("td");
    const notes = document.createElement("input");
    notes.type = "text";
    notes.placeholder = "Driver notes...";
    notes.className = "notes-input";
    notesCell.appendChild(notes);
    row.appendChild(notesCell);

    // 9. Actions
    const actionCell = document.createElement("td");
    const actionDiv = document.createElement("div");
    actionDiv.className = "action-buttons";

    const viewBtn = document.createElement("button");
    viewBtn.textContent = "👁️";
    viewBtn.onclick = () => expandImage(data.image);

    const delBtn = document.createElement("button");
    delBtn.textContent = "🗑️";
    delBtn.className = "btn-delete";
    delBtn.onclick = () => {
        if (confirm("Delete this record?")) {
            row.remove();
            updateRecordCount();
        }
    };

    actionDiv.appendChild(viewBtn);
    actionDiv.appendChild(delBtn);
    actionCell.appendChild(actionDiv);
    row.appendChild(actionCell);

    row.dataset.invoiceData = JSON.stringify(data);
    tableBody.appendChild(row);
}

function createItemsSelect(preSelectedItems = "") {
    const container = document.createElement("div");
    container.className = "items-select-container";

    const displayDiv = document.createElement("div");
    displayDiv.className = "items-display";
    displayDiv.textContent = preSelectedItems || "Select items...";

    const dropdown = document.createElement("div");
    dropdown.className = "items-dropdown";
    dropdown.style.display = "none";

    const selectedItems = preSelectedItems ? preSelectedItems.split(", ") : [];

    applianceOptions.forEach(option => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = option;
        checkbox.checked = selectedItems.includes(option);

        checkbox.addEventListener("change", () => {
            const checked = Array.from(dropdown.querySelectorAll("input:checked")).map(cb => cb.value);
            displayDiv.textContent = checked.length > 0 ? checked.join(", ") : "Select items...";
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(" " + option));
        dropdown.appendChild(label);
    });

    displayDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        const allDropdowns = document.querySelectorAll(".items-dropdown");
        allDropdowns.forEach(d => { if(d !== dropdown) d.style.display = "none"; });
        dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
    });

    document.addEventListener("click", () => {
        dropdown.style.display = "none";
    });

    container.appendChild(displayDiv);
    container.appendChild(dropdown);
    return container;
}

/* ===========================
   POD CAMERA
=========================== */
async function openPodCamera(row) {
    currentPodRow = row;
    const modal = document.getElementById("podModal");
    modal.style.display = "flex";

    if (!navigator.mediaDevices?.getUserMedia) {
        alert("Camera not supported on this device.");
        return;
    }

    try {
        if (podStream) stopStream(podStream);
        podStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false
        });
        const v = document.getElementById("podVideo");
        v.srcObject = podStream;
        await v.play();
    } catch (err) {
        console.error("POD camera error", err);
        alert("Unable to access camera.");
        closePodModal();
    }
}

function capturePOD() {
    const video = document.getElementById("podVideo");
    const canvas = document.getElementById("podCanvas");
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    canvas.getContext("2d").drawImage(video, 0, 0);

    const img = new Image();
    img.src = canvas.toDataURL("image/png");
    img.className = "pod-thumbnail";
    img.onclick = () => expandImage(img.src);

    // Replace button with image
    const cell = currentPodRow.children[5]; // 6th column
    cell.innerHTML = "";
    cell.appendChild(img);

    closePodModal();
}

function closePodModal() {
    document.getElementById("podModal").style.display = "none";
    if (podStream) {
        stopStream(podStream);
        podStream = null;
    }
}

/* ===========================
   SIGNATURE PAD
=========================== */
function initSignaturePad() {
    sigCanvas = document.getElementById("sigCanvas");
    if (!sigCanvas) return;
    
    sigCtx = sigCanvas.getContext("2d");
    
    // Resize canvas to fit modal width
    sigCanvas.width = 300;
    sigCanvas.height = 150;

    // Mouse events
    sigCanvas.addEventListener("mousedown", startDrawing);
    sigCanvas.addEventListener("mouseup", stopDrawing);
    sigCanvas.addEventListener("mousemove", draw);

    // Touch events
    sigCanvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        startDrawing(e.touches[0]);
    });
    sigCanvas.addEventListener("touchend", (e) => {
        e.preventDefault();
        stopDrawing();
    });
    sigCanvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        draw(e.touches[0]);
    });
}

function startDrawing(e) {
    drawing = true;
    sigCtx.beginPath();
    const rect = sigCanvas.getBoundingClientRect();
    sigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function stopDrawing() {
    drawing = false;
    sigCtx.closePath();
}

function draw(e) {
    if (!drawing) return;
    const rect = sigCanvas.getBoundingClientRect();
    sigCtx.lineWidth = 2;
    sigCtx.lineCap = "round";
    sigCtx.strokeStyle = "#000";
    sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    sigCtx.stroke();
}

function openSignature(row) {
    currentSigRow = row;
    const modal = document.getElementById("sigModal");
    modal.style.display = "flex";
    clearSig(); // Reset canvas for new sign
}

function clearSig() {
    if (sigCtx && sigCanvas) {
        sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    }
}

function saveSig() {
    if (!currentSigRow) return;
    
    const dataUrl = sigCanvas.toDataURL("image/png");
    const img = new Image();
    img.src = dataUrl;
    img.className = "sig-thumbnail";
    
    // Replace button with signature image
    const cell = currentSigRow.children[6]; // 7th column
    cell.innerHTML = "";
    cell.appendChild(img);
    
    closeSigModal();
}

function closeSigModal() {
    document.getElementById("sigModal").style.display = "none";
}

/* ===========================
   IMAGE PREVIEW MODAL
=========================== */
function expandImage(src) {
    const modal = document.getElementById("imageModal");
    const expanded = document.getElementById("expandedImage");
    expanded.src = src;
    modal.style.display = "flex";
}

function closeImageModal() {
    document.getElementById("imageModal").style.display = "none";
}

/* ===========================
   EXPORT FUNCTIONS
=========================== */
function clearLog() {
    if (confirm("Are you sure you want to clear all records?")) {
        document.getElementById("tableBody").innerHTML = "";
        updateRecordCount();
    }
}

// Placeholder export functions
function exportCSV() { alert("CSV Export logic goes here."); }
function exportExcel() { alert("Excel Export logic goes here."); }
function exportJSON() { alert("JSON Export logic goes here."); }
function shareData() { alert("Share logic goes here."); }