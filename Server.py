"""
Mobile Invoice OCR - Flask Server
Handles OCR processing, file uploads, and data storage
Compatible with Tesseract.js (client-side) and Python Tesseract (server-side fallback)
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pytesseract
from PIL import Image, ImageOps, ImageFilter
import io
import base64
import re
import os
import json
from datetime import datetime

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

# Configuration
app.config["PROPAGATE_EXCEPTIONS"] = True
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max file size

# Create data directory if it doesn't exist
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)


@app.get("/health")
def health():
    """Health check endpoint"""
    try:
        v = pytesseract.get_tesseract_version()
        return {"ok": True, "tesseract": str(v), "server": "running"}
    except Exception as e:
        return {"ok": False, "error": str(e)}, 500


def preprocess_pil(img: Image.Image) -> Image.Image:
    """
    Enhanced preprocessing for better OCR accuracy:
    - Grayscale conversion
    - Auto-contrast adjustment
    - Intelligent resizing
    - Sharpening
    - Adaptive thresholding
    """
    # Convert to grayscale
    g = ImageOps.grayscale(img)
    
    # Auto-contrast for better visibility
    g = ImageOps.autocontrast(g, cutoff=2)

    # Resize if too small (helps OCR accuracy)
    max_side = 2000
    scale = min(max_side / max(g.size), 1.8)
    if scale > 1.0:
        new_size = (int(g.width * scale), int(g.height * scale))
        g = g.resize(new_size, Image.Resampling.LANCZOS)

    # Apply sharpening filter
    g = g.filter(ImageFilter.UnsharpMask(radius=1.0, percent=150, threshold=3))

    # Simple threshold for better text recognition
    bw = g.point(lambda x: 255 if x > 140 else 0)

    return bw


def extract_invoice_data(text: str) -> dict:
    """
    Enhanced data extraction with multiple pattern matching
    Extracts: invoice number, name, address, phone, items, date, total
    """
    def find(pat):
        m = re.search(pat, text, re.IGNORECASE | re.MULTILINE | re.DOTALL)
        return m.group(1).strip() if m else ""

    # Extract invoice number
    invoice_number = (
        find(r"INVOICE[\s\n]+([A-Z0-9]{8,})")
        or find(r"Invoice[\s#:]+([A-Z0-9\-]{6,})")
        or find(r"INV[\s#:]+([A-Z0-9\-]{6,})")
        or ""
    )

    # Extract customer name
    name = (
        find(r"Name[:\s]+([A-Za-z\s]+?)(?:\s+\(ID:|ID:|\n|Phone)")
        or find(r"BILL TO[:\s]*Name[:\s]+([^\(\n]+)")
        or find(r"Customer[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)")
        or ""
    )

    # Extract phone number
    phone = (
        find(r"Phone[:\s]*(\+?1?[\s\-\.]?\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4})")
        or find(r"(\d{3}[\-\s]?\d{3}[\-\s]?\d{4})")
        or ""
    )

    # Extract address
    address = (
        find(r"Address[:\s]*([^\n]+(?:\n[^Phone]+)?(?=Phone|$))")
        or find(r"Address[:\s]+([0-9]+[^\n]+[A-Z]{2}[\s,]+\d{5})")
        or ""
    )
    if address:
        address = address.replace("\n", " ").strip()

    # Extract date
    date = (
        find(r"(\d{1,2}\/\d{1,2}\/\d{2,4}[\s,]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)")
        or find(r"(\d{1,2}\/\d{1,2}\/\d{2,4})")
        or find(r"(\d{4}-\d{2}-\d{2})")
        or ""
    )

    # Extract total
    total = (
        find(r"Total[:\s]*\$?[\s]*(\d+(?:[\.,]\d{2})?)")
        or find(r"\$[\s]*(\d+\.\d{2})(?:\s*$)")
        or ""
    )

    # Extract items (appliances)
    items = []
    item_patterns = re.finditer(
        r"\b(Washer|Dryer|Refrigerator|Dishwasher|Freezer|Range|Oven|Microwave|Stove)\b",
        text,
        re.IGNORECASE
    )
    for match in item_patterns:
        item = match.group(1).capitalize()
        if item not in items:
            items.append(item)

    return {
        "invoice_number": invoice_number,
        "name": name,
        "phone": phone,
        "address": address,
        "date": date,
        "total": total,
        "items": ", ".join(items) if items else "",
    }


@app.post("/process-ocr")
def process_ocr():
    """
    Process invoice image with OCR
    Accepts base64-encoded image data
    Returns extracted invoice information
    """
    try:
        payload = request.get_json(force=True)
        data_url = payload.get("image", "")

        if not data_url:
            return jsonify({"success": False, "error": "No image data provided"}), 400

        # Separate base64 data
        if "," in data_url:
            b64 = data_url.split(",", 1)[1]
        else:
            b64 = data_url

        # Decode base64 image
        raw = base64.b64decode(b64)

        # Load image with PIL
        img = Image.open(io.BytesIO(raw)).convert("RGB")

        # Preprocess for better OCR
        img = preprocess_pil(img)

        # Perform OCR with optimized configuration
        config = "--oem 1 --psm 6"  # LSTM OCR, assume uniform text block
        text = pytesseract.image_to_string(img, config=config)

        # Extract structured data
        data = extract_invoice_data(text)
        
        # Add metadata
        data["raw_text"] = text
        data["processed_at"] = datetime.now().isoformat()

        return jsonify({"success": True, **data})

    except Exception as e:
        print(f"OCR Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.post("/save-delivery")
def save_delivery():
    """
    Save delivery data to JSON file
    Stores complete delivery record including images
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"delivery_{timestamp}.json"
        filepath = os.path.join(DATA_DIR, filename)

        # Save to file
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return jsonify({
            "success": True,
            "filename": filename,
            "message": "Delivery data saved successfully"
        })

    except Exception as e:
        print(f"Save Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.get("/deliveries")
def get_deliveries():
    """
    Retrieve all saved deliveries
    Returns list of delivery records
    """
    try:
        deliveries = []
        
        # Read all JSON files in data directory
        for filename in os.listdir(DATA_DIR):
            if filename.endswith(".json"):
                filepath = os.path.join(DATA_DIR, filename)
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    data["filename"] = filename
                    deliveries.append(data)

        # Sort by timestamp (newest first)
        deliveries.sort(key=lambda x: x.get("processed_at", ""), reverse=True)

        return jsonify({
            "success": True,
            "count": len(deliveries),
            "deliveries": deliveries
        })

    except Exception as e:
        print(f"Retrieval Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.delete("/delivery/<filename>")
def delete_delivery(filename):
    """
    Delete a specific delivery record
    """
    try:
        # Sanitize filename to prevent directory traversal
        filename = os.path.basename(filename)
        filepath = os.path.join(DATA_DIR, filename)

        if not os.path.exists(filepath):
            return jsonify({"success": False, "error": "File not found"}), 404

        os.remove(filepath)

        return jsonify({
            "success": True,
            "message": f"Deleted {filename}"
        })

    except Exception as e:
        print(f"Delete Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.post("/batch-ocr")
def batch_ocr():
    """
    Process multiple images in batch
    Returns array of OCR results
    """
    try:
        payload = request.get_json(force=True)
        images = payload.get("images", [])

        if not images:
            return jsonify({"success": False, "error": "No images provided"}), 400

        results = []

        for idx, data_url in enumerate(images):
            try:
                # Process each image
                if "," in data_url:
                    b64 = data_url.split(",", 1)[1]
                else:
                    b64 = data_url

                raw = base64.b64decode(b64)
                img = Image.open(io.BytesIO(raw)).convert("RGB")
                img = preprocess_pil(img)

                config = "--oem 1 --psm 6"
                text = pytesseract.image_to_string(img, config=config)

                data = extract_invoice_data(text)
                data["index"] = idx
                data["raw_text"] = text
                data["success"] = True

                results.append(data)

            except Exception as e:
                results.append({
                    "index": idx,
                    "success": False,
                    "error": str(e)
                })

        return jsonify({
            "success": True,
            "processed": len(results),
            "results": results
        })

    except Exception as e:
        print(f"Batch OCR Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.get("/")
def root():
    """Serve the main HTML file"""
    if os.path.exists("Index.html"):
        return send_from_directory(".", "Index.html")
    return {"message": "Mobile Invoice OCR Server is running."}


@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large errors"""
    return jsonify({
        "success": False,
        "error": "File too large. Maximum size is 16MB."
    }), 413


@app.errorhandler(500)
def internal_server_error(error):
    """Handle internal server errors"""
    return jsonify({
        "success": False,
        "error": "Internal server error occurred."
    }), 500


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Mobile Invoice OCR Server")
    print("=" * 60)
    print(f"📂 Data directory: {DATA_DIR}")
    print("🌐 Server starting on http://0.0.0.0:5000")
    print("📱 Access from mobile devices using your local IP")
    print("=" * 60)
    
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)

