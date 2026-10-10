// Dark is the main mode; a member can switch to light in the header and it's remembered on that device.
(function () {
  var t = "dark"; try { t = localStorage.getItem("s100-theme") || "dark"; } catch (e) { }
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]').setAttribute("content", t === "dark" ? "#110509" : "#FAF8F5");
})();
