package com.mobileinvoice.delivery.ui.adapters;

import android.view.LayoutInflater;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.DiffUtil;
import androidx.recyclerview.widget.ListAdapter;
import androidx.recyclerview.widget.RecyclerView;
import com.mobileinvoice.ocr.database.Invoice;
import com.mobileinvoice.ocr.databinding.ItemInvoiceBinding;
import java.util.Objects;

/**
 * Adapter for displaying delivery items in a RecyclerView.
 * Uses DiffUtil for efficient list updates.
 * 
 * This adapter is designed to work with the Invoice data model
 * and provides callbacks for delivery-specific actions.
 * 
 * @author Mobile Invoice Team
 * @version 1.0
 */
public class DeliveryAdapter extends ListAdapter<Invoice, DeliveryAdapter.DeliveryViewHolder> {
    
    private OnDeliveryClickListener listener;

    public interface OnDeliveryClickListener {
        void onDeliveryClick(Invoice invoice);
        void onDeliveryComplete(Invoice invoice);
    }

    public DeliveryAdapter(OnDeliveryClickListener listener) {
        super(DIFF_CALLBACK);
        this.listener = listener;
    }

    /**
     * DiffUtil callback for calculating the diff between two lists.
     * This improves performance by only updating changed items.
     */
    private static final DiffUtil.ItemCallback<Invoice> DIFF_CALLBACK = 
        new DiffUtil.ItemCallback<Invoice>() {
            
            @Override
            public boolean areItemsTheSame(@NonNull Invoice oldItem, @NonNull Invoice newItem) {
                return oldItem.getId() == newItem.getId();
            }

            @Override
            public boolean areContentsTheSame(@NonNull Invoice oldItem, @NonNull Invoice newItem) {
                // Compare all fields - using Objects.equals() for String comparison
                return Objects.equals(oldItem.getInvoiceNumber(), newItem.getInvoiceNumber()) &&
                       Objects.equals(oldItem.getCustomerName(), newItem.getCustomerName()) &&
                       Objects.equals(oldItem.getAddress(), newItem.getAddress()) &&
                       Objects.equals(oldItem.getPhone(), newItem.getPhone()) &&
                       Objects.equals(oldItem.getItems(), newItem.getItems()) &&
                       Objects.equals(oldItem.getNotes(), newItem.getNotes()) &&
                       oldItem.getTimestamp() == newItem.getTimestamp();
            }
        };

    @NonNull
    @Override
    public DeliveryViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemInvoiceBinding binding = ItemInvoiceBinding.inflate(
            LayoutInflater.from(parent.getContext()), parent, false);
        return new DeliveryViewHolder(binding);
    }

    @Override
    public void onBindViewHolder(@NonNull DeliveryViewHolder holder, int position) {
        Invoice invoice = getItem(position);
        holder.bind(invoice);
    }

    class DeliveryViewHolder extends RecyclerView.ViewHolder {
        private final ItemInvoiceBinding binding;

        DeliveryViewHolder(ItemInvoiceBinding binding) {
            super(binding.getRoot());
            this.binding = binding;
        }

        void bind(Invoice invoice) {
            binding.tvInvoiceNumber.setText(invoice.getInvoiceNumber() != null ? 
                invoice.getInvoiceNumber() : "INV-" + invoice.getId());
            binding.tvCustomerName.setText(invoice.getCustomerName() != null ? 
                invoice.getCustomerName() : "Unknown Customer");
            
            String address = invoice.getAddress() != null ? invoice.getAddress() : "No address";
            binding.tvAddress.setText(address);
            
            binding.btnViewDetails.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onDeliveryClick(invoice);
                }
            });
            
            binding.btnDelete.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onDeliveryComplete(invoice);
                }
            });
        }
    }
}
