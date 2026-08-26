(() => {
  'use strict';

  // Production delivery may replace this file in the Pages artifact with the
  // public HTTPS relay base URL. The checked-in default deliberately keeps the
  // relay disabled so local/dev builds and relay outages preserve canonical
  // self-contained Ámpula sharing.
  window.AMPULA_SHORT_LINK_RELAY = window.AMPULA_SHORT_LINK_RELAY || '';
})();
