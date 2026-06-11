import os
import sqlite3
import smtplib
from email.message import EmailMessage
from datetime import datetime

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DB_PATH = os.path.join(os.path.dirname(__file__), 'shop.db')
SELLER_EMAIL = 'franknganga122@gmail.com'
SMTP_HOST = 'smtp.gmail.com'
SMTP_PORT = 587
SMTP_USER = 'franknganga122@gmail.com'
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def send_order_email(name, phone, shoe, quantity, total):
    if not SMTP_PASSWORD:
        return False

    message = EmailMessage()
    message['Subject'] = 'New Shoe Order Received'
    message['From'] = SMTP_USER
    message['To'] = SELLER_EMAIL
    message.set_content(
        f"New order received for {name}\n"
        f"Phone: {phone}\n"
        f"Shoe: {shoe}\n"
        f"Quantity: {quantity}\n"
        f"Total: Ksh {total}\n"
        f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    )

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(message)
        return True
    except Exception:
        return False


def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                color TEXT NOT NULL,
                tag TEXT NOT NULL,
                image_url TEXT DEFAULT ''
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                shoe TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                total REAL NOT NULL,
                created_at TEXT NOT NULL
            )
        ''')
        columns = [row[1] for row in conn.execute('PRAGMA table_info(products)')]
        if 'image_url' not in columns:
            try:
                conn.execute('ALTER TABLE products ADD COLUMN image_url TEXT DEFAULT ""')
            except sqlite3.OperationalError as exc:
                if 'duplicate column name' not in str(exc).lower():
                    raise

        if conn.execute('SELECT COUNT(*) FROM products').fetchone()[0] == 0:
            conn.executemany(
                'INSERT INTO products (name, price, color, tag, image_url) VALUES (?, ?, ?, ?, ?)',
                [
                    ('UltraLight Pro', 89, 'Nebula Blue', 'Best seller', 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80'),
                    ('CityRun X', 74, 'Crimson', 'New arrival', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'),
                    ('TrailFlex', 99, 'Forest Green', 'Outdoor', 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80'),
                    ('StudioLite', 64, 'Pearl White', 'Comfort', 'https://images.unsplash.com/photo-1511556532299-05a7c43d2d0d?auto=format&fit=crop&w=900&q=80'),
                ],
            )


init_db()


@app.get('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.get('/api/products')
def list_products():
    with get_db() as conn:
        rows = conn.execute('SELECT * FROM products ORDER BY id DESC').fetchall()
    return jsonify([dict(row) for row in rows])


@app.post('/api/products')
def add_product():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    price = float(data.get('price') or 0)
    color = (data.get('color') or '').strip()
    tag = (data.get('tag') or '').strip()
    image_url = (data.get('image_url') or '').strip()

    if not all([name, price, color, tag]):
        return jsonify({'error': 'All fields are required.'}), 400

    with get_db() as conn:
        cursor = conn.execute(
            'INSERT INTO products (name, price, color, tag, image_url) VALUES (?, ?, ?, ?, ?)',
            (name, price, color, tag, image_url),
        )
        product_id = cursor.lastrowid

    return jsonify({'ok': True, 'id': product_id, 'message': f'{name} added to the shop.'})


@app.delete('/api/products/<int:product_id>')
def delete_product(product_id):
    with get_db() as conn:
        cursor = conn.execute('DELETE FROM products WHERE id = ?', (product_id,))
    if cursor.rowcount == 0:
        return jsonify({'error': 'Product not found.'}), 404
    return jsonify({'ok': True, 'message': 'Product deleted successfully.'})


@app.get('/api/orders')
def list_orders():
    with get_db() as conn:
        rows = conn.execute('SELECT * FROM orders ORDER BY id DESC').fetchall()
    return jsonify([dict(row) for row in rows])


@app.post('/api/orders')
def add_order():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    phone = (data.get('phone') or '').strip()
    shoe = (data.get('shoe') or '').strip()
    quantity = int(data.get('quantity') or 0)
    total = float(data.get('total') or 0)

    if not all([name, phone, shoe]) or quantity < 1:
        return jsonify({'error': 'Name, phone, shoe, and quantity are required.'}), 400

    with get_db() as conn:
        conn.execute(
            'INSERT INTO orders (name, phone, shoe, quantity, total, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            (name, phone, shoe, quantity, total, datetime.now().isoformat(timespec='seconds')),
        )

    notification = f"New order received for {name}: {quantity} x {shoe} on {datetime.now().strftime('%Y-%m-%d %H:%M')}."
    email_sent = send_order_email(name, phone, shoe, quantity, total)
    return jsonify({
        'ok': True,
        'message': 'Order saved successfully.',
        'notification': notification,
        'email_sent': email_sent,
    })


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
