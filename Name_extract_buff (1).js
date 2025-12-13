function extractName(text) {
    // Strategy: Look for specific labels first. 
    // If found, grab the text until the end of the line or a specific stop word.
    const patterns = [
        /(?:Sold To|Bill To|Deliver To|Ship To|Customer|Consignee)[:\s\.]*([A-Za-z\s\.]+)(?=\n|Address|Phone|ID)/i,
        /Name[:\s\.]*([A-Za-z\s]+)(?=\n|Address|Phone)/i,
        // Fallback: Look for "Customer: " specifically
        /Customer[:\s]+([A-Za-z]+ [A-Za-z]+)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            // Clean up the result (remove extra spaces or newlines)
            let name = match[1].trim().replace(/\n/g, " ");
            // Filter out garbage if the OCR picked up noise (e.g., if name is too short)
            if (name.length > 2) return name;
        }
    }
    return "Unknown";
}
