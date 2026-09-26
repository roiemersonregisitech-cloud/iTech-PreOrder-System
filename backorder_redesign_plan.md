# Backorders Flow Redesign Plan

## 1. Sidebar Navigation Updates
- **Rename Existing:** Rename the current `/dashboard/backorders` menu item (which lists the confirmed backorders) to **"Backorders Report"**.
- **Add New Menu:** Create a new sidebar item called **"Create Backorder"** (pointing to `/dashboard/create-backorder`) with a distinct icon (e.g., a plus or shopping cart).

## 2. Reservations Page Cleanup (`app/dashboard/reservations/page.tsx`)
- **Strict Stock Enforcement:** Remove the `isBackorderEligible` bypass logic. If an item has 0 stock (or `available < reserveQty`), it will strictly block the user from reserving it.
- **Remove Backorder Warnings:** Remove the yellow warning banner that covers the product picture for out-of-stock items. It will revert to the standard "Out of Stock" state.

## 3. New "Create Backorder" Page (`app/dashboard/create-backorder/page.tsx`)
- **Dedicated UI:** This page will function similarly to the Reservations page, but specifically tailored for backorders.
- **Product Filtering:** The product picker will be filtered to *only* show products where `backorder_allowed` is `true`.
- **Visual Design:** We will remove the yellow overlay banner. Instead, each product card will feature a sleek **circle tag** (e.g., a small indicator in the corner) denoting that the item is a backorder.
- **API Integration:** Submitting the form will still use the existing `/api/reservations` endpoint. Our Postgres `reserve_item` function already intelligently handles backorders and will correctly log the inventory as `qty_backordered` instead of `qty_reserved` when stock is 0.

## 4. Backend Review (No changes needed)
- The backend `reserve_item` function automatically detects if the requested quantity exceeds available stock and marks the reservation as `is_backorder = true`. This will continue to work perfectly with the new separation of frontend concerns.
