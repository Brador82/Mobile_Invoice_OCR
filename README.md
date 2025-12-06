#  Mobile Invoice OCR

A comprehensive web-based tool for delivery teams to process invoice images using OCR (Optical Character Recognition), manage daily deliveries, capture proof of delivery photos, collect digital signatures, and export data for reporting.

##  Features

###  **Advanced OCR Processing**

- **Tesseract.js Integration**: Client-side OCR processing powered by Tesseract.js
- **Multi-Image Upload**: Process multiple invoice images at once
- **Camera Capture**: Use mobile device camera to capture invoices in real-time
- **Drag & Drop**: Intuitive drag-and-drop interface for image uploads
- **Smart Data Extraction**: Automatically extracts:
  - Invoice Number
  - Customer Name
  - Address (with Google Maps integration)
  - Phone Number (with click-to-call)
  - Items/Appliances
  - Date and Total

### 📊 **Daily Delivery Log**

Interactive spreadsheet-style table with 9 columns:

1. **Invoice #**: Unique identifier
2. **Name**: Customer name
3. **Address**: Clickable Google Maps link
4. **Phone #**: Clickable call link
5. **Item(s)**: Multi-select dropdown for appliances
6. **P.O.D.**: Proof of Delivery photo capture
7. **Signature**: Digital signature pad
8. **Notes**: Free-form text for driver remarks
9. **Actions**: View/Delete controls

###  **Photo Capture**

- **Camera Access**: Direct camera integration for mobile devices
- **POD Photos**: Capture proof of delivery images for each invoice
- **Image Preview**: Click to expand any image to full size
- **Local Storage**: Images stored as base64 data URLs

###  **Digital Signature**

- **Canvas-Based**: Smooth signature capture on touchscreens
- **Multi-Device Support**: Works on mobile, tablet, and desktop
- **Touch Optimized**: Prevents accidental scrolling during signing
- **Clear & Save**: Easy to clear and recapture signatures

###  **Export & Share**

- **CSV Export**: Standard comma-separated values
- **Excel Export**: Tab-separated format for Excel
- **JSON Export**: Structured data with images
- **Email/Message**: Share reports via device's share options
- **Copy to Clipboard**: Quick copy for pasting elsewhere

###  **Mobile-First Design**

- **Responsive Layout**: Optimized for all screen sizes
- **Touch-Friendly**: Large buttons and touch targets
- **Offline Capable**: Works without constant internet connection
- **Fast Performance**: Optimized for mobile devices

##  Getting Started

### Prerequisites

**For Python Backend:**

- Python 3.7+
- Tesseract OCR installed on system
- pip (Python package manager)

**For Client-Side:**

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Camera access for mobile devices

### Installation

1. **Clone or download the project**

    ```powershell
    cd c:\_MainWorkspace\Projects\_Mobile_Invoice_OCR\Startup_Pkg
    ```

2. **Install Python dependencies**

    ```powershell
    pip install flask flask-cors pillow pytesseract
    ```

3. **Install Tesseract OCR**
   - **Windows**: Download from <https://github.com/UB-Mannheim/tesseract/wiki>
   - **Mac**: `brew install tesseract`
   - **Linux**: `sudo apt-get install tesseract-ocr`

4. **Start the server**

    ```powershell
    python Server.py
    ```

5. **Access the application**
   - Local: Open <http://localhost:5000> in your browser
   - Mobile: Use your computer's IP address (e.g., <http://192.168.1.100:5000>)

## 📖 Usage Guide

### Step 1: Upload Invoices

1. Click **"Upload Multiple Files"** to select images from your device
2. Or click **"Camera Capture"** to take photos directly
3. Or drag and drop image files into the drop zone
4. Preview thumbnails will appear below

### Step 2: Process with OCR

1. Click **"Process All Images with OCR"**
2. Wait while Tesseract.js extracts data from each image
3. Progress bar shows processing status
4. Each invoice is added as a row in the table

### Step 3: Complete Delivery Info

1. **Select Items**: Click the items dropdown to choose appliances
2. **Capture POD**: Click "📸 Capture" in the P.O.D. column
3. **Get Signature**: Click "✍️ Sign" for customer signature
4. **Add Notes**: Type any driver remarks in the notes field

### Step 4: Export Data

1. Click **"Export as CSV"** for spreadsheet import
2. Click **"Export as Excel"** for Microsoft Excel
3. Click **"Export as JSON"** for structured data
4. Click **"Share via Email/Message"** to send report

### Step 5: Clear Log

- Click **"Clear Log"** at end of day to reset the table
- Export data first to avoid losing records!

##  Column Details

### Invoice Number

- Automatically extracted from invoice image
- Unique identifier for tracking

### Name

- Customer name from invoice
- Automatically extracted via OCR

### Address

- Full street address
- **Clickable**: Opens Google Maps for navigation
- Format: Street, City, State ZIP

### Phone Number

- Customer phone number
- **Clickable**: Initiates call on mobile devices
- Supports various formats (XXX-XXX-XXXX, (XXX) XXX-XXXX)

### Item(s)

- **Multi-select dropdown** with options:
  - Washer
  - Dryer
  - Refrigerator
  - Dishwasher
  - Freezer
  - Range
  - Oven
  - Microwave
  - Stove
  - Other
- Click to select multiple items per invoice

### P.O.D. (Proof of Delivery)

- Click "📸 Capture" to activate camera
- Take photo of delivered items
- Photo saves to cell
- Click thumbnail to expand

### Signature

- Click "✍️ Sign" to open signature pad
- Customer signs with finger/stylus
- Click "Save" to store signature
- Click thumbnail to view full size

### Notes

- Free-form text input
- Add delivery remarks, issues, or special instructions
- Exported with other data

### Actions

- **👁️ View**: Expand invoice image to full screen
- **🗑️ Delete**: Remove record from table

##  Technical Details

### Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **OCR Engine**: Tesseract.js 5.x
- **Backend**: Python Flask
- **Image Processing**: Pillow (PIL)
- **Server OCR**: Python-Tesseract

### File Structure

### Data Storage

- **Client-Side**: Images stored as base64 in browser memory
- **Server-Side**: Optional JSON file storage in `/data` directory
- **Export Formats**: CSV, Excel (TSV), JSON

### Browser Compatibility

- ✅ Chrome 90+ (recommended for mobile)
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

### Camera Requirements

- **HTTPS** required for camera access (or localhost)
- **Permissions**: Must grant camera permission in browser
- **Fallback**: File upload if camera unavailable

## 🔧 Configuration

### OCR Accuracy

Edit `extractInvoiceData()` in `App.js` to customize extraction patterns:

```javascript
function extractInvoiceNumber(text) {
    const patterns = [
        /INVOICE[\s\n]+([A-Z0-9]{8,})/i,
        // Add your custom pattern here
    ];
    // ...
}
```

### Appliance Options

Edit `applianceOptions` array in `App.js`:

```javascript
const applianceOptions = [
    "Washer",
    "Dryer",
    // Add more options here
];
```

### Server Settings

Edit `Server.py` for custom configuration:

```python
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # Change max file size
```

##  Mobile Optimization

### Access from Mobile Device

1. Start server on computer
2. Find computer's local IP address:

   ```powershell
   ipconfig
   ```

   Look for "IPv4 Address" (e.g., 192.168.1.100)
3. On mobile device, open browser and navigate to:

   ```text
   http://YOUR_IP_ADDRESS:5000
   ```

### Tips for Best Mobile Experience

- Use rear camera for better invoice photos
- Ensure good lighting when capturing
- Hold device steady during OCR processing
- Use landscape mode for signature capture
- Export data regularly to avoid browser memory limits

## 🐛 Troubleshooting

### Camera Not Working

- **Check HTTPS**: Camera requires secure connection
- **Grant Permissions**: Allow camera access in browser settings
- **Try Different Browser**: Some browsers have better camera support
- **Use Upload Instead**: Fall back to file upload if camera fails

### OCR Accuracy Issues

- **Better Lighting**: Ensure invoice is well-lit and in focus
- **Flatten Invoice**: Remove wrinkles and shadows
- **Higher Resolution**: Use device's highest camera quality
- **Manual Edit**: You can manually edit extracted data in table

### Export Not Working

- **Check Popup Blocker**: Allow downloads in browser settings
- **Try Different Format**: CSV usually has best compatibility
- **Clear Browser Cache**: Sometimes helps with download issues

### Server Errors

- **Check Tesseract**: Verify Tesseract OCR is installed
- **Python Version**: Ensure Python 3.7+ is installed
- **Firewall**: Allow port 5000 through firewall
- **Dependencies**: Run `pip install -r requirements.txt`

##  License

This project is provided as-is for delivery team operations. Modify and customize as needed for your business requirements.

##  Support

For issues or questions:

1. Check this README
2. Review console logs (F12 in browser)
3. Check Python server output
4. Verify all dependencies are installed

##  Future Enhancements

Potential improvements:

- Cloud storage integration (Google Drive, Dropbox)
- Database backend (SQLite, PostgreSQL)
- User authentication and multi-user support
- Route optimization integration
- Real-time sync across devices
- Barcode/QR code scanning
- Voice notes for drivers
- Push notifications for updates

---

## Built for delivery teams who need fast, reliable invoice processing on the go! 🚚📦
