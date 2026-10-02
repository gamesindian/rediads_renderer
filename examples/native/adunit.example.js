// One native ad unit -> one native imp in every bid request, for all 12 slot sizes.
// Native has no size in Prebid; GAM picks the slot size and the renderer adapts to it.

var RD_SIZES = [[300,250],[320,50],[320,480],[300,600],[728,90],[970,250],[970,90],[728,250],[160,600],[120,600],[336,280],[320,100]];

var adUnits = [{
  code: 'div-rediads-native',
  mediaTypes: {
    native: {
      sendTargetingKeys: false,
      rendererUrl: 'https://cdn.rediads.com/native/v1/rediads-native-renderer.js', // local dev: /rediads-native-renderer.js
      ortb: {
        ver: '1.2',
        context: 1,
        plcmttype: 1,
        assets: [
          { id: 1, required: 1, title: { len: 100 } },
          { id: 2, required: 1, img: { type: 3, wmin: 100, hmin: 100 } },
          { id: 3, required: 0, img: { type: 1, wmin: 50, hmin: 50 } },
          { id: 4, required: 0, data: { type: 2, len: 140 } },
          { id: 5, required: 0, data: { type: 12, len: 20 } },
          { id: 6, required: 0, data: { type: 1, len: 25 } }
        ],
        eventtrackers: [{ event: 1, methods: [1, 2] }],
        privacy: 1
      }
    }
  },
  bids: [
    { bidder: 'appnexus', params: { placementId: 0 } } // replace with your bidders
  ]
}];

var slot;
window.googletag = window.googletag || { cmd: [] };
window.pbjs = window.pbjs || { que: [] };

googletag.cmd.push(function () {
  var map = googletag.sizeMapping()
    .addSize([1024, 0], [[970,250],[970,90],[728,250],[728,90],[300,600],[160,600],[120,600],[336,280],[300,250]])
    .addSize([768, 0],  [[728,250],[728,90],[300,600],[160,600],[120,600],[336,280],[300,250]])
    .addSize([0, 0],    [[320,480],[336,280],[300,250],[320,100],[320,50]])
    .build();
  slot = googletag.defineSlot('/NETWORK_ID/rediads_native', RD_SIZES, 'div-rediads-native')
    .defineSizeMapping(map)
    .addService(googletag.pubads());
  googletag.pubads().disableInitialLoad();
  googletag.enableServices();
});

pbjs.que.push(function () {
  pbjs.addAdUnits(adUnits);
  pbjs.requestBids({
    timeout: 1200,
    bidsBackHandler: function () {
      googletag.cmd.push(function () {
        pbjs.setTargetingForGPTAsync(['div-rediads-native']);
        googletag.pubads().refresh([slot]);
      });
    }
  });
});
