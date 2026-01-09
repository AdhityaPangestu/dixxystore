// script.js — interactivity for DIXXY STORE + Pakasir (via URL)
// IMPORTANT:
// 1) Ganti WA_NUMBER dengan nomor WhatsApp kamu (format internasional, tanpa + dan tanpa 0 di depan)
// 2) Ganti PAKASIR_SLUG dengan slug proyek Pakasir milik kamu

const WA_NUMBER = "628123456789"; // <-- GANTI NOMOR INI
const WA_BASE = "https://wa.me/";

const PAKASIR_SLUG = "DIXXYSTORE"; // <-- GANTI SLUG INI
const PAKASIR_PAY_BASE = "https://app.pakasir.com/pay/";

const STORAGE_KEY = "dixxystore_orders_v1";

function waLink(message) {
  return `${WA_BASE}${WA_NUMBER}?text=${encodeURIComponent(message)}`;
}

function onlyDigits(str) {
  return String(str || "").replace(/\D/g, "");
}

function formatRp(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return "-";
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function generateOrderId() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DX-${stamp}-${rand}`;
}

function loadOrders() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveOrder(order) {
  const orders = loadOrders();
  orders[order.order_id] = order;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function getOrder(orderId) {
  const orders = loadOrders();
  return orders[orderId] || null;
}

function buildPakasirUrl({ slug, amount, orderId, redirectUrl }) {
  const safeAmount = onlyDigits(amount);
  const base = `${PAKASIR_PAY_BASE}${encodeURIComponent(slug)}/${safeAmount}`;
  const params = new URLSearchParams({
    order_id: orderId,
    redirect: redirectUrl
  });
  return `${base}?${params.toString()}`;
}

function buildSuccessUrl(orderId) {
  // Works on https://..., and also when hosted on GitHub Pages.
  // For local file:// usage, redirect might not work (browser limitation).
  const url = new URL("success.html", window.location.href);
  url.searchParams.set("order_id", orderId);
  return url.toString();
}

function defaultInquiryMessage(pkg) {
  return `Halo DIXXY STORE! Saya mau tanya/order: ${pkg || "Layanan"} untuk game MLBB/FF. Mohon info detail harga & prosesnya. Terima kasih.`;
}

function buildProofMessage(order) {
  const lines = [
    "Halo DIXXY STORE! Saya sudah melakukan pembayaran via Pakasir.",
    "",
    `Order ID: ${order.order_id}`,
    `Paket: ${order.package}`,
    `Nominal: ${formatRp(order.amount)}`,
    `Nama: ${order.customer_name}`,
    `No. WhatsApp: ${order.customer_wa}`
  ];

  if (order.category === "topup") {
    lines.push(`User ID: ${order.player_id || "-"}`);
    lines.push(`Server/Zone: ${order.server_id || "-"}`);
  }

  lines.push("", "Saya lampirkan bukti/screenshot pembayaran. Terima kasih.");
  return lines.join("\n");
}

document.addEventListener("DOMContentLoaded", () => {
  // ===== NAV + 기본 WA CTA =====
  const menuToggle = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu");
  if (menuToggle && menu) {
    menuToggle.addEventListener("click", () => menu.classList.toggle("open"));
  }

  const whatsappCta = document.getElementById("whatsapp-cta");
  const whatsappOrder = document.getElementById("whatsapp-order");
  const baseLink = waLink(defaultInquiryMessage("General"));
  if (whatsappCta) whatsappCta.href = baseLink;
  if (whatsappOrder) whatsappOrder.href = baseLink;

  // Smooth scroll for internal anchors (only on index)
  if (window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/")) {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", function (e) {
        const href = this.getAttribute("href");
        if (href && href.length > 1) {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  // ===== CHECKOUT MODAL (INDEX) =====
  const orderModal = document.getElementById("order-modal");
  const orderForm = document.getElementById("order-form");
  const orderPkg = document.getElementById("order-package");
  const orderAmount = document.getElementById("order-amount");
  const orderName = document.getElementById("order-name");
  const orderWa = document.getElementById("order-wa");
  const orderCategory = document.getElementById("order-category");
  const orderPlayerId = document.getElementById("order-player-id");
  const orderServerId = document.getElementById("order-server-id");
  const fieldPlayer = document.getElementById("field-player-id");
  const fieldServer = document.getElementById("field-server-id");
  const orderChat = document.getElementById("order-chat");

  function openModal() {
    if (!orderModal) return;
    orderModal.classList.add("open");
    orderModal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!orderModal) return;
    orderModal.classList.remove("open");
    orderModal.setAttribute("aria-hidden", "true");
  }

  function setTopupFieldsVisible(isTopup) {
    if (!fieldPlayer || !fieldServer || !orderPlayerId || !orderServerId) return;

    fieldPlayer.style.display = isTopup ? "flex" : "none";
    fieldServer.style.display = isTopup ? "flex" : "none";

    orderPlayerId.required = !!isTopup;
    orderServerId.required = !!isTopup;

    if (!isTopup) {
      orderPlayerId.value = "";
      orderServerId.value = "";
    }
  }

  // Click checkout buttons
  const packageButtons = document.querySelectorAll("[data-package]");
  packageButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (!orderModal || !orderForm) {
        // fallback: old behavior -> WA
        const pkg = e.currentTarget.dataset.package || "Layanan";
        window.open(waLink(defaultInquiryMessage(pkg)), "_blank");
        return;
      }

      const pkg = e.currentTarget.dataset.package || "Layanan";
      const category = e.currentTarget.dataset.category || "";
      const amount = e.currentTarget.dataset.amount || "";

      orderPkg.value = pkg;
      orderCategory.value = category;

      if (amount) {
        orderAmount.value = String(amount);
        orderAmount.readOnly = true;
      } else {
        orderAmount.value = "";
        orderAmount.readOnly = false;
      }

      setTopupFieldsVisible(category === "topup");

      // Pre-fill WA if user typed before (optional)
      try {
        const last = JSON.parse(localStorage.getItem("dixxystore_last_customer") || "{}") || {};
        if (last.name && !orderName.value) orderName.value = last.name;
        if (last.wa && !orderWa.value) orderWa.value = last.wa;
      } catch {}

      openModal();
      orderName.focus();
    });
  });

  // Close modal handlers
  if (orderModal) {
    orderModal.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.dataset && target.dataset.close === "modal") {
        closeModal();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  if (orderChat) {
    orderChat.addEventListener("click", () => {
      const pkg = orderPkg?.value || "Layanan";
      window.open(waLink(defaultInquiryMessage(pkg)), "_blank");
    });
  }

  if (orderForm) {
    orderForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!PAKASIR_SLUG || PAKASIR_SLUG === "ganti-slug-kamu") {
        alert("PAKASIR_SLUG belum diisi. Silakan isi slug Pakasir kamu di file script.js");
        return;
      }

      const pkg = (orderPkg?.value || "").trim();
      const category = (orderCategory?.value || "").trim();
      const amount = Number(orderAmount?.value || 0);
      const customerName = (orderName?.value || "").trim();
      const customerWa = onlyDigits(orderWa?.value || "").trim();
      const playerId = (orderPlayerId?.value || "").trim();
      const serverId = (orderServerId?.value || "").trim();

      if (!pkg || !customerName || !customerWa || !amount) {
        alert("Mohon lengkapi data: Paket, Nominal, Nama, dan No. WhatsApp.");
        return;
      }

      if (amount < 1000) {
        alert("Nominal minimal Rp 1.000.");
        return;
      }

      if (category === "topup" && (!playerId || !serverId)) {
        alert("Untuk Top Up, User ID dan Server/Zone wajib diisi.");
        return;
      }

      // save for future prefill
      try {
        localStorage.setItem(
          "dixxystore_last_customer",
          JSON.stringify({ name: customerName, wa: customerWa })
        );
      } catch {}

      const orderId = generateOrderId();
      const order = {
        order_id: orderId,
        package: pkg,
        category,
        amount: Math.round(amount),
        customer_name: customerName,
        customer_wa: customerWa,
        player_id: category === "topup" ? playerId : "",
        server_id: category === "topup" ? serverId : "",
        created_at: new Date().toISOString()
      };

      saveOrder(order);

      const redirectUrl = buildSuccessUrl(orderId);
      const payUrl = buildPakasirUrl({
        slug: PAKASIR_SLUG,
        amount: order.amount,
        orderId: orderId,
        redirectUrl
      });

      closeModal();
      window.location.href = payUrl;
    });
  }

  // ===== SUCCESS PAGE =====
  const isSuccessPage = document.body?.dataset?.page === "success";
  if (isSuccessPage) {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id") || "";

    const elOrderId = document.getElementById("s-order-id");
    const elPkg = document.getElementById("s-package");
    const elAmount = document.getElementById("s-amount");
    const elName = document.getElementById("s-name");
    const elWa = document.getElementById("s-wa");
    const elPlayer = document.getElementById("s-player");
    const elServer = document.getElementById("s-server");
    const rowPlayer = document.getElementById("row-player");
    const rowServer = document.getElementById("row-server");
    const sendProof = document.getElementById("send-proof");

    const order = orderId ? getOrder(orderId) : null;

    if (elOrderId) elOrderId.textContent = orderId || "-";

    if (order) {
      if (elPkg) elPkg.textContent = order.package || "-";
      if (elAmount) elAmount.textContent = formatRp(order.amount);
      if (elName) elName.textContent = order.customer_name || "-";
      if (elWa) elWa.textContent = order.customer_wa || "-";

      const isTopup = order.category === "topup";
      if (rowPlayer) rowPlayer.style.display = isTopup ? "flex" : "none";
      if (rowServer) rowServer.style.display = isTopup ? "flex" : "none";
      if (isTopup) {
        if (elPlayer) elPlayer.textContent = order.player_id || "-";
        if (elServer) elServer.textContent = order.server_id || "-";
      }

      if (sendProof) {
        sendProof.href = waLink(buildProofMessage(order));
      }
    } else {
      // Fallback if localStorage is cleared (still allow user to send Order ID)
      if (elPkg) elPkg.textContent = "-";
      if (elAmount) elAmount.textContent = "-";
      if (elName) elName.textContent = "-";
      if (elWa) elWa.textContent = "-";
      if (rowPlayer) rowPlayer.style.display = "none";
      if (rowServer) rowServer.style.display = "none";

      if (sendProof) {
        const msg = [
          "Halo DIXXY STORE! Saya sudah melakukan pembayaran via Pakasir.",
          "",
          `Order ID: ${orderId || "-"}`,
          "",
          "Saya lampirkan bukti/screenshot pembayaran. Terima kasih."
        ].join("\n");
        sendProof.href = waLink(msg);
      }
    }
  }
});
