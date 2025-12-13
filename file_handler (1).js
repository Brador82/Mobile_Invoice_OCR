/* ===========================
   UPDATED FILE UPLOAD HANDLER
=========================== */
async function handleMultipleFiles(files) {
    const previewGallery = document.getElementById("previewGallery");
    const processBtn = document.getElementById("processBtn");

    // Update status to indicate pre-processing is happening
    updateStatus(`Preprocessing ${files.length} image(s)...`);
    
    uploadedImages = [];
    if (previewGallery) previewGallery.innerHTML = "";

    try {
        // Loop through all files and process them sequentially
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            updateStatus(`Preprocessing image ${i + 1} of ${files.length}...`);
            
            // --- THIS IS THE NEW STEP ---
            // Await the pre-processing BEFORE moving on.
            const processedDataUrl = await preprocessImage(file);
            // ---------------------------

            // Store the PROCESSED image data URL
            uploadedImages.push({
                dataUrl: processedDataUrl,
                fileName: file.name,
                index: i
            });

            // Add preview thumbnail using the processed image
            if (previewGallery) {
                const previewDiv = document.createElement("div");
                previewDiv.className = "preview-item";
                // Use processedDataUrl for the source
                previewDiv.innerHTML = `
                    <img src="${processedDataUrl}" alt="Processed Invoice ${i + 1}" onclick="expandImage('${processedDataUrl}')">
                    <span class="preview-label">${i + 1}. ${file.name}</span>
                `;
                previewGallery.appendChild(previewDiv);
            }
        }

        // All images are processed and ready
        if (processBtn) processBtn.disabled = false;
        updateStatus(`${files.length} image(s) processed and ready for OCR.`);

    } catch (error) {
        console.error("Error during image preprocessing:", error);
        updateStatus("Error processing images. Please try again.");
        alert("An error occurred while preparing the images. Please try again.");
    }
}
