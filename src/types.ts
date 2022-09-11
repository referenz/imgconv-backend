interface IFileInfo {
  filename: string;
  filesize: number;
}
export type InputData = IFileInfo & {
  filetype: string;
};

export type LossyImgData = IFileInfo & {
  quality: number;
};

export type LosslessImgData = IFileInfo;

export type Manifest = Record<string, IFileInfo | InputData | LossyImgData>;
