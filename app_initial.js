let currentImage = "";
let currentPodRow = null;
let currentSigRow = null;
let cameraStream = null;
let podStream = null;

const uploadInput = document.getElementById("uploadInput");
const previewImg = document.getElementById("preview");
const statusMessage = document.getElementById("statusMessage");

function updateStatus(message = "") {
	if (!statusMessage) return;
	statusMessage.textContent = message;
}

function setPreview(src) {
	if (!previewImg) return;
	previewImg.src = src;
	previewImg.classList.add("visible");
}

/* ===========================
   DRAG & DROP
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
		const files = e.dataTransfer.files;
		if (files.length > 0) {
			handleFileUpload(files[0]);
		}
	}, false);
});

function handleFileUpload(file) {
	if (!file || !file.type.startsWith("image/")) {
		updateStatus("Please upload an image file.");
		return;
	}
	const reader = new FileReader();
	reader.onload = ev => {
		currentImage = ev.target.result;
		setPreview(currentImage);
		updateStatus("Invoice ready – run OCR when you're set.");
	};
	reader.readAsDataURL(file);
}

/* ===========================
   LOAD IMAGE PREVIEW
=========================== */
uploadInput.addEventListener("change", e => {
	const file = e.target.files[0];
	if (!file) return;
	handleFileUpload(file);
});

/* ===========================
   CAMERA (MAIN INVOICE)
=========================== */
async function openCamera() {
	if (!navigator.mediaDevices?.getUserMedia) {
		updateStatus("Camera not supported. Using upload instead.");
		uploadInput.click();
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
		uploadInput.click();
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
	currentImage = canvas.toDataURL("image/png");
	setPreview(currentImage);
	updateStatus("Photo captured – run OCR when ready.");
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

/* ===========================
   PROCESS OCR
=========================== */
async function processOCR() {
	if (!currentImage) {
		updateStatus("Upload or capture an invoice first.");
		alert("Upload/capture image first.");
		return;
	}

	updateStatus("Processing invoice with OCR service…");

	try {
		const res = await fetch("http://127.0.0.1:5000/process-ocr", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ image: currentImage })
		});

		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const data = await res.json();
		if (!data?.success) throw new Error("OCR failed");

		addInvoiceRow(data);
		updateStatus("OCR complete – row added below.");
	} catch (error) {
		console.error("OCR error", error);
		updateStatus("OCR failed – please retry.");
		alert("OCR failed. Check the server log and try again.");
	}
}

/* ===========================
   ADD ROW TO TABLE
=========================== */
function addInvoiceRow(data) {
	const row = document.createElement("tr");

	/* A: Invoice image */
	const imgCell = document.createElement("td");
	const img = document.createElement("img");
	img.src = data?.image || currentImage;
	img.className = "invoice-img";
	img.alt = "Invoice preview";
	imgCell.appendChild(img);
	row.appendChild(imgCell);

	/* B: Name */
	const nameCell = document.createElement("td");
	const nameLink = document.createElement("a");
	const resolvedAddress = data?.address || "";
	nameLink.href = resolvedAddress
		? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedAddress)}`
		: "#";
	nameLink.textContent = data?.name || "Unknown";
	nameLink.target = "_blank";
	nameCell.appendChild(nameLink);
	row.appendChild(nameCell);

	/* C: Address */
	const addressCell = document.createElement("td");
	const addressLink = document.createElement("a");
	addressLink.href = resolvedAddress
		? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedAddress)}`
		: "#";
	addressLink.textContent = resolvedAddress || "Unknown";
	addressLink.target = "_blank";
	addressCell.appendChild(addressLink);
	row.appendChild(addressCell);

	/* D: Phone */
	const phoneCell = document.createElement("td");
	const phoneLink = document.createElement("a");
	const cleanPhone = (data?.phone || "").replace(/\D/g, "");
	phoneLink.href = cleanPhone ? `tel:${cleanPhone}` : "#";
	phoneLink.textContent = data?.phone || "Unknown";
	phoneLink.target = "_self";
	phoneCell.appendChild(phoneLink);
	row.appendChild(phoneCell);

	/* E: POD */
	const podCell = document.createElement("td");
	const podBtn = document.createElement("button");
	podBtn.textContent = "Capture POD";
	podBtn.onclick = () => openPodCamera(row);
	podCell.appendChild(podBtn);
	row.appendChild(podCell);

	/* F: Signature */
	const sigCell = document.createElement("td");
	const sigBtn = document.createElement("button");
	sigBtn.textContent = "Sign";
	sigBtn.onclick = () => openSignature(row);
	sigCell.appendChild(sigBtn);
	row.appendChild(sigCell);

	/* G: Notes */
	const notesCell = document.createElement("td");
	const notes = document.createElement("input");
	notes.type = "text";
	notes.placeholder = "Notes...";
	notesCell.appendChild(notes);
	row.appendChild(notesCell);

	/* H: Actions */
	const actionCell = document.createElement("td");
	const delBtn = document.createElement("button");
	delBtn.textContent = "Delete";
	delBtn.onclick = () => row.remove();
	actionCell.appendChild(delBtn);
	row.appendChild(actionCell);

	document.getElementById("tableBody").appendChild(row);
}

/* ===========================
   POD CAMERA
=========================== */
function openPodCamera(row) {
	currentPodRow = row;
	const modal = document.getElementById("podModal");
	modal.style.display = "flex";

	if (!navigator.mediaDevices?.getUserMedia) {
		alert("Camera not supported on this device.");
		return;
	}

	if (podStream) stopStream(podStream);
	navigator.mediaDevices.getUserMedia({
		video: { facingMode: { ideal: "environment" } },
		audio: false
	}).then(stream => {
		podStream = stream;
		const v = document.getElementById("podVideo");
		v.srcObject = stream;
		v.play();
	}).catch(err => {
		console.error("POD camera error", err);
		alert("Unable to access camera.");
	});
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
	img.src = canvas.toDataURL();
	img.className = "invoice-img";

	currentPodRow.children[4].innerHTML = "";
	currentPodRow.children[4].appendChild(img);

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
   SIGNATURE
=========================== */
let drawing = false;
let sigCtx, sigPad;

function openSignature(row) {
	currentSigRow = row;
	const modal = document.getElementById("sigModal");
	modal.style.display = "flex";

	sigPad = document.getElementById("sigCanvas");
	sigCtx = sigPad.getContext("2d");
	initSignaturePad();
	clearSig();
}

function initSignaturePad() {
	if (!sigPad || sigPad.dataset.initialized) return;
	sigPad.style.touchAction = "none";

	const resize = () => {
		const ratio = window.devicePixelRatio || 1;
		const width = sigPad.clientWidth || 280;
		const height = 200;
		sigPad.width = width * ratio;
		sigPad.height = height * ratio;
		sigCtx.setTransform(1, 0, 0, 1, 0, 0);
		sigCtx.scale(ratio, ratio);
	};

	resize();
	window.addEventListener("resize", resize);

	const getPos = e => {
		const rect = sigPad.getBoundingClientRect();
		const touch = e.touches ? e.touches[0] : e;
		return {
			x: (touch.clientX - rect.left) * (sigPad.width / rect.width) / (window.devicePixelRatio || 1),
			y: (touch.clientY - rect.top) * (sigPad.height / rect.height) / (window.devicePixelRatio || 1)
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
		sigCtx.lineWidth = 3;
		sigCtx.lineCap = "round";
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
	};

	// Use both pointer and touch events for maximum compatibility
	sigPad.addEventListener("pointerdown", startDraw, { passive: false });
	sigPad.addEventListener("pointermove", draw, { passive: false });
	sigPad.addEventListener("pointerup", stopDraw, { passive: false });
	sigPad.addEventListener("pointerleave", stopDraw, { passive: false });
	sigPad.addEventListener("pointercancel", stopDraw, { passive: false });
	
	// Fallback for touch events
	sigPad.addEventListener("touchstart", startDraw, { passive: false });
	sigPad.addEventListener("touchmove", draw, { passive: false });
	sigPad.addEventListener("touchend", stopDraw, { passive: false });
	sigPad.addEventListener("touchcancel", stopDraw, { passive: false });
	
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
	img.src = sigPad.toDataURL();
	img.className = "invoice-img";

	currentSigRow.children[5].innerHTML = "";
	currentSigRow.children[5].appendChild(img);

	closeSigModal();
}

function closeSigModal() {
	document.getElementById("sigModal").style.display = "none";
	sigPad = null;
	sigCtx = null;
}

/* ===========================
   EXPORT CSV
=========================== */
function exportCSV() {
	let csv = "Image,Name,Address,Phone,POD,Signature,Notes\n";

	document.querySelectorAll("#tableBody tr").forEach(row => {
		let line = [];
		for (let i = 0; i < 7; i++) {
			line.push(row.children[i].innerText.replace(/,/g, " "));
		}
		csv += line.join(",") + "\n";
	});

	download("invoices.csv", csv, "text/csv");
}

/* ===========================
   EXPORT JSON
=========================== */
function exportJSON() {
	let arr = [];

	document.querySelectorAll("#tableBody tr").forEach(row => {
		arr.push({
			image: row.children[0].innerText,
			name: row.children[1].innerText,
			address: row.children[2].innerText,
			phone: row.children[3].innerText,
			pod: row.children[4].innerText,
			signature: row.children[5].innerText,
			notes: row.children[6].innerText
		});
	});

	download("invoices.json", JSON.stringify(arr, null, 2), "application/json");
}

/* ===========================
   EXPORT EXCEL (CSV FALLBACK)
=========================== */
function exportExcel() {
	let rows = [];
	rows.push(["Image", "Name", "Address", "Phone", "POD", "Signature", "Notes"]);

	document.querySelectorAll("#tableBody tr").forEach(row => {
		let r = [];
		for (let i = 0; i < 7; i++) {
			r.push(row.children[i].innerText);
		}
		rows.push(r);
	});

	let csv = rows.map(r => r.join(",")).join("\n");
	download("invoices.xlsx", csv, "text/csv");
}

/* ===========================
   DOWNLOAD
=========================== */
function download(name, data, mime) {
	const blob = new Blob([data], {
		type: mime || "text/plain"
	});
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = name;
	a.click();
}
