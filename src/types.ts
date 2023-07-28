export interface IRedisValue {
  filename: string;
  filetype: string;
  buffer: string;
}

export const allowedFormats = ['webp', 'jpeg', 'png', 'webp-nearlossless'] as const;
export type Format = (typeof allowedFormats)[number];

export interface IFileInfo {
  filename: string;
  filesize: number;
  quality?: number;
}
