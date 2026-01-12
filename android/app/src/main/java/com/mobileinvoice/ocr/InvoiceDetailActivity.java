package com.mobileinvoice.ocr;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.mobileinvoice.ocr.database.Invoice;
import com.mobileinvoice.ocr.database.InvoiceDatabase;
import com.mobileinvoice.ocr.databinding.ActivityInvoiceDetailBinding;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class InvoiceDetailActivity extends AppCompatActivity {
    private ActivityInvoiceDetailBinding binding;
    private InvoiceDatabase database;
    private Invoice currentInvoice;
    private int invoiceId;
    private String signaturePath;
    private String podImagePath;
    private List<String> selectedItems = new ArrayList<>();
    
    private ActivityResultLauncher<Intent> signatureLauncher;
    private ActivityResultLauncher<Intent> podCameraLauncher;
    private ActivityResultLauncher<String> requestCameraPermissionLauncher;
    
    private static final String[] AVAILABLE_ITEMS = {
        "Washer", "Dryer", "Refrigerator", "Dishwasher", 
        "Freezer", "Range", "Oven", "Microwave", "Stove", "Other"
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityInvoiceDetailBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());
        
        database = InvoiceDatabase.getInstance(this);
        
        setupActivityResultLaunchers();
        loadInvoiceFromDatabase();
        setupClickListeners();
    }
    
    private void setupActivityResultLaunchers() {
        // Signature launcher
        signatureLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                    signaturePath = result.getData().getStringExtra("signature_path");
                    Uri signatureUri = result.getData().getData();
                    
                    if (signatureUri != null) {
                        binding.ivSignature.setImageURI(signatureUri);
                        binding.ivSignature.setVisibility(View.VISIBLE);
                        binding.btnCaptureSignature.setText("Change Signature");
                        Toast.makeText(this, "Signature captured!", Toast.LENGTH_SHORT).show();
                    } else if (signaturePath != null) {
                        File sigFile = new File(signaturePath);
                        if (sigFile.exists()) {
                            binding.ivSignature.setImageURI(Uri.fromFile(sigFile));
                            binding.ivSignature.setVisibility(View.VISIBLE);
                            binding.btnCaptureSignature.setText("Change Signature");
                        }
                    }
                }
            }
        );
        
        // POD camera launcher
        podCameraLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                    Uri imageUri = result.getData().getData();
                    if (imageUri != null) {
                        // Save the POD image to app's private storage
                        podImagePath = saveImageToStorage(imageUri, "pod_" + invoiceId + ".jpg");
                        if (podImagePath != null) {
                            binding.ivPod.setImageURI(Uri.parse(podImagePath));
                            binding.ivPod.setVisibility(View.VISIBLE);
                            binding.btnCapturePOD.setText("Change POD Photo");
                            Toast.makeText(this, "POD photo captured!", Toast.LENGTH_SHORT).show();
                        }
                    }
                }
            }
        );
        
        // Camera permission launcher
        requestCameraPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            isGranted -> {
                if (isGranted) {
                    openPODCamera();
                } else {
                    Toast.makeText(this, "Camera permission required for POD capture", Toast.LENGTH_SHORT).show();
                }
            }
        );
    }
    
    private void loadInvoiceFromDatabase() {
        invoiceId = getIntent().getIntExtra("invoice_id", 0);
        
        if (invoiceId > 0) {
            new Thread(() -> {
                currentInvoice = database.invoiceDao().getInvoiceByIdSync(invoiceId);
                
                runOnUiThread(() -> {
                    if (currentInvoice != null) {
                        binding.etInvoiceNumber.setText(currentInvoice.getInvoiceNumber());
                        binding.etCustomerName.setText(currentInvoice.getCustomerName());
                        binding.etAddress.setText(currentInvoice.getAddress());
                        binding.etPhone.setText(currentInvoice.getPhone());
                        binding.etNotes.setText(currentInvoice.getNotes());
                        
                        // Load items
                        if (currentInvoice.getItems() != null && !currentInvoice.getItems().isEmpty()) {
                            selectedItems = new ArrayList<>(Arrays.asList(currentInvoice.getItems().split("\\s*,\\s*")));
                            updateSelectedItemsDisplay();
                        }
                        
                        // Load signature
                        if (currentInvoice.getSignatureImagePath() != null) {
                            signaturePath = currentInvoice.getSignatureImagePath();
                            File sigFile = new File(signaturePath);
                            if (sigFile.exists()) {
                                binding.ivSignature.setImageURI(Uri.fromFile(sigFile));
                                binding.ivSignature.setVisibility(View.VISIBLE);
                                binding.btnCaptureSignature.setText("Change Signature");
                            }
                        }
                        
                        // Load POD image
                        if (currentInvoice.getPodImagePath() != null) {
                            podImagePath = currentInvoice.getPodImagePath();
                            File podFile = new File(podImagePath);
                            if (podFile.exists()) {
                                binding.ivPod.setImageURI(Uri.fromFile(podFile));
                                binding.ivPod.setVisibility(View.VISIBLE);
                                binding.btnCapturePOD.setText("Change POD Photo");
                            }
                        }
                    }
                });
            }).start();
        }
    }
    
    private void setupClickListeners() {
        binding.btnCaptureSignature.setOnClickListener(v -> {
            Intent intent = new Intent(this, SignatureActivity.class);
            signatureLauncher.launch(intent);
        });
        
        binding.btnCapturePOD.setOnClickListener(v -> {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) 
                    == PackageManager.PERMISSION_GRANTED) {
                openPODCamera();
            } else {
                requestCameraPermissionLauncher.launch(Manifest.permission.CAMERA);
            }
        });
        
        binding.tvSelectedItems.setOnClickListener(v -> showItemSelectionDialog());
        
        binding.btnSave.setOnClickListener(v -> saveInvoiceData());
    }
    
    private void openPODCamera() {
        Intent intent = new Intent(this, CameraActivity.class);
        podCameraLauncher.launch(intent);
    }
    
    private void showItemSelectionDialog() {
        boolean[] checkedItems = new boolean[AVAILABLE_ITEMS.length];
        
        // Pre-select items that are already selected
        for (int i = 0; i < AVAILABLE_ITEMS.length; i++) {
            checkedItems[i] = selectedItems.contains(AVAILABLE_ITEMS[i]);
        }
        
        new AlertDialog.Builder(this)
            .setTitle("Select Items")
            .setMultiChoiceItems(AVAILABLE_ITEMS, checkedItems, (dialog, which, isChecked) -> {
                if (isChecked) {
                    if (!selectedItems.contains(AVAILABLE_ITEMS[which])) {
                        selectedItems.add(AVAILABLE_ITEMS[which]);
                    }
                } else {
                    selectedItems.remove(AVAILABLE_ITEMS[which]);
                }
            })
            .setPositiveButton("OK", (dialog, which) -> updateSelectedItemsDisplay())
            .setNegativeButton("Cancel", null)
            .show();
    }
    
    private void updateSelectedItemsDisplay() {
        if (selectedItems.isEmpty()) {
            binding.tvSelectedItems.setText("Tap to select items");
        } else {
            binding.tvSelectedItems.setText(String.join(", ", selectedItems));
        }
    }
    
    private void saveInvoiceData() {
        if (currentInvoice == null) {
            Toast.makeText(this, "Error: Invoice not loaded", Toast.LENGTH_SHORT).show();
            return;
        }
        
        // Validate required fields
        String invoiceNumber = binding.etInvoiceNumber.getText().toString().trim();
        String customerName = binding.etCustomerName.getText().toString().trim();
        String address = binding.etAddress.getText().toString().trim();
        String phone = binding.etPhone.getText().toString().trim();
        
        if (invoiceNumber.isEmpty()) {
            binding.etInvoiceNumber.setError("Invoice number is required");
            binding.etInvoiceNumber.requestFocus();
            return;
        }
        
        if (customerName.isEmpty()) {
            binding.etCustomerName.setError("Customer name is required");
            binding.etCustomerName.requestFocus();
            return;
        }
        
        // Update invoice with current values
        currentInvoice.setInvoiceNumber(invoiceNumber);
        currentInvoice.setCustomerName(customerName);
        currentInvoice.setAddress(address);
        currentInvoice.setPhone(phone);
        currentInvoice.setNotes(binding.etNotes.getText().toString().trim());
        currentInvoice.setItems(String.join(",", selectedItems));
        currentInvoice.setSignatureImagePath(signaturePath);
        currentInvoice.setPodImagePath(podImagePath);
        
        // Save to database
        new Thread(() -> {
            database.invoiceDao().update(currentInvoice);
            
            runOnUiThread(() -> {
                Toast.makeText(this, "Invoice saved successfully!", Toast.LENGTH_SHORT).show();
                finish();
            });
        }).start();
    }
    
    private String saveImageToStorage(Uri imageUri, String filename) {
        try {
            InputStream inputStream = getContentResolver().openInputStream(imageUri);
            if (inputStream == null) return null;
            
            File storageDir = new File(getFilesDir(), "images");
            if (!storageDir.exists()) {
                storageDir.mkdirs();
            }
            
            File imageFile = new File(storageDir, filename);
            FileOutputStream outputStream = new FileOutputStream(imageFile);
            
            byte[] buffer = new byte[1024];
            int length;
            while ((length = inputStream.read(buffer)) > 0) {
                outputStream.write(buffer, 0, length);
            }
            
            outputStream.close();
            inputStream.close();
            
            return imageFile.getAbsolutePath();
        } catch (IOException e) {
            e.printStackTrace();
            Toast.makeText(this, "Error saving image", Toast.LENGTH_SHORT).show();
            return null;
        }
    }
}
