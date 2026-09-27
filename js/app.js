/**
 * CAP'N COOK® // MAIN APP, CART STORE & WHATSAPP CHECKOUT ENGINE
 * Número oficial de pedidos: 0960105825 (+593960105825)
 * Soporte para cantidades múltiples, selector de 20+ frases personalizadas y mensajes directos del comprador al vendedor.
 */

const CAPN_WHATSAPP_PHONE = "593960105825";

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

    // Inicializar laboratorio de cocina
    if (typeof CookLabEngine !== 'undefined') {
      window.cookLab = new CookLabEngine(CAPN_PRODUCTS, COOK_LAB_CONFIG, CAPN_CUSTOM_PHRASES);
    }
  }

  // ==========================================
  // CONTESTADOR DE JESSE PINKMAN (AUDIO 3 SEGUNDOS)
  // ==========================================
  initVoicemailAudio() {
    this.voicemailAudio = new Audio("assets/jesse_voicemail.mp3");
    this.voicemailAudio.preload = "auto";

    this.voicemailAudio.addEventListener("ended", () => {
      this.isPlayingVoicemail = false;
      this.updateAudioButtonState(false);
      const waveEl = document.getElementById("voicemail-wave-box");
      if (waveEl) waveEl.style.display = "none";
    });

    setTimeout(() => {
      this.triggerVoicemailPlayback();
    }, 3000);

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
        btn.innerHTML = `<span>📞 CONTESTADOR DE JESSE</span>`;
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
          <span style="font-size:0.75rem; color:#FFF;">"¿Qué hay de nuevo? 148-3 to the 3 to the 6 to the 9, representando el ABQ. Deja tu mensaje al tono..."</span>
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
      // Audio fallback
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
          <button class="quick-view-badge" title="Vista Rápida">👁️ VISTA DETALLADA</button>
        </div>

        <div class="card-details-body">
          <div class="card-meta-line">
            <span class="meta-brand">${p.brand} • ${p.silhouette}</span>
            <span class="meta-purity">${p.purity}% PUREZA</span>
          </div>

          <h3 class="card-title" onclick="window.CapnApp.openQuickView('${p.id}')">${p.name}</h3>

          <div class="card-specs-row">
            <span class="spec-bubble">${p.closure}</span>
            <span class="spec-bubble">Base: ${p.underbrim}</span>
          </div>

          <!-- Selector de Frase Personalizada -->
          <div class="card-phrase-box">
            <label class="card-phrase-lbl">✍️ Frase Personalizada:</label>
            <select class="card-phrase-select" id="phrase-${p.id}">
              <option value="${p.defaultPhrase}" selected>★ "${p.defaultPhrase}"</option>
              ${CAPN_CUSTOM_PHRASES.filter(ph => ph !== p.defaultPhrase).map(ph => `
                <option value="${ph}">"${ph}"</option>
              `).join('')}
              <option value="CUSTOM_WRITE">[Escribir mi propia frase...]</option>
            </select>
            <input type="text" class="card-phrase-custom-input" id="phrase-custom-${p.id}" placeholder="Escribe tu frase personalizada aquí..." style="display: none;">
          </div>

          <div class="card-purchase-row">
            <div class="card-pricing">
              <span class="price-now">$${p.price.toFixed(2)}</span>
              ${p.originalPrice > p.price ? `<span class="price-was">$${p.originalPrice.toFixed(2)}</span>` : ''}
            </div>

            <div class="card-actions-unified">
              <div class="card-controls-row">
                <select class="mini-size-select" id="size-${p.id}" aria-label="Seleccionar talla">
                  <option value="Ajustable (OSFM)">Ajustable</option>
                  <option value="7 (55.8 cm)">7 (55.8cm)</option>
                  <option value="7 1/8 (56.8 cm)" selected>7 1/8 ★</option>
                  <option value="7 1/4 (57.7 cm)">7 1/4</option>
                  <option value="7 3/8 (58.7 cm)">7 3/8</option>
                  <option value="7 1/2 (59.6 cm)">7 1/2</option>
                </select>

                <!-- Selector de Cantidad -->
                <div class="mini-qty-box">
                  <button type="button" class="mini-qty-btn" onclick="window.CapnApp.changeCardQty('${p.id}', -1)">-</button>
                  <input type="number" id="qty-${p.id}" class="mini-qty-input" value="1" min="1" max="${p.stock || 10}" readonly>
                  <button type="button" class="mini-qty-btn" onclick="window.CapnApp.changeCardQty('${p.id}', 1)">+</button>
                </div>
              </div>

              <div class="card-buttons-row">
                <button class="btn-card-add-full" onclick="window.CapnApp.addFromCard('${p.id}')" title="Añadir al barril de dinero">
                  <span>🛒 AGREGAR</span>
                </button>
                <button class="btn-card-wa-direct" onclick="window.CapnApp.orderDirectWa('${p.id}')" title="Comprar directo por WhatsApp">
                  <span>💬 WHATSAPP</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    `).join('');

    // Listener para input de frase personalizada
    items.forEach(p => {
      const select = document.getElementById(`phrase-${p.id}`);
      const customInput = document.getElementById(`phrase-custom-${p.id}`);
      if (select && customInput) {
        select.addEventListener("change", (e) => {
          if (e.target.value === "CUSTOM_WRITE") {
            customInput.style.display = "block";
            customInput.focus();
          } else {
            customInput.style.display = "none";
          }
        });
      }
    });
  }

  changeCardQty(productId, delta) {
    const qtyInput = document.getElementById(`qty-${productId}`);
    if (!qtyInput) return;
    let val = parseInt(qtyInput.value, 10) || 1;
    val = Math.max(1, val + delta);
    qtyInput.value = val;
    this.playBeep();
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

  getChosenPhrase(productId) {
    const select = document.getElementById(`phrase-${productId}`);
    const customInput = document.getElementById(`phrase-custom-${productId}`);
    if (select) {
      if (select.value === "CUSTOM_WRITE") {
        return (customInput && customInput.value.trim()) ? customInput.value.trim() : "Edición Especial Cap'n Cook";
      }
      return select.value;
    }
    const product = CAPN_PRODUCTS.find(p => p.id === productId);
    return product ? product.defaultPhrase : "Say My Name";
  }

  addFromCard(productId) {
    const sizeSelect = document.getElementById(`size-${productId}`);
    const size = sizeSelect ? sizeSelect.value : "Ajustable";
    const qtyInput = document.getElementById(`qty-${productId}`);
    const qty = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;
    const phrase = this.getChosenPhrase(productId);

    this.addToCart(productId, size, qty, phrase);
  }

  orderDirectWa(productId) {
    const p = CAPN_PRODUCTS.find(item => item.id === productId);
    if (!p) return;
    const sizeSelect = document.getElementById(`size-${productId}`);
    const size = sizeSelect ? sizeSelect.value : "Ajustable";
    const qtyInput = document.getElementById(`qty-${productId}`);
    const qty = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;
    const phrase = this.getChosenPhrase(productId);
    const total = (p.price * qty).toFixed(2);

    const msg = `¡Hola! Quiero una gorra ${p.name} y una frase personalizada.

• Gorra: ${p.name}
• Talla: ${size}
• Cantidad: ${qty} unidad(es)
• Frase personalizada: "${phrase}"
• Total estimado: $${total}

¿Me confirmas disponibilidad y cómo realizar el pago por favor?`;

    window.open(`https://wa.me/${CAPN_WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  // ==========================================
  // CARRITO DE COMPRAS & CHECKOUT
  // ==========================================
  addToCart(productId, size = "Ajustable", quantity = 1, phrase = "") {
    const product = CAPN_PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    const chosenPhrase = phrase || product.defaultPhrase || "99.1% Pureza Krystal";

    const existingIndex = this.cart.findIndex(i => i.id === productId && i.size === size && i.phrase === chosenPhrase);
    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += quantity;
    } else {
      this.cart.push({
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        image: product.images[0],
        size: size,
        phrase: chosenPhrase,
        quantity: Math.max(1, quantity)
      });
    }

    this.saveCart();
    this.updateCartUI();
    this.playBeep();
    this.showToast(`¡Agregada ${quantity}x al barril! (${product.name})`);
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
            <p>Añade una gorra al lote antes de que se agote el stock.</p>
          </div>
        `;
      } else {
        listEl.innerHTML = this.cart.map((item, idx) => `
          <div class="cart-barrel-item">
            <img src="${item.image}" alt="${item.name}" class="barrel-thumb">
            <div class="barrel-item-info">
              <span class="barrel-item-sku">${item.sku}</span>
              <h4 class="barrel-item-title">${item.name}</h4>
              <span class="barrel-item-size">📏 Talla: <strong>${item.size}</strong></span>
              <span class="barrel-item-phrase">✍️ "${item.phrase || 'Edición Oficial'}"</span>
              <div class="barrel-item-row">
                <span class="barrel-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
                <div class="barrel-stepper">
                  <button type="button" onclick="window.CapnApp.updateQuantity(${idx}, -1)" title="Disminuir">-</button>
                  <span>${item.quantity}</span>
                  <button type="button" onclick="window.CapnApp.updateQuantity(${idx}, 1)" title="Aumentar">+</button>
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

    // Generar enlace WhatsApp hacia 0960105825 (593960105825) escrito por el comprador hacia el vendedor
    const waCheckoutBtn = document.getElementById("cart-checkout-wa-btn");
    if (waCheckoutBtn) {
      if (this.cart.length === 0) {
        waCheckoutBtn.classList.add("disabled");
        waCheckoutBtn.removeAttribute("href");
      } else {
        waCheckoutBtn.classList.remove("disabled");
        const lines = this.cart.map((i, idx) => 
          `${idx + 1}. Gorra: ${i.name} (Talla: ${i.size}) x${i.quantity} = $${(i.price * i.quantity).toFixed(2)}\n   Frase personalizada: "${i.phrase || 'Edición Oficial'}"`
        ).join('\n\n');

        const waMsg = `¡Hola! Quiero hacer un pedido de las siguientes gorras con sus frases personalizadas:

${lines}

Total a pagar: $${finalTotal.toFixed(2)}

¿Me podrían confirmar la disponibilidad y los datos para realizar el pago y coordinar el envío por favor? Muchas gracias.`;

        waCheckoutBtn.href = `https://wa.me/${CAPN_WHATSAPP_PHONE}?text=${encodeURIComponent(waMsg)}`;
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
        this.showToast("Cupón inválido o no reconocido");
      }
      this.updateCartUI();
    };
  }

  // ==========================================
  // MODAL VISTA RÁPIDA (QUICK VIEW)
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
                <img src="${img}" alt="Miniatura ${idx + 1}">
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
            <div><strong>Base Visera (Underbrim):</strong> <span><span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:${p.underbrimHex || '#FFF'}; border:1px solid rgba(255,255,255,0.6); margin-right:5px; vertical-align:middle;"></span>${p.underbrim}</span></div>
            <div><strong>Bordado:</strong> ${p.embroidery}</div>
            <div><strong>Parche Conmemorativo:</strong> ${p.sidePatch}</div>
            <div><strong>Cierre / Talla:</strong> ${p.closure}</div>
          </div>

          <!-- Selector de Frase Personalizada en QuickView -->
          <div class="qv-phrase-section">
            <label style="font-size: 0.82rem; font-weight: bold; color: var(--hazmat-yellow); display: block; margin-bottom: 6px;">
              ✍️ ELIGE TU FRASE PERSONALIZADA (20+ DISPONIBLES):
            </label>
            <select id="qv-phrase-select" class="size-select-styled" style="width: 100%; margin-bottom: 8px;">
              <option value="${p.defaultPhrase}" selected>★ "${p.defaultPhrase}" (Recomendada)</option>
              ${CAPN_CUSTOM_PHRASES.filter(ph => ph !== p.defaultPhrase).map(ph => `
                <option value="${ph}">"${ph}"</option>
              `).join('')}
              <option value="CUSTOM_WRITE">[Escribir mi propia frase...]</option>
            </select>
            <input type="text" id="qv-custom-phrase-input" class="coupon-field" placeholder="Escribe tu frase aquí..." style="display: none; width: 100%; margin-bottom: 12px; background:#111; color:#FFF; border:1px solid var(--hazmat-yellow);">
          </div>

          <!-- Selector de Talla y Cantidad -->
          <div class="qv-actions-row">
            <div style="display: flex; gap: 8px; flex: 1;">
              <select id="qv-size-select" class="mini-size-select" style="padding: 10px; font-size: 0.85rem; flex: 1;">
                <option value="Ajustable (OSFM)">Ajustable (OSFM)</option>
                <option value="7 (55.8 cm)">7 (55.8 cm)</option>
                <option value="7 1/8 (56.8 cm)" selected>7 1/8 (56.8 cm) ★</option>
                <option value="7 1/4 (57.7 cm)">7 1/4 (57.7 cm)</option>
                <option value="7 3/8 (58.7 cm)">7 3/8 (58.7 cm)</option>
                <option value="7 1/2 (59.6 cm)">7 1/2 (59.6 cm)</option>
              </select>

              <div class="mini-qty-box" style="height: auto;">
                <button type="button" class="mini-qty-btn" onclick="const q = document.getElementById('qv-qty-input'); q.value = Math.max(1, (parseInt(q.value,10)||1) - 1);">-</button>
                <input type="number" id="qv-qty-input" class="mini-qty-input" value="1" min="1" max="10" readonly style="width: 38px;">
                <button type="button" class="mini-qty-btn" onclick="const q = document.getElementById('qv-qty-input'); q.value = (parseInt(q.value,10)||1) + 1;">+</button>
              </div>
            </div>

            <div style="display: flex; gap: 8px; width: 100%; margin-top: 10px;">
              <button class="btn-primary" style="flex: 1;" onclick="
                const size = document.getElementById('qv-size-select').value;
                const qty = parseInt(document.getElementById('qv-qty-input').value, 10) || 1;
                const pSelect = document.getElementById('qv-phrase-select');
                const cInput = document.getElementById('qv-custom-phrase-input');
                const phrase = (pSelect.value === 'CUSTOM_WRITE' && cInput.value.trim()) ? cInput.value.trim() : pSelect.value;
                window.CapnApp.addToCart('${p.id}', size, qty, phrase);
                window.CapnApp.closeQuickView();
              ">
                <span>🛒 AGREGAR AL BARRIL</span>
              </button>

              <button class="btn-wa-lab" style="flex: 1; padding: 10px;" onclick="
                const size = document.getElementById('qv-size-select').value;
                const qty = parseInt(document.getElementById('qv-qty-input').value, 10) || 1;
                const pSelect = document.getElementById('qv-phrase-select');
                const cInput = document.getElementById('qv-custom-phrase-input');
                const phrase = (pSelect.value === 'CUSTOM_WRITE' && cInput.value.trim()) ? cInput.value.trim() : pSelect.value;
                const total = (${p.price} * qty).toFixed(2);
                const msg = '¡Hola! Quiero una gorra ${p.name} y una frase personalizada.\\n\\n• Gorra: ${p.name}\\n• Talla: ' + size + '\\n• Cantidad: ' + qty + ' unidad(es)\\n• Frase personalizada: \\\"' + phrase + '\\\"\\n• Total estimado: $' + total + '\\n\\n¿Me confirmas disponibilidad y los datos para realizar el pago por favor?';
                window.open('https://wa.me/${CAPN_WHATSAPP_PHONE}?text=' + encodeURIComponent(msg), '_blank');
              ">
                <span>💬 PEDIR POR WHATSAPP</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const pSelect = document.getElementById("qv-phrase-select");
    const cInput = document.getElementById("qv-custom-phrase-input");
    if (pSelect && cInput) {
      pSelect.addEventListener("change", (e) => {
        cInput.style.display = e.target.value === "CUSTOM_WRITE" ? "block" : "none";
        if (e.target.value === "CUSTOM_WRITE") cInput.focus();
      });
    }

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
