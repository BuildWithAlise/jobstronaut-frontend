// Register Jobstronaut service worker (launch-ready)
(function() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js')
        .then(function(reg) {
          console.log('Service worker registered:', reg.scope);
          if (reg && reg.update) {
            // Check for updates shortly after load
            setTimeout(function(){ reg.update(); }, 3000);
          }
        })
        .catch(function(err) {
          console.warn('Service worker registration failed:', err);
        });
    });
  }
})();