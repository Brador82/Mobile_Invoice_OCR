/* ===========================
   MOBILE INVOICE ENTRY - MANUAL VERSION
   No OCR - Manual Data Entry Only
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
   INITIALIZATION
=========================== */
window.addEventListener("DOMContentLoaded", () => {
    // Initialize
    updateRecordCount();
    updateStatus("Ready. Click 'Add New Invoice Entry' to begin manual data entry.");
});

/* ===========================
   CAMERA FOR REFERENCE PHOTOS
=========================== */
async function openCamera() {
    const modal = document.getElementById("cameraModal");
    const video = document.getElementById("cameraVideo");
    if (!modal || !video) return;
    
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        video.srcObject = cameraStream;
        modal.style.display = "flex";
        updateStatus("Camera ready. Capture invoice for reference.");
    } catch (err) {
        console.error("Camera error:", err);
        updateStatus("❌ Camera access denied. You can still add entries manually.");
    }
}

function captureInvoiceImage() {
    const video = document.getElementById("cameraVideo");
    const canvas = document.getElementById("cameraCanvas");
    if (!video || !canvas) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    
    const dataURL = canvas.toDataURL("image/jpeg", 0.8);
    uploadedImages.push({ src: dataURL, name: `Invoice_${Date.now()}.jpg` });
    
    // Show preview
    const gallery = document.getElementById("previewGallery");
    const img = document.createElement("img");
    img.src = dataURL;
    img.className = "preview-image";
    img.onclick = () => expandImage(dataURL);
    gallery.appendChild(img);
    
    closeCameraModal();
    updateStatus("✅ Invoice photo captured. Now click 'Add New Invoice Entry' to enter details manually.");
}

function closeCameraModal() {
    const modal = document.getElementById("cameraModal");
    stopStream(cameraStream);
    cameraStream = null;
    if (modal) modal.style.display = "none";
}

function stopStream(stream) {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
}

/* ===========================
   MANUAL ENTRY FUNCTION
=========================== */
function addManualEntry() {
    const data = {
        invoiceNumber: "",
        name: "",
        address: "",
        phone: "",
        items: "",
        image: uploadedImages.length > 0 ? uploadedImages[uploadedImages.length - 1].src : ""
    };
    
    addInvoiceRow(data, true); // true = editable mode
    updateRecordCount();
    updateStatus("✅ New entry added. Fill in the invoice details in the table.");
}

/* ===========================
   ADD ROW TO TABLE (EDITABLE)
=========================== */
function addInvoiceRow(data, editable = true) {
    const tableBody = document.getElementById("tableBody");
    const row = document.createElement("tr");

    // Column 1: Invoice Number (editable)
    const invoiceCell = document.createElement("td");
    if (editable) {
        const invoiceInput = document.createElement("input");
        invoiceInput.type = "text";
        invoiceInput.value = data.invoiceNumber || "";
        invoiceInput.placeholder = "Invoice #";
        invoiceInput.className = "cell-input";
        invoiceCell.appendChild(invoiceInput);
    } else {
        invoiceCell.textContent = data.invoiceNumber || "N/A";
    }
    invoiceCell.className = "invoice-number";
    row.appendChild(invoiceCell);

    // Column 2: Name (editable)
    const nameCell = document.createElement("td");
    if (editable) {
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.value = data.name || "";
        nameInput.placeholder = "Customer Name";
        nameInput.className = "cell-input";
        nameCell.appendChild(nameInput);
    } else {
        nameCell.textContent = data.name || "Unknown";
    }
    nameCell.className = "customer-name";
    row.appendChild(nameCell);

    // Column 3: Address (editable with Google Maps link)
    const addressCell = document.createElement("td");
    if (editable) {
        const addressInput = document.createElement("input");
        addressInput.type = "text";
        addressInput.value = data.address || "";
        addressInput.placeholder = "Address";
        addressInput.className = "cell-input";
        addressCell.appendChild(addressInput);
    } else {
        const addressLink = document.createElement("a");
        const resolvedAddress = data.address || "";
        addressLink.href = resolvedAddress
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedAddress)}`
            : "#";
        addressLink.textContent = resolvedAddress || "Unknown";
        addressLink.target = "_blank";
        addressLink.className = "address-link";
        addressCell.appendChild(addressLink);
    }
    row.appendChild(addressCell);

    // Column 4: Phone (editable with tel: link)
    const phoneCell = document.createElement("td");
    if (editable) {
        const phoneInput = document.createElement("input");
        phoneInput.type = "tel";
        phoneInput.value = data.phone || "";
        phoneInput.placeholder = "Phone #";
        phoneInput.className = "cell-input";
        phoneCell.appendChild(phoneInput);
    } else {
        const phoneLink = document.createElement("a");
        const cleanPhone = (data.phone || "").replace(/\D/g, "");
        phoneLink.href = cleanPhone ? `tel:${cleanPhone}` : "#";
        phoneLink.textContent = data.phone || "Unknown";
        phoneLink.target = "_self";
        phoneLink.className = "phone-link";
        phoneCell.appendChild(phoneLink);
    }
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
    viewBtn.onclick = () => {
        if (data.image) {
            expandImage(data.image);
        } else {
            updateStatus("No reference image captured for this entry.");
        }
    };
    
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
    
    const button = document.createElement("button");
    button.className = "items-select-btn";
    button.textContent = "Select items...";
    button.type = "button";
    
    const dropdown = document.createElement("div");
    dropdown.className = "items-dropdown";
    dropdown.style.display = "none";
    
    const selectedSet = new Set(
        preSelectedItems.split(",").map(i => i.trim()).filter(Boolean)
    );
    
    applianceOptions.forEach(opt => {
        const label = document.createElement("label");
        label.className = "item-option";
        
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = opt;
        checkbox.checked = selectedSet.has(opt);
        
        checkbox.addEventListener("change", () => {
            const checked = Array.from(dropdown.querySelectorAll("input:checked"))
                .map(cb => cb.value);
            button.textContent = checked.length > 0 
                ? checked.join(", ") 
                : "Select items...";
        });
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${opt}`));
        dropdown.appendChild(label);
    });
    
    if (selectedSet.size > 0) {
        button.textContent = Array.from(selectedSet).join(", ");
    }
    
    button.addEventListener("click", e => {
        e.stopPropagation();
        const isVisible = dropdown.style.display === "block";
        document.querySelectorAll(".items-dropdown").forEach(d => d.style.display = "none");
        dropdown.style.display = isVisible ? "none" : "block";
    });
    
    document.addEventListener("click", () => {
        dropdown.style.display = "none";
    });
    
    container.appendChild(button);
    container.appendChild(dropdown);
    return container;
}

/* ===========================
   POD CAMERA
=========================== */
async function openPodCamera(row) {
    currentPodRow = row;
    const modal = document.getElementById("podModal");
    const video = document.getElementById("podVideo");
    if (!modal || !video) return;
    
    try {
        podStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        video.srcObject = podStream;
        modal.style.display = "flex";
    } catch (err) {
        console.error("POD camera error:", err);
        alert("Camera access denied for POD capture.");
    }
}

function capturePOD() {
    if (!currentPodRow) return;
    
    const video = document.getElementById("podVideo");
    const canvas = document.getElementById("podCanvas");
    if (!video || !canvas) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    
    const dataURL = canvas.toDataURL("image/jpeg", 0.8);
    
    const podCell = currentPodRow.cells[5];
    podCell.innerHTML = "";
    const img = document.createElement("img");
    img.src = dataURL;
    img.className = "pod-thumbnail";
    img.onclick = () => expandImage(dataURL);
    podCell.appendChild(img);
    
    closePodModal();
}

function closePodModal() {
    const modal = document.getElementById("podModal");
    stopStream(podStream);
    podStream = null;
    currentPodRow = null;
    if (modal) modal.style.display = "none";
}

/* ===========================
   SIGNATURE PAD
=========================== */
function openSignature(row) {
    currentSigRow = row;
    const modal = document.getElementById("sigModal");
    const canvas = document.getElementById("sigCanvas");
    if (!modal || !canvas) return;
    
    modal.style.display = "flex";
    
    setTimeout(() => {
        initSignaturePad();
    }, 100);
}

function initSignaturePad() {
    const canvas = document.getElementById("sigCanvas");
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext("2d");
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    sigCtx = ctx;
    sigPad = canvas;
    
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    let lastX = 0, lastY = 0;
    
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };
    
    const startDrawing = (e) => {
        e.preventDefault();
        drawing = true;
        const pos = getPos(e);
        lastX = pos.x;
        lastY = pos.y;
    };
    
    const draw = (e) => {
        if (!drawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastX = pos.x;
        lastY = pos.y;
    };
    
    const stopDrawing = (e) => {
        if (drawing) {
            e.preventDefault();
            drawing = false;
        }
    };
    
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseout", stopDrawing);
    
    canvas.addEventListener("touchstart", startDrawing);
    canvas.addEventListener("touchmove", draw);
    canvas.addEventListener("touchend", stopDrawing);
    canvas.addEventListener("touchcancel", stopDrawing);
}

function clearSig() {
    if (!sigPad || !sigCtx) return;
    sigCtx.clearRect(0, 0, sigPad.width, sigPad.height);
}

function saveSig() {
    if (!currentSigRow || !sigPad) return;
    
    const dataURL = sigPad.toDataURL("image/png");
    
    const sigCell = currentSigRow.cells[6];
    sigCell.innerHTML = "";
    const img = document.createElement("img");
    img.src = dataURL;
    img.className = "sig-thumbnail";
    img.onclick = () => expandImage(dataURL);
    sigCell.appendChild(img);
    
    closeSigModal();
}

function closeSigModal() {
    const modal = document.getElementById("sigModal");
    currentSigRow = null;
    drawing = false;
    if (modal) modal.style.display = "none";
}

/* ===========================
   IMAGE EXPAND MODAL
=========================== */
function expandImage(src) {
    const modal = document.getElementById("imageModal");
    const img = document.getElementById("expandedImage");
    if (modal && img) {
        img.src = src;
        modal.style.display = "flex";
    }
}

function closeImageModal() {
    const modal = document.getElementById("imageModal");
    if (modal) modal.style.display = "none";
}

/* ===========================
   EXPORT FUNCTIONS
=========================== */
function exportCSV() {
    const tableBody = document.getElementById("tableBody");
    if (!tableBody || tableBody.children.length === 0) {
        alert("No data to export!");
        return;
    }
    
    let csv = "Invoice #,Name,Address,Phone #,Items,Notes\n";
    
    Array.from(tableBody.children).forEach(row => {
        const cells = row.cells;
        const invoice = cells[0].querySelector("input")?.value || cells[0].textContent;
        const name = cells[1].querySelector("input")?.value || cells[1].textContent;
        const address = cells[2].querySelector("input")?.value || cells[2].querySelector("a")?.textContent || "";
        const phone = cells[3].querySelector("input")?.value || cells[3].querySelector("a")?.textContent || "";
        const items = cells[4].querySelector(".items-select-btn")?.textContent || "";
        const notes = cells[7].querySelector("input")?.value || "";
        
        const escapeCSV = (str) => {
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        
        csv += `${escapeCSV(invoice)},${escapeCSV(name)},${escapeCSV(address)},${escapeCSV(phone)},${escapeCSV(items)},${escapeCSV(notes)}\n`;
    });
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice_log_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    updateStatus("✅ CSV exported successfully!");
}

function exportExcel() {
    const tableBody = document.getElementById("tableBody");
    if (!tableBody || tableBody.children.length === 0) {
        alert("No data to export!");
        return;
    }
    
    let tsv = "Invoice #\tName\tAddress\tPhone #\tItems\tNotes\n";
    
    Array.from(tableBody.children).forEach(row => {
        const cells = row.cells;
        const invoice = cells[0].querySelector("input")?.value || cells[0].textContent;
        const name = cells[1].querySelector("input")?.value || cells[1].textContent;
        const address = cells[2].querySelector("input")?.value || cells[2].querySelector("a")?.textContent || "";
        const phone = cells[3].querySelector("input")?.value || cells[3].querySelector("a")?.textContent || "";
        const items = cells[4].querySelector(".items-select-btn")?.textContent || "";
        const notes = cells[7].querySelector("input")?.value || "";
        
        tsv += `${invoice}\t${name}\t${address}\t${phone}\t${items}\t${notes}\n`;
    });
    
    const blob = new Blob([tsv], { type: "text/tab-separated-values" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice_log_${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    
    updateStatus("✅ Excel file exported successfully!");
}

function exportJSON() {
    const tableBody = document.getElementById("tableBody");
    if (!tableBody || tableBody.children.length === 0) {
        alert("No data to export!");
        return;
    }
    
    const records = [];
    
    Array.from(tableBody.children).forEach(row => {
        const cells = row.cells;
        const record = {
            invoiceNumber: cells[0].querySelector("input")?.value || cells[0].textContent,
            name: cells[1].querySelector("input")?.value || cells[1].textContent,
            address: cells[2].querySelector("input")?.value || cells[2].querySelector("a")?.textContent || "",
            phone: cells[3].querySelector("input")?.value || cells[3].querySelector("a")?.textContent || "",
            items: cells[4].querySelector(".items-select-btn")?.textContent || "",
            podImage: cells[5].querySelector("img")?.src || "",
            signature: cells[6].querySelector("img")?.src || "",
            notes: cells[7].querySelector("input")?.value || ""
        };
        records.push(record);
    });
    
    const json = JSON.stringify(records, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice_log_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    updateStatus("✅ JSON exported successfully!");
}

function shareData() {
    const tableBody = document.getElementById("tableBody");
    if (!tableBody || tableBody.children.length === 0) {
        alert("No data to share!");
        return;
    }
    
    let text = "Daily Delivery Log\n\n";
    
    Array.from(tableBody.children).forEach((row, i) => {
        const cells = row.cells;
        const invoice = cells[0].querySelector("input")?.value || cells[0].textContent;
        const name = cells[1].querySelector("input")?.value || cells[1].textContent;
        const address = cells[2].querySelector("input")?.value || cells[2].querySelector("a")?.textContent || "";
        const items = cells[4].querySelector(".items-select-btn")?.textContent || "";
        
        text += `${i + 1}. Invoice: ${invoice}\n`;
        text += `   Name: ${name}\n`;
        text += `   Address: ${address}\n`;
        text += `   Items: ${items}\n\n`;
    });
    
    if (navigator.share) {
        navigator.share({
            title: "Daily Delivery Log",
            text: text
        }).catch(err => console.log("Share cancelled", err));
    } else {
        const mailtoLink = `mailto:?subject=Daily Delivery Log&body=${encodeURIComponent(text)}`;
        window.location.href = mailtoLink;
    }
}

function clearLog() {
    if (!confirm("Are you sure you want to clear all records? This cannot be undone!")) {
        return;
    }
    
    const tableBody = document.getElementById("tableBody");
    if (tableBody) {
        tableBody.innerHTML = "";
        updateRecordCount();
        updateStatus("Log cleared. Ready for new entries.");
    }
}
