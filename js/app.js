/**
 * CAP'N COOK® // MAIN APP, CART STORE & VOICEMAIL AUDIO
 * Carrito de compras, filtros de catálogo, checkout dual WhatsApp/Deuna para Ecuador,
 * y reproducción automática del mensaje de voz de Jesse Pinkman a los 3 segundos.
 */

class CapnStore {
  constructor() {
    this.cart = JSON.parse(localStorage.getItem("capn_cook_cart") || "[]");
    this.discount = 0;
    this.appliedCoupon = "";
    this.soundEnabled = true;
    this.audioCtx = null;
    this.voicemailAudio = null;
    this.isPlayingVoicemail = false;

    this.init();
  }

  init() {
    this.renderCatalog(CAPN_PRODUCTS);
    this.bindCatalogFilters();
    this.bindCartDrawer();
    this.bindPromoCode();
    this.updateCartUI();
    this.initVoicemailAudio();

    // Inicializar laboratorio
    if (typeof CookLabEngine !== 'undefined') {
      window.cookLab = new CookLabEngine(CAPN_PRODUCTS, COOK_LAB_CONFIG);
    }
  }

  // ==========================================
  // CONTESTADOR DE JESSE PINKMAN (AUDIO 3 SEGUNDOS)
  // ==========================================
  initVoicemailAudio() {
    this.voicemailAudio = new Audio("assets/jesse_voicemail.mp3");
    this.voicemailAudio.preload = "auto";

    // Notificar cuando termine
    this.voicemailAudio.addEventListener("ended", () => {
      this.isPlayingVoicemail = false;
      this.updateAudioButtonState(false);
      const waveEl = document.getElementById("voicemail-wave-box");
      if (waveEl) waveEl.style.display = "none";
    });

    // 3 SEGUNDOS DESPUÉS DE CARGAR LA PÁGINA
    setTimeout(() => {
      this.triggerVoicemailPlayback();
    }, 3000);

    // Botón manual en hero/navbar
    const triggerBtns = document.querySelectorAll(".btn-trigger-voicemail");
    triggerBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        if (this.isPlayingVoicemail) {
          this.stopVoicemail();
        } else {
          this.playVoicemailManual();
        }
      });
    });
  }

  triggerVoicemailPlayback() {
    if (!this.voicemailAudio) return;

    const playPromise = this.voicemailAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        this.isPlayingVoicemail = true;
        this.updateAudioButtonState(true);
        this.showVoicemailNotification();
      }).catch((err) => {
        console.warn("Autoplay bloqueado por política del navegador. Esperando interacción:", err);
        this.showAutoplayInteractionPrompt();
      });
    }
  }

  showAutoplayInteractionPrompt() {
    // Si el navegador bloqueó el audio sin interacción previa,
    // creamos un banner y escuchamos el primer clic en cualquier parte de la pantalla.
    const prompt = document.getElementById("voicemail-auto-prompt");
    if (prompt) prompt.classList.add("visible");

    const onFirstUserAction = () => {
      this.playVoicemailManual();
      if (prompt) prompt.classList.remove("visible");
      window.removeEventListener("click", onFirstUserAction);
      window.removeEventListener("keydown", onFirstUserAction);
      window.removeEventListener("touchstart", onFirstUserAction);
    };

    window.addEventListener("click", onFirstUserAction, { once: true });
    window.addEventListener("keydown", onFirstUserAction, { once: true });
    window.addEventListener("touchstart", onFirstUserAction, { once: true });
  }

  playVoicemailManual() {
    if (!this.voicemailAudio) return;
    this.voicemailAudio.currentTime = 0;
    this.voicemailAudio.play().then(() => {
      this.isPlayingVoicemail = true;
      this.updateAudioButtonState(true);
      this.showVoicemailNotification();
    }).catch(e => console.error("Error al reproducir audio:", e));
  }

  stopVoicemail() {
    if (!this.voicemailAudio) return;
    this.voicemailAudio.pause();
    this.voicemailAudio.currentTime = 0;
    this.isPlayingVoicemail = false;
    this.updateAudioButtonState(false);
    const waveEl = document.getElementById("voicemail-wave-box");
    if (waveEl) waveEl.style.display = "none";
  }

  updateAudioButtonState(isPlaying) {
    const btns = document.querySelectorAll(".btn-trigger-voicemail");
    btns.forEach(btn => {
      if (isPlaying) {
        btn.classList.add("playing");
        btn.innerHTML = `<span>⏸️ PAUSAR MENSAJE (JESSE)</span>`;
      } else {
        btn.classList.remove("playing");
        btn.innerHTML = `<span>📞 ESCUCHAR CONTESTADOR DE JESSE</span>`;
      }
    });
  }

  showVoicemailNotification() {
    const waveEl = document.getElementById("voicemail-wave-box");
    if (waveEl) waveEl.style.display = "flex";

    const container = document.getElementById("toast-shelf");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "capn-toast voicemail-toast";
    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:1.4rem; animation: pulse 0.8s infinite;">📞</span>
        <div>
          <strong style="color:var(--hazmat-yellow); display:block; font-size:0.85rem;">MENSAJE DE VOZ DE JESSE PINKMAN:</strong>
          <span style="font-size:0.75rem; color:#FFF;">"¿Qué hay de nuevo perr4? 148-3 to the 3 to the 6 to the 9, representing the ABQ, what up, biatch?! Deja tu mensaje al tono..."</span>
        </div>
      </div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("visible"), 20);
    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 400);
    }, 9500);
  }

  playBeep() {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(580, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.05);
    } catch (e) {
      // Audio fallback silencioso
    }
  }

  showToast(msg) {
    const container = document.getElementById("toast-shelf");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "capn-toast";
    toast.innerHTML = `<span>🧪 ${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("visible"), 20);
    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // ==========================================
  // RENDERIZADO DEL CATÁLOGO
  // ==========================================
  renderCatalog(items) {
    const grid = document.getElementById("catalog-products-grid");
    const countEl = document.getElementById("catalog-count-lbl");
    if (!grid) return;

    if (countEl) {
      countEl.textContent = `${items.length} PIEZAS ACTIVAS EN EL LOTE OFICIAL`;
    }

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="empty-catalog-box">
          <h3>NO HAY GORRAS CON ESOS INGREDIENTES</h3>
          <p>Prueba buscando por Yankees, Sox, Dodgers, A-Frame o Fitted.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map(p => `
      <article class="cap-product-card" data-id="${p.id}">
        <div class="card-purity-tag">
          <span>${p.badge}</span>
        </div>

        <div class="card-img-stage" onclick="window.CapnApp.openQuickView('${p.id}')">
          <img src="${p.images[0]}" alt="${p.name}" class="img-main">
          ${p.images[1] ? `<img src="${p.images[1]}" alt="${p.name} vista lateral" class="img-side">` : ''}
          <button class="quick-view-badge" title="Vista Rápida">👁️ VISTA RÁPIDA</button>
        </div>

        <div class="card-details-body">
          <div class="card-meta-line">
            <span class="meta-brand">${p.brand} • ${p.silhouette}</span>
            <span class="meta-purity">${p.purity}% PUREZA</span>
          </div>

          <h3 class="card-title" onclick="window.CapnApp.openQuickView('${p.id}')">${p.name}</h3>

          <div class="card-specs-row">
            <span class="spec-bubble">${p.closure}</span>
            <span class="spec-bubble">Underbrim: ${p.underbrim}</span>
          </div>

          <div class="card-purchase-row">
            <div class="card-pricing">
              <span class="price-now">$${p.price.toFixed(2)}</span>
              ${p.originalPrice > p.price ? `<span class="price-was">$${p.originalPrice.toFixed(2)}</span>` : ''}
            </div>

            <div class="card-actions">
              <select class="mini-size-select" id="size-${p.id}" aria-label="Seleccionar talla">
                <option value="Ajustable (OSFM)">Ajustable</option>
                <option value="7 (55.8 cm)">7 (55.8cm)</option>
                <option value="7 1/8 (56.8 cm)" selected>7 1/8 ★</option>
                <option value="7 1/4 (57.7 cm)">7 1/4</option>
                <option value="7 3/8 (58.7 cm)">7 3/8</option>
                <option value="7 1/2 (59.6 cm)">7 1/2</option>
              </select>
              <button class="btn-card-add" onclick="window.CapnApp.addFromCard('${p.id}')" title="Añadir a la Bolsa">
                +🛒
              </button>
            </div>
          </div>
        </div>
      </article>
    `).join('');
  }

  bindCatalogFilters() {
    const filterBtns = document.querySelectorAll(".filter-tag-btn");
    filterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.playBeep();

        const cat = btn.dataset.category;
        const searchVal = (document.getElementById("catalog-search-input")?.value || "").toLowerCase().trim();
        this.filterAndSortCatalog(cat, searchVal);
      });
    });

    const searchInput = document.getElementById("catalog-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const activeCat = document.querySelector(".filter-tag-btn.active")?.dataset.category || "all";
        this.filterAndSortCatalog(activeCat, e.target.value.toLowerCase().trim());
      });
    }

    const sortSelect = document.getElementById("catalog-sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        const activeCat = document.querySelector(".filter-tag-btn.active")?.dataset.category || "all";
        const searchVal = (document.getElementById("catalog-search-input")?.value || "").toLowerCase().trim();
        this.filterAndSortCatalog(activeCat, searchVal);
      });
    }
  }

  filterAndSortCatalog(category, query) {
    let filtered = CAPN_PRODUCTS.filter(p => {
      const matchCat = category === "all" || p.category === category || (category === "exclusive" && p.stock <= 2);
      const matchQuery = !query || 
        p.name.toLowerCase().includes(query) ||
        p.team.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.silhouette.toLowerCase().includes(query) ||
        p.primaryColor.toLowerCase().includes(query);
      return matchCat && matchQuery;
    });

    const sortVal = document.getElementById("catalog-sort-select")?.value || "featured";
    if (sortVal === "price-asc") filtered.sort((a, b) => a.price - b.price);
    if (sortVal === "price-desc") filtered.sort((a, b) => b.price - a.price);
    if (sortVal === "purity") filtered.sort((a, b) => b.purity - a.purity);

    this.renderCatalog(filtered);
  }

  addFromCard(productId) {
    const sizeSelect = document.getElementById(`size-${productId}`);
    const size = sizeSelect ? sizeSelect.value : "Ajustable";
    this.addToCart(productId, size);
  }

  // ==========================================
  // CARRITO DE COMPRAS & CHECKOUT
  // ==========================================
  addToCart(productId, size = "Ajustable") {
    const product = CAPN_PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    const existingIndex = this.cart.findIndex(i => i.id === productId && i.size === size);
    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += 1;
    } else {
      this.cart.push({
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        image: product.images[0],
        size: size,
        quantity: 1
      });
    }

    this.saveCart();
    this.updateCartUI();
    this.playBeep();
    this.showToast(`¡Gorra agregada al barril de dinero! (${product.name})`);
    this.openCart();
  }

  updateQuantity(index, delta) {
    if (!this.cart[index]) return;
    this.cart[index].quantity += delta;
    if (this.cart[index].quantity <= 0) {
      this.cart.splice(index, 1);
    }
    this.saveCart();
    this.updateCartUI();
  }

  removeItem(index) {
    if (!this.cart[index]) return;
    const removed = this.cart.splice(index, 1);
    this.saveCart();
    this.updateCartUI();
    this.showToast(`Eliminada: ${removed[0].name}`);
  }

  saveCart() {
    localStorage.setItem("capn_cook_cart", JSON.stringify(this.cart));
  }

  updateCartUI() {
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmt = subtotal * this.discount;
    const finalTotal = Math.max(0, subtotal - discountAmt);

    // Badges en navbar
    const badge = document.getElementById("cart-badge-count");
    if (badge) {
      badge.textContent = totalItems;
      badge.style.display = totalItems > 0 ? "inline-block" : "none";
    }

    // Lista de ítems en el Drawer
    const listEl = document.getElementById("cart-items-shelf");
    if (listEl) {
      if (this.cart.length === 0) {
        listEl.innerHTML = `
          <div class="empty-barrel-box">
            <span style="font-size: 3rem;">🛢️</span>
            <h4>TU BARRIL DE DINERO ESTÁ VACÍO</h4>
            <p>¿Qué esperas, hermano? Añade una corona al lote antes de que la DEA se entere.</p>
          </div>
        `;
      } else {
        listEl.innerHTML = this.cart.map((item, idx) => `
          <div class="cart-barrel-item">
            <img src="${item.image}" alt="${item.name}" class="barrel-thumb">
            <div class="barrel-item-info">
              <span class="barrel-item-sku">${item.sku}</span>
              <h4 class="barrel-item-title">${item.name}</h4>
              <span class="barrel-item-size">Talla: ${item.size}</span>
              <div class="barrel-item-row">
                <span class="barrel-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
                <div class="barrel-stepper">
                  <button type="button" onclick="window.CapnApp.updateQuantity(${idx}, -1)">-</button>
                  <span>${item.quantity}</span>
                  <button type="button" onclick="window.CapnApp.updateQuantity(${idx}, 1)">+</button>
                </div>
              </div>
            </div>
            <button class="barrel-del-btn" onclick="window.CapnApp.removeItem(${idx})" title="Eliminar">✕</button>
          </div>
        `).join('');
      }
    }

    // Totales
    const subtotalEl = document.getElementById("cart-subtotal-val");
    const totalEl = document.getElementById("cart-total-val");
    const discountLine = document.getElementById("cart-discount-line");
    const discountValEl = document.getElementById("cart-discount-val");

    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${finalTotal.toFixed(2)}`;

    if (discountLine && discountValEl) {
      if (this.discount > 0) {
        discountLine.style.display = "flex";
        discountValEl.textContent = `-$${discountAmt.toFixed(2)} (${this.appliedCoupon})`;
      } else {
        discountLine.style.display = "none";
      }
    }

    // Barra de Envío Gratis ($60 threshold)
    const threshold = 60.0;
    const freeProg = document.getElementById("free-shipping-bar");
    const freeTxt = document.getElementById("free-shipping-msg");
    if (freeProg && freeTxt) {
      if (subtotal >= threshold) {
        freeProg.style.width = "100%";
        freeTxt.innerHTML = `🎉 <strong>¡ENVÍO GRATIS SERVIENTREGA DESBLOQUEADO A TODO ECUADOR!</strong>`;
      } else {
        const remaining = (threshold - subtotal).toFixed(2);
        const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
        freeProg.style.width = `${pct}%`;
        freeTxt.innerHTML = `Agrega <strong>$${remaining}</strong> más para <strong>ENVÍO GRATIS SERVIENTREGA</strong>`;
      }
    }

    // Generar enlace WhatsApp
    const waCheckoutBtn = document.getElementById("cart-checkout-wa-btn");
    if (waCheckoutBtn) {
      if (this.cart.length === 0) {
        waCheckoutBtn.classList.add("disabled");
        waCheckoutBtn.removeAttribute("href");
      } else {
        waCheckoutBtn.classList.remove("disabled");
        const lines = this.cart.map(i => `• ${i.name} (Talla: ${i.size}) x${i.quantity} = $${(i.price * i.quantity).toFixed(2)}`).join('\n');
        const waMsg = encodeURIComponent(
`🔥 ¡HOLA CAP'N COOK! Quiero hacer mi pedido de gorras desde mySHOUT.US:

${lines}

Subtotal: $${subtotal.toFixed(2)}
${this.discount > 0 ? `Cupón ${this.appliedCoupon}: -$${discountAmt.toFixed(2)}\n` : ''}Total a pagar: $${finalTotal.toFixed(2)}
Envío: ${subtotal >= threshold ? 'GRATIS VÍA SERVIENTREGA' : '$5.00 Servientrega Nacional'}

Mi Ciudad: (Ingresa tu ciudad, ej: Quito / Guayaquil / Cuenca)
Nombre y Apellido: 
Cédula: 
Forma de pago: [Transferencia Banco Pichincha / Deuna! / Efectivo]`
        );
        waCheckoutBtn.href = `https://wa.me/593999999999?text=${waMsg}`;
      }
    }
  }

  bindCartDrawer() {
    const openBtn = document.getElementById("open-barrel-btn");
    const closeBtn = document.getElementById("close-barrel-btn");
    const backdrop = document.getElementById("barrel-backdrop");
    const drawer = document.getElementById("barrel-drawer");

    if (openBtn) openBtn.onclick = () => this.openCart();
    if (closeBtn) closeBtn.onclick = () => this.closeCart();
    if (backdrop) backdrop.onclick = () => this.closeCart();

    const tabWa = document.getElementById("tab-wa-btn");
    const tabBank = document.getElementById("tab-bank-btn");
    const paneWa = document.getElementById("pane-wa");
    const paneBank = document.getElementById("pane-bank");

    if (tabWa && tabBank && paneWa && paneBank) {
      tabWa.onclick = () => {
        tabWa.classList.add("active");
        tabBank.classList.remove("active");
        paneWa.style.display = "block";
        paneBank.style.display = "none";
      };
      tabBank.onclick = () => {
        tabBank.classList.add("active");
        tabWa.classList.remove("active");
        paneWa.style.display = "none";
        paneBank.style.display = "block";
      };
    }
  }

  openCart() {
    document.getElementById("barrel-drawer")?.classList.add("open");
    document.getElementById("barrel-backdrop")?.classList.add("open");
  }

  closeCart() {
    document.getElementById("barrel-drawer")?.classList.remove("open");
    document.getElementById("barrel-backdrop")?.classList.remove("open");
  }

  bindPromoCode() {
    const applyBtn = document.getElementById("apply-coupon-btn");
    const input = document.getElementById("coupon-code-input");
    if (!applyBtn || !input) return;

    applyBtn.onclick = () => {
      const code = input.value.trim().toUpperCase();
      if (code === "CHILIP10") {
        this.discount = 0.10;
        this.appliedCoupon = "CHILIP10 (-10%)";
        this.showToast("¡Cupón CHILIP10 aplicado! 10% de descuento en el lote");
      } else if (code === "HEISENBERG") {
        this.discount = 0.15;
        this.appliedCoupon = "HEISENBERG (-15%)";
        this.showToast("¡Fórmula de Heisenberg activada! 15% de descuento");
      } else {
        this.showToast("Cupón inválido o expirado en Nuevo México");
      }
      this.updateCartUI();
    };
  }

  // ==========================================
  // MODAL QUICK VIEW
  // ==========================================
  openQuickView(productId) {
    const p = CAPN_PRODUCTS.find(item => item.id === productId);
    if (!p) return;

    const modal = document.getElementById("quickview-overlay");
    const content = document.getElementById("quickview-body");
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="qv-grid">
        <div class="qv-photo-box">
          <img id="qv-large-photo" src="${p.images[0]}" alt="${p.name}">
          <div class="qv-thumbs-row">
            ${p.images.map((img, idx) => `
              <button class="qv-thumb ${idx === 0 ? 'active' : ''}" onclick="document.getElementById('qv-large-photo').src='${img}'; document.querySelectorAll('.qv-thumb').forEach(b => b.classList.remove('active')); this.classList.add('active');">
                <img src="${img}" alt="Thumb ${idx + 1}">
              </button>
            `).join('')}
          </div>
        </div>

        <div class="qv-info-box">
          <span class="qv-badge">${p.badge}</span>
          <h2 class="qv-title">${p.name}</h2>
          <span class="qv-sku">LOTE SKU: ${p.sku} // MARCA: ${p.brand}</span>

          <div class="qv-pricing-line">
            <span class="qv-price-val">$${p.price.toFixed(2)}</span>
            ${p.originalPrice > p.price ? `<span class="qv-orig-val">$${p.originalPrice.toFixed(2)}</span>` : ''}
            <span class="qv-tax-note">PVP Incluye IVA aduanero</span>
          </div>

          <p class="qv-desc">${p.description}</p>
          <div class="qv-lore">"${p.loreQuote}"</div>

          <div class="qv-specs-list">
            <div><strong>Silueta:</strong> ${p.silhouette} (${p.crownProfile})</div>
            <div><strong>Color Corona:</strong> ${p.crownColor}</div>
            <div><strong>Visera / Base:</strong> ${p.visorColor}</div>
            <div><strong>Underbrim:</strong> <span><span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:${p.underbrimHex || '#FFF'}; border:1px solid rgba(255,255,255,0.6); margin-right:5px; vertical-align:middle;"></span>${p.underbrim}</span></div>
            <div><strong>Bordado / Parche:</strong> ${p.embroidery}</div>
            <div><strong>Parche Conmemorativo:</strong> ${p.sidePatch}</div>
            <div><strong>Cierre / Talla:</strong> ${p.closure}</div>
          </div>

          <div class="qv-actions-row">
            <select id="qv-size-select" class="mini-size-select" style="padding: 12px; font-size: 0.9rem;">
              <option value="Ajustable (OSFM)">Ajustable (OSFM)</option>
              <option value="7 (55.8 cm)">7 (55.8 cm)</option>
              <option value="7 1/8 (56.8 cm)" selected>7 1/8 (56.8 cm) ★</option>
              <option value="7 1/4 (57.7 cm)">7 1/4 (57.7 cm)</option>
              <option value="7 3/8 (58.7 cm)">7 3/8 (58.7 cm)</option>
              <option value="7 1/2 (59.6 cm)">7 1/2 (59.6 cm)</option>
            </select>
            <button class="btn-primary" onclick="window.CapnApp.addToCart('${p.id}', document.getElementById('qv-size-select').value); window.CapnApp.closeQuickView();">
              <span>🛒 AGREGAR AL BARRIL</span>
            </button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add("open");
  }

  closeQuickView() {
    document.getElementById("quickview-overlay")?.classList.remove("open");
  }
}

// Inicialización global al cargar DOM
document.addEventListener("DOMContentLoaded", () => {
  window.CapnApp = new CapnStore();
});
