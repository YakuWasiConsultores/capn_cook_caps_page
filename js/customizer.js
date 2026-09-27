/**
 * CAP'N COOK® // THE COOK LAB ENGINE (REACTIVE AVAILABILITY SYSTEM)
 * Solo muestra las piezas genuinamente disponibles en bodega.
 * Si un color, silueta o franquicia no tiene stock para una combinación,
 * se deshabilita dinámicamente y se adapta a la pieza real en stock.
 */

class CookLabEngine {
  constructor(products, config) {
    this.products = products;
    this.config = config;

    // Inicializar con la primera pieza real del catálogo
    const first = this.products[0];
    this.state = {
      silhouette: first.silhouette,
      chemical: first.primaryColor,
      team: "any",
      visorStyle: first.visorType,
      activeImageIdx: 0,
      activeProduct: first
    };

    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has("sil")) this.state.silhouette = urlParams.get("sil");
      if (urlParams.has("chem")) this.state.chemical = urlParams.get("chem");
      if (urlParams.has("team")) this.state.team = urlParams.get("team");
    }

    this.init();
  }

  init() {
    this.bindEvents();
    this.syncActiveProduct();
  }

  bindEvents() {
    // 1. Clic en Silueta
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-type]");
      if (!btn || btn.classList.contains("disabled")) return;

      const type = btn.dataset.type;
      const val = btn.dataset.val;

      if (window.CapnApp?.playBeep) window.CapnApp.playBeep();

      if (type === "silhouette") {
        this.state.silhouette = val;
        // Adaptar color si el color actual no existe en esta silueta
        const availableInSil = this.products.filter(p => p.silhouette === val);
        const hasColor = availableInSil.some(p => p.primaryColor === this.state.chemical);
        if (!hasColor && availableInSil.length > 0) {
          this.state.chemical = availableInSil[0].primaryColor;
        }
        // Adaptar franquicia si la actual no existe en esta silueta
        if (this.state.team !== "any") {
          const hasTeam = availableInSil.some(p => p.team === this.state.team);
          if (!hasTeam) this.state.team = "any";
        }
      } else if (type === "chemical") {
        this.state.chemical = val;
        // Adaptar silueta si la silueta actual no tiene este color
        const availableInChem = this.products.filter(p => p.primaryColor === val);
        const hasSil = availableInChem.some(p => p.silhouette === this.state.silhouette);
        if (!hasSil && availableInChem.length > 0) {
          this.state.silhouette = availableInChem[0].silhouette;
        }
        // Adaptar franquicia si no tiene este color
        if (this.state.team !== "any") {
          const hasTeam = availableInChem.some(p => p.team === this.state.team);
          if (!hasTeam) this.state.team = "any";
        }
      } else if (type === "visorStyle") {
        this.state.visorStyle = val;
        const matchingVisor = this.products.find(p => 
          p.silhouette === this.state.silhouette && 
          p.primaryColor === this.state.chemical && 
          p.visorType === val
        );
        if (matchingVisor) {
          this.state.activeProduct = matchingVisor;
        }
      }

      this.syncActiveProduct();
    });

    // 2. Cambio en Selector de Franquicias
    const teamSelect = document.getElementById("lab-team-select");
    if (teamSelect) {
      teamSelect.addEventListener("change", (e) => {
        const teamVal = e.target.value;
        this.state.team = teamVal;

        if (teamVal !== "any") {
          const teamProducts = this.products.filter(p => p.team === teamVal);
          // Si la pieza actual no coincide con el equipo, adaptamos
          const matchesCurrent = teamProducts.some(p => 
            p.silhouette === this.state.silhouette && p.primaryColor === this.state.chemical
          );
          if (!matchesCurrent && teamProducts.length > 0) {
            this.state.silhouette = teamProducts[0].silhouette;
            this.state.chemical = teamProducts[0].primaryColor;
          }
        }

        if (window.CapnApp?.playBeep) window.CapnApp.playBeep();
        this.syncActiveProduct();
      });
    }
  }

  syncActiveProduct() {
    this.state.activeImageIdx = 0;

    // Buscar coincidencia exacta
    let matches = this.products.filter(p => 
      p.silhouette === this.state.silhouette && 
      p.primaryColor === this.state.chemical
    );

    if (this.state.team !== "any") {
      const teamMatches = matches.filter(p => p.team === this.state.team);
      if (teamMatches.length > 0) matches = teamMatches;
    }

    if (matches.length === 0) {
      // Fallback seguro: encontrar cualquier pieza que comparta silueta o color
      matches = this.products.filter(p => p.silhouette === this.state.silhouette);
      if (matches.length === 0) matches = this.products.filter(p => p.primaryColor === this.state.chemical);
      if (matches.length === 0) matches = [this.products[0]];
    }

    const prod = matches[0];
    this.state.activeProduct = prod;
    this.state.silhouette = prod.silhouette;
    this.state.chemical = prod.primaryColor;
    this.state.visorStyle = prod.visorType;

    this.renderControlsAvailability();
    this.renderLabStage(prod);
  }

  renderControlsAvailability() {
    const activeProd = this.state.activeProduct;

    // 1. RENDERIZAR SILUETAS
    const silContainer = document.getElementById("lab-silhouettes");
    if (silContainer) {
      silContainer.innerHTML = this.config.silhouettes.map(sil => {
        const inStockCount = this.products.filter(p => p.silhouette === sil.id).length;
        const isCurrent = this.state.silhouette === sil.id;
        const isDisabled = inStockCount === 0;

        return `
          <button type="button" 
                  class="lab-sil-card ${isCurrent ? 'active' : ''} ${isDisabled ? 'disabled' : ''}" 
                  data-type="silhouette" 
                  data-val="${sil.id}"
                  ${isDisabled ? 'disabled' : ''}>
            <div class="sil-head">
              <span class="sil-name">${sil.name}</span>
              <span class="sil-tag">${inStockCount > 0 ? `${inStockCount} DISP.` : 'AGOTADO'}</span>
            </div>
            <span class="sil-desc">${sil.note}</span>
          </button>
        `;
      }).join('');
    }

    // 2. RENDERIZAR QUÍMICOS (COLORES)
    // Solo habilitar colores que existen en la silueta actualmente seleccionada
    const chemContainer = document.getElementById("lab-chemicals");
    if (chemContainer) {
      const colorsInSil = this.products
        .filter(p => p.silhouette === this.state.silhouette)
        .map(p => p.primaryColor);

      chemContainer.innerHTML = this.config.chemicals.map(c => {
        const isAvailable = colorsInSil.includes(c.id);
        const isCurrent = this.state.chemical === c.id;
        const count = this.products.filter(p => p.silhouette === this.state.silhouette && p.primaryColor === c.id).length;

        return `
          <button type="button" 
                  class="lab-chem-pill ${isCurrent ? 'active' : ''} ${!isAvailable ? 'disabled' : ''}" 
                  data-type="chemical" 
                  data-val="${c.id}"
                  title="${isAvailable ? `${count} pieza(s) en este corte` : 'No disponible en este corte'}"
                  ${!isAvailable ? 'disabled' : ''}>
            <span class="chem-dot" style="background-color: ${c.hex};"></span>
            <span class="chem-label">${c.name}</span>
            <span class="chem-tag">${isAvailable ? `✓ (${count})` : '[Sin stock]'}</span>
          </button>
        `;
      }).join('');
    }

    // 3. RENDERIZAR FRANQUICIAS
    const teamSelect = document.getElementById("lab-team-select");
    if (teamSelect) {
      const teamsInSilAndChem = this.products
        .filter(p => p.silhouette === this.state.silhouette && p.primaryColor === this.state.chemical)
        .map(p => p.team);

      teamSelect.innerHTML = this.config.teams.map(t => {
        if (t.id === "any") {
          return `<option value="any" ${this.state.team === "any" ? 'selected' : ''}>${t.icon} ${t.name}</option>`;
        }
        const isAvail = teamsInSilAndChem.includes(t.id);
        const isSelected = activeProd.team === t.id;
        return `
          <option value="${t.id}" ${isSelected ? 'selected' : ''} ${!isAvail ? 'disabled style="color:#666;"' : ''}>
            ${t.icon} ${t.name} ${isAvail ? '✓ [EN BODEGA]' : '[NO DISPONIBLE EN ESTE CORTE/COLOR]'}
          </option>
        `;
      }).join('');
    }

    // 4. RENDERIZAR ESTILO DE VISERA
    const visorContainer = document.getElementById("lab-visor-styles");
    if (visorContainer) {
      visorContainer.innerHTML = this.config.visorStyles.map(v => {
        const isCurrent = activeProd.visorType === v.id;
        return `
          <button type="button" class="lab-visor-pill ${isCurrent ? 'active' : ''}" data-type="visorStyle" data-val="${v.id}">
            <span class="visor-check">${isCurrent ? '●' : '○'}</span>
            <div>
              <span class="visor-name">${v.name}</span>
              <span class="visor-sub">${v.desc}</span>
            </div>
          </button>
        `;
      }).join('');
    }
  }

  renderLabStage(prod) {
    // 1. Imagen del laboratorio
    const mainImg = document.getElementById("lab-main-photo");
    const thumbsBox = document.getElementById("lab-photo-thumbs");

    if (mainImg) {
      mainImg.src = prod.images[this.state.activeImageIdx] || prod.images[0];
      mainImg.alt = prod.name;
    }

    if (thumbsBox) {
      thumbsBox.innerHTML = prod.images.map((img, i) => `
        <button type="button" class="lab-thumb-btn ${i === this.state.activeImageIdx ? 'active' : ''}" data-idx="${i}">
          <img src="${img}" alt="Ángulo ${i + 1}">
          <span>${i === 0 ? 'FRENTE' : 'PERFIL'}</span>
        </button>
      `).join('');

      thumbsBox.querySelectorAll(".lab-thumb-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.idx, 10);
          this.state.activeImageIdx = idx;
          if (mainImg) mainImg.src = prod.images[idx];
          thumbsBox.querySelectorAll(".lab-thumb-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          if (window.CapnApp?.playBeep) window.CapnApp.playBeep();
        });
      });
    }

    // 2. Datos y Especificaciones de la Cocina
    const titleEl = document.getElementById("lab-prod-title");
    const skuEl = document.getElementById("lab-prod-sku");
    const purityValEl = document.getElementById("lab-purity-val");
    const purityBarEl = document.getElementById("lab-purity-bar");
    const priceEl = document.getElementById("lab-prod-price");
    const origPriceEl = document.getElementById("lab-prod-orig");
    const descEl = document.getElementById("lab-prod-desc");
    const loreEl = document.getElementById("lab-prod-lore");
    const stockEl = document.getElementById("lab-prod-stock");
    const specsEl = document.getElementById("lab-prod-specs");
    const addCartBtn = document.getElementById("lab-add-cart-btn");
    const waBtn = document.getElementById("lab-wa-order-btn");

    if (titleEl) titleEl.textContent = prod.name;
    if (skuEl) skuEl.textContent = `LOTE: ${prod.catalogId} // SKU ${prod.sku} // ${prod.brand.toUpperCase()} AUTHENTIC`;
    if (purityValEl) purityValEl.textContent = `99.6% DE PUREZA HEISENBERG`;
    if (purityBarEl) {
      purityBarEl.style.width = "99.6%";
      purityBarEl.style.background = "linear-gradient(90deg, var(--hazmat-yellow), var(--meth-cyan))";
    }
    if (priceEl) priceEl.textContent = `$${prod.price.toFixed(2)}`;

    if (origPriceEl) {
      if (prod.originalPrice > prod.price) {
        origPriceEl.textContent = `$${prod.originalPrice.toFixed(2)}`;
        origPriceEl.style.display = "inline";
      } else {
        origPriceEl.style.display = "none";
      }
    }

    if (stockEl) {
      stockEl.innerHTML = prod.stock <= 2
        ? `<span class="stock-warn">⚠️ QUEDAN SOLO ${prod.stock} UNIDADES EN LA BODEGA DE ALBUQUERQUE (ECUADOR)</span>`
        : `<span class="stock-ok">✓ DISPONIBLE EN EL BÚNKER DE SERVIENTREGA (${prod.stock} UNIDADES)</span>`;
    }

    if (descEl) descEl.textContent = prod.description;
    if (loreEl) loreEl.innerHTML = `<span class="quote-icon">❝</span> ${prod.loreQuote}`;

    // FÓRMULA CROMÁTICA REAL AUDITADA + FICHA TÉCNICA
    if (specsEl) {
      specsEl.innerHTML = `
        <div class="lab-advisory-banner pure">
          ✓ FÓRMULA DISPONIBLE: Pieza física real verificada en bodega. Coincidencia 100% auténtica en silueta, color y franquicia.
        </div>

        <div class="lab-chroma-box">
          <div class="chroma-head">
            <span class="chroma-badge">🧪 FÓRMULA CROMÁTICA REAL (${prod.catalogId} // NEW ERA ORIGINAL)</span>
            <span class="chroma-purity-tag pure">✓ 99.6% CRISTAL PURO</span>
          </div>
          <div class="chroma-grid">
            <div class="chroma-cell">
              <span class="chroma-chip" style="background: ${prod.colorHex};"></span>
              <div>
                <span class="chroma-label">CORONA REAL</span>
                <span class="chroma-val">${prod.crownColor}</span>
              </div>
            </div>
            <div class="chroma-cell">
              <span class="chroma-chip" style="background: ${prod.underbrimHex};"></span>
              <div>
                <span class="chroma-label">VISERA & BASE</span>
                <span class="chroma-val">${prod.visorColor} (${prod.underbrim})</span>
              </div>
            </div>
            <div class="chroma-cell chroma-cell-full">
              <span class="chroma-chip" style="background: ${prod.embroideryHex || '#FFF'};"></span>
              <div>
                <span class="chroma-label">BORDADO / PARCHE</span>
                <span class="chroma-val">${prod.embroidery}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="lab-specs-grid">
          <div class="spec-cell">
            <span class="cell-k">SILUETA / CORONA</span>
            <span class="cell-v">${prod.crownProfile}</span>
          </div>
          <div class="spec-cell">
            <span class="cell-k">UNDERBRIM (BASE VISERA)</span>
            <span class="cell-v"><span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:${prod.underbrimHex || '#FFF'}; border:1px solid rgba(255,255,255,0.6); margin-right:6px; vertical-align:middle;"></span>${prod.underbrim}</span>
          </div>
          <div class="spec-cell">
            <span class="cell-k">CIERRE / TALLA</span>
            <span class="cell-v">${prod.closure}</span>
          </div>
          <div class="spec-cell">
            <span class="cell-k">PARCHE CONMEMORATIVO</span>
            <span class="cell-v">${prod.sidePatch}</span>
          </div>
        </div>
      `;
    }

    // Botones de acción
    if (addCartBtn) {
      addCartBtn.onclick = () => {
        const sizeSelect = document.getElementById("lab-size-select");
        const chosenSize = sizeSelect ? sizeSelect.value : "Ajustable";
        window.CapnApp?.addToCart(prod.id, chosenSize);
      };
    }

    if (waBtn) {
      const sizeSelect = document.getElementById("lab-size-select");
      const chosenSize = sizeSelect ? sizeSelect.value : "Ajustable";
      const msg = encodeURIComponent(`Hola Cap'n Cook! Vengo de mySHOUT.US y quiero ordenar mi gorra:
- Lote ID: ${prod.catalogId} (${prod.sku})
- Pieza: ${prod.name}
- Silueta: ${prod.silhouette}
- Color auditado: ${prod.crownColor}
- Talla: ${chosenSize}
- Precio: $${prod.price.toFixed(2)}
¿Está lista para despacho en Ecuador vía Servientrega?`);
      waBtn.href = `https://wa.me/593999999999?text=${msg}`;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CookLabEngine };
}
