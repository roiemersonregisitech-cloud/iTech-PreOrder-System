import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

// POST /api/products/upload-image — Upload a product image to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasRole(session.staff.role, 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const productId = formData.get('product_id') as string | null;

    if (!file || !productId) {
      return NextResponse.json({ error: 'Missing file or product_id' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 2MB.' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Verify product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, sku')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${product.sku.toLowerCase()}-${Date.now()}.${ext}`;
    const filePath = `products/${fileName}`;

    // Convert File to ArrayBuffer then to Buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    // Update product record with image URL
    const { error: updateError } = await supabase
      .from('products')
      .update({ image_url: imageUrl })
      .eq('id', productId);

    if (updateError) {
      console.error('Update product image_url error:', updateError);
      return NextResponse.json(
        { error: 'Image uploaded but failed to update product record' },
        { status: 500 }
      );
    }

    return NextResponse.json({ image_url: imageUrl });
  } catch (err) {
    console.error('POST /api/products/upload-image error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
