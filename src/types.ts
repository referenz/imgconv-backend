export interface Upload {
  filename: string
  filetype: string
  filesize: number
  binary: Buffer
}

export const allowedFormats = ['webp', 'jpeg', 'png', 'webp-nearlossless'] as const
export type Format = (typeof allowedFormats)[number]
