// ==UserScript==
// @name         StudySpace LibCal Autofill
// @namespace    studyspace
// @version      1.1
// @description  On schedule.yale.edu, click the earliest green start at or after #studyspaceStart=. Skip red booked cells. Leave the end-time dropdown alone.
// @match        https://schedule.yale.edu/space/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  const HASH = "studyspaceStart";
  const match = location.hash.match(new RegExp(HASH + "=([^&]+)"));
  if (!match) return;
  const fromHash = new Date(decodeURIComponent(match[1]));
  if (Number.isNaN(+fromHash)) return;

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function hourKey(label) {
    const m = String(label)
      .toLowerCase()
      .match(/(\d{1,2}):(\d{2})\s*([ap]m)/);
    if (!m) return "";
    let h = +m[1] % 12;
    if (m[3].indexOf("p") === 0) h += 12;
    if (m[3].indexOf("a") === 0 && +m[1] === 12) h = 0;
    return h + ":" + m[2];
  }

  function blocked(el) {
    return /s-lc-eq-checkout|s-lc-eq-period-booked|s-lc-eq-r-unavailable|s-lc-eq-r-padding|s-lc-eq-unavail/.test(
      el.className || "",
    );
  }

  function slotDate(el, fallback) {
    const start =
      el.fcSeg &&
      el.fcSeg.eventRange &&
      el.fcSeg.eventRange.range &&
      el.fcSeg.eventRange.range.start;
    if (start) {
      const d = new Date(start);
      if (!Number.isNaN(+d)) return d;
    }
    const t = el.getAttribute("title") || el.getAttribute("aria-label") || "";
    const hk = hourKey(t);
    if (!hk) return null;
    const parts = hk.split(":");
    const out = new Date(fallback);
    out.setHours(+parts[0], +parts[1], 0, 0);
    return out;
  }

  function greens() {
    return [].slice
      .call(document.querySelectorAll("a.s-lc-eq-avail"))
      .filter(function (el) {
        return !blocked(el);
      });
  }

  function pickGreen(want) {
    const rows = greens()
      .map(function (el) {
        const d = slotDate(el, want);
        return d ? { el: el, ms: +d } : null;
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return a.ms - b.ms;
      });
    if (!rows.length) return null;
    const needed = +want;
    const exact = rows.find(function (r) {
      return Math.abs(r.ms - needed) < 60000;
    });
    if (exact) return exact.el;
    const after = rows.find(function (r) {
      return r.ms >= needed - 60000;
    });
    return (after || rows[0]).el;
  }

  function realClick(el) {
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const o = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      buttons: 1,
    };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.dispatchEvent(new MouseEvent("click", o));
  }

  function wellText() {
    const w = document.querySelector("#s-lc-eq-bwell");
    return w ? String(w.innerText || w.textContent || "").toLowerCase() : "";
  }

  function timeLabel(d) {
    let h = d.getHours();
    const m = pad(d.getMinutes());
    const ap = h >= 12 ? "pm" : "am";
    h = h % 12;
    if (!h) h = 12;
    return (h + ":" + m + ap).toLowerCase();
  }

  function clearWrongPending(target) {
    const want = timeLabel(slotDate(target, fromHash) || fromHash);
    const text = wellText();
    if (!text || text.indexOf(want) !== -1) return;
    const btn = [].slice
      .call(document.querySelectorAll("button,a,[role='button']"))
      .find(function (el) {
        return /remove pending booking/i.test(el.getAttribute("aria-label") || el.textContent || "");
      });
    if (btn) realClick(btn);
  }

  function tryPick(attempt) {
    const target = pickGreen(fromHash);
    if (target) {
      clearWrongPending(target);
      realClick(target);
      return;
    }
    const nextBtn = document.querySelector(".fc-goToNextAvailable-button");
    if (nextBtn && nextBtn.offsetParent !== null && attempt < 12) {
      realClick(nextBtn);
      window.setTimeout(function () {
        tryPick(attempt + 1);
      }, 700);
      return;
    }
    if (attempt < 20) {
      window.setTimeout(function () {
        tryPick(attempt + 1);
      }, 250);
    }
  }

  tryPick(0);
})();
