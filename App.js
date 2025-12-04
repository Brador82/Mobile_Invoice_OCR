/* ===========================
   MOBILE INVOICE OCR - MAIN APP
   Tesseract.js + Multi-Image Processing
=========================== */

// Global state
let uploadedImages = [];
let currentPodRow = null;
let currentSigRow = null;
let cameraStream = null;
let podStream = null;
let drawing = false;
let sigCtx, sigPad;

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

// Appliance options for dropdown
const applianceOptions = [
    "Washer",
    "Dryer",
    "Refrigerator",
    "Dishwasher",
    "Freezer",
    "Range",
    "Oven",
    "Microwave",
    "Stove",
    "Other"
];

/* ===========================
   DRAG & DROP HANDLER
=========================== */
window.addEventListener("DOMContentLoaded", () => {
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
    
    // Initialize
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

function handleMultipleFiles(files) {
    const previewGallery = document.getElementById("previewGallery");
    const processBtn = document.getElementById("processBtn");
    
    updateStatus(`Loading ${files.length} image(s)...`);
    uploadedImages = [];
    if (previewGallery) previewGallery.innerHTML = "";
    
    let loaded = 0;
    files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = ev => {
            uploadedImages.push({
                dataUrl: ev.target.result,
                fileName: file.name,
                index: index
            });
            
            // Add preview thumbnail
            if (previewGallery) {
                const previewDiv = document.createElement("div");
                previewDiv.className = "preview-item";
                previewDiv.innerHTML = `
                    <img src="${ev.target.result}" alt="Invoice ${index + 1}" onclick="expandImage('${ev.target.result}')">
                    <span class="preview-label">${index + 1}. ${file.name}</span>
                `;
                previewGallery.appendChild(previewDiv);
            }
            
            loaded++;
            if (loaded === files.length) {
                if (processBtn) processBtn.disabled = false;
                updateStatus(`${files.length} image(s) ready for OCR processing.`);
            }
        };
        reader.readAsDataURL(file);
    });
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
    
    // Add to uploaded images
    handleMultipleFiles([dataURLtoFile(dataUrl, `camera-capture-${Date.now()}.png`)]);
    
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

// Convert data URL to File object
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
        // Initialize Tesseract worker
        const worker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    console.log(`Progress: ${Math.round(m.progress * 100)}%`);
                }
            }
        });

        for (let i = 0; i < uploadedImages.length; i++) {
            const img = uploadedImages[i];
            updateProgress(i + 1, uploadedImages.length);
            updateStatus(`Processing invoice ${i + 1} of ${uploadedImages.length}...`);

            try {
                // Perform OCR
                const { data: { text } } = await worker.recognize(img.dataUrl);
                
                // Extract invoice data
                const invoiceData = extractInvoiceData(text);
                invoiceData.image = img.dataUrl;
                invoiceData.rawText = text;
                
                // Add row to table
                addInvoiceRow(invoiceData);
                
            } catch (err) {
                console.error(`Error processing image ${i + 1}:`, err);
                updateStatus(`Error processing image ${i + 1}`);
            }
        }

        await worker.terminate();
        
        if (progressBar) progressBar.style.display = "none";
        updateStatus(`✅ Successfully processed ${uploadedImages.length} invoice(s)!`);
        updateRecordCount();
        
        // Clear uploaded images
        uploadedImages = [];
        if (previewGallery) previewGallery.innerHTML = "";
        if (processBtn) processBtn.disabled = true;

    } catch (error) {
        console.error("OCR error", error);
        if (progressBar) progressBar.style.display = "none";
        updateStatus("OCR failed – please retry.");
        alert("OCR processing failed. Check console for details.");
        if (processBtn) processBtn.disabled = false;
    }
}

/* ===========================
   DATA EXTRACTION FROM OCR TEXT
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
    
    console.log("Extracted data:", data);
    return data;
}

function extractInvoiceNumber(text) {
    const patterns = [
        /INVOICE[\s\n]+([A-Z0-9]{8,})/i,
        /Invoice[\s#:]+([A-Z0-9\-]{6,})/i,
        /INV[\s#:]+([A-Z0-9\-]{6,})/i
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
        /BILL TO[:\s]*Name[:\s]+([^\(\n]+)/i,
        /Customer[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].trim();
    }
    return "";
}

function extractAddress(text) {
    const patterns = [
        /Address[:\s]*([^\n]+(?:\n[^Phone]+)?(?=Phone|$))/i,
        /Address[:\s]+([0-9]+[^\n]+[A-Z]{2}[\s,]+\d{5})/i,
        /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct)[^\n]*[A-Z]{2}\s+\d{5})/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].replace(/\n/g, " ").trim();
    }
    return "";
}

function extractPhone(text) {
    const patterns = [
        /Phone[:\s]*(\+?1?[\s\-\.]?\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4})/i,
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
        if (!items.includes(item)) {
            items.push(item);
        }
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
        /(\d{1,2}\/\d{1,2}\/\d{2,4}[\s,]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)/i,
        /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
        /(\d{4}-\d{2}-\d{2})/
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1];
    }
    return "";
}

/* ===========================
   ADD ROW TO TABLE
=========================== */
function addInvoiceRow(data) {
    const tableBody = document.getElementById("tableBody");
    const row = document.createElement("tr");

    // Column 1: Invoice Number
    const invoiceCell = document.createElement("td");
    invoiceCell.textContent = data.invoiceNumber || "N/A";
    invoiceCell.className = "invoice-number";
    row.appendChild(invoiceCell);

    // Column 2: Name
    const nameCell = document.createElement("td");
    nameCell.textContent = data.name || "Unknown";
    nameCell.className = "customer-name";
    row.appendChild(nameCell);

    // Column 3: Address (clickable Google Maps link)
    const addressCell = document.createElement("td");
    const addressLink = document.createElement("a");
    const resolvedAddress = data.address || "";
    addressLink.href = resolvedAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedAddress)}`
        : "#";
    addressLink.textContent = resolvedAddress || "Unknown";
    addressLink.target = "_blank";
    addressLink.className = "address-link";
    addressCell.appendChild(addressLink);
    row.appendChild(addressCell);

    // Column 4: Phone (clickable tel: link)
    const phoneCell = document.createElement("td");
    const phoneLink = document.createElement("a");
    const cleanPhone = (data.phone || "").replace(/\D/g, "");
    phoneLink.href = cleanPhone ? `tel:${cleanPhone}` : "#";
    phoneLink.textContent = data.phone || "Unknown";
    phoneLink.target = "_self";
    phoneLink.className = "phone-link";
    phoneCell.appendChild(phoneLink);
    row.appendChild(phoneCell);

    // Column 5: Items (Multi-select dropdown)
    const itemsCell = document.createElement("td");
    const itemsSelect = createItemsSelect(data.items);
    itemsCell.appendChild(itemsSelect);
    row.appendChild(itemsCell);

    // Column 6: POD (Proof of Delivery)
    const podCell = document.createElement("td");
    const podBtn = document.createElement("button");
    podBtn.textContent = "📸 Capture";
    podBtn.className = "btn-cell";
    podBtn.onclick = () => openPodCamera(row);
    podCell.appendChild(podBtn);
    podCell.className = "pod-cell";
    row.appendChild(podCell);

    // Column 7: Signature
    const sigCell = document.createElement("td");
    const sigBtn = document.createElement("button");
    sigBtn.textContent = "✍️ Sign";
    sigBtn.className = "btn-cell";
    sigBtn.onclick = () => openSignature(row);
    sigCell.appendChild(sigBtn);
    sigCell.className = "signature-cell";
    row.appendChild(sigCell);

    // Column 8: Notes
    const notesCell = document.createElement("td");
    const notes = document.createElement("input");
    notes.type = "text";
    notes.placeholder = "Driver notes...";
    notes.className = "notes-input";
    notesCell.appendChild(notes);
    row.appendChild(notesCell);

    // Column 9: Actions
    const actionCell = document.createElement("td");
    const actionDiv = document.createElement("div");
    actionDiv.className = "action-buttons";
    
    const viewBtn = document.createElement("button");
    viewBtn.textContent = "👁️";
    viewBtn.title = "View Invoice Image";
    viewBtn.className = "btn-action";
    viewBtn.onclick = () => expandImage(data.image);
    
    const delBtn = document.createElement("button");
    delBtn.textContent = "🗑️";
    delBtn.title = "Delete Row";
    delBtn.className = "btn-action btn-delete";
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

    // Store raw data in row for export
    row.dataset.invoiceData = JSON.stringify(data);

    tableBody.appendChild(row);
}

/* ===========================
   MULTI-SELECT ITEMS DROPDOWN
=========================== */
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
        label.className = "items-option";
        
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = option;
        checkbox.checked = selectedItems.includes(option);
        
        checkbox.addEventListener("change", () => {
            const checked = Array.from(dropdown.querySelectorAll("input:checked"))
                .map(cb => cb.value);
            displayDiv.textContent = checked.length > 0 ? checked.join(", ") : "Select items...";
        });
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(" " + option));
        dropdown.appendChild(label);
    });
    
    displayDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        const allDropdowns = document.querySelectorAll(".items-dropdown");
        allDropdowns.forEach(d => {
            if (d !== dropdown) d.style.display = "none";
        });
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
    const width = video.videoWidth || video.clientWidth || 640;
    const height = video.videoHeight || video.clientHeight || 480;
    canvas.width = width;
    canvas.height = height;

    canvas.getContext("2d").drawImage(video, 0, 0);

    const img = new Image();
    img.src = canvas.toDataURL("image/png");
    img.className = "pod-thumbnail";
    img.onclick = () => expandImage(img.src);

    currentPodRow.children[5].innerHTML = "";
    currentPodRow.children[5].appendChild(img);

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
function openSignature(row) {
    currentSigRow = row;
    const modal = document.getElementById("sigModal");
    modal.style.display = "flex";

    sigPad = document.getElementById("sigCanvas");
    sigCtx = sigPad.getContext("2d");
    
    delete sigPad.dataset.initialized;
    initSignaturePad();
    clearSig();
}

function initSignaturePad() {
    if (!sigPad || sigPad.dataset.initialized) return;
    
    sigPad.style.touchAction = "none";
    sigPad.style.msTouchAction = "none";
    sigPad.style.userSelect = "none";
    sigPad.style.webkitUserSelect = "none";

    const resize = () => {
        const ratio = window.devicePixelRatio || 1;
        const rect = sigPad.getBoundingClientRect();
        const width = rect.width;
        const height = 200;
        
        sigPad.width = width * ratio;
        sigPad.height = height * ratio;
        
        sigCtx.scale(ratio, ratio);
        sigPad.style.width = width + 'px';
        sigPad.style.height = height + 'px';
    };

    resize();
    window.addEventListener("resize", resize);

    const getPos = e => {
        const rect = sigPad.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        return {
            x: (clientX - rect.left),
            y: (clientY - rect.top)
        };
    };

    const startDraw = e => {
        e.preventDefault();
        e.stopPropagation();
        drawing = true;
        const pos = getPos(e);
        sigCtx.beginPath();
        sigCtx.moveTo(pos.x, pos.y);
    };

    const draw = e => {
        e.preventDefault();
        e.stopPropagation();
        if (!drawing) return;
        const pos = getPos(e);
        sigCtx.lineWidth = 2;
        sigCtx.lineCap = "round";
        sigCtx.lineJoin = "round";
        sigCtx.strokeStyle = "#000";
        sigCtx.lineTo(pos.x, pos.y);
        sigCtx.stroke();
    };

    const stopDraw = e => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        drawing = false;
        sigCtx.closePath();
    };

    const events = ['pointerdown', 'pointermove', 'pointerup', 'pointerleave', 'pointercancel',
                    'touchstart', 'touchmove', 'touchend', 'touchcancel',
                    'mousedown', 'mousemove', 'mouseup', 'mouseleave'];
    
    events.forEach(evt => {
        sigPad.removeEventListener(evt, startDraw);
        sigPad.removeEventListener(evt, draw);
        sigPad.removeEventListener(evt, stopDraw);
    });

    sigPad.addEventListener("pointerdown", startDraw, { passive: false });
    sigPad.addEventListener("pointermove", draw, { passive: false });
    sigPad.addEventListener("pointerup", stopDraw, { passive: false });
    sigPad.addEventListener("pointerleave", stopDraw, { passive: false });
    sigPad.addEventListener("pointercancel", stopDraw, { passive: false });
    
    sigPad.addEventListener("touchstart", startDraw, { passive: false });
    sigPad.addEventListener("touchmove", draw, { passive: false });
    sigPad.addEventListener("touchend", stopDraw, { passive: false });
    sigPad.addEventListener("touchcancel", stopDraw, { passive: false });
    
    sigPad.addEventListener("mousedown", startDraw, { passive: false });
    sigPad.addEventListener("mousemove", draw, { passive: false });
    sigPad.addEventListener("mouseup", stopDraw, { passive: false });
    sigPad.addEventListener("mouseleave", stopDraw, { passive: false });
    
    sigPad.dataset.initialized = "true";
}

function clearSig() {
    if (sigCtx && sigPad) {
        sigCtx.clearRect(0, 0, sigPad.width, sigPad.height);
    }
}

function saveSig() {
    if (!sigPad) return;
    const img = new Image();
    img.src = sigPad.toDataURL("image/png");
    img.className = "signature-thumbnail";
    img.onclick = () => expandImage(img.src);

    currentSigRow.children[6].innerHTML = "";
    currentSigRow.children[6].appendChild(img);

    closeSigModal();
}

function closeSigModal() {
    document.getElementById("sigModal").style.display = "none";
    drawing = false;
    if (sigPad) {
        delete sigPad.dataset.initialized;
    }
    sigPad = null;
    sigCtx = null;
}

/* ===========================
   IMAGE EXPAND MODAL
=========================== */
function expandImage(src) {
    const modal = document.getElementById("imageModal");
    const img = document.getElementById("expandedImage");
    img.src = src;
    modal.style.display = "flex";
}

function closeImageModal() {
    document.getElementById("imageModal").style.display = "none";
}

/* ===========================
   EXPORT FUNCTIONS
=========================== */
function exportCSV() {
    const tableBody = document.getElementById("tableBody");
    const rows = Array.from(tableBody.children);
    if (rows.length === 0) {
        alert("No data to export.");
        return;
    }
    
    let csv = "Invoice #,Name,Address,Phone,Items,POD,Signature,Notes\n";

    rows.forEach(row => {
        const cells = row.children;
        const line = [
            escapeCsv(cells[0].textContent),
            escapeCsv(cells[1].textContent),
            escapeCsv(cells[2].textContent),
            escapeCsv(cells[3].textContent),
            escapeCsv(cells[4].querySelector(".items-display")?.textContent || ""),
            cells[5].querySelector("img") ? "Photo captured" : "No photo",
            cells[6].querySelector("img") ? "Signed" : "Not signed",
            escapeCsv(cells[7].querySelector("input")?.value || "")
        ];
        csv += line.join(",") + "\n";
    });

    download("invoices.csv", csv, "text/csv");
    updateStatus("CSV exported successfully!");
}

function exportJSON() {
    const tableBody = document.getElementById("tableBody");
    const rows = Array.from(tableBody.children);
    if (rows.length === 0) {
        alert("No data to export.");
        return;
    }
    
    const data = rows.map(row => {
        const cells = row.children;
        return {
            invoiceNumber: cells[0].textContent,
            name: cells[1].textContent,
            address: cells[2].textContent,
            phone: cells[3].textContent,
            items: cells[4].querySelector(".items-display")?.textContent || "",
            pod: cells[5].querySelector("img")?.src || null,
            signature: cells[6].querySelector("img")?.src || null,
            notes: cells[7].querySelector("input")?.value || ""
        };
    });

    download("invoices.json", JSON.stringify(data, null, 2), "application/json");
    updateStatus("JSON exported successfully!");
}

function exportExcel() {
    const tableBody = document.getElementById("tableBody");
    const rows = Array.from(tableBody.children);
    if (rows.length === 0) {
        alert("No data to export.");
        return;
    }
    
    let csv = "Invoice #\tName\tAddress\tPhone\tItems\tPOD\tSignature\tNotes\n";

    rows.forEach(row => {
        const cells = row.children;
        const line = [
            cells[0].textContent,
            cells[1].textContent,
            cells[2].textContent,
            cells[3].textContent,
            cells[4].querySelector(".items-display")?.textContent || "",
            cells[5].querySelector("img") ? "Photo captured" : "No photo",
            cells[6].querySelector("img") ? "Signed" : "Not signed",
            cells[7].querySelector("input")?.value || ""
        ];
        csv += line.join("\t") + "\n";
    });

    download("invoices.xlsx", csv, "application/vnd.ms-excel");
    updateStatus("Excel file exported successfully!");
}

function shareData() {
    const tableBody = document.getElementById("tableBody");
    const rows = Array.from(tableBody.children);
    if (rows.length === 0) {
        alert("No data to share.");
        return;
    }
    
    let shareText = `📋 Daily Delivery Report - ${new Date().toLocaleDateString()}\n\n`;
    shareText += `Total Deliveries: ${rows.length}\n\n`;
    
    rows.forEach((row, index) => {
        const cells = row.children;
        shareText += `${index + 1}. Invoice: ${cells[0].textContent}\n`;
        shareText += `   Name: ${cells[1].textContent}\n`;
        shareText += `   Address: ${cells[2].textContent}\n`;
        shareText += `   Phone: ${cells[3].textContent}\n`;
        shareText += `   Items: ${cells[4].querySelector(".items-display")?.textContent || "N/A"}\n`;
        shareText += `   Notes: ${cells[7].querySelector("input")?.value || "None"}\n\n`;
    });
    
    if (navigator.share) {
        navigator.share({
            title: 'Daily Delivery Report',
            text: shareText
        }).then(() => {
            updateStatus("Report shared successfully!");
        }).catch(err => {
            console.log('Share failed:', err);
            fallbackShare(shareText);
        });
    } else {
        fallbackShare(shareText);
    }
}

function fallbackShare(text) {
    const subject = encodeURIComponent("Daily Delivery Report");
    const body = encodeURIComponent(text);
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
    
    const choice = confirm("Share via:\nOK = Email\nCancel = Copy to clipboard");
    if (choice) {
        window.location.href = mailtoLink;
    } else {
        navigator.clipboard.writeText(text).then(() => {
            alert("Report copied to clipboard!");
        }).catch(() => {
            alert("Could not copy. Please use Export instead.");
        });
    }
}

function clearLog() {
    const tableBody = document.getElementById("tableBody");
    if (tableBody.children.length === 0) {
        alert("Log is already empty.");
        return;
    }
    
    const confirmed = confirm(`Clear all ${tableBody.children.length} records?\nThis cannot be undone.`);
    if (confirmed) {
        tableBody.innerHTML = "";
        updateRecordCount();
        updateStatus("Log cleared.");
    }
}

function escapeCsv(str) {
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function download(filename, data, mime) {
    const blob = new Blob([data], { type: mime || "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}
