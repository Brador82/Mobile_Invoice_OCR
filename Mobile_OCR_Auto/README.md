# Mobile Invoice OCR - Automatic Version

## 📦 Fully automatic OCR extraction

This package provides **automated OCR processing** for invoice images using Tesseract.js and Python Tesseract backend.

## Features

- ⚡ Fast automatic text extraction
- 🤖 Regex-based field detection
- 📸 Camera capture (invoice + POD)
- ✍️ Signature pad
- 💾 localStorage persistence
- 📤 Export HTML with embedded images
- 📊 Export CSV/JSON

## Quick Start

### Option 1: Client-Side Only (No Server Required)

1. **Open Index.html** in a browser (Chrome/Safari recommended)
2. Upload or capture invoice images
3. Click "Process All Images with OCR"
4. Review and edit extracted data
5. Capture POD photo and signature
6. Export when complete

### Option 2: With Python Server (Enhanced OCR)

The Python server provides enhanced OCR processing with better preprocessing.

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python Server.py
```

Server will start at `http://localhost:5000`

## Best Used For

- ✅ Clean, well-formatted invoices
- ✅ Batch processing multiple invoices
- ✅ Quick data entry workflows
- ✅ High-volume invoice processing

## Requirements

### Client-Side
- Modern web browser with JavaScript enabled
- Internet connection for first load (to download Tesseract.js)

### Server-Side (Optional)
- Python 3.7+
- Tesseract OCR installed on system
- pip packages: Flask, flask-cors, Pillow, pytesseract

## How It Works

1. **Upload**: Select or capture invoice images
2. **Process**: Click "Process All Images with OCR"
3. **Extract**: OCR automatically extracts:
   - Invoice Number
   - Customer Name
   - Address
   - Phone Number
   - Items/Appliances
   - Date and Total
4. **Review**: Check and edit extracted data
5. **Complete**: Add POD photo and signature
6. **Export**: Save data as CSV/Excel/JSON

## Tips for Best Results

### Invoice Photos
- ✅ Good lighting (no shadows)
- ✅ Flat surface (no wrinkles)
- ✅ Clear focus
- ✅ Fill the frame with invoice
- ❌ Avoid glare or reflections
- ❌ Don't tilt or angle the photo

### OCR Processing
- Process images with good contrast
- Ensure text is horizontal and readable
- Use rear camera for better quality
- Allow time for processing (30-60s per image)

## Notes

- OCR runs entirely in the browser using Tesseract.js
- No internet required after first load
- Data persists in browser until exported
- Export HTML to save complete records with images
- Server enhances accuracy but is optional

## Troubleshooting

### OCR Not Working
- Check browser console for errors (F12)
- Ensure Tesseract.js CDN is accessible
- Try refreshing the page
- Clear browser cache

### Low Accuracy
- Improve image quality
- Use better lighting
- Flatten invoices before capturing
- Use the Python server for better preprocessing

---

**Version:** Automatic OCR  
**Created:** December 2025  
**Package Type:** Full OCR with Tesseract.js + Optional Python Backend
