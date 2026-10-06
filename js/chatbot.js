/**
 * CAP'N COOK® // CHATBOT TEMÁTICO DE JESSE PINKMAN
 * Asistente virtual del laboratorio de gorras con actualización en tiempo real de base de datos SQLite.
 */

class JesseChatbot {
  constructor() {
    this.apiBase = window.location.origin.startsWith("http") ? "" : "http://localhost:8080";
    this.isOpen = false;
    this.messages = [];
    this.history = [];
    this.activeProductIds = ["CAPN-01", "CAPN-02"];
    this.unreadCount = 1;
    this.init();
  }

  init() {
    this.injectWidgetDOM();
    this.bindEvents();
    this.addBotMessage(
      "¡Yo biatch! Soy Jesse Pinkman, químico y asesor de coronas en Cap'n Cook Ecuador. ¿Qué modelo estás buscando hoy? Dime tu equipo favorito, si buscas A-Frame o Trucker, o pregúntame por stock real en bodega.",
      [
        "⭐ ¿Cuál es la más vendida?",
        "🧢 Ver gorras de los Yankees",
        "⚡ Ver gorras de los White Sox",
        "📏 ¿Cómo elijo mi talla?",
        "📦 ¿Tienen envío a Quito/Guayaquil?"
      ]
    );
  }

  injectWidgetDOM() {
    if (document.getElementById("jesse-chatbot-container")) return;

    const html = `
      <div id="jesse-chatbot-container" class="jesse-chat-wrapper">
        <!-- Botón Flotante Launcher -->
        <button id="jesse-chat-launcher" class="jesse-launcher-btn" aria-label="Abrir chat con Jesse Pinkman">
          <div class="launcher-avatar-box">
            <img src="assets/carrd_jesse.png" alt="Jesse Pinkman Chat" class="launcher-avatar-img">
            <span class="launcher-online-dot"></span>
          </div>
          <div class="launcher-text-box">
            <span class="launcher-title">HABLAR CON JESSE</span>
            <span class="launcher-sub">ASESOR DEL LAB // ONLINE</span>
          </div>
          <span class="launcher-badge" id="jesse-badge-count">1</span>
        </button>

        <!-- Ventana de Chat Flotante -->
        <div id="jesse-chat-window" class="jesse-chat-window" style="display: none;">
          <!-- Header -->
          <div class="jesse-chat-header">
            <div class="chat-header-info">
              <div class="header-avatar-circle">
                <img src="assets/carrd_jesse.png" alt="Jesse Pinkman">
              </div>
              <div>
                <div class="header-bot-name">JESSE PINKMAN <span>★ CAP'N COOK</span></div>
                <div class="header-bot-status"><span class="status-pulse"></span> CONECTADO A BASE DE DATOS SQLITE</div>
              </div>
            </div>
            <div class="chat-header-actions">
              <button id="jesse-chat-close-btn" class="chat-btn-close" title="Cerrar chat">✕</button>
            </div>
          </div>

          <!-- Feed de Mensajes -->
          <div class="jesse-chat-feed" id="jesse-chat-feed"></div>

          <!-- Sugerencias Rápidas (Chips) -->
          <div class="jesse-quick-chips" id="jesse-quick-chips"></div>

          <!-- Input Footer -->
          <form class="jesse-chat-input-bar" id="jesse-chat-form">
            <input 
              type="text" 
              id="jesse-chat-input" 
              class="jesse-input-field" 
              placeholder="Escribe a Jesse (ej: ¿Tienes Yankees A-Frame?)..." 
              autocomplete="off"
            >
            <button type="submit" class="jesse-send-btn" id="jesse-send-btn" title="Enviar mensaje">
              <span>ENVIAR</span>
              <span>⚡</span>
            </button>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);
  }

  bindEvents() {
    const launcher = document.getElementById("jesse-chat-launcher");
    const closeBtn = document.getElementById("jesse-chat-close-btn");
    const form = document.getElementById("jesse-chat-form");
    const input = document.getElementById("jesse-chat-input");

    launcher.addEventListener("click", () => this.toggleChat());
    closeBtn.addEventListener("click", () => this.toggleChat(false));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      this.handleUserSubmit(text);
      input.value = "";
    });
  }

  toggleChat(forceState) {
    this.isOpen = typeof forceState === "boolean" ? forceState : !this.isOpen;
    const windowEl = document.getElementById("jesse-chat-window");
    const badgeEl = document.getElementById("jesse-badge-count");

    if (this.isOpen) {
      windowEl.style.display = "flex";
      this.unreadCount = 0;
      badgeEl.style.display = "none";
      const feed = document.getElementById("jesse-chat-feed");
      feed.scrollTop = feed.scrollHeight;
      document.getElementById("jesse-chat-input").focus();
    } else {
      windowEl.style.display = "none";
    }
  }

  async handleUserSubmit(userText) {
    this.addUserMessage(userText);
    this.renderTypingIndicator();

    try {
      // Petición a la API del servidor local con historial y contexto
      const res = await fetch(`${this.apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: this.history,
          active_products: this.activeProductIds
        })
      });

      this.removeTypingIndicator();

      if (res.ok) {
        const data = await res.json();
        
        // Registrar en memoria contextual
        this.history.push({ role: "user", text: userText });
        this.history.push({ role: "model", text: data.reply });
        if (this.history.length > 8) {
          this.history = this.history.slice(-8);
        }

        // Actualizar gorras activas en conversación
        if (data.products && data.products.length > 0) {
          this.activeProductIds = data.products.map(p => p.id);
        }

        this.addBotMessage(data.reply, data.chips || [], data.products || []);
      } else {
        throw new Error("Servidor no respondió");
      }
    } catch (err) {
      this.removeTypingIndicator();
      this.handleLocalFallback(userText);
    }
  }

  handleLocalFallback(userText) {
    const text = userText.toLowerCase();
    let reply = "¡Yo biatch! Estoy en línea. Te recomiendo checar la 9FORTY A-Frame NY Yankees 'Chili P Mocha' o la White Sox Heisenberg en el personalizador.";
    let prods = [];
    let chips = ["Ver más productos", "Guía de tallas", "Preguntar por envíos"];

    // Detectar comparación o recomendación
    const isCompare = /(cu[aá]l|qu[eé]).*(recomie|prefier|elijo|llevo|mejor|quedo|conviene)|cu[aá]l de las dos|entre las dos/i.test(text);

    if (isCompare && typeof CAPN_PRODUCTS !== "undefined") {
      let candidateProds = CAPN_PRODUCTS.filter(p => this.activeProductIds.includes(p.id));
      if (candidateProds.length < 2) candidateProds = [CAPN_PRODUCTS[3], CAPN_PRODUCTS[4]]; // Dodgers vs Steelers

      const p1 = candidateProds[0];
      const p2 = candidateProds[1];

      reply = `¡A ver compa, pregunta brava! Estás comparando la ${p1.name} ($${p1.price}) y la ${p2.name} ($${p2.price}).\n\n` +
              `• Si buscas facha pesada de calle para salir de noche o clima templado (Quito/Cuenca): vete por la ${p1.name}. Su corona cerrada y estilo clásico no fallan.\n` +
              `• Si vas a andar bajo el sol o clima cálido (Guayaquil/Costa): vete por la ${p2.name}, la malla trucker te ventila la cabeza y es súper liviana.\n\n` +
              `¡Mi veredicto, biatch: si quieres romper cuellos llévate la de ${p1.team}!`;
      prods = candidateProds;
      chips = [`Comprar ${p1.name.split(' ')[2] || p1.id}`, `Comprar ${p2.name.split(' ')[2] || p2.id}`];
    } else if (typeof CAPN_PRODUCTS !== "undefined") {
      if (/\b(yankees?|ny|nueva york)\b/i.test(text)) {
        prods = CAPN_PRODUCTS.filter(p => p.team.toLowerCase().includes("yankee"));
        reply = "¡Las de los Yankees vuelan rápido en Ecuador! Aquí tienes las disponibles:";
      } else if (/\b(dodgers?|los angeles)\b/i.test(text)) {
        prods = CAPN_PRODUCTS.filter(p => p.team.toLowerCase().includes("dodger"));
        reply = "¡Representing the West Coast, biatch! Los Angeles Dodgers en azul real:";
      } else if (/\b(sox|chicago|negro)\b/i.test(text)) {
        prods = CAPN_PRODUCTS.filter(p => p.team.toLowerCase().includes("sox"));
        reply = "¡La corona Heisenberg 99.6% pura! Checa este lote:";
      } else if (/\b(env[ií]o|servientrega|cuenca|quito|guayaquil)\b/i.test(text)) {
        reply = "¡Hacemos envíos 100% seguros a todo el Ecuador por Servientrega! 24 a 48 horas a tu puerta, y si tu compra supera los $60 USD, ¡el envío es completamente GRATIS!";
      } else {
        prods = CAPN_PRODUCTS.slice(0, 2);
      }
    }

    this.history.push({ role: "user", text: userText });
    this.history.push({ role: "model", text: reply });
    this.addBotMessage(reply, chips, prods);
  }

  addUserMessage(text) {
    const feed = document.getElementById("jesse-chat-feed");
    const msgEl = document.createElement("div");
    msgEl.className = "jesse-msg jesse-msg-user";
    msgEl.innerHTML = `
      <div class="msg-bubble user-bubble">${this.escapeHTML(text)}</div>
      <span class="msg-time">${this.getTimeStr()}</span>
    `;
    feed.appendChild(msgEl);
    feed.scrollTop = feed.scrollHeight;
  }

  addBotMessage(text, quickChips = [], products = []) {
    const feed = document.getElementById("jesse-chat-feed");
    const msgEl = document.createElement("div");
    msgEl.className = "jesse-msg jesse-msg-bot";

    let prodsHTML = "";
    if (products && products.length > 0) {
      prodsHTML = `
        <div class="jesse-prods-carousel">
          ${products.map(p => this.renderProductMiniCard(p)).join("")}
        </div>
      `;
    }

    msgEl.innerHTML = `
      <div class="bot-bubble-wrapper">
        <div class="bot-avatar-tiny">
          <img src="assets/carrd_jesse.png" alt="Jesse">
        </div>
        <div class="msg-bubble bot-bubble">
          <p class="bot-text">${this.escapeHTML(text)}</p>
          ${prodsHTML}
        </div>
      </div>
      <span class="msg-time">${this.getTimeStr()}</span>
    `;

    feed.appendChild(msgEl);
    this.renderChips(quickChips);
    feed.scrollTop = feed.scrollHeight;

    // Vincular botones de compra directa en el chat
    msgEl.querySelectorAll(".btn-chat-buy-direct").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const prodId = e.currentTarget.getAttribute("data-id");
        this.executeChatPurchase(prodId);
      });
    });
  }

  renderProductMiniCard(p) {
    const id = p.id;
    const name = p.nombre_oficial || p.name;
    const price = p.precio_venta || p.price;
    const stock = p.stock !== undefined ? p.stock : 2;
    const img = (p.images && p.images[0]) || p.imagen_frontal || "assets/products/ne-chili-mocha_0.webp";
    const silueta = p.silueta || "9FORTY A-Frame";

    return `
      <div class="chat-mini-card" id="chat-card-${id}">
        <div class="mini-card-img-wrap">
          <img src="${img}" alt="${name}">
          <span class="mini-card-stock ${stock <= 1 ? 'stock-low' : ''}">⚡ Stock: ${stock}</span>
        </div>
        <div class="mini-card-body">
          <span class="mini-card-silueta">${silueta}</span>
          <h4 class="mini-card-title">${name}</h4>
          <div class="mini-card-price-row">
            <span class="mini-card-price">$${Number(price).toFixed(2)}</span>
            <button 
              type="button" 
              class="btn-chat-buy-direct" 
              data-id="${id}"
              ${stock <= 0 ? 'disabled' : ''}
            >
              ${stock > 0 ? '🛒 COMPRAR YA' : 'AGOTADO'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async executeChatPurchase(prodId) {
    this.addUserMessage(`Quiero comprar la gorra ${prodId} directamente.`);
    this.renderTypingIndicator();

    try {
      const res = await fetch(`${this.apiBase}/api/comprar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: prodId,
          cantidad: 1,
          cliente: "Chatbot Buyer",
          metodo: "El Barril / Chatbot"
        })
      });

      this.removeTypingIndicator();

      if (res.ok) {
        const data = await res.json();
        
        // Respuesta eufórica de Jesse Pinkman
        const reply = `¡YA ESTÁ COCINADO BIATCH! 🎉\n` +
          `Orden #${data.order_id} registrada con éxito en la base de datos SQLite (capn_cook_inventory.db).\n` +
          `• Producto: ${data.product_name}\n` +
          `• Total: $${Number(data.total_usd).toFixed(2)} USD\n` +
          `• Stock restante en bodega: ${data.new_stock} unidad(es).\n` +
          `Tu pedido fue añadido también a El Barril para coordinar el envío con Servientrega.`;

        this.addBotMessage(reply, ["Ver mi carrito El Barril", "Comprar otra gorra"]);

        // Actualizar tarjeta en el chat
        const card = document.getElementById(`chat-card-${prodId}`);
        if (card) {
          const stockBadge = card.querySelector(".mini-card-stock");
          if (stockBadge) stockBadge.textContent = `⚡ Stock: ${data.new_stock}`;
          if (data.new_stock <= 0) {
            const btn = card.querySelector(".btn-chat-buy-direct");
            if (btn) {
              btn.disabled = true;
              btn.textContent = "AGOTADO";
            }
          }
        }

        // Agregar al carrito local si CapnStore existe
        if (window.capnApp) {
          window.capnApp.addToCart(prodId, "Ajustable", 1, "Cocinada desde el Chatbot");
        }

      } else {
        const errData = await res.json();
        this.addBotMessage(`¡Maldición biatch! ${errData.error || "No se pudo procesar la compra."}`);
      }
    } catch (err) {
      this.removeTypingIndicator();
      this.addBotMessage("¡Ey biatch! Parece que el servidor local de SQLite está desconectado. Inicia 'python server.py' para actualizar el stock real en disco.");
    }
  }

  renderChips(chips) {
    const chipsEl = document.getElementById("jesse-quick-chips");
    if (!chips || chips.length === 0) {
      chipsEl.innerHTML = "";
      chipsEl.style.display = "none";
      return;
    }

    chipsEl.style.display = "flex";
    chipsEl.innerHTML = chips.map(c => `
      <button type="button" class="quick-chip-btn">${this.escapeHTML(c)}</button>
    `).join("");

    chipsEl.querySelectorAll(".quick-chip-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const text = btn.textContent.replace(/^[^\w\s¿?]+/, "").trim();
        this.handleUserSubmit(text);
      });
    });
  }

  renderTypingIndicator() {
    this.removeTypingIndicator();
    const feed = document.getElementById("jesse-chat-feed");
    const typing = document.createElement("div");
    typing.id = "jesse-typing-indicator";
    typing.className = "jesse-msg jesse-msg-bot";
    typing.innerHTML = `
      <div class="bot-bubble-wrapper">
        <div class="bot-avatar-tiny"><img src="assets/carrd_jesse.png" alt="Jesse"></div>
        <div class="msg-bubble bot-bubble typing-bubble">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
      </div>
    `;
    feed.appendChild(typing);
    feed.scrollTop = feed.scrollHeight;
  }

  removeTypingIndicator() {
    const el = document.getElementById("jesse-typing-indicator");
    if (el) el.remove();
  }

  escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  getTimeStr() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

// Iniciar al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
  window.jesseChat = new JesseChatbot();
});
