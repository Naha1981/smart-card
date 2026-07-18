(function () {
  var script = document.currentScript;
  var tenantSlug = script.getAttribute("data-tenant");
  var appUrl = script.getAttribute("data-app-url") || "https://app.smartcart.ai";
  if (!tenantSlug) {
    console.error("[SmartCart] Missing data-tenant attribute on embed script tag.");
    return;
  }

  var bubble = document.createElement("button");
  bubble.innerText = "Chat";
  bubble.style.cssText =
    "position:fixed;bottom:20px;right:20px;z-index:999999;background:#34d399;color:#0a0a0b;" +
    "border:none;border-radius:9999px;padding:14px 20px;font-weight:600;font-family:sans-serif;" +
    "box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer;";

  var iframe = document.createElement("iframe");
  iframe.src = appUrl + "/widget/" + tenantSlug;
  iframe.style.cssText =
    "position:fixed;bottom:88px;right:20px;width:380px;height:560px;max-width:92vw;max-height:75vh;" +
    "border:none;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.35);z-index:999999;display:none;";

  bubble.onclick = function () {
    iframe.style.display = iframe.style.display === "none" ? "block" : "none";
  };

  document.body.appendChild(iframe);
  document.body.appendChild(bubble);
})();
