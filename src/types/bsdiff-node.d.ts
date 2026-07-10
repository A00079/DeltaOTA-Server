declare module "bsdiff-node" {
  interface BsDiff {
    diff(oldFile: string, newFile: string, patchFile: string): Promise<void>;
    patch(oldFile: string, patchFile: string, newFile: string): Promise<void>;
  }
  const bsdiff: BsDiff;
  export default bsdiff;
}
