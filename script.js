/* =========================================================
   Body Scent — shared script (ใช้ร่วมกันทุกหน้า)
   ทำงานตาม element ที่พบในหน้านั้นๆ:
     - #product-grid   → product.html (แสดงการ์ด + ปุ่มกรอง mood)
     - #order-form     → order.html   (เติม items/total + ส่งออเดอร์)
     - #orders-body    → admin.html   (แสดงตารางออเดอร์จาก Google Sheet)
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Config ---------- */
  var ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbxX5vdzBvUBjAwFYsat_EN6ozPTc4ui5It8RmucRM6STL8LZCu3hYzaUBRdyFBVjbsH/exec";

  var SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTSc4RnzuTCng_xfeBeEVEO-BNG2K3tkj6FgAGdgRMzAY7tGni3WBGUUb_REAVpVmAR7yxfqN4XC5El/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  var TYPE_LABELS = { spray: "น้ำหอมฉีดตัว", rollon: "โรลออน" };

  /* ---------- Helpers ---------- */
  function formatPrice(n) {
    return Number(n).toLocaleString("th-TH") + " บาท";
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function setStatus(node, message) {
    if (!node) return;
    node.textContent = message || "";
    node.hidden = !message;
  }

  /* =========================================================
     1) product.html — การ์ดสินค้า + กรองตาม mood
     ========================================================= */
  function initProductPage() {
    var grid = document.getElementById("product-grid");
    if (!grid) return;

    var filterBar = document.getElementById("mood-filters");
    var status = document.getElementById("product-status");
    var products = [];

    function getInitialMood() {
      var m = new URLSearchParams(window.location.search).get("mood");
      m = m ? m.toLowerCase() : "all";
      var valid = MOODS.some(function (x) { return x.key === m; });
      return valid ? m : "all";
    }

    function orderUrl(p) {
      var itemName = p.name + (p.size ? " " + p.size : "");
      return (
        "order.html?item=" + encodeURIComponent(itemName) +
        "&price=" + encodeURIComponent(p.price)
      );
    }

    function buildCard(p) {
      var card = el("article", "card");
      card.setAttribute("data-mood", p.mood);

      var media = el("div", "card__media");
      var img = el("img");
      img.src = p.image;
      img.alt = p.name;
      img.loading = "lazy";
      media.appendChild(img);

      var body = el("div", "card__body");
      body.appendChild(el("h3", "card__title", p.name));

      var meta = [];
      meta.push(TYPE_LABELS[p.type] || p.type);
      if (p.size) meta.push(p.size);
      body.appendChild(el("p", "card__meta", meta.join(" • ")));

      var tag = el("span", "mood-tag", p.mood.charAt(0).toUpperCase() + p.mood.slice(1));
      body.appendChild(tag);

      if (p.description) body.appendChild(el("p", "card__desc", p.description));

      var footer = el("div", "card__footer");
      footer.appendChild(el("span", "price", formatPrice(p.price)));
      var btn = el("a", "btn btn--accent btn--small", "สั่งซื้อ");
      btn.href = orderUrl(p);
      footer.appendChild(btn);
      body.appendChild(footer);

      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    function render(mood) {
      grid.textContent = "";
      var list = products.filter(function (p) {
        return mood === "all" || p.mood === mood;
      });
      if (!list.length) {
        setStatus(status, "ยังไม่มีสินค้าในหมวดนี้");
        return;
      }
      setStatus(status, "");
      list.forEach(function (p) { grid.appendChild(buildCard(p)); });
    }

    function setActive(mood) {
      if (!filterBar) return;
      Array.prototype.forEach.call(filterBar.querySelectorAll("button"), function (b) {
        var on = b.getAttribute("data-mood-filter") === mood;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function applyFilter(mood) {
      setActive(mood);
      render(mood);
      // อัปเดต URL โดยไม่โหลดหน้าใหม่ (แชร์ลิงก์ที่กรองแล้วได้)
      if (window.history && history.replaceState) {
        var url = new URL(window.location.href);
        if (mood === "all") url.searchParams.delete("mood");
        else url.searchParams.set("mood", mood);
        history.replaceState(null, "", url);
      }
    }

    function buildFilters() {
      if (!filterBar) return;
      filterBar.textContent = "";
      MOODS.forEach(function (m) {
        var b = el("button", "chip");
        b.type = "button";
        b.setAttribute("data-mood-filter", m.key);
        if (m.key !== "all") {
          b.setAttribute("data-mood", m.key);
          b.appendChild(el("span", "mood-dot"));
        }
        b.appendChild(document.createTextNode(m.label));
        b.addEventListener("click", function () { applyFilter(m.key); });
        filterBar.appendChild(b);
      });
    }

    buildFilters();
    setStatus(status, "กำลังโหลดสินค้า...");

    fetch("products.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        applyFilter(getInitialMood());
      })
      .catch(function (err) {
        console.error(err);
        setStatus(status, "โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      });
  }

  /* =========================================================
     2) order.html — เติมฟอร์มจาก URL + ส่งออเดอร์
     ========================================================= */
  function initOrderPage() {
    var form = document.getElementById("order-form");
    if (!form) return;

    var itemsInput = document.getElementById("items");
    var totalInput = document.getElementById("total");

    // อ่านค่าจาก URL parameter แล้วเติมทั้ง items และ total ทันที
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");

    if (itemsInput && item) itemsInput.value = item;
    if (totalInput && price) totalInput.value = price;

    function valueOf(id) {
      var node = document.getElementById(id);
      return node ? node.value.trim() : "";
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var submitBtn = form.querySelector('[type="submit"]');

      var payload = {
        customerName: valueOf("customerName"),
        contact: valueOf("contact"),
        items: valueOf("items"),
        total: valueOf("total"),
        note: valueOf("note")
      };

      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(() => { window.location.href = "thankyou.html"; })
        .catch(error => {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* =========================================================
     3) admin.html — ตารางออเดอร์จาก Google Sheet (CSV)
     ========================================================= */

  // parse CSV เอง: รองรับ "..." ครอบ, "" แทน " ในช่อง, ขึ้นบรรทัดใหม่ในช่อง, CRLF
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
    // แถวสุดท้ายที่ไม่มี newline ปิดท้าย
    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }
    // ตัดแถวว่างทิ้ง
    return rows.filter(function (r) {
      return r.some(function (cell) { return cell.trim() !== ""; });
    });
  }

  function initAdminPage() {
    var tbody = document.getElementById("orders-body");
    if (!tbody) return;

    var status = document.getElementById("admin-status");
    setStatus(status, "กำลังโหลดข้อมูล...");

    // เติม query กันแคชของเบราว์เซอร์
    var url = SHEET_CSV_URL + "&_=" + Date.now();

    fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);
        rows.shift(); // แถวแรกคือหัวคอลัมน์
        rows.reverse(); // Sheet เพิ่มแถวต่อท้ายเสมอ → กลับลำดับให้ล่าสุดขึ้นก่อน

        tbody.textContent = "";

        if (!rows.length) {
          setStatus(status, "ยังไม่มีคำสั่งซื้อ");
          return;
        }

        rows.forEach(function (r) {
          var tr = document.createElement("tr");
          // คอลัมน์ A-F: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
          for (var i = 0; i < 6; i++) {
            // ใช้ textContent เสมอ เพราะข้อมูลมาจากลูกค้า (กัน HTML/script แฝง)
            tr.appendChild(el("td", null, r[i] !== undefined ? r[i] : ""));
          }
          tbody.appendChild(tr);
        });

        setStatus(status, "ทั้งหมด " + rows.length + " รายการ");
      })
      .catch(function (err) {
        console.error(err);
        setStatus(status, "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      });
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initProductPage();
    initOrderPage();
    initAdminPage();
  });
})();
