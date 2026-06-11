const API_BASE = '/api';

const productGrid = document.getElementById('product-grid');
const shoeSelect = document.getElementById('shoe-select');
const orderForm = document.getElementById('order-form');
const orderMessage = document.getElementById('order-message');
const sellerKeyInput = document.getElementById('seller-key');
const unlockButton = document.getElementById('unlock-seller');
const sellerAccessMessage = document.getElementById('seller-access-message');
const sellerPanel = document.getElementById('seller-form-panel');
const addProductForm = document.getElementById('add-product-form');
const productMessage = document.getElementById('product-message');
const orderDetailsPanel = document.getElementById('order-details-panel');
const orderDetailsList = document.getElementById('order-details-list');
let sellerUnlocked = false;

async function loadProducts() {
  const response = await fetch(`${API_BASE}/products`);
  if (!response.ok) throw new Error('Unable to load products');
  return response.json();
}

function renderProducts(items) {
  if (!productGrid) return;
  productGrid.innerHTML = items
    .map(
      (shoe) => `
        <article class="product-card">
          <img src="${shoe.image_url || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'}" alt="${shoe.name}" style="height: 150px; width: 100%; object-fit: cover;" />
          <div class="product-body">
            <h3>${shoe.name}</h3>
            <p>${shoe.color}</p>
            <div class="product-meta">
              <strong>Ksh ${shoe.price}</strong>
              <span class="tag">${shoe.tag}</span>
            </div>
            ${sellerUnlocked ? `<button class="btn btn-secondary delete-btn" data-id="${shoe.id}" type="button">Delete</button>` : ''}
          </div>
        </article>
      `
    )
    .join('');

  document.querySelectorAll('.delete-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.id);
      if (!confirm('Delete this product for the seller?')) return;
      const response = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (response.ok) {
        productMessage.textContent = result.message || 'Product deleted.';
        await refreshStore();
      } else {
        productMessage.textContent = result.error || 'Unable to delete product.';
      }
    });
  });
}

function populateSelect(items) {
  if (!shoeSelect) return;
  shoeSelect.innerHTML = items
    .map((shoe) => `<option value="${shoe.name}">${shoe.name} — Ksh ${shoe.price}</option>`)
    .join('');
}

async function loadOrders() {
  const response = await fetch(`${API_BASE}/orders`);
  if (!response.ok) throw new Error('Unable to load orders');
  return response.json();
}

function renderOrders(items) {
  if (!orderDetailsList || !orderDetailsPanel) return;

  if (!sellerUnlocked) {
    orderDetailsPanel.classList.add('hidden');
    return;
  }

  orderDetailsPanel.classList.remove('hidden');
  if (!items.length) {
    orderDetailsList.innerHTML = '<p>No orders yet.</p>';
    return;
  }

  orderDetailsList.innerHTML = items
    .map(
      (order) => `
        <article class="card">
          <strong>${order.name}</strong>
          <p>Phone: ${order.phone}</p>
          <p>Order: ${order.quantity} x ${order.shoe}</p>
          <p>Total: Ksh ${order.total}</p>
          <p>Time: ${order.created_at}</p>
        </article>
      `
    )
    .join('');
}

async function refreshStore() {
  try {
    const items = await loadProducts();
    const orders = await loadOrders();
    renderProducts(items);
    populateSelect(items);
    renderOrders(orders);
    return items;
  } catch (error) {
    if (productGrid) {
      productGrid.innerHTML = '<article class="product-card"><div class="product-body"><h3>Shop unavailable</h3><p>Start the Flask server to load products.</p></div></article>';
    }
    return [];
  }
}

if (orderForm) {
  orderForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(orderForm);
    const shoeName = formData.get('shoe');
    const quantity = Number(formData.get('quantity') || 1);
    const products = await loadProducts();
    const selected = products.find((item) => item.name === shoeName) || {};
    const total = Number(selected.price || 0) * quantity;

    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name'),
        phone: formData.get('phone'),
        shoe: shoeName,
        quantity,
        total,
      }),
    });

    const result = await response.json();
    if (orderMessage) {
      const emailStatus = result.email_sent ? 'Email notification sent to franknganga122@gmail.com.' : 'Email notification is enabled when SMTP_PASSWORD is configured.';
      orderMessage.textContent = response.ok
        ? `Order saved for ${formData.get('name')} — ${quantity} x ${shoeName} for Ksh ${total}. ${result.message} Seller notification: ${result.notification} ${emailStatus}`
        : result.error || 'Unable to save order.';
    }
    if (response.ok) {
      orderForm.reset();
      await refreshStore();
    }
  });
}

if (unlockButton) {
  unlockButton.addEventListener('click', () => {
    if (sellerKeyInput.value.trim() === 'seller2026') {
      sellerUnlocked = true;
      sellerPanel.classList.remove('hidden');
      sellerAccessMessage.textContent = 'Seller access granted.';
      refreshStore();
    } else {
      sellerUnlocked = false;
      sellerPanel.classList.add('hidden');
      sellerAccessMessage.textContent = 'Incorrect seller key. Try seller2026.';
      refreshStore();
    }
  });
}

if (addProductForm) {
  addProductForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(addProductForm);
    const imageFile = formData.get('image');
    const newProduct = {
      name: String(formData.get('name') || '').trim(),
      price: Number(formData.get('price')) || 0,
      color: String(formData.get('color') || '').trim(),
      tag: String(formData.get('tag') || 'Added by seller').trim(),
      image_url: '',
    };

    if (imageFile && imageFile.name) {
      const reader = new FileReader();
      const fileData = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read image file.'));
        reader.readAsDataURL(imageFile);
      });
      newProduct.image_url = fileData;
    }

    if (!newProduct.name || !newProduct.price || !newProduct.color || !newProduct.tag) {
      productMessage.textContent = 'Please fill in all fields.';
      return;
    }

    const response = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProduct),
    });
    const result = await response.json();

    if (productMessage) {
      productMessage.textContent = response.ok ? result.message : result.error || 'Unable to add product.';
    }
    if (response.ok) {
      addProductForm.reset();
      await refreshStore();
    }
  });
}

refreshStore();
