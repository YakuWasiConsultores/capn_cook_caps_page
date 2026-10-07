import os
import json
import sqlite3
import urllib.request
import re
import time
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory

PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "capn_cook_inventory.db")

# Control de abuso y Rate Limiting en memoria (15 peticiones/min por IP)
IP_RATE_LIMITS = {}
MAX_REQUESTS_PER_MINUTE = 15

def is_rate_limited(ip):
    now = time.time()
    timestamps = IP_RATE_LIMITS.get(ip, [])
    timestamps = [t for t in timestamps if now - t < 60]
    if len(timestamps) >= MAX_REQUESTS_PER_MINUTE:
        IP_RATE_LIMITS[ip] = timestamps
        return True
    timestamps.append(now)
    IP_RATE_LIMITS[ip] = timestamps
    return False

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Motor conversacional de Jesse Pinkman / Cap'n Cook con Inteligencia Artificial y Fallback Local
def process_jesse_ai_chat(user_msg, history=None, active_ids=None):
    if history is None:
        history = []
    if active_ids is None:
        active_ids = []

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM gorras_inventario ORDER BY id ASC")
    products = [dict(row) for row in cur.fetchall()]
    conn.close()

    prod_map = {p["id"]: p for p in products}

    # 1. Intentar con Gemini AI si la llave está disponible
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        catalog_lines = []
        for p in products:
            catalog_lines.append(
                f"- ID: {p['id']} | {p['nombre_oficial']} | Silueta: {p['silueta']} | Color: {p['color_principal']} | Precio: ${p['precio_venta']} USD | Stock: {p['stock']} un."
            )
        catalog_text = "\n".join(catalog_lines)

        sys_prompt = f"""Eres Jesse Pinkman de Breaking Bad, ahora asesor de moda urbana y químico en la tienda de gorras Cap'n Cook Ecuador.
Tu personalidad:
- Hablas con el estilo callejero y enérgico de Jesse ('¡Yo biatch!', 'hermano', 'compa', 'receta pura de Heisenberg', 'cocinar'), pero con TOTAL RESPETO COMERCIAL, EDUCACIÓN Y LÓGICA IMPECABLE.
- Eres ABSOLUTAMENTE LÓGICO, COHERENTE y RIGUROSO con lo que el cliente te pregunta. NUNCA respondas con frases inconexas o repetitivas.
- Si el usuario pregunta cosas como 'CUÁL DE LAS DOS ME RECOMIENDAS', 'cuál prefieres', o tiene errores tipográficos ('recomiedas'):
  Mira las gorras activas en la conversación ({active_ids}) o los productos discutidos en el historial. Analiza detalladamente ambas opciones con criterio de moda callejera y uso real (ventilación de malla trucker en clima cálido/Costa vs corona estructurada A-Frame/clásica para noche o Sierra/Quito/Cuenca, versatilidad de colores, underbrim rosado UV de colección, precios) y da tu veredicto sincero.
- Envíos en Ecuador: Servientrega a nivel nacional (Quito, Guayaquil, Cuenca, Ambato, Riobamba, etc.), gratis en compras mayores a $60 USD.
- Autenticidad: 100% originales New Era con hologramas aduaneros oficiales y sellos de importación.
- Tallas: 9FORTY Snapback ajustable (le queda al 95% de cabezas).

Inventario oficial en bodega:
{catalog_text}

Gorras en pantalla del cliente: {active_ids}

FORMATO OBLIGATORIO DE RESPUESTA:
Devuelve un JSON estrictamente válido:
{{
  "reply": "Tu respuesta directa como Jesse Pinkman (lógica, coherente, explicada y bien formateada).",
  "recommended_ids": ["CAPN-04", "CAPN-05"],
  "chips": ["Comprar Dodgers", "Comprar Steelers", "Ver envíos a nivel nacional"]
}}
"""
        gemini_contents = []
        for h in history[-4:]:
            role = "user" if h.get("role") == "user" else "model"
            gemini_contents.append({"role": role, "parts": [{"text": h.get("text", "")}]})
        gemini_contents.append({"role": "user", "parts": [{"text": user_msg}]})

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={api_key}"
        payload = {
            "contents": gemini_contents,
            "systemInstruction": {"parts": [{"text": sys_prompt}]},
            "generationConfig": {"responseMimeType": "application/json"}
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                text_resp = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text_resp)
                rec_ids = parsed.get("recommended_ids", [])
                matched_prods = [prod_map[i] for i in rec_ids if i in prod_map]
                return {
                    "reply": parsed.get("reply", ""),
                    "products": matched_prods,
                    "chips": parsed.get("chips", ["Ver más gorras", "Guía de tallas"]),
                    "timestamp": datetime.now().isoformat()
                }
        except Exception:
            pass

    # 2. Fallback conversacional local inteligente con expresiones regulares y límites de palabra
    return local_jesse_chat_engine(user_msg, history, active_ids, products, prod_map)

def local_jesse_chat_engine(user_msg, history, active_ids, products, prod_map):
    msg = user_msg.lower().strip()

    # Intención: Comparar / Recomendar
    is_recommend = bool(re.search(r"\b(cu[aá]l|qu[eé])\b.*\b(recomie\w*|prefier\w*|elijo|llevo|mejor|quedo|conviene)\b", msg, re.I)) or \
                   bool(re.search(r"\b(cu[aá]l de las dos|entre las dos|cual me recomiedas|cual recomiendas)\b", msg, re.I))

    if is_recommend:
        candidate_ids = [i for i in active_ids if i in prod_map]
        if len(candidate_ids) < 2:
            candidate_ids = ["CAPN-04", "CAPN-05"]
        p1 = prod_map[candidate_ids[0]]
        p2 = prod_map[candidate_ids[1]]

        reply = (
            f"¡A ver compa, esa es una pregunta con química pura! Estás comparando dos bestias del laboratorio: "
            f"la **{p1['nombre_oficial']} (${p1['precio_venta']})** y la **{p2['nombre_oficial']} (${p2['precio_venta']})**.\n\n"
            f"Aquí va mi recomendación honesta de asesor urbano:\n"
            f"• **Elige {p1['nombre_oficial']}:** Si buscas facha pesada de calle, corona sólida estructurada y detalles prémium como el underbrim UV de colección. Es insuperable para la noche o clima templado (Quito, Cuenca).\n"
            f"• **Elige {p2['nombre_oficial']}:** Si vas a andar bajo el sol de Guayaquil o la Costa, la malla trasera tipo trucker te salva la vida ventilando al 100% y cuesta menos.\n\n"
            f"👉 **Mi veredicto, biatch:** ¡Si tienes el presupuesto llévate la **{p1['nombre_oficial']}** para romper cuellos, o la **{p2['nombre_oficial']}** para máxima frescura en el calor!"
        )
        return {
            "reply": reply,
            "products": [p1, p2],
            "chips": [f"Comprar {p1['id']}", f"Comprar {p2['id']}", "Ver envíos a Cuenca/Quito"],
            "timestamp": datetime.now().isoformat()
        }

    # Búsqueda por franquicia / equipo con límites estrictos de palabra
    team_rules = [
        (r"\b(yankees?|ny|nueva york)\b", "yankee", "¡Yo biatch! Las coronas de los New York Yankees son la receta más pura que cocinamos. Mira las disponibles en bodega:"),
        (r"\b(dodgers?|los angeles)\b", "dodger", "¡Representing the West Coast, biatch! Los Angeles Dodgers en azul real con underbrim rosado UV de colección:"),
        (r"\b(white sox|sox|chicago)\b", "white sox", "¡Esa es la fórmula Heisenberg, hermano! Chicago White Sox en negro puro con bordado gótico blanco:"),
        (r"\b(oakland|athletics?|a'?s)\b", "oakland", "¡La edición Vámonos Pest! Oakland Athletics bicolor arena con visera verde bosque:"),
        (r"\b(raiders?|las vegas)\b", "raider", "¡Tuco Salamanca approve! Las Vegas Raiders con el pirata bordado en plata y negro:"),
        (r"\b(bulls?)\b", "bulls", "¡La roja fuego de Chicago Bulls! Pura adrenalina urbana:"),
        (r"\b(cowboys?|dallas)\b", "cowboys", "¡La estrella solitaria de Dallas Cowboys! Azul marino prémium:"),
        (r"\b(steelers?|pittsburgh)\b", "steelers", "¡La fórmula de Los Pollos Hermanos! Pittsburgh Steelers Trucker con malla transpirable:")
    ]

    for pattern, team_key, intro in team_rules:
        if re.search(pattern, msg, re.I):
            matched = [p for p in products if team_key in p["franquicia"].lower() or team_key in p["slug"].lower()]
            if matched:
                return {
                    "reply": intro,
                    "products": matched,
                    "chips": ["¿Cuál es mejor?", "Guía de tallas", "¿Tienen envíos?"],
                    "timestamp": datetime.now().isoformat()
                }

    # Siluetas
    if re.search(r"\b(trucker|malla|camioner\w*)\b", msg, re.I):
        matched = [p for p in products if "trucker" in p["silueta"].lower()]
        return {
            "reply": "¡La silueta Trucker viene con malla trasera ultra-ventilada! Es la mejor opción para el calor de la Costa y Guayaquil:",
            "products": matched,
            "chips": ["Comprar Trucker", "¿Tienen más colores?"],
            "timestamp": datetime.now().isoformat()
        }

    if re.search(r"\b(a-?frame|pellizco)\b", msg, re.I):
        matched = [p for p in products if "a-frame" in p["silueta"].lower() and "trucker" not in p["silueta"].lower()]
        return {
            "reply": "¡Las A-Frame son el Santo Grial del streetwear! Tienen corona alta estructurada con el pellizco frontal característico:",
            "products": matched,
            "chips": ["Ver Yankees A-Frame", "Ver Oakland A-Frame"],
            "timestamp": datetime.now().isoformat()
        }

    # Envíos
    if re.search(r"\b(env[ií]os?|servientrega|costo de env[ií]o|cuenca|quito|guayaquil|ambato|tena)\b", msg, re.I):
        return {
            "reply": "¡Hacemos envíos 100% seguros a todo el Ecuador por Servientrega! Llega en 24 a 48 horas con número de guía a tu puerta. Y ojo: si tu compra supera los $60 USD, ¡el envío te sale completamente GRATIS!",
            "products": [],
            "chips": ["Ver gorras disponibles", "Comprar ahora"],
            "timestamp": datetime.now().isoformat()
        }

    # Originalidad
    if re.search(r"\b(original\w*|aut[eé]ntic\w*|r[eé]plic\w*|falsa|trucha|holograma)\b", msg, re.I):
        return {
            "reply": "¡Aquí no cocinamos porquerías, compa! En Cap'n Cook solo vendemos New Era 100% ORIGINALES importadas legalmente, con hologramas oficiales reflectivos, bordados de alta densidad y factura con impuestos.",
            "products": products[:2],
            "chips": ["Ver Yankees Chili Mocha", "Ver White Sox Heisenberg"],
            "timestamp": datetime.now().isoformat()
        }

    # Tallas
    if re.search(r"\b(talla|medida|size|ajustable|como saber)\b", msg, re.I):
        return {
            "reply": "¡Escucha bien! Casi todas nuestras gorras 9FORTY A-Frame y Trucker son SNAPBACK ajustables (con broche trasero, le quedan al 95% de personas). Si buscas gorra cerrada fitted 59FIFTY, la talla estándar más común en Ecuador es 7 1/8 (56.8 cm).",
            "products": [],
            "chips": ["Ver modelos ajustables", "Ir a la Guía de Tallas"],
            "timestamp": datetime.now().isoformat()
        }

    # Default
    return {
        "reply": "¡Yo, what up! Soy Jesse Pinkman, asesor oficial de Cap'n Cook. Dime qué equipo te gusta, si buscas estilo para clima cálido o frío, o qué gorras te gustaría comparar.",
        "products": products[:2],
        "chips": ["¿Cuál es la más vendida?", "Ver Yankees A-Frame", "Ver Truckers"],
        "timestamp": datetime.now().isoformat()
    }

# ==============================================================================
# APLICACIÓN FLASK PARA PRODUCCIÓN (RENDER / GUNICORN / WSGI COMPATIBLE)
# ==============================================================================
app = Flask(__name__, static_folder=BASE_DIR, static_url_path="")

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response

# Ruta principal: Servir index.html
@app.route("/", methods=["GET"])
def index():
    return send_from_directory(BASE_DIR, "index.html")

# Health Check oficial para Render
@app.route("/healthz", methods=["GET", "HEAD"])
def healthz():
    return "OK", 200

# API: Inventario en tiempo real
@app.route("/api/inventario", methods=["GET"])
def api_inventario():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM gorras_inventario ORDER BY id ASC")
    items = [dict(row) for row in cur.fetchall()]
    conn.close()
    return jsonify(items)

# API: Historial de Ventas
@app.route("/api/ventas", methods=["GET"])
def api_ventas():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT v.*, g.nombre_oficial, g.silueta 
        FROM ventas_pedidos v 
        JOIN gorras_inventario g ON v.id_producto = g.id 
        ORDER BY v.id_venta DESC
    """)
    sales = [dict(row) for row in cur.fetchall()]
    conn.close()
    return jsonify(sales)

# API: Chatbot con Jesse Pinkman (con Rate Limiting)
@app.route("/api/chat", methods=["POST", "OPTIONS"])
def api_chat():
    if request.method == "OPTIONS":
        return "", 200

    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr).split(",")[0].strip()
    if is_rate_limited(client_ip):
        return jsonify({
            "error": "Límite de peticiones excedido.",
            "reply": "¡Ey hermano, baja un cambio! Estás cocinando demasiado rápido. Espera un momento antes de volver a preguntar, biatch."
        }), 429

    data = request.get_json(silent=True) or {}
    user_msg = (data.get("message") or "")[:350].strip()
    history = (data.get("history") or [])[-6:]
    active_prods = (data.get("active_products") or [])[:4]

    result = process_jesse_ai_chat(user_msg, history, active_prods)
    return jsonify(result)

# API: Transacción de Compra Atómica
@app.route("/api/comprar", methods=["POST", "OPTIONS"])
def api_comprar():
    if request.method == "OPTIONS":
        return "", 200

    data = request.get_json(silent=True) or {}
    prod_id = data.get("id")
    qty = int(data.get("cantidad", 1))
    cliente = data.get("cliente", "Cliente Online")
    metodo = data.get("metodo", "El Barril / WhatsApp")

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("SELECT id, nombre_oficial, precio_venta, stock FROM gorras_inventario WHERE id = ?", (prod_id,))
        prod = cur.fetchone()

        if not prod:
            conn.close()
            return jsonify({"success": False, "error": "Producto no encontrado"}), 404

        current_stock = prod["stock"]
        if current_stock < qty:
            conn.close()
            return jsonify({
                "success": False,
                "error": f"Stock insuficiente. Quedan solo {current_stock} unidades disponibles."
            }), 400

        new_stock = current_stock - qty
        price = prod["precio_venta"]
        total = price * qty
        now = datetime.now().isoformat()

        cur.execute("UPDATE gorras_inventario SET stock = ? WHERE id = ?", (new_stock, prod_id))
        cur.execute("""
            INSERT INTO ventas_pedidos (id_producto, cantidad, precio_unitario, total_usd, metodo_pago, cliente_contacto, fecha)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (prod_id, qty, price, total, metodo, cliente, now))

        sale_id = cur.lastrowid
        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "order_id": sale_id,
            "product_id": prod_id,
            "product_name": prod["nombre_oficial"],
            "quantity": qty,
            "total_usd": total,
            "new_stock": new_stock,
            "message": f"¡Cocinado! Compra confirmada por {qty}x {prod['nombre_oficial']}. Stock remanente en bodega: {new_stock} unidades."
        })

    except Exception as e:
        conn.close()
        return jsonify({"success": False, "error": str(e)}), 500

# Servir archivos estáticos restantes (css, js, assets)
@app.route("/<path:filename>", methods=["GET"])
def static_proxy(filename):
    return send_from_directory(BASE_DIR, filename)

if __name__ == "__main__":
    print(f"=== CAP'N COOK FLASK SERVER ONLINE ===")
    print(f"Host: 0.0.0.0 | Port: {PORT}")
    print(f"URL: http://localhost:{PORT}")
    app.run(host="0.0.0.0", port=PORT)
