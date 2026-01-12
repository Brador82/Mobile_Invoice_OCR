package com.mobileinvoice.ocr;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.mobileinvoice.ocr.database.Invoice;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class ExportHelper {
    private final Context context;
    
    public ExportHelper(Context context) {
        this.context = context;
    }
    
    /**
     * Export invoices to CSV format
     */
    public void exportToCSV(List<Invoice> invoices) {
        if (invoices == null || invoices.isEmpty()) {
            Toast.makeText(context, "No invoices to export", Toast.LENGTH_SHORT).show();
            return;
        }
        
        StringBuilder csv = new StringBuilder();
        
        // CSV Header
        csv.append("Invoice #,Customer Name,Address,Phone,Items,POD Image,Signature,Notes,Timestamp\n");
        
        // CSV Data
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US);
        for (Invoice invoice : invoices) {
            csv.append(escapeCSV(invoice.getInvoiceNumber())).append(",");
            csv.append(escapeCSV(invoice.getCustomerName())).append(",");
            csv.append(escapeCSV(invoice.getAddress())).append(",");
            csv.append(escapeCSV(invoice.getPhone())).append(",");
            csv.append(escapeCSV(invoice.getItems())).append(",");
            csv.append(escapeCSV(invoice.getPodImagePath() != null ? "Yes" : "No")).append(",");
            csv.append(escapeCSV(invoice.getSignatureImagePath() != null ? "Yes" : "No")).append(",");
            csv.append(escapeCSV(invoice.getNotes())).append(",");
            csv.append(escapeCSV(dateFormat.format(new Date(invoice.getTimestamp())))).append("\n");
        }
        
        // Save to file
        String filename = "invoices_" + System.currentTimeMillis() + ".csv";
        File file = saveToFile(filename, csv.toString());
        
        if (file != null) {
            shareFile(file, "text/csv", "Export CSV");
        }
    }
    
    /**
     * Export invoices to Excel-compatible TSV format
     */
    public void exportToExcel(List<Invoice> invoices) {
        if (invoices == null || invoices.isEmpty()) {
            Toast.makeText(context, "No invoices to export", Toast.LENGTH_SHORT).show();
            return;
        }
        
        StringBuilder tsv = new StringBuilder();
        
        // TSV Header
        tsv.append("Invoice #\tCustomer Name\tAddress\tPhone\tItems\tPOD Image\tSignature\tNotes\tTimestamp\n");
        
        // TSV Data
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US);
        for (Invoice invoice : invoices) {
            tsv.append(escapeTSV(invoice.getInvoiceNumber())).append("\t");
            tsv.append(escapeTSV(invoice.getCustomerName())).append("\t");
            tsv.append(escapeTSV(invoice.getAddress())).append("\t");
            tsv.append(escapeTSV(invoice.getPhone())).append("\t");
            tsv.append(escapeTSV(invoice.getItems())).append("\t");
            tsv.append(escapeTSV(invoice.getPodImagePath() != null ? "Yes" : "No")).append("\t");
            tsv.append(escapeTSV(invoice.getSignatureImagePath() != null ? "Yes" : "No")).append("\t");
            tsv.append(escapeTSV(invoice.getNotes())).append("\t");
            tsv.append(escapeTSV(dateFormat.format(new Date(invoice.getTimestamp())))).append("\n");
        }
        
        // Save to file
        String filename = "invoices_" + System.currentTimeMillis() + ".xls";
        File file = saveToFile(filename, tsv.toString());
        
        if (file != null) {
            shareFile(file, "application/vnd.ms-excel", "Export Excel");
        }
    }
    
    /**
     * Export invoices to JSON format with full data
     */
    public void exportToJSON(List<Invoice> invoices) {
        if (invoices == null || invoices.isEmpty()) {
            Toast.makeText(context, "No invoices to export", Toast.LENGTH_SHORT).show();
            return;
        }
        
        try {
            JSONObject root = new JSONObject();
            root.put("export_date", new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date()));
            root.put("total_invoices", invoices.size());
            
            JSONArray invoicesArray = new JSONArray();
            
            for (Invoice invoice : invoices) {
                JSONObject invoiceObj = new JSONObject();
                invoiceObj.put("id", invoice.getId());
                invoiceObj.put("invoice_number", invoice.getInvoiceNumber());
                invoiceObj.put("customer_name", invoice.getCustomerName());
                invoiceObj.put("address", invoice.getAddress());
                invoiceObj.put("phone", invoice.getPhone());
                invoiceObj.put("items", invoice.getItems());
                invoiceObj.put("pod_image_path", invoice.getPodImagePath());
                invoiceObj.put("signature_image_path", invoice.getSignatureImagePath());
                invoiceObj.put("notes", invoice.getNotes());
                invoiceObj.put("original_image_path", invoice.getOriginalImagePath());
                invoiceObj.put("raw_ocr_text", invoice.getRawOcrText());
                invoiceObj.put("timestamp", invoice.getTimestamp());
                
                invoicesArray.put(invoiceObj);
            }
            
            root.put("invoices", invoicesArray);
            
            // Save to file
            String filename = "invoices_" + System.currentTimeMillis() + ".json";
            File file = saveToFile(filename, root.toString(4)); // Pretty print with indent
            
            if (file != null) {
                shareFile(file, "application/json", "Export JSON");
            }
            
        } catch (JSONException e) {
            e.printStackTrace();
            Toast.makeText(context, "Error creating JSON export", Toast.LENGTH_SHORT).show();
        }
    }
    
    /**
     * Export summary statistics
     */
    public String getExportSummary(List<Invoice> invoices) {
        if (invoices == null || invoices.isEmpty()) {
            return "No invoices available for export";
        }
        
        int totalInvoices = invoices.size();
        int withPOD = 0;
        int withSignature = 0;
        int withItems = 0;
        
        for (Invoice invoice : invoices) {
            if (invoice.getPodImagePath() != null && !invoice.getPodImagePath().isEmpty()) {
                withPOD++;
            }
            if (invoice.getSignatureImagePath() != null && !invoice.getSignatureImagePath().isEmpty()) {
                withSignature++;
            }
            if (invoice.getItems() != null && !invoice.getItems().isEmpty()) {
                withItems++;
            }
        }
        
        return String.format(Locale.US,
            "Export Summary:\n" +
            "Total Invoices: %d\n" +
            "With POD Photos: %d (%.1f%%)\n" +
            "With Signatures: %d (%.1f%%)\n" +
            "With Items: %d (%.1f%%)",
            totalInvoices,
            withPOD, (withPOD * 100.0f / totalInvoices),
            withSignature, (withSignature * 100.0f / totalInvoices),
            withItems, (withItems * 100.0f / totalInvoices)
        );
    }
    
    /**
     * Escape CSV special characters
     */
    private String escapeCSV(String value) {
        if (value == null) return "";
        
        // If value contains comma, quote, or newline, wrap in quotes and escape quotes
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        
        return value;
    }
    
    /**
     * Escape TSV special characters
     */
    private String escapeTSV(String value) {
        if (value == null) return "";
        
        // Replace tabs and newlines with spaces
        return value.replace("\t", " ").replace("\n", " ").replace("\r", "");
    }
    
    /**
     * Save content to file in app's cache directory
     */
    private File saveToFile(String filename, String content) {
        try {
            File exportDir = new File(context.getExternalFilesDir(null), "exports");
            if (!exportDir.exists()) {
                exportDir.mkdirs();
            }
            
            File file = new File(exportDir, filename);
            FileOutputStream fos = new FileOutputStream(file);
            fos.write(content.getBytes());
            fos.close();
            
            Toast.makeText(context, "Exported to: " + filename, Toast.LENGTH_LONG).show();
            return file;
            
        } catch (IOException e) {
            e.printStackTrace();
            Toast.makeText(context, "Error saving export file", Toast.LENGTH_SHORT).show();
            return null;
        }
    }
    
    /**
     * Share file using system share dialog
     */
    private void shareFile(File file, String mimeType, String title) {
        try {
            Uri fileUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                file
            );
            
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType(mimeType);
            shareIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Invoice Export");
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            
            context.startActivity(Intent.createChooser(shareIntent, title));
            
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(context, "Error sharing file: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }
}
