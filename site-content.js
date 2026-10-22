(function () {
  try {
    const request = new XMLHttpRequest();
    request.open("GET", "/api/content", false);
    request.send();
    if (request.status === 200) window.lagomContent = JSON.parse(request.responseText);
  } catch (error) {
    console.info("Yönetilen içerik kullanılamadı; yerleşik içerik gösteriliyor.");
  }
})();
