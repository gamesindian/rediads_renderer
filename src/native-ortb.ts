/** Twelve GPT slot sizes supported by the native renderer bundle. */
export const NATIVE_DISPLAY_SIZES: ReadonlyArray<readonly [number, number]> = [
  [300, 250],
  [320, 50],
  [320, 480],
  [300, 600],
  [728, 90],
  [970, 250],
  [970, 90],
  [728, 250],
  [160, 600],
  [120, 600],
  [336, 280],
  [320, 100],
] as const;

/** Default ORTB native 1.2 block — asset ids match `rediads-native-renderer.js`. */
export const DEFAULT_NATIVE_ORTB = {
  ver: '1.2',
  context: 1,
  plcmttype: 1,
  assets: [
    { id: 1, required: 1, title: { len: 100 } },
    { id: 2, required: 1, img: { type: 3, wmin: 100, hmin: 100 } },
    { id: 3, required: 0, img: { type: 1, wmin: 50, hmin: 50 } },
    { id: 4, required: 0, data: { type: 2, len: 140 } },
    { id: 5, required: 0, data: { type: 12, len: 20 } },
    { id: 6, required: 0, data: { type: 1, len: 25 } },
  ],
  eventtrackers: [{ event: 1, methods: [1, 2] }],
  privacy: 1,
} as const;

export type NativeMediaType = {
  sendTargetingKeys?: boolean;
  rendererUrl: string;
  ortb: typeof DEFAULT_NATIVE_ORTB;
};

/** Prebid `mediaTypes.native` with RediAds rendererUrl and default ORTB assets. */
export function buildNativeMediaType(rendererUrl: string): NativeMediaType {
  return {
    sendTargetingKeys: false,
    rendererUrl,
    ortb: { ...DEFAULT_NATIVE_ORTB },
  };
}
