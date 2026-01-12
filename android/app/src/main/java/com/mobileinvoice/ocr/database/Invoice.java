package com.mobileinvoice.ocr.database;

import androidx.room.Entity;
import androidx.room.PrimaryKey;
import androidx.room.TypeConverters;

@Entity(tableName = "invoices")
@TypeConverters(Converters.class)
public class Invoice {
    @PrimaryKey(autoGenerate = true)
    private int id;

    private String invoiceNumber;
    private String customerName;
    private String address;
    private String phone;
    private String items; // Comma-separated string
    private String podImagePath;
    private String signatureImagePath;
    private String notes;
    private String originalImagePath;
    private String rawOcrText;
    private long timestamp;

    public Invoice() {
        this.timestamp = System.currentTimeMillis();
    }

    // Getters
    public int getId() { return id; }
    public String getInvoiceNumber() { return invoiceNumber; }
    public String getCustomerName() { return customerName; }
    public String getAddress() { return address; }
    public String getPhone() { return phone; }
    public String getItems() { return items; }
    public String getPodImagePath() { return podImagePath; }
    public String getSignatureImagePath() { return signatureImagePath; }
    public String getNotes() { return notes; }
    public String getOriginalImagePath() { return originalImagePath; }
    public String getRawOcrText() { return rawOcrText; }
    public long getTimestamp() { return timestamp; }

    // Setters
    public void setId(int id) { this.id = id; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public void setAddress(String address) { this.address = address; }
    public void setPhone(String phone) { this.phone = phone; }
    public void setItems(String items) { this.items = items; }
    public void setPodImagePath(String podImagePath) { this.podImagePath = podImagePath; }
    public void setSignatureImagePath(String signatureImagePath) { this.signatureImagePath = signatureImagePath; }
    public void setNotes(String notes) { this.notes = notes; }
    public void setOriginalImagePath(String originalImagePath) { this.originalImagePath = originalImagePath; }
    public void setRawOcrText(String rawOcrText) { this.rawOcrText = rawOcrText; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}
