export const VIDEO_MODEL_CAPABILITIES = {
  'seedance-2.0': {
    id: 'seedance-2.0',
    name: 'Seedance 2.0',
    displayName: 'Seedance 2.0',
    category: ['text-to-video', 'image-to-video', 'first-last-frame', 'multi-modal-ref', 'edit-video', 'extend-video'],

    promptLimit: {
      positive: 2000,
      negative: null,
      recommendedChinese: [50, 150],
      recommendedEnglish: [30, 100],
    },

    inputImage: {
      formats: ['jpeg', 'png', 'webp', 'bmp', 'tiff', 'gif'],
      maxCount: 9,
      maxFileSize: 30,
      minSize: 14,
      aspectRatioRange: [1/16, 16],
      maxTotalPixels: 36000000,
      inputMethods: ['url', 'base64'],
    },

    inputVideo: {
      formats: ['mp4', 'mov'],
      maxCount: 3,
      durationRange: [2, 15],
      maxTotalDuration: 15,
      maxFileSize: 200,
    },

    inputAudio: {
      formats: ['mp3', 'wav'],
      maxCount: 3,
      maxDuration: 15,
      maxFileSize: 15,
    },

    maxTotalFiles: 12,

    outputVideo: {
      durationRange: [4, 15],
      frameRate: 24,
      format: 'mp4',
      stereoAudio: true,
    },

    resolutions: {
      '480p': [
        { ratio: '1:1', width: 640, height: 640 },
        { ratio: '16:9', width: 864, height: 496 },
        { ratio: '9:16', width: 496, height: 864 },
        { ratio: '4:3', width: 752, height: 560 },
        { ratio: '3:4', width: 560, height: 752 },
        { ratio: '21:9', width: 992, height: 432 },
      ],
      '720p': [
        { ratio: '1:1', width: 960, height: 960 },
        { ratio: '16:9', width: 1280, height: 720 },
        { ratio: '9:16', width: 720, height: 1280 },
        { ratio: '4:3', width: 1112, height: 834 },
        { ratio: '3:4', width: 834, height: 1112 },
        { ratio: '21:9', width: 1470, height: 630 },
      ],
      '1080p': [
        { ratio: '1:1', width: 1440, height: 1440 },
        { ratio: '16:9', width: 1920, height: 1080 },
        { ratio: '9:16', width: 1080, height: 1920 },
        { ratio: '4:3', width: 1664, height: 1248 },
        { ratio: '3:4', width: 1248, height: 1664 },
        { ratio: '21:9', width: 2206, height: 946 },
      ],
      '2K': [
        { ratio: '1:1', width: 2048, height: 2048 },
        { ratio: '16:9', width: 2848, height: 1600 },
        { ratio: '9:16', width: 1600, height: 2848 },
        { ratio: '4:3', width: 2304, height: 1728 },
        { ratio: '3:4', width: 1728, height: 2304 },
      ],
      '4K': null,
    },

    features: {
      atSyntax: true,
      directorControl: true,
      lipSync: true,
      firstLastFrame: true,
    },

    defaults: {
      ratio: '16:9',
      resolution: '1080p',
      duration: '5s',
      refMode: 'all',
    },
  },

  'kling-3.0': {
    id: 'kling-3.0',
    name: 'Kling 3.0',
    displayName: 'Kling 3.0',
    category: ['text-to-video', 'image-to-video', 'multi-modal-ref', 'first-last-frame'],

    promptLimit: {
      positive: 2500,
      negative: 2500,
      recommendedChinese: [50, 200],
      recommendedEnglish: [30, 150],
    },

    inputImage: {
      formats: ['jpeg', 'png', 'webp'],
      maxCount: 2,
      maxFileSize: 10,
      minSize: 64,
      aspectRatioRange: [1/3, 3],
      maxTotalPixels: null,
      inputMethods: ['url', 'base64'],
    },

    inputVideo: {
      formats: [],
      maxCount: 0,
      durationRange: null,
      maxTotalDuration: null,
      maxFileSize: null,
    },

    inputAudio: {
      formats: [],
      maxCount: 0,
      maxDuration: null,
      maxFileSize: null,
    },

    maxTotalFiles: 2,

    outputVideo: {
      durationRange: [5, 10],
      frameRate: 30,
      format: 'mp4',
      stereoAudio: true,
    },

    resolutions: {
      '480p': [
        { ratio: '1:1', width: 640, height: 640 },
        { ratio: '16:9', width: 848, height: 480 },
        { ratio: '9:16', width: 480, height: 848 },
      ],
      '720p': [
        { ratio: '1:1', width: 960, height: 960 },
        { ratio: '16:9', width: 1280, height: 720 },
        { ratio: '9:16', width: 720, height: 1280 },
      ],
      '1080p': [
        { ratio: '1:1', width: 1440, height: 1440 },
        { ratio: '16:9', width: 1920, height: 1080 },
        { ratio: '9:16', width: 1080, height: 1920 },
      ],
      '2K': null,
      '4K': null,
    },

    features: {
      atSyntax: false,
      directorControl: true,
      lipSync: false,
      firstLastFrame: true,
    },

    defaults: {
      ratio: '16:9',
      resolution: '1080p',
      duration: '5s',
      refMode: 'all',
    },
  },

  'kling-o3': {
    id: 'kling-o3',
    name: 'Kling O3',
    displayName: 'Kling O3',
    category: ['text-to-video', 'image-to-video', 'multi-modal-ref', 'first-last-frame'],

    promptLimit: {
      positive: 2500,
      negative: 2500,
      recommendedChinese: [50, 200],
      recommendedEnglish: [30, 150],
    },

    inputImage: {
      formats: ['jpeg', 'png', 'webp'],
      maxCount: 1,
      maxFileSize: 10,
      minSize: 64,
      aspectRatioRange: [1/3, 3],
      maxTotalPixels: null,
      inputMethods: ['url', 'base64'],
    },

    inputVideo: {
      formats: [],
      maxCount: 0,
      durationRange: null,
      maxTotalDuration: null,
      maxFileSize: null,
    },

    inputAudio: {
      formats: [],
      maxCount: 0,
      maxDuration: null,
      maxFileSize: null,
    },

    maxTotalFiles: 1,

    outputVideo: {
      durationRange: [5, 10],
      frameRate: 30,
      format: 'mp4',
      stereoAudio: true,
    },

    resolutions: {
      '480p': [
        { ratio: '1:1', width: 640, height: 640 },
        { ratio: '16:9', width: 848, height: 480 },
        { ratio: '9:16', width: 480, height: 848 },
      ],
      '720p': [
        { ratio: '1:1', width: 960, height: 960 },
        { ratio: '16:9', width: 1280, height: 720 },
        { ratio: '9:16', width: 720, height: 1280 },
      ],
      '1080p': [
        { ratio: '1:1', width: 1440, height: 1440 },
        { ratio: '16:9', width: 1920, height: 1080 },
        { ratio: '9:16', width: 1080, height: 1920 },
      ],
      '2K': null,
      '4K': null,
    },

    features: {
      atSyntax: false,
      directorControl: false,
      lipSync: false,
      firstLastFrame: false,
    },

    defaults: {
      ratio: '16:9',
      resolution: '1080p',
      duration: '5s',
      refMode: 'all',
    },
  },

  'vidu-q3': {
    id: 'vidu-q3',
    name: 'Vidu Q3',
    displayName: 'Vidu Q3',
    category: ['text-to-video', 'image-to-video', 'multi-modal-ref', 'first-last-frame'],

    promptLimit: {
      positive: 1000,
      negative: null,
      recommendedChinese: [30, 100],
      recommendedEnglish: [20, 80],
    },

    inputImage: {
      formats: ['jpeg', 'png', 'webp'],
      maxCount: 2,
      maxFileSize: 10,
      minSize: 128,
      aspectRatioRange: [1/2, 2],
      maxTotalPixels: null,
      inputMethods: ['url', 'base64'],
    },

    inputVideo: {
      formats: [],
      maxCount: 0,
      durationRange: null,
      maxTotalDuration: null,
      maxFileSize: null,
    },

    inputAudio: {
      formats: [],
      maxCount: 0,
      maxDuration: null,
      maxFileSize: null,
    },

    maxTotalFiles: 2,

    outputVideo: {
      durationRange: [4, 8],
      frameRate: 24,
      format: 'mp4',
      stereoAudio: true,
    },

    resolutions: {
      '480p': [
        { ratio: '1:1', width: 640, height: 640 },
        { ratio: '16:9', width: 848, height: 480 },
        { ratio: '9:16', width: 480, height: 848 },
      ],
      '720p': [
        { ratio: '1:1', width: 960, height: 960 },
        { ratio: '16:9', width: 1280, height: 720 },
        { ratio: '9:16', width: 720, height: 1280 },
      ],
      '1080p': [
        { ratio: '1:1', width: 1440, height: 1440 },
        { ratio: '16:9', width: 1920, height: 1080 },
        { ratio: '9:16', width: 1080, height: 1920 },
      ],
      '2K': null,
      '4K': null,
    },

    features: {
      atSyntax: false,
      directorControl: false,
      lipSync: false,
      firstLastFrame: true,
    },

    defaults: {
      ratio: '16:9',
      resolution: '1080p',
      duration: '4s',
      refMode: 'all',
    },
  },

};
