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

export type Manifest = {
    inputfile: InputData;
    png: LosslessImgData;
    jpegs: Record<string, LossyImgData>;
    webps: Record<string, LossyImgData>;
};
