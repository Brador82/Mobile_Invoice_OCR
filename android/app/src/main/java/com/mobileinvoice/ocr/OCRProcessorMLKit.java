package com.mobileinvoice.ocr;

import android.content.Context;
import android.graphics.Bitmap;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Log;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * ML Kit-based OCR Processor - on-device text recognition
 * Replaces Tesseract and HTTP backend with Google ML Kit
 */
public class OCRProcessorMLKit {
    private static final String TAG = "OCRProcessorMLKit";
    private Context context;
    private TextRecognizer recognizer;
    
    // Patterns for field extraction
    private static final Pattern PHONE_PATTERN = Pattern.compile(
        "\\(?\\d{3}\\)?[-\\s.]?\\d{3}[-\\s.]?\\d{4}"
    );
    
    private static final Pattern INVOICE_PATTERN = Pattern.compile(
        "(?:INV|INVOICE|#)[-\\s:]*([A-Z0-9-]+)",
        Pattern.CASE_INSENSITIVE
    );
    
    // Pattern for invoice number that appears near/after "INVOICE" header
    // Format like: KY12345-1234567-2345 or CA2163AMJBF
    private static final Pattern HEADER_INVOICE_PATTERN = Pattern.compile(
        "\\b([A-Z]{2}\\d{4}[A-Z0-9]+|\\d{5,}[-\\d]+)\\b"
    );
    
    private static final Pattern ZIP_PATTERN = Pattern.compile(
        "\\b\\d{5}(?:-\\d{4})?\\b"
    );
    
    // Common appliance keywords for item extraction
    private static final String[] APPLIANCE_KEYWORDS = {
        "REFRIGERATOR", "FRIDGE", "WASHER", "DRYER", "DISHWASHER", 
        "STOVE", "RANGE", "OVEN", "MICROWAVE", "FREEZER"
    };

    public OCRProcessorMLKit(Context context) {
        this.context = context;
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        Log.d(TAG, "ML Kit OCR Processor initialized - on-device processing");
    }

    /**
     * Process image with ML Kit and extract invoice fields
     */
    public OCRResult processImage(Uri imageUri) {
        OCRResult result = new OCRResult();
        
        try {
            Log.d(TAG, "Processing image with ML Kit: " + imageUri);
            
            // Load image from URI
            Bitmap bitmap = MediaStore.Images.Media.getBitmap(
                context.getContentResolver(), imageUri
            );
            
            if (bitmap == null) {
                Log.e(TAG, "Failed to load bitmap from URI");
                result.rawText = "Error: Could not load image";
                return result;
            }
            
            // Create ML Kit InputImage
            InputImage image = InputImage.fromBitmap(bitmap, 0);
            
            // Process synchronously (wrap async in blocking call)
            final Object lock = new Object();
            final boolean[] done = {false};
            final Text[] textResult = {null};
            
            recognizer.process(image)
                .addOnSuccessListener(text -> {
                    synchronized (lock) {
                        textResult[0] = text;
                        done[0] = true;
                        lock.notify();
                    }
                })
                .addOnFailureListener(e -> {
                    synchronized (lock) {
                        Log.e(TAG, "ML Kit recognition failed: " + e.getMessage(), e);
                        done[0] = true;
                        lock.notify();
                    }
                });
            
            // Wait for recognition to complete
            synchronized (lock) {
                while (!done[0]) {
                    try {
                        lock.wait(10000); // 10 second timeout
                    } catch (InterruptedException e) {
                        Log.e(TAG, "Recognition interrupted", e);
                        break;
                    }
                }
            }
            
            if (textResult[0] != null) {
                result = extractInvoiceData(textResult[0]);
                Log.d(TAG, "========= ML KIT EXTRACTION RESULTS =========");
                Log.d(TAG, "Invoice #: " + result.invoiceNumber);
                Log.d(TAG, "Customer: " + result.customerName);
                Log.d(TAG, "Address: " + result.address);
                Log.d(TAG, "Phone: " + result.phone);
                Log.d(TAG, "Items: " + result.items);
                Log.d(TAG, "============================================");
            } else {
                result.rawText = "Error: Recognition timed out or failed";
            }
            
        } catch (IOException e) {
            Log.e(TAG, "Error loading image: " + e.getMessage(), e);
            result.rawText = "Error: " + e.getMessage();
        } catch (Exception e) {
            Log.e(TAG, "Error processing image: " + e.getMessage(), e);
            result.rawText = "Error: " + e.getMessage();
        }
        
        return result;
    }
    
    /**
     * Extract invoice fields from ML Kit Text result
     * Intelligent parsing to identify customer name, address, phone, invoice number
     * Now includes top-right invoice number extraction and item detection
     */
    private OCRResult extractInvoiceData(Text text) {
        OCRResult result = new OCRResult();
        StringBuilder fullText = new StringBuilder();
        
        // Collect all lines from all text blocks WITH POSITION DATA
        List<String> allLines = new ArrayList<>();
        List<TextBlock> positionedBlocks = new ArrayList<>();
        
        for (Text.TextBlock block : text.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                String lineText = line.getText().trim();
                if (!lineText.isEmpty()) {
                    allLines.add(lineText);
                    fullText.append(lineText).append("\n");
                    
                    // Store position for top-right detection
                    android.graphics.Rect bounds = line.getBoundingBox();
                    if (bounds != null) {
                        positionedBlocks.add(new TextBlock(
                            lineText, 
                            bounds.top, 
                            bounds.left
                        ));
                    }
                }
            }
        }
        
        result.rawText = fullText.toString();
        Log.d(TAG, "Extracted " + allLines.size() + " lines from image");
        
        // Extract invoice number from top-right corner (primary reference)
        result.invoiceNumber = extractTopRightInvoiceNumber(positionedBlocks);
        
        // Extract items being delivered
        result.items = extractDeliveredItems(allLines);
        
        // Find "BILL TO:" line
        int billToIndex = -1;
        for (int i = 0; i < allLines.size(); i++) {
            String line = allLines.get(i).toUpperCase();
            if (line.contains("BILL TO")) {
                billToIndex = i;
                Log.d(TAG, "Found 'BILL TO:' at line " + i + ": " + allLines.get(i));
                break;
            }
        }
        
        if (billToIndex >= 0 && billToIndex + 3 < allLines.size()) {
            // Next 3 lines after "BILL TO:" are: Name, Address, Phone
            String nameLine = allLines.get(billToIndex + 1);
            String addressLine = allLines.get(billToIndex + 2);
            String phoneLine = allLines.get(billToIndex + 3);
            
            Log.d(TAG, "Name line: " + nameLine);
            Log.d(TAG, "Address line: " + addressLine);
            Log.d(TAG, "Phone line: " + phoneLine);
            
            // Extract name (first word(s) before ID or slash)
            if (nameLine.contains("Name:")) {
                nameLine = nameLine.substring(nameLine.indexOf("Name:") + 5).trim();
            }
            
            // Extract invoice ID from name line as fallback: (ID:XXXXXXX)
            if (result.invoiceNumber.isEmpty() || result.invoiceNumber.equals("No invoice number")) {
                Pattern idPattern = Pattern.compile("\\(ID:([^)]+)\\)");
                Matcher idMatcher = idPattern.matcher(nameLine);
                if (idMatcher.find()) {
                    result.invoiceNumber = idMatcher.group(1).trim();
                    Log.d(TAG, "Using fallback invoice ID from name line: " + result.invoiceNumber);
                    // Remove ID and everything after it from name
                    nameLine = nameLine.substring(0, idMatcher.start()).trim();
                }
            }
            
            result.customerName = nameLine;
            
            // Extract address
            if (addressLine.contains("Address:")) {
                addressLine = addressLine.substring(addressLine.indexOf("Address:") + 8).trim();
            }
            result.address = addressLine;
            
            // Extract phone from phone line
            if (phoneLine.contains("Phone:")) {
                phoneLine = phoneLine.substring(phoneLine.indexOf("Phone:") + 6).trim();
            }
            Matcher phoneMatcher = PHONE_PATTERN.matcher(phoneLine);
            if (phoneMatcher.find()) {
                result.phone = phoneMatcher.group().trim();
            }
            
        } else {
            Log.w(TAG, "'BILL TO:' section not found or incomplete - using fallback");
            result = extractWithPatterns(fullText.toString());
        }
        
        // Clean up results
        if (result.customerName.isEmpty()) {
            result.customerName = "Unknown Customer";
        }
        if (result.address.isEmpty()) {
            result.address = "No address found";
        }
        if (result.phone.isEmpty()) {
            result.phone = "No phone";
        }
        if (result.invoiceNumber.isEmpty()) {
            result.invoiceNumber = "No invoice number";
        }
        
        return result;
    }
    
    /**
     * Extract invoice number from top-right corner (primary company reference)
     * Looks for number patterns near "INVOICE" header in top-right position
     */
    private String extractTopRightInvoiceNumber(List<TextBlock> blocks) {
        if (blocks.isEmpty()) return "";
        
        // Find the rightmost position to identify top-right area
        int maxLeft = 0;
        for (TextBlock block : blocks) {
            if (block.left > maxLeft) maxLeft = block.left;
        }
        
        // Top-right is roughly right 40% and top 30% of image
        int rightThreshold = (int)(maxLeft * 0.6);
        int topThreshold = Integer.MAX_VALUE;
        for (TextBlock block : blocks) {
            if (block.top < topThreshold) topThreshold = block.top;
        }
        topThreshold = (int)(topThreshold + (topThreshold * 0.3));
        
        String invoiceNumber = "";
        boolean foundInvoiceHeader = false;
        
        // First pass: find "INVOICE" text in top-right
        for (TextBlock block : blocks) {
            if (block.left >= rightThreshold && block.top <= topThreshold) {
                if (block.text.toUpperCase().contains("INVOICE")) {
                    foundInvoiceHeader = true;
                    Log.d(TAG, "Found INVOICE header at position (" + block.left + ", " + block.top + ")");
                    break;
                }
            }
        }
        
        // Second pass: extract number patterns near INVOICE header
        if (foundInvoiceHeader) {
            for (TextBlock block : blocks) {
                if (block.left >= rightThreshold && block.top <= topThreshold) {
                    // Look for invoice number patterns
                    Matcher matcher = HEADER_INVOICE_PATTERN.matcher(block.text);
                    if (matcher.find()) {
                        invoiceNumber = matcher.group(1);
                        Log.d(TAG, "Extracted TOP-RIGHT invoice number: " + invoiceNumber);
                        break;
                    }
                    
                    // Also check for alphanumeric strings (like CA2163AMJBF)
                    if (block.text.matches("[A-Z0-9]{8,}")) {
                        invoiceNumber = block.text;
                        Log.d(TAG, "Extracted TOP-RIGHT alphanumeric invoice: " + invoiceNumber);
                        break;
                    }
                }
            }
        }
        
        // Fallback: look anywhere in top portion for invoice-like numbers
        if (invoiceNumber.isEmpty()) {
            for (TextBlock block : blocks) {
                if (block.top <= topThreshold) {
                    Matcher matcher = HEADER_INVOICE_PATTERN.matcher(block.text);
                    if (matcher.find() && matcher.group(1).length() >= 8) {
                        invoiceNumber = matcher.group(1);
                        Log.d(TAG, "Fallback: Found invoice number in top area: " + invoiceNumber);
                        break;
                    }
                }
            }
        }
        
        return invoiceNumber;
    }
    
    /**
     * Extract list of items/appliances being delivered
     * Looks for appliance keywords and product descriptions
     */
    private String extractDeliveredItems(List<String> lines) {
        List<String> items = new ArrayList<>();
        boolean inItemSection = false;
        
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            String upperLine = line.toUpperCase();
            
            // Detect start of items section
            if (upperLine.contains("ITEM") || upperLine.contains("DESCRIPTION") ||
                upperLine.contains("PRODUCT") || upperLine.contains("MODEL")) {
                inItemSection = true;
                Log.d(TAG, "Found item section at line " + i + ": " + line);
                continue;
            }
            
            // Stop at warranty, terms, or footer sections
            if (upperLine.contains("WARRANTY") || upperLine.contains("TERMS") ||
                upperLine.contains("TOTAL") || upperLine.contains("SUBTOTAL") ||
                upperLine.contains("TAX")) {
                inItemSection = false;
                break;
            }
            
            // Extract items: look for appliance keywords or numbered items
            if (inItemSection || containsApplianceKeyword(upperLine)) {
                // Clean and add item if it looks like product description
                if (line.length() > 3 && !line.matches("^[\\d\\s.$]+$")) {
                    String cleanedItem = line.replaceAll("^\\d+[\\s.)]\\s*", "").trim();
                    if (!cleanedItem.isEmpty() && cleanedItem.length() > 3) {
                        items.add(cleanedItem);
                        Log.d(TAG, "Found item: " + cleanedItem);
                    }
                }
            }
        }
        
        // Return comma-separated list
        return items.isEmpty() ? "No items detected" : String.join(", ", items);
    }
    
    /**
     * Check if line contains appliance keywords
     */
    private boolean containsApplianceKeyword(String upperLine) {
        for (String keyword : APPLIANCE_KEYWORDS) {
            if (upperLine.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Fallback pattern-based extraction when structure not found
     */
    private OCRResult extractWithPatterns(String text) {
        OCRResult result = new OCRResult();
        result.rawText = text;
        
        // Extract phone
        Matcher phoneMatcher = PHONE_PATTERN.matcher(text);
        if (phoneMatcher.find()) {
            result.phone = phoneMatcher.group().trim();
        }
        
        // Extract invoice number
        Matcher invMatcher = INVOICE_PATTERN.matcher(text);
        if (invMatcher.find()) {
            result.invoiceNumber = invMatcher.group(1).trim();
        }
        
        // Try to extract name and address from lines
        String[] lines = text.split("\n");
        List<String> potentialAddressLines = new ArrayList<>();
        
        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty()) continue;
            
            // Skip header lines (company name, etc.)
            if (line.toUpperCase().contains("APPLIANCES") || 
                line.toUpperCase().contains("BATTLEFIELD") ||
                line.toUpperCase().contains("INVOICE") ||
                line.toUpperCase().contains("DATE")) {
                continue;
            }
            
            // Lines with street addresses or zip codes are likely customer data
            if (line.matches(".*\\d+.*[A-Za-z]+.*") || ZIP_PATTERN.matcher(line).find()) {
                potentialAddressLines.add(line);
            }
        }
        
        // First non-header line could be customer name
        if (!potentialAddressLines.isEmpty()) {
            result.customerName = potentialAddressLines.get(0);
            if (potentialAddressLines.size() > 1) {
                result.address = String.join(", ", 
                    potentialAddressLines.subList(1, potentialAddressLines.size()));
            }
        }
        
        return result;
    }
    
    /**
     * Simple class to hold text block with position
     */
    private static class TextBlock {
        String text;
        int top;
        int left;
        
        TextBlock(String text, int top, int left) {
            this.text = text;
            this.top = top;
            this.left = left;
        }
    }
    
    /**
     * Result container for OCR extraction
     */
    public static class OCRResult {
        public String customerName = "";
        public String address = "";
        public String phone = "";
        public String invoiceNumber = "";  // Primary company reference from top-right
        public String items = "";            // Delivered appliances/products
        public String rawText = "";
    }
    
    /**
     * Clean up resources
     */
    public void close() {
        if (recognizer != null) {
            recognizer.close();
        }
    }
}
