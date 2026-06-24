export const IMAGE_MODEL_CAPABILITIES = {
  'doubao-seedream-5.0-lite': {
    id: 'doubao-seedream-5.0-lite',
    name: 'Doubao SeeDream 5.0 Lite',
    displayName: 'Doubao-Seed-5.0-Lite',
    category: ['text-to-image', 'image-to-image'],

    promptLimit: {
      chinese: 300,
      english: 600,
    },

    uploadImage: {
      formats: ['jpeg', 'png', 'webp', 'bmp', 'tiff', 'gif', 'heic', 'heif'],
      aspectRatioRange: [1/16, 16],
      minSize: 14,
      maxFileSize: 30,
      maxTotalPixels: 36000000,
      maxCount: 14,
      inputMethods: ['url', 'base64'],
    },

    outputImage: {
      defaultSize: '2048×2048',
      pixelRange: [3686400, 16777216],
      aspectRatioRange: [1/16, 16],
    },

    resolutions: {
      '1K': null,
      '2K': [
        { ratio: '1:1', width: 2048, height: 2048 },
        { ratio: '4:3', width: 2304, height: 1728 },
        { ratio: '3:4', width: 1728, height: 2304 },
        { ratio: '16:9', width: 2848, height: 1600 },
        { ratio: '9:16', width: 1600, height: 2848 },
        { ratio: '3:2', width: 2496, height: 1664 },
        { ratio: '2:3', width: 1664, height: 2496 },
        { ratio: '21:9', width: 3136, height: 1344 },
      ],
      '3K': [
        { ratio: '1:1', width: 3072, height: 3072 },
        { ratio: '4:3', width: 3456, height: 2592 },
        { ratio: '3:4', width: 2592, height: 3456 },
        { ratio: '16:9', width: 4096, height: 2304 },
        { ratio: '9:16', width: 2304, height: 4096 },
        { ratio: '2:3', width: 2496, height: 3744 },
        { ratio: '3:2', width: 3744, height: 2496 },
        { ratio: '21:9', width: 4704, height: 2016 },
      ],
      '4K': [
        { ratio: '1:1', width: 4096, height: 4096 },
        { ratio: '3:4', width: 3520, height: 4704 },
        { ratio: '4:3', width: 4704, height: 3520 },
        { ratio: '16:9', width: 5504, height: 3040 },
        { ratio: '9:16', width: 3040, height: 5504 },
        { ratio: '2:3', width: 3328, height: 4992 },
        { ratio: '3:2', width: 4992, height: 3328 },
        { ratio: '21:9', width: 6240, height: 2656 },
      ],
    },

    features: {
      multiImageInput: true,
      imageFusion: true,
      maxImagesTotal: 15,
      visualCoT: true,
      outpainting: true,
    },

    defaults: {
      ratio: '16:9',
      resolution: '2K',
      count: '1张',
    },
  },

  'doubao-seedream-4.5': {
    id: 'doubao-seedream-4.5',
    name: 'Doubao SeeDream 4.5',
    displayName: 'Doubao-Seed-4.5',
    category: ['text-to-image', 'image-to-image'],

    promptLimit: {
      chinese: 300,
      english: 600,
    },

    uploadImage: {
      formats: ['jpeg', 'png', 'webp', 'bmp', 'tiff', 'gif', 'heic', 'heif'],
      aspectRatioRange: [1/16, 16],
      minSize: 14,
      maxFileSize: 30,
      maxTotalPixels: 36000000,
      maxCount: 14,
      inputMethods: ['url', 'base64'],
    },

    outputImage: {
      defaultSize: '2048×2048',
      pixelRange: [3686400, 16777216],
      aspectRatioRange: [1/16, 16],
    },

    resolutions: {
      '1K': null,
      '2K': [
        { ratio: '1:1', width: 2048, height: 2048 },
        { ratio: '4:3', width: 2304, height: 1728 },
        { ratio: '3:4', width: 1728, height: 2304 },
        { ratio: '16:9', width: 2848, height: 1600 },
        { ratio: '9:16', width: 1600, height: 2848 },
        { ratio: '3:2', width: 2496, height: 1664 },
        { ratio: '2:3', width: 1664, height: 2496 },
        { ratio: '21:9', width: 3136, height: 1344 },
      ],
      '3K': [
        { ratio: '1:1', width: 3072, height: 3072 },
        { ratio: '4:3', width: 3456, height: 2592 },
        { ratio: '3:4', width: 2592, height: 3456 },
        { ratio: '16:9', width: 4096, height: 2304 },
        { ratio: '9:16', width: 2304, height: 4096 },
        { ratio: '2:3', width: 2496, height: 3744 },
        { ratio: '3:2', width: 3744, height: 2496 },
        { ratio: '21:9', width: 4704, height: 2016 },
      ],
      '4K': [
        { ratio: '1:1', width: 4096, height: 4096 },
        { ratio: '3:4', width: 3520, height: 4704 },
        { ratio: '4:3', width: 4704, height: 3520 },
        { ratio: '16:9', width: 5504, height: 3040 },
        { ratio: '9:16', width: 3040, height: 5504 },
        { ratio: '2:3', width: 3328, height: 4992 },
        { ratio: '3:2', width: 4992, height: 3328 },
        { ratio: '21:9', width: 6240, height: 2656 },
      ],
    },

    features: {
      multiImageInput: true,
      imageFusion: true,
      maxImagesTotal: 15,
      visualCoT: true,
      outpainting: true,
    },

    defaults: {
      ratio: '16:9',
      resolution: '2K',
      count: '1张',
    },
  },

  'doubao-seedream-4.0': {
    id: 'doubao-seedream-4.0',
    name: 'Doubao SeeDream 4.0',
    displayName: 'Doubao-Seed-4.0',
    category: ['text-to-image', 'image-to-image'],

    promptLimit: {
      chinese: 300,
      english: 600,
    },

    uploadImage: {
      formats: ['jpeg', 'png', 'webp', 'bmp', 'tiff', 'gif', 'heic', 'heif'],
      aspectRatioRange: [1/16, 16],
      minSize: 14,
      maxFileSize: 30,
      maxTotalPixels: 36000000,
      maxCount: 14,
      inputMethods: ['url', 'base64'],
    },

    outputImage: {
      defaultSize: '2048×2048',
      pixelRange: [3686400, 16777216],
      aspectRatioRange: [1/16, 16],
    },

    resolutions: {
      '1K': [
        { ratio: '1:1', width: 1024, height: 1024 },
        { ratio: '4:3', width: 1152, height: 864 },
        { ratio: '3:4', width: 864, height: 1152 },
        { ratio: '16:9', width: 1408, height: 800 },
        { ratio: '9:16', width: 800, height: 1408 },
        { ratio: '3:2', width: 1248, height: 832 },
        { ratio: '2:3', width: 832, height: 1248 },
        { ratio: '21:9', width: 1568, height: 672 },
      ],
      '2K': [
        { ratio: '1:1', width: 2048, height: 2048 },
        { ratio: '4:3', width: 2304, height: 1728 },
        { ratio: '3:4', width: 1728, height: 2304 },
        { ratio: '16:9', width: 2848, height: 1600 },
        { ratio: '9:16', width: 1600, height: 2848 },
        { ratio: '3:2', width: 2496, height: 1664 },
        { ratio: '2:3', width: 1664, height: 2496 },
        { ratio: '21:9', width: 3136, height: 1344 },
      ],
      '3K': [
        { ratio: '1:1', width: 3072, height: 3072 },
        { ratio: '4:3', width: 3456, height: 2592 },
        { ratio: '3:4', width: 2592, height: 3456 },
        { ratio: '16:9', width: 4096, height: 2304 },
        { ratio: '9:16', width: 2304, height: 4096 },
        { ratio: '2:3', width: 2496, height: 3744 },
        { ratio: '3:2', width: 3744, height: 2496 },
        { ratio: '21:9', width: 4704, height: 2016 },
      ],
      '4K': [
        { ratio: '1:1', width: 4096, height: 4096 },
        { ratio: '3:4', width: 3520, height: 4704 },
        { ratio: '4:3', width: 4704, height: 3520 },
        { ratio: '16:9', width: 5504, height: 3040 },
        { ratio: '9:16', width: 3040, height: 5504 },
        { ratio: '2:3', width: 3328, height: 4992 },
        { ratio: '3:2', width: 4992, height: 3328 },
        { ratio: '21:9', width: 6240, height: 2656 },
      ],
    },

    features: {
      multiImageInput: true,
      imageFusion: true,
      maxImagesTotal: 15,
      visualCoT: false,
      outpainting: false,
    },

    defaults: {
      ratio: '16:9',
      resolution: '2K',
      count: '1张',
    },
  },

  'openai-dalle-2': {
    id: 'openai-dalle-2',
    name: 'OpenAI DALL·E 2',
    displayName: 'DALL·E 2',
    category: ['text-to-image', 'image-to-image'],

    promptLimit: {
      chinese: null,
      english: 1000,
    },

    uploadImage: {
      formats: ['png'],
      aspectRatioRange: [1, 1],
      minSize: null,
      maxFileSize: 4,
      maxTotalPixels: null,
      maxCount: 1,
      inputMethods: ['file'],
    },

    outputImage: {
      defaultSize: '1024×1024',
      pixelRange: null,
      aspectRatioRange: [1, 1],
    },

    resolutions: {
      '1K': [
        { ratio: '1:1', width: 1024, height: 1024 },
      ],
      '2K': null,
      '3K': null,
      '4K': null,
    },

    features: {
      multiImageInput: false,
      imageFusion: false,
      maxImagesTotal: 10,
      visualCoT: false,
      outpainting: false,
    },

    defaults: {
      ratio: '1:1',
      resolution: '1K',
      count: '1张',
    },
  },

  'google-nano-banana-2-pro': {
    id: 'google-nano-banana-2-pro',
    name: 'Google Nano Banana 2 Pro',
    displayName: 'Nano-Banana-2-Pro',
    category: ['text-to-image'],

    promptLimit: {
      chinese: null,
      english: 2048,
    },

    uploadImage: {
      formats: [],
      aspectRatioRange: null,
      minSize: null,
      maxFileSize: null,
      maxTotalPixels: null,
      maxCount: 0,
      inputMethods: [],
    },

    outputImage: {
      defaultSize: '1024×1024',
      pixelRange: null,
      aspectRatioRange: [1/4, 4],
    },

    resolutions: {
      '1K': [
        { ratio: '1:1', width: 1024, height: 1024 },
        { ratio: '3:4', width: 896, height: 1152 },
        { ratio: '4:3', width: 1152, height: 896 },
        { ratio: '16:9', width: 1344, height: 768 },
        { ratio: '9:16', width: 768, height: 1344 },
      ],
      '2K': null,
      '3K': null,
      '4K': null,
    },

    features: {
      multiImageInput: false,
      imageFusion: false,
      maxImagesTotal: 4,
      visualCoT: false,
      outpainting: false,
    },

    defaults: {
      ratio: '16:9',
      resolution: '1K',
      count: '1张',
    },
  },

  'google-nano-banana-2': {
    id: 'google-nano-banana-2',
    name: 'Google Nano Banana 2',
    displayName: 'Nano-Banana-2',
    category: ['text-to-image'],

    promptLimit: {
      chinese: null,
      english: 2048,
    },

    uploadImage: {
      formats: [],
      aspectRatioRange: null,
      minSize: null,
      maxFileSize: null,
      maxTotalPixels: null,
      maxCount: 0,
      inputMethods: [],
    },

    outputImage: {
      defaultSize: '1024×1024',
      pixelRange: null,
      aspectRatioRange: [1/4, 4],
    },

    resolutions: {
      '1K': [
        { ratio: '1:1', width: 1024, height: 1024 },
        { ratio: '3:4', width: 896, height: 1152 },
        { ratio: '4:3', width: 1152, height: 896 },
        { ratio: '16:9', width: 1344, height: 768 },
        { ratio: '9:16', width: 768, height: 1344 },
      ],
      '2K': null,
      '3K': null,
      '4K': null,
    },

    features: {
      multiImageInput: false,
      imageFusion: false,
      maxImagesTotal: 4,
      visualCoT: false,
      outpainting: false,
    },

    defaults: {
      ratio: '16:9',
      resolution: '1K',
      count: '1张',
    },
  },

  'midjourney-v7': {
    id: 'midjourney-v7',
    name: 'Midjourney v7',
    displayName: 'Midjourney v7',
    category: ['text-to-image', 'image-to-image'],

    promptLimit: {
      chinese: null,
      english: 1500,
    },

    uploadImage: {
      formats: ['jpeg', 'png', 'gif', 'webp'],
      aspectRatioRange: null,
      minSize: null,
      maxFileSize: 25,
      maxTotalPixels: null,
      maxCount: 5,
      inputMethods: ['url'],
    },

    outputImage: {
      defaultSize: '2048×2048',
      pixelRange: null,
      aspectRatioRange: [1/3, 3],
    },

    resolutions: {
      '1K': [
        { ratio: '1:1', width: 1024, height: 1024 },
        { ratio: '3:2', width: 1248, height: 832 },
        { ratio: '2:3', width: 832, height: 1248 },
        { ratio: '16:9', width: 1408, height: 800 },
        { ratio: '9:16', width: 800, height: 1408 },
        { ratio: '7:4', width: 1344, height: 768 },
        { ratio: '4:7', width: 768, height: 1344 },
      ],
      '2K': [
        { ratio: '1:1', width: 2048, height: 2048 },
        { ratio: '3:2', width: 2496, height: 1664 },
        { ratio: '2:3', width: 1664, height: 2496 },
        { ratio: '16:9', width: 2848, height: 1600 },
        { ratio: '9:16', width: 1600, height: 2848 },
        { ratio: '7:4', width: 2688, height: 1536 },
        { ratio: '4:7', width: 1536, height: 2688 },
      ],
      '3K': null,
      '4K': null,
    },

    features: {
      multiImageInput: true,
      imageFusion: true,
      maxImagesTotal: 4,
      visualCoT: false,
      outpainting: false,
    },

    defaults: {
      ratio: '16:9',
      resolution: '2K',
      count: '1张',
    },
  },
};
